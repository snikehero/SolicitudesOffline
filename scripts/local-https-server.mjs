import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:https';
import { networkInterfaces } from 'node:os';
import { extname, resolve, sep } from 'node:path';

const projectDirectory = resolve(import.meta.dirname, '..');
const publicDirectory = resolve(projectDirectory, 'dist', 'client');
const certificateDirectory = resolve(projectDirectory, '.local-certs');
const port = Number.parseInt(process.env.TDCON_PORT || '8443', 10);

const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.wasm': 'application/wasm',
  '.webmanifest': 'application/manifest+json',
};

const keyPath = resolve(certificateDirectory, 'server.key');
const certificatePath = resolve(certificateDirectory, 'server-chain.crt');
const ipPath = resolve(certificateDirectory, 'lan-ip.txt');

if (!existsSync(keyPath) || !existsSync(certificatePath)) {
  console.error('Local HTTPS certificates are missing. Run: npm run local:setup');
  process.exit(1);
}

if (!existsSync(resolve(publicDirectory, 'index.html'))) {
  console.error('The application build is missing. Run: npm run build');
  process.exit(1);
}

function resolvePublicFile(pathname) {
  const decodedPath = decodeURIComponent(pathname);
  const requestedPath = decodedPath === '/' ? 'index.html' : decodedPath.replace(/^\/+/, '');
  const candidate = resolve(publicDirectory, requestedPath);
  const publicPrefix = `${publicDirectory}${sep}`;
  if (candidate !== publicDirectory && !candidate.startsWith(publicPrefix)) return null;
  if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  return resolve(publicDirectory, 'index.html');
}

const server = createServer(
  {
    key: readFileSync(keyPath),
    cert: readFileSync(certificatePath),
  },
  (request, response) => {
    try {
      if (!['GET', 'HEAD'].includes(request.method || 'GET')) {
        response.writeHead(405, { Allow: 'GET, HEAD' }).end('Method Not Allowed');
        return;
      }
      const url = new URL(request.url || '/', 'https://localhost');
      const filePath = resolvePublicFile(url.pathname);
      if (!filePath) {
        response.writeHead(403).end('Forbidden');
        return;
      }
      const extension = extname(filePath).toLowerCase();
      response.writeHead(200, {
        'Content-Type': mimeTypes[extension] || 'application/octet-stream',
        'Cache-Control': url.pathname === '/sw.js' ? 'no-cache' : 'no-cache, must-revalidate',
        'X-Content-Type-Options': 'nosniff',
      });
      if (request.method === 'HEAD') {
        response.end();
        return;
      }
      createReadStream(filePath).pipe(response);
    } catch {
      response.writeHead(400).end('Bad Request');
    }
  },
);

const lanIp = existsSync(ipPath) ? readFileSync(ipPath, 'utf8').trim() : 'localhost';
const activeAddresses = Object.values(networkInterfaces())
  .flat()
  .filter((address) => address?.family === 'IPv4' && !address.internal)
  .map((address) => address.address);

if (lanIp !== 'localhost' && !activeAddresses.includes(lanIp)) {
  console.error(`The certificate belongs to ${lanIp}, but that address is not active.`);
  console.error('Reserve a fixed IP or run npm run local:setup again for the new address.');
  process.exit(1);
}

server.listen(port, '0.0.0.0', () => {
  console.log(`Solicitudes TDCON is available at https://${lanIp}:${port}`);
  console.log('Keep this window open only during installation or application updates.');
});
