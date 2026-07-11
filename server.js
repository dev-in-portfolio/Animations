const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname);
const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_PORT = 8081;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.mp3': 'audio/mpeg',
  '.svg': 'image/svg+xml; charset=utf-8',
};

function sendText(req, res, status, message, extraHeaders = {}) {
  const body = Buffer.from(message, 'utf8');
  res.writeHead(status, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Content-Length': body.length,
    'X-Content-Type-Options': 'nosniff',
    ...extraHeaders,
  });
  res.end(req.method === 'HEAD' ? undefined : body);
}

function createServer() {
  return http.createServer((req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      sendText(req, res, 405, 'Method Not Allowed', { Allow: 'GET, HEAD' });
      return;
    }

    let pathname;
    try {
      pathname = decodeURIComponent(new URL(req.url, `http://${DEFAULT_HOST}`).pathname);
    } catch {
      sendText(req, res, 400, 'Bad Request');
      return;
    }

    if (pathname.includes('\0')) {
      sendText(req, res, 400, 'Bad Request');
      return;
    }

    const relativePath = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
    const filePath = path.resolve(ROOT, relativePath);

    if (filePath !== ROOT && !filePath.startsWith(`${ROOT}${path.sep}`)) {
      sendText(req, res, 403, 'Forbidden');
      return;
    }

    try {
      fs.readFile(filePath, (error, data) => {
        if (error) {
          const notFound = error.code === 'ENOENT' || error.code === 'EISDIR';
          sendText(
            req,
            res,
            notFound ? 404 : 500,
            notFound ? 'Not Found' : 'Internal Server Error'
          );
          return;
        }

        const ext = path.extname(filePath).toLowerCase();
        res.writeHead(200, {
          'Content-Type': MIME[ext] || 'application/octet-stream',
          'Content-Length': data.length,
          'Cache-Control': 'no-cache',
          'X-Content-Type-Options': 'nosniff',
          'Referrer-Policy': 'no-referrer',
        });
        res.end(req.method === 'HEAD' ? undefined : data);
      });
    } catch {
      sendText(req, res, 400, 'Bad Request');
    }
  });
}

if (require.main === module) {
  const host = process.env.HOST || DEFAULT_HOST;
  const requestedPort = Number.parseInt(process.env.PORT || '', 10);
  const port = Number.isInteger(requestedPort) && requestedPort >= 0 && requestedPort <= 65535
    ? requestedPort
    : DEFAULT_PORT;

  const server = createServer();
  server.listen(port, host, () => {
    const address = server.address();
    const activePort = typeof address === 'object' && address ? address.port : port;
    console.log(`http://${host}:${activePort}`);
  });
}

module.exports = { createServer };
