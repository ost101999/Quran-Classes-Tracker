// Zero-dependency local dev server with real-student auto-routing & live reload
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { getRealStudentPath } from './real-student.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const PORT = Number(process.env.PORT) || 5174;
const HOST = '127.0.0.1';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
};

const LIVE_RELOAD_SNIPPET = `
<script>
(() => {
  try {
    const es = new EventSource('/__events');
    es.addEventListener('reload', () => window.location.reload());
  } catch {}
})();
</script>`;

const sseClients = new Set();
let reloadTimer = null;

try {
  fs.watch(ROOT, (_event, filename) => {
    if (!filename) return;
    if (!/\.(html|js|css|json|svg|png)$/i.test(filename)) return;
    clearTimeout(reloadTimer);
    reloadTimer = setTimeout(() => {
      for (const client of sseClients) {
        client.write('event: reload\ndata: 1\n\n');
      }
    }, 120);
  });
} catch {
  // Ignore watch errors; manual refresh still works.
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${HOST}:${PORT}`);
  const pathname = decodeURIComponent(url.pathname);

  if (pathname === '/__health') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  if (pathname === '/__events') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    res.write(': connected\n\n');
    sseClients.add(res);
    req.on('close', () => sseClients.delete(res));
    return;
  }

  // Redirect bare root (or explicit /__real) directly to a live student from Firebase
  if ((pathname === '/' && !url.searchParams.has('student') && !url.searchParams.has('mushaf') && !url.searchParams.has('m')) || pathname === '/__real') {
    const realPath = await getRealStudentPath();
    if (realPath && realPath !== '/') {
      res.writeHead(302, { Location: realPath, 'Cache-Control': 'no-store' });
      res.end();
      return;
    }
  }

  const candidate = path.resolve(ROOT, `.${pathname}`);
  const insideRoot = candidate === ROOT || candidate.startsWith(ROOT + path.sep);
  if (insideRoot && pathname !== '/' && fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
    const ext = path.extname(candidate).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    fs.createReadStream(candidate).pipe(res);
    return;
  }

  const indexPath = path.join(ROOT, 'index.html');
  let html = fs.readFileSync(indexPath, 'utf8');
  const bodyCloseIndex = html.lastIndexOf('</body>');
  if (bodyCloseIndex !== -1) {
    html = `${html.slice(0, bodyCloseIndex)}${LIVE_RELOAD_SNIPPET}\n${html.slice(bodyCloseIndex)}`;
  } else {
    html += LIVE_RELOAD_SNIPPET;
  }
  res.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(html);
});

server.listen(PORT, HOST, () => {
  console.log(`Student Portal Live Preview running at http://localhost:${PORT}/`);
});
