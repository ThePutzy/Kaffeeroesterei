// Checks every built package in dist/:
// - the total size must stay below SIZE_LIMIT_BYTES (start package under 2 MB),
// - shipped text files must not reference external URLs, except the
//   target's allowedUrls from config/targets.json (no external requests).
// Usage: node tools/check-size.mjs [target ...]   (default: all targets)
import { readdir, readFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT, loadTargets } from './build.mjs';

export const SIZE_LIMIT_BYTES = 2_000_000;

// XML namespace identifiers look like URLs but are never fetched.
const NAMESPACE_URLS = new Set([
  'http://www.w3.org/2000/svg',
  'http://www.w3.org/1999/xlink',
  'http://www.w3.org/1999/xhtml',
  'http://www.w3.org/XML/1998/namespace',
]);

const TEXT_EXTENSIONS = new Set(['.html', '.js', '.mjs', '.css', '.json', '.svg', '.txt', '.xml', '.webmanifest']);

// Absolute http(s) URLs, plus protocol-relative ones such as src="//cdn.example.com/x.js".
const URL_PATTERN = /\bhttps?:\/\/[^\s"'`<>()\\]+|(?<=["'`(=\s])\/\/[a-z0-9-]+(?:\.[a-z0-9-]+)+[^\s"'`<>()\\]*/gi;

export async function listFiles(dir) {
  const entries = await readdir(dir, { recursive: true, withFileTypes: true });
  return entries.filter((entry) => entry.isFile()).map((entry) => join(entry.parentPath, entry.name));
}

export async function measure(dir) {
  const files = [];
  let total = 0;
  for (const file of await listFiles(dir)) {
    const { size } = await stat(file);
    total += size;
    files.push({ file: relative(dir, file), size });
  }
  files.sort((a, b) => b.size - a.size);
  return { total, files };
}

export async function findExternalUrls(dir, allowedUrls = []) {
  const findings = [];
  for (const file of await listFiles(dir)) {
    if (!TEXT_EXTENSIONS.has(extname(file).toLowerCase())) continue;
    const text = await readFile(file, 'utf8');
    for (const [url] of text.matchAll(URL_PATTERN)) {
      if (NAMESPACE_URLS.has(url)) continue;
      if (allowedUrls.some((prefix) => url.startsWith(prefix))) continue;
      findings.push({ file: relative(dir, file), url });
    }
  }
  return findings;
}

export async function checkPackage(dir, { limit = SIZE_LIMIT_BYTES, allowedUrls = [] } = {}) {
  const { total, files } = await measure(dir);
  const urls = await findExternalUrls(dir, allowedUrls);
  return { total, files, urls, limit, sizeOk: total < limit, urlsOk: urls.length === 0 };
}

function formatBytes(bytes) {
  return `${bytes.toLocaleString('en-US')} bytes`;
}

async function main(names) {
  const targets = await loadTargets();
  const selected = names.length > 0 ? names : Object.keys(targets);
  let ok = true;
  for (const name of selected) {
    if (!Object.hasOwn(targets, name)) throw new Error(`Unknown target: "${name}"`);
    const dir = join(ROOT, 'dist', name);
    if (!existsSync(dir)) throw new Error(`dist/${name} not found, run "npm run build" first`);

    const result = await checkPackage(dir, { allowedUrls: targets[name].allowedUrls ?? [] });
    const percent = ((result.total / result.limit) * 100).toFixed(1);
    console.log(
      `${result.sizeOk ? 'OK  ' : 'FAIL'} ${name}: ${formatBytes(result.total)} in ${result.files.length} files ` +
        `(${percent}% of ${formatBytes(result.limit)})`,
    );
    for (const { file, size } of result.files.slice(0, 5)) {
      console.log(`       ${formatBytes(size).padStart(15)}  ${file}`);
    }
    if (result.urlsOk) {
      console.log(`OK   ${name}: no external URLs`);
    } else {
      console.log(`FAIL ${name}: external URLs found`);
      for (const { file, url } of result.urls) console.log(`       ${file}: ${url}`);
    }
    ok &&= result.sizeOk && result.urlsOk;
  }
  return ok;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (!(await main(process.argv.slice(2)))) process.exit(1);
  } catch (error) {
    console.error(`check failed: ${error.message}`);
    process.exit(1);
  }
}
