import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { lstat, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
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

test('symlinked files are copied as files, not as links', async (t) => {
  const root = await tempDir(t);
  const outside = await tempDir(t);
  await writeFile(join(outside, 'shared.js'), 'export const shared = 1;');
  await mkdir(join(root, 'config'));
  await writeFile(join(root, 'config', 'targets.json'), JSON.stringify({ demo: { runtime: { theme: 'demo' } } }));
  await writeFile(join(root, 'index.html'), '<!doctype html>');
  await mkdir(join(root, 'src', 'ads'), { recursive: true });
  await writeFile(join(root, 'src', 'ads', 'index.js'), '');
  await writeFile(join(root, 'src', 'ads', 'none.js'), '');
  await symlink(join(outside, 'shared.js'), join(root, 'src', 'shared.js'));
  await mkdir(join(root, 'themes', 'demo'), { recursive: true });

  const [dir] = await build({ root });
  const copied = join(dir, 'src', 'shared.js');
  assert.equal((await lstat(copied)).isSymbolicLink(), false);
  assert.equal(await readFile(copied, 'utf8'), 'export const shared = 1;');
  await listFiles(dir); // throws on links
});

test('the tools also run when called through a symlinked path', async (t) => {
  const dir = await tempDir(t);
  const linked = join(dir, 'repo');
  await symlink(ROOT, linked);
  const run = (tool, ...args) => spawnSync(process.execPath, [join(linked, 'tools', tool), ...args], { encoding: 'utf8' });

  const size = run('check-size.mjs', 'no-such-target');
  assert.equal(size.status, 1); // before, nothing ran and the check "passed"
  assert.match(size.stderr, /Unknown target/);
  assert.match(run('simulate.mjs').stdout, /Result: /);
});
