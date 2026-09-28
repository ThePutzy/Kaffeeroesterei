import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createStaticServer } from '../../tools/serve.mjs';

async function startServer(t) {
  const parent = await mkdtemp(join(tmpdir(), 'kaffee-serve-'));
  t.after(() => rm(parent, { recursive: true, force: true }));
  const root = join(parent, 'root');
  await mkdir(join(root, 'pkg'), { recursive: true });
  await writeFile(join(root, 'index.html'), '<!doctype html><title>root</title>');
  await writeFile(join(root, 'app.js'), 'export {};');
  await writeFile(join(root, 'pkg', 'index.html'), '<!doctype html><title>pkg</title>');
  await writeFile(join(parent, 'secret.txt'), 'outside the served root');

  const server = createStaticServer({ root });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  return `http://127.0.0.1:${server.address().port}`;
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
