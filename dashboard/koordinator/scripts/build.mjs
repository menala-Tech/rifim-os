// Salin kode PWA ke folder statis agar dapat dilayani tanpa bundler tambahan.
import { cp, mkdir } from 'node:fs/promises';

await mkdir('public/src', { recursive: true });
await cp('src', 'public/src', { recursive: true, force: true });
console.log('Kode PWA disalin ke public/src.');
