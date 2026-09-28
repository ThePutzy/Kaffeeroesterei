// Minimal static file server for development and browser tests.
// ES modules do not load from file://, so the game needs an HTTP server.
// Usage: node tools/serve.mjs [--root <dir>] [--port <n>] [--host <address>]
// It serves the repository folder, but never hidden files such as .git or
// node_modules, and nothing outside the folder, not even through symlinks.
import { createServer } from 'node:http';
import { createReadStream, realpathSync } from 'node:fs';
import { realpath, stat } from 'node:fs/promises';
import { extname, join, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

async function fileInfo(path) {
  try {
    return await stat(path);
  } catch {
    return null;
  }
}

function sendText(res, status, text) {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(text);
}

const isInside = (path, base) => path === base || path.startsWith(base + sep);

async function realPath(path) {
  try {
    return await realpath(path);
  } catch {
    return null;
  }
}

// allowedHosts: accepted Host headers, or null for any. On the loopback
// address this stops other websites from reading files via DNS rebinding.
export function createStaticServer({ root, allowedHosts = null }) {
  const base = resolve(root);
  const realBase = realpathSync(base);
  return createServer(async (req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      sendText(res, 405, 'Method not allowed');
      return;
    }
    if (allowedHosts && !allowedHosts.includes(req.headers.host)) {
      sendText(res, 403, 'Forbidden host');
      return;
    }
    let url;
    let path;
    let segments;
    try {
      url = new URL(req.url, 'http://localhost');
      const pathname = decodeURIComponent(url.pathname);
      segments = pathname.split(/[\\/]/).filter(Boolean); // also \ as on Windows
      path = resolve(base, `.${pathname}`);
    } catch {
      sendText(res, 400, 'Bad request');
      return;
    }
    if (!isInside(path, base)) {
      sendText(res, 403, 'Forbidden');
      return;
    }
    if (segments.some((segment) => segment.startsWith('.') || segment === 'node_modules')) {
      sendText(res, 404, 'Not found');
      return;
    }

    let info = await fileInfo(path);
    if (info?.isDirectory()) {
      // Relative paths inside a package only resolve against a trailing slash.
      if (!url.pathname.endsWith('/')) {
        res.writeHead(301, { Location: `${url.pathname}/${url.search}` });
        res.end();
        return;
      }
      path = join(path, 'index.html');
      info = await fileInfo(path);
    }
    if (!info?.isFile()) {
      sendText(res, 404, 'Not found');
      return;
    }
    const real = await realPath(path);
    if (!real || !isInside(real, realBase)) {
      sendText(res, 403, 'Forbidden');
      return;
    }

    res.writeHead(200, {
      'Content-Type': MIME_TYPES[extname(path).toLowerCase()] ?? 'application/octet-stream',
      'Content-Length': info.size,
      'Cache-Control': 'no-store',
    });
    if (req.method === 'HEAD') {
      res.end();
      return;
    }
    // A file removed between stat and read must not crash the server.
    createReadStream(path)
      .on('error', () => res.destroy())
      .pipe(res);
  });
}

// Run as a command, also when called through a symlinked path.
if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  const { values } = parseArgs({
    options: {
      root: { type: 'string', default: fileURLToPath(new URL('..', import.meta.url)) },
      port: { type: 'string', default: '8080' },
      host: { type: 'string', default: '127.0.0.1' },
    },
  });
  const root = resolve(values.root);
  const port = Number(values.port);
  const loopback = ['127.0.0.1', 'localhost', '::1'].includes(values.host);
  const allowedHosts = loopback ? [`127.0.0.1:${port}`, `localhost:${port}`, `[::1]:${port}`] : null;
  createStaticServer({ root, allowedHosts }).listen(port, values.host, () => {
    console.log(`Serving ${root} at http://${values.host}:${port}/`);
  });
}
