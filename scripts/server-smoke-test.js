const http = require('http');
const assert = require('assert/strict');
const { createServer } = require('../server');

function request(port, pathname, method = 'GET') {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: '127.0.0.1',
      port,
      path: pathname,
      method,
    }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: Buffer.concat(chunks).toString('utf8'),
        });
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function run() {
  const server = createServer();

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });

  const address = server.address();
  assert.equal(typeof address, 'object');
  const port = address.port;

  try {
    const root = await request(port, '/');
    assert.equal(root.status, 200);
    assert.match(root.body, /Opening Animation Ideas/);
    assert.match(root.headers['content-type'], /^text\/html/);

    const head = await request(port, '/', 'HEAD');
    assert.equal(head.status, 200);
    assert.equal(head.body, '');
    assert.ok(Number(head.headers['content-length']) > 0);

    const missing = await request(port, '/missing-animation.html');
    assert.equal(missing.status, 404);

    const unsupported = await request(port, '/', 'POST');
    assert.equal(unsupported.status, 405);
    assert.equal(unsupported.headers.allow, 'GET, HEAD');

    const malformed = await request(port, '/%E0%A4%A');
    assert.equal(malformed.status, 400);

    const traversal = await request(port, '/..%2Fpackage.json');
    assert.equal(traversal.status, 403);

    const nullByte = await request(port, '/%00x');
    assert.equal(nullByte.status, 400);

    const stillAlive = await request(port, '/');
    assert.equal(stillAlive.status, 200);

    console.log('Server smoke tests passed.');
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
