import { test } from 'node:test';
import assert from 'node:assert/strict';
import { request } from 'node:http';
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createStaticServer } from '../../tools/serve.mjs';

async function startServer(t, { allowedHosts = null } = {}) {
  const parent = await mkdtemp(join(tmpdir(), 'kaffee-serve-'));
  t.after(() => rm(parent, { recursive: true, force: true }));
  const root = join(parent, 'root');
  await mkdir(join(root, 'pkg'), { recursive: true });
  await writeFile(join(root, 'index.html'), '<!doctype html><title>root</title>');
  await writeFile(join(root, 'app.js'), 'export {};');
  await writeFile(join(root, 'pkg', 'index.html'), '<!doctype html><title>pkg</title>');
  await writeFile(join(parent, 'secret.txt'), 'outside the served root');
  await mkdir(join(root, '.git'));
  await writeFile(join(root, '.git', 'config'), 'private');
  await mkdir(join(root, 'node_modules'));
  await writeFile(join(root, 'node_modules', 'dep.js'), 'private');
  await symlink(join(parent, 'secret.txt'), join(root, 'link.txt'));

  const server = createStaticServer({ root, allowedHosts });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const { port } = server.address();
  allowedHosts?.push(`127.0.0.1:${port}`);
  return `http://127.0.0.1:${port}`;
}

function getWithHost(base, path, host) {
  return new Promise((resolve, reject) => {
    const req = request(`${base}${path}`, { headers: { Host: host } }, (res) => {
      res.resume();
      resolve(res.statusCode);
    });
    req.on('error', reject);
    req.end();
  });
}

test('serves files with MIME types browsers accept for ES modules', async (t) => {
  const base = await startServer(t);
  const js = await fetch(`${base}/app.js`);
  assert.equal(js.status, 200);
  assert.match(js.headers.get('content-type'), /^text\/javascript/);

  const html = await fetch(`${base}/`);
  assert.equal(html.status, 200);
  assert.match(html.headers.get('content-type'), /^text\/html/);
  assert.match(await html.text(), /<title>root<\/title>/);
});

test('redirects directories to a trailing slash so relative paths resolve', async (t) => {
  const base = await startServer(t);
  const res = await fetch(`${base}/pkg`, { redirect: 'manual' });
  assert.equal(res.status, 301);
  assert.equal(res.headers.get('location'), '/pkg/');
  assert.match(await (await fetch(`${base}/pkg/`)).text(), /<title>pkg<\/title>/);
});

test('answers 404 for missing files and never serves files outside the root', async (t) => {
  const base = await startServer(t);
  assert.equal((await fetch(`${base}/missing.js`)).status, 404);

  const escaped = await fetch(`${base}/..%2fsecret.txt`);
  assert.equal(escaped.status, 403);
  assert.doesNotMatch(await escaped.text(), /outside the served root/);
});

test('hidden files, node_modules and symlinks out of the root are never served', async (t) => {
  const base = await startServer(t);
  assert.equal((await fetch(`${base}/.git/config`)).status, 404);
  assert.equal((await fetch(`${base}/%2egit/config`)).status, 404);
  assert.equal((await fetch(`${base}/pkg%5c..%5c.git/config`)).status, 404);
  assert.equal((await fetch(`${base}/node_modules/dep.js`)).status, 404);
  const linked = await fetch(`${base}/link.txt`);
  assert.equal(linked.status, 403);
  assert.doesNotMatch(await linked.text(), /outside the served root/);
});

test('with allowed hosts, other host names are refused (DNS rebinding)', async (t) => {
  const base = await startServer(t, { allowedHosts: [] });
  assert.equal((await fetch(`${base}/index.html`)).status, 200);
  assert.equal(await getWithHost(base, '/index.html', 'rebind.attacker.example'), 403);
});
