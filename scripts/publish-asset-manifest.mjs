import { copyFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const buildDirectory = resolve('dist', 'client');

await copyFile(
  resolve(buildDirectory, '.vite', 'manifest.json'),
  resolve(buildDirectory, 'asset-manifest.json'),
);

console.log('Published the offline asset manifest.');
