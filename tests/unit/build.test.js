import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT, build, buildTarget, loadTargets } from '../../tools/build.mjs';
import { listFiles } from '../../tools/check-size.mjs';

async function tempDir(t) {
  const dir = await mkdtemp(join(tmpdir(), 'kaffee-build-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  return dir;
}

test('build creates one package per target with that target\'s config', async (t) => {
  const outDir = await tempDir(t);
  const targets = await loadTargets();
  await build({ outDir });

  for (const [name, target] of Object.entries(targets)) {
    const configUrl = pathToFileURL(join(outDir, name, 'src', 'config.js')).href;
    const { config } = await import(configUrl);
    assert.deepEqual(config, { target: name, ...target.runtime });
  }
});

test('packages contain only index.html, src/ and their own theme', async (t) => {
  const outDir = await tempDir(t);
  const targets = await loadTargets();
  await build({ outDir });

  for (const [name, target] of Object.entries(targets)) {
    const dir = join(outDir, name);
    const files = (await listFiles(dir)).map((file) => relative(dir, file).split(sep).join('/'));
    assert.ok(files.includes('index.html'), `${name}: index.html missing`);
    assert.ok(files.includes('src/main.js'), `${name}: src/main.js missing`);
    for (const file of files) {
      const allowed =
        file === 'index.html' || file.startsWith('src/') || file.startsWith(`themes/${target.runtime.theme}/`);
      assert.ok(allowed, `${name}: unexpected file ${file}`);
      assert.ok(!file.endsWith('.gitkeep'), `${name}: placeholder file ${file} shipped`);
    }
  }
});

test('each package ships only its own ads adapter', async (t) => {
  const outDir = await tempDir(t);
  const targets = await loadTargets();
  await build({ outDir });
  for (const [name, target] of Object.entries(targets)) {
    const dir = join(outDir, name, 'src', 'ads');
    const files = (await listFiles(dir)).map((file) => relative(dir, file)).sort();
    assert.deepEqual(files, [`${target.runtime.ads.adapter}.js`, 'index.js'].sort(), name);
  }
  await assert.rejects(buildTarget('bad', { runtime: { theme: 'kaffeeroesterei', ads: { adapter: 'nope' } } }, { outDir }), /adapter/);
});

test('build of selected targets only builds those', async (t) => {
  const outDir = await tempDir(t);
  const built = await build({ outDir, names: ['web'] });
  assert.deepEqual(built, [join(outDir, 'web')]);
});

test('unknown targets and unsafe theme names are rejected', async (t) => {
  const outDir = await tempDir(t);
  await assert.rejects(build({ outDir, names: ['nope'] }), /Unknown target/);
  await assert.rejects(buildTarget('bad', { runtime: { theme: '../src' } }, { outDir }), /invalid theme/);
  await assert.rejects(buildTarget('bad', { runtime: { theme: 'missing' } }, { outDir }), /not found/);
});

test('index.html only uses relative paths', async () => {
  const html = await readFile(join(ROOT, 'index.html'), 'utf8');
  const refs = [...html.matchAll(/\s(?:src|href)="([^"]*)"/g)].map((match) => match[1]);
  assert.ok(refs.length > 0);
  for (const ref of refs) {
    const isAbsolute = ref.startsWith('/') || (/^[a-z][a-z0-9+.-]*:/i.test(ref) && !ref.startsWith('data:'));
    assert.ok(!isAbsolute, `absolute path in index.html: ${ref}`);
  }
});
