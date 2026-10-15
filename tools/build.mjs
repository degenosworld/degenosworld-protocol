import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderPage, publicRegister } from './render.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.resolve(process.env.OUT_DIR || path.join(root, 'dist'));
const regPath = path.resolve(process.env.REGISTER_PATH || path.join(root, 'src', 'register.json'));
const register = JSON.parse(fs.readFileSync(regPath, 'utf8'));
const src = path.join(root, 'src');

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(path.join(out, 'js'), { recursive: true });
fs.mkdirSync(path.join(out, 'assets'), { recursive: true });

const tokens = fs.readFileSync(path.join(src, 'tokens.css'), 'utf8');

const html = renderPage(fs.readFileSync(path.join(src, 'index.template.html'), 'utf8'), register);
fs.writeFileSync(path.join(out, 'index.html'), html);
for (const f of ['tokens.css', 'styles.css']) fs.copyFileSync(path.join(src, f), path.join(out, f));
for (const f of fs.readdirSync(path.join(src, 'js'))) fs.copyFileSync(path.join(src, 'js', f), path.join(out, 'js', f));
fs.copyFileSync(path.join(src, 'assets', 'favicon.svg'), path.join(out, 'favicon.svg'));
for (const f of ['apple-touch-icon.png', 'mark-96.png', 'mark-512.png']) fs.copyFileSync(path.join(src, 'assets', f), path.join(out, 'assets', f));
fs.writeFileSync(path.join(out, 'register.json'), JSON.stringify(publicRegister(register), null, 2));
fs.writeFileSync(path.join(out, '_headers'), '/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n');
console.log('build ok ->', out);
