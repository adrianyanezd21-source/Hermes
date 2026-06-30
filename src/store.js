// Almacenamiento ligero basado en ficheros JSON (sin dependencias nativas).
import fs from 'node:fs';
import path from 'node:path';
import config from './config.js';

function ensureDir() {
  if (!fs.existsSync(config.dataDir)) {
    fs.mkdirSync(config.dataDir, { recursive: true });
  }
}

function file(name) {
  return path.join(config.dataDir, `${name}.json`);
}

export function read(name, fallback) {
  ensureDir();
  try {
    const raw = fs.readFileSync(file(name), 'utf8');
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function write(name, data) {
  ensureDir();
  const tmp = file(name) + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, file(name));
  return data;
}

export function update(name, fallback, mutator) {
  const current = read(name, fallback);
  const next = mutator(current) ?? current;
  write(name, next);
  return next;
}

export default { read, write, update };
