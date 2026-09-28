import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkPackage, findExternalUrls, measure } from '../../tools/check-size.mjs';

async function packageDir(t, files) {
  const dir = await mkdtemp(join(tmpdir(), 'kaffee-size-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  for (const [name, content] of Object.entries(files)) {
    await mkdir(join(dir, name, '..'), { recursive: true });
    await writeFile(join(dir, name), content);
  }
  return dir;
}

test('measure sums all files, including nested ones', async (t) => {
  const dir = await packageDir(t, { 'a.txt': '12345', 'sub/b.txt': '123' });
  const { total, files } = await measure(dir);
  assert.equal(total, 8);
  assert.equal(files.length, 2);
});

test('size check passes below the limit and fails at or above it', async (t) => {
  const dir = await packageDir(t, { 'index.html': 'x'.repeat(10) });
  assert.equal((await checkPackage(dir, { limit: 11 })).sizeOk, true);
  assert.equal((await checkPackage(dir, { limit: 10 })).sizeOk, false);
  assert.equal((await checkPackage(dir, { limit: 5 })).sizeOk, false);
});

test('external URLs are reported', async (t) => {
  const dir = await packageDir(t, {
    'src/a.js': "fetch('https://example.com/data.json');",
    'index.html': '<script src="//cdn.example.com/lib.js"></script>',
    'style.css': 'body { background: url(http://example.org/bg.png); }',
  });
  const urls = (await findExternalUrls(dir)).map((finding) => finding.url).sort();
  assert.deepEqual(urls, ['//cdn.example.com/lib.js', 'http://example.org/bg.png', 'https://example.com/data.json']);
  assert.equal((await checkPackage(dir)).urlsOk, false);
});

test('other schemes, escaped URLs and URLs in odd places are reported too', async (t) => {
  const dir = await packageDir(t, {
    'src/socket.js': "new WebSocket('wss://live.example.com/feed'); const plain = 'ws://plain.example.com';",
    'src/data.json': '{"logo": "https:\\/\\/img.example.com\\/logo.png", "query": "%22https://q.example.com/"}',
    'files.txt': 'ftp://files.example.com/a.zip',
    'index.html': '<img srcset="a.png 1x,//cdn.example.com/b.png 2x">',
    'start.js': '//cdn.example.com/at-file-start.js',
  });
  const urls = (await findExternalUrls(dir)).map((finding) => finding.url).sort();
  const expected = [
    'wss://live.example.com/feed',
    'ws://plain.example.com',
    'https:\\/\\/img.example.com',
    'https://q.example.com/',
    'ftp://files.example.com/a.zip',
    '//cdn.example.com/b.png',
    '//cdn.example.com/at-file-start.js',
  ];
  assert.deepEqual(urls, expected.sort());
});

test('allowed URLs match by origin and path, not as text prefix', async (t) => {
  const dir = await packageDir(t, {
    'src/sdk.js': "load('https://sdk.example.com/v3.js'); load('https://sdk.example.com.evil.test/x.js'); load('https://sdk.example.company/y.js');",
  });
  const urls = (await findExternalUrls(dir, ['https://sdk.example.com'])).map((finding) => finding.url).sort();
  assert.deepEqual(urls, ['https://sdk.example.com.evil.test/x.js', 'https://sdk.example.company/y.js']);
});

test('a symlink in a package fails the check', async (t) => {
  const dir = await packageDir(t, { 'real.txt': 'x' });
  await symlink(join(dir, 'real.txt'), join(dir, 'link.txt'));
  await assert.rejects(checkPackage(dir), /symbolic links/);
});

test('XML namespaces, allowed prefixes, relative paths and binary files are ignored', async (t) => {
  const dir = await packageDir(t, {
    'icon.svg':
      '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape"></svg>',
    'formula.html': '<math xmlns="http://www.w3.org/1998/Math/MathML"></math>',
    'src/sdk.js': "const sdk = 'https://sdk.example.com/v1.js'; // loads the ad SDK",
    'index.html': '<script type="module" src="src/main.js"></script><link rel="icon" href="data:,">',
    'image.png': 'https://example.com/not-scanned',
  });
  assert.deepEqual(await findExternalUrls(dir, ['https://sdk.example.com/']), []);
});
