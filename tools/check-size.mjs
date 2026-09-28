// Checks every built package in dist/:
// - the total size must stay below SIZE_LIMIT_BYTES (start package under 2 MB),
// - shipped text files must not reference external URLs, except the
//   target's allowedUrls from config/targets.json (no external requests).
// Usage: node tools/check-size.mjs [target ...]   (default: all targets)
import { readdir, readFile, stat } from 'node:fs/promises';
import { existsSync, realpathSync } from 'node:fs';
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

// Absolute URLs (http, https, ws, wss, ftp; also JSON-escaped as "https:\/\/…"),
// plus protocol-relative ones such as src="//cdn.example.com/x.js".
const URL_PATTERN =
  /(?:https?|wss?|ftp):(?:\\?\/){2}[^\s"'`<>()\\]+|(?<=^|[\s"'`(=,])\/\/[a-z0-9-]+(?:\.[a-z0-9-]+)+[^\s"'`<>()\\]*/gim;

// The value of an xmlns or xmlns:prefix attribute names a namespace.
const XMLNS_BEFORE = /xmlns(?::[\w.-]+)?\s*=\s*["']$/;

// A package holds plain files only; a symlink would point outside of it and
// escape both checks.
export async function listFiles(dir) {
  const entries = await readdir(dir, { recursive: true, withFileTypes: true });
  const links = entries.filter((entry) => entry.isSymbolicLink()).map((entry) => relative(dir, join(entry.parentPath, entry.name)));
  if (links.length > 0) throw new Error(`symbolic links in ${dir}: ${links.join(', ')}`);
  return entries.filter((entry) => entry.isFile()).map((entry) => join(entry.parentPath, entry.name));
}

// Allowed entries match by exact origin and path prefix, so an entry for
// https://sdk.example.com does not allow https://sdk.example.com.evil.test.
function isAllowed(url, allowedUrls) {
  let parsed;
  try {
    parsed = new URL(url.replaceAll('\\/', '/'), 'https://protocol-relative.invalid');
  } catch {
    return false;
  }
  return allowedUrls.some((entry) => {
    try {
      const allowed = new URL(entry);
      return parsed.origin === allowed.origin && parsed.pathname.startsWith(allowed.pathname);
    } catch {
      return false; // an unreadable entry allows nothing
    }
  });
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
    for (const { 0: url, index } of text.matchAll(URL_PATTERN)) {
      if (NAMESPACE_URLS.has(url) || XMLNS_BEFORE.test(text.slice(Math.max(0, index - 64), index))) continue;
      if (isAllowed(url, allowedUrls)) continue;
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

// Run as a command, also when called through a symlinked path.
if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  try {
    if (!(await main(process.argv.slice(2)))) process.exit(1);
  } catch (error) {
    console.error(`check failed: ${error.message}`);
    process.exit(1);
  }
}
