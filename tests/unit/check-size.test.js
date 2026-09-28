import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
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

test('XML namespaces, allowed prefixes, relative paths and binary files are ignored', async (t) => {
  const dir = await packageDir(t, {
    'icon.svg': '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"></svg>',
    'src/sdk.js': "const sdk = 'https://sdk.example.com/v1.js'; // loads the ad SDK",
    'index.html': '<script type="module" src="src/main.js"></script><link rel="icon" href="data:,">',
    'image.png': 'https://example.com/not-scanned',
  });
  assert.deepEqual(await findExternalUrls(dir, ['https://sdk.example.com/']), []);
});
