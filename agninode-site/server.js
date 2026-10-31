const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PUBLIC_DIR = fs.existsSync(path.join(__dirname, 'public'))
  ? path.join(__dirname, 'public')
  : path.join(__dirname, 'agninode-site', 'public');
const DEFAULT_PORT = parseInt(process.env.PORT, 10) || 3000;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.pdf': 'application/pdf',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.webmanifest': 'application/manifest+json',
  '.xml': 'application/xml',
  '.txt': 'text/plain; charset=utf-8',
};

function getSafeFilePath(baseDir, requestedPath) {
  const decodedPath = decodeURIComponent(requestedPath);
  const safeSuffix = path.normalize(decodedPath).replace(/^(\.\.[\/\\])+/, '');
  return path.join(baseDir, safeSuffix);
}

function serve404(res) {
  const notFoundPage = path.join(PUBLIC_DIR, '404.html');
  fs.readFile(notFoundPage, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found');
    } else {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(data);
    }
  });
}

function serveFile(req, res, filePath) {
  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      return serve404(res);
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    const totalSize = stats.size;

    // Handle Range requests for audio and video streaming
    const rangeHeader = req.headers.range;
    if (rangeHeader && (ext === '.mp4' || ext === '.webm')) {
      const parts = rangeHeader.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : totalSize - 1;

      if (isNaN(start) || start >= totalSize || (parts[1] && end >= totalSize) || start > end) {
        res.writeHead(416, {
          'Content-Range': `bytes */${totalSize}`,
        });
        return res.end();
      }

      const chunkSize = end - start + 1;
      const stream = fs.createReadStream(filePath, { start, end });
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${totalSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': contentType,
      });
      stream.pipe(res);
      return;
    }

    res.writeHead(200, {
      'Content-Length': totalSize,
      'Content-Type': contentType,
      'Accept-Ranges': 'bytes',
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=3600',
    });
    fs.createReadStream(filePath).pipe(res);
  });
}

const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url);
  let pathname = parsedUrl.pathname;

  if (pathname === '/') {
    pathname = '/index.html';
  }

  let filePath = getSafeFilePath(PUBLIC_DIR, pathname);

  fs.stat(filePath, (err, stats) => {
    if (!err && stats.isFile()) {
      return serveFile(req, res, filePath);
    }

    if (!err && stats.isDirectory()) {
      const indexPath = path.join(filePath, 'index.html');
      if (fs.existsSync(indexPath)) {
        return serveFile(req, res, indexPath);
      }
    }

    // Clean URLs support: try appending .html
    if (!path.extname(pathname)) {
      const htmlPath = filePath + '.html';
      if (fs.existsSync(htmlPath)) {
        return serveFile(req, res, htmlPath);
      }
    }

    return serve404(res);
  });
});

function startServer(port) {
  server.listen(port, () => {
    console.log(`\n========================================`);
    console.log(`  AgniNode Website is running!`);
    console.log(`  Local URL:  http://localhost:${port}`);
    console.log(`  Directory:  ${PUBLIC_DIR}`);
    console.log(`========================================\n`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`Port ${port} in use, trying port ${port + 1}...`);
      startServer(port + 1);
    } else {
      console.error('Server error:', err);
    }
  });
}

startServer(DEFAULT_PORT);
