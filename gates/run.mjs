import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { validate, renderCa, renderSocial, handleOf } from '../tools/render.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const walk = (d, o = []) => { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, f.name); f.isDirectory() ? walk(p, o) : o.push(p); } return o; };
let n = 0, failed = 0;
const gate = (name, fn) => {
  n++;
  try { const r = fn(); if (r === false) throw new Error('returned false'); console.log(`PASS ${String(n).padStart(2, '0')} ${name}`); }
  catch (e) { failed++; console.log(`FAIL ${String(n).padStart(2, '0')} ${name}\n     ${String(e.message).split('\n').join('\n     ')}`); }
};
const assert = (c, m) => { if (!c) throw new Error(m); };

// ---- builds: base (register as shipped) and mutated (anchors read the current record at runtime)
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'degenos-gates-'));
const build = (out, regPath) => execFileSync(process.execPath, [path.join(root, 'tools/build.mjs')], { env: { ...process.env, OUT_DIR: out, REGISTER_PATH: regPath }, stdio: 'pipe' });
const baseReg = JSON.parse(read('src/register.json'));
const baseOut = path.join(tmp, 'base');
build(baseOut, path.join(root, 'src/register.json'));

const TEST_CA = 'DeGenTestAddr' + 'A1b2C3d4E5f6G7h8J9kLmNpQrStUv'.slice(0, 31); // 44 chars base58, test only
const mut = JSON.parse(JSON.stringify(baseReg));
const caNow = baseReg.records.ca;                    // read current record, do not assume state
mut.records.ca = { ...caNow, state: 'stated', value: TEST_CA };
for (const id of ['x', 'github']) { const r = baseReg.records[id]; mut.records[id] = { ...r, state: 'stated', url: `https://${id === 'x' ? 'x.com' : 'github.com'}/degenos-test` }; }
const mutReg = path.join(tmp, 'mut.json'); fs.writeFileSync(mutReg, JSON.stringify(mut));
const mutOut = path.join(tmp, 'mut');
build(mutOut, mutReg);

const dist = path.join(root, 'dist');
const distHtml = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
const baseHtml = fs.readFileSync(path.join(baseOut, 'index.html'), 'utf8');
const mutHtml = fs.readFileSync(path.join(mutOut, 'index.html'), 'utf8');
const distFiles = walk(dist);
const textFiles = distFiles.filter(f => /\.(html|css|js|json|svg)$|_headers$/.test(f));
const bodyText = html => html.replace(/<script[\s\S]*?<\/script>/g, ' ').replace(/<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&middot;/g, ' ').replace(/&mdash;/g, ' ').replace(/&amp;/g, '&');

gate('register: states valid, inert records carry no value or url', () => { const e = validate(baseReg); assert(!e.length, e.join('; ')); const m = validate(mut); assert(!m.length, m.join('; ')); });
gate('register: shipped register.json has no dates and no value/url on inert records', () => {
  const j = JSON.parse(fs.readFileSync(path.join(dist, 'register.json'), 'utf8'));
  for (const [id, r] of Object.entries(j.records)) { assert(!('checked' in r), id + ' ships a date'); if (r.state !== 'stated') assert(!('value' in r) && !('url' in r), id + ' inert carries data'); }
});
gate('dist: deploy output complete (index, css, js, favicon, assets)', () => {
  for (const f of ['index.html', 'styles.css', 'tokens.css', 'favicon.svg', 'js/main.js', 'js/market.js', 'js/motion.js', 'assets/mark-96.png', 'assets/apple-touch-icon.png']) assert(fs.existsSync(path.join(dist, f)), 'missing ' + f);
  assert(!fs.existsSync(path.join(dist, 'README.md')) && !fs.existsSync(path.join(dist, 'LICENSE')) && !fs.existsSync(path.join(dist, 'docs')), 'repo files leaked into dist');
});
gate('favicon: 32x32 SVG, no double hyphen anywhere, no XML comment', () => {
  const s = fs.readFileSync(path.join(dist, 'favicon.svg'), 'utf8');
  assert(/viewBox="0 0 32 32"/.test(s) && /width="32"/.test(s) && /height="32"/.test(s), 'not 32x32');
  assert(!s.includes('--') && !s.includes('<!--'), 'double hyphen or comment');
});
gate('no dates, clocks or recency strings in any shipped file', () => {
  const bad = [/\b(19|20)\d{2}[-\/.]\d{1,2}[-\/.]\d{1,2}\b/, /\b\d{1,2}[-\/.]\d{1,2}[-\/.](19|20)\d{2}\b/, /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.? \d{1,2}\b/i, /\b\d{1,2}:\d{2}(:\d{2})?\b/, /\bas of\b/i, /\bchecked\b/i, /\bago\b/i, /\b20[12]\d\b/, /\btoISOString|toLocale(Date|Time)String|new Date\b|Date\.now/];
  for (const f of textFiles) { if (f.endsWith('favicon.svg')) continue; const t = fs.readFileSync(f, 'utf8'); for (const re of bad) { const m = re.exec(t); assert(!m, `${path.relative(dist, f)}: ${m && m[0]}`); } }
});
gate('palette: colour literals live only in tokens.css', () => {
  for (const f of textFiles) {
    if (/tokens\.css$|favicon\.svg$/.test(f)) continue;
    const t = fs.readFileSync(f, 'utf8').replace(/&#\d+;|&#x[0-9a-f]+;/gi, '');
    const m = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/.exec(t);
    assert(!m, `${path.relative(dist, f)}: ${m && m[0]}`);
    assert(!/\b(rgb|rgba|hsl|hsla|oklch|oklab)\(/.test(t), `${path.relative(dist, f)}: functional colour literal`);
  }
});
gate('palette: every token is a real pixel of the supplied assets', () => { execFileSync('python', ['-I', path.join(root, 'gates/verify-palette.py')], { cwd: root, stdio: 'pipe' }); });
gate('css: no ch units', () => { for (const f of textFiles.filter(f => /\.(css|html)$/.test(f))) assert(!/[\d.]ch\b/.test(fs.readFileSync(f, 'utf8')), f); });
gate('motion: prefers-reduced-motion kills animation, transition, reveal', () => {
  const c = fs.readFileSync(path.join(dist, 'styles.css'), 'utf8'); const m = /@media \(prefers-reduced-motion:\s*reduce\)\{([\s\S]*)\}\s*$/.exec(c);
  assert(m && /animation:none!important/.test(m[1]) && /transition:none!important/.test(m[1]) && /\.rv\{opacity:1!important/.test(m[1]), 'css block incomplete');
  const j = fs.readFileSync(path.join(dist, 'js/motion.js'), 'utf8'); assert(/prefers-reduced-motion: reduce/.test(j) && (j.match(/reduced\(\)/g) || []).length >= 3, 'js ignores reduced motion');
});
gate('social: both icons render inert when absent, no href, at every breakpoint (no media hiding)', () => {
  for (const id of ['x', 'github']) {
    const rec = baseReg.records[id];
    const m = new RegExp(`<(a|span)[^>]*data-record="${id}"[^>]*>`).exec(baseHtml); assert(m, id + ' icon missing');
    if (rec.state !== 'stated') { assert(m[1] === 'span' && !/href=/.test(m[0]) && /pending/.test(m[0]), id + ' not inert'); }
  }
  const css = fs.readFileSync(path.join(dist, 'styles.css'), 'utf8'); assert(!/\.(social|ico)[^{]*\{[^}]*display:none/.test(css), 'social hidden by css');
  assert(/<div class="social"[^>]*>[\s\S]*<\/div>\s*<\/div>\s*<div class="ca"/.test(baseHtml), 'social not in header nav');
});
gate('social: stated branch emits real href and derived handle label', () => {
  for (const [id, host] of [['x', 'x.com'], ['github', 'github.com']]) {
    const m = new RegExp(`<a[^>]*data-record="${id}"[^>]*>`).exec(mutHtml); assert(m, id + ' link missing when stated');
    assert(m[0].includes(`href="https://${host}/degenos-test"`), id + ' href wrong'); assert(m[0].includes('@degenos-test'), id + ' handle not derived');
  }
  assert(handleOf('https://x.com/abc/status/1') === '@abc', 'handle derive');
});
gate('icons: official X mark and GitHub Octicon path data present', () => {
  assert(baseHtml.includes('M18.244 2.25h3.308l-7.227 8.26'), 'X mark'); assert(baseHtml.includes('M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59'), 'octicon');
});
gate('ca branch ABSENT: slot inert, label + pending only, nothing copyable', () => {
  const slot = /<div class="ca"[\s\S]*?<\/div><\/div>/.exec(baseHtml)[0];
  if (baseReg.records.ca.state === 'stated') return true;
  assert(/pending/.test(slot) && !/data-copy/.test(slot) && !/<button/.test(slot), 'absent slot not inert: ' + slot);
});
gate('ca branch STATED: full address rendered, click-to-copy wired, feedback region', () => {
  const slot = /<div class="ca"[\s\S]*?<\/div><\/div>/.exec(mutHtml)[0];
  assert(slot.includes(TEST_CA) && (slot.match(/data-copy="/g) || []).length === 2 && /aria-live/.test(slot), 'stated slot wrong');
  assert(/clipboard\.writeText/.test(fs.readFileSync(path.join(dist, 'js/market.js'), 'utf8')), 'no clipboard call');
  assert(/Copied/.test(fs.readFileSync(path.join(dist, 'js/main.js'), 'utf8')), 'no copy feedback');
});
gate('ca slot: sits inside sticky header, large type, break-all for full address', () => {
  assert(/<header class="top">[\s\S]*id="ca"[\s\S]*<\/header>/.test(baseHtml), 'slot not in header');
  const css = fs.readFileSync(path.join(dist, 'styles.css'), 'utf8'); assert(/\.top\{position:sticky/.test(css) && /\.ca-val\{[^}]*clamp\(13px,3\.4vw,24px\)[^}]*break-all/.test(css), 'css');
});
gate('address scanner: address-shaped strings match stated registry, 0x never blanket-rejected, CA exempt', () => {
  const scan = (html, reg) => {
    const stated = new Set(Object.values(reg.records).filter(r => r.state === 'stated' && r.value).map(r => r.value));
    const caVal = reg.records.ca.state === 'stated' ? reg.records.ca.value : null;
    const text = html.replace(/<script type="application\/json"[\s\S]*?<\/script>/, ' ').replace(/<img[^>]*>/g, ' ');
    const found = new Set([...text.matchAll(/\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/g)].map(m => m[0]).concat([...text.matchAll(/\b0x[0-9a-fA-F]{40}\b/g)].map(m => m[0])));
    return [...found].filter(a => a !== caVal && !stated.has(a));
  };
  assert(scan(baseHtml, baseReg).length === 0, 'stray address in base: ' + scan(baseHtml, baseReg));
  assert(scan(mutHtml, mut).length === 0, 'CA not exempt');
  const fake = baseHtml.replace('</footer>', '0x' + 'ab'.repeat(20) + '</footer>');
  assert(scan(fake, baseReg).length === 1, 'unregistered 0x not caught');
  const hexOnly = baseHtml.replace('</footer>', ' 0xdeadbeef </footer>'); assert(scan(hexOnly, baseReg).length === 0, '0x short hex wrongly rejected');
});
gate('market: independent of CA state (same module bytes, same market record, no ca reference)', () => {
  const h = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
  assert(h(path.join(baseOut, 'js/market.js')) === h(path.join(mutOut, 'js/market.js')), 'market.js differs');
  const jr = o => JSON.parse(fs.readFileSync(path.join(o, 'register.json'), 'utf8')).records.market;
  assert(JSON.stringify(jr(baseOut)) === JSON.stringify(jr(mutOut)), 'market record differs');
  const mk = fs.readFileSync(path.join(dist, 'js/market.js'), 'utf8'); assert(!/records\.ca|reg\.ca|#ca\b|data-copy="ca/.test(mk), 'market touches ca');
  const mj = fs.readFileSync(path.join(dist, 'js/main.js'), 'utf8'); assert(/startMarket\(reg\.market\)/.test(mj), 'market not wired to market record');
});
gate('market: spec behaviours present (source urls, solana filter, top 10, poll 60s, backoff, visibility, fallback tile)', () => {
  const r = JSON.parse(fs.readFileSync(path.join(dist, 'register.json'), 'utf8')).records.market;
  assert(r.url === 'https://api.dexscreener.com/token-boosts/top/v1' && r.pairs === 'https://api.dexscreener.com/tokens/v1/solana/', 'urls');
  const m = fs.readFileSync(path.join(dist, 'js/market.js'), 'utf8');
  for (const [re, w] of [[/chainId === 'solana'/, 'solana filter'], [/TOP_N = 10/, 'top 10'], [/POLL_MS = 60000/, '60s'], [/2 \*\* \(fails - 1\)/, 'exponential backoff'], [/visibilitychange/, 'visibility'], [/document\.hidden/, 'pause hidden'], [/im\.onerror = letter/, 'letter fallback'], [/imageUrl/, 'imageUrl'], [/volume && p\.volume\.h24/, 'h24 volume'], [/showing last good data/, 'last good kept']]) assert(re.test(m), w);
  assert(/class="tk-track"/.test(distHtml) && /40s linear/.test(fs.readFileSync(path.join(dist, 'styles.css'), 'utf8')), 'ticker');
});
gate('copy: zero shared word 2-grams with the reference copy', () => {
  const norm = s => s.toLowerCase().replace(/[^a-z0-9$%]+/g, ' ').trim().split(' ').filter(Boolean);
  const grams = w => { const o = new Set(); for (let i = 0; i < w.length - 1; i++) o.add(w[i] + ' ' + w[i + 1]); return o; };
  const ref = grams(norm(read('gates/reference-copy.txt')));
  const ours = [bodyText(distHtml), fs.readFileSync(path.join(dist, 'js/market.js'), 'utf8').match(/'[A-Z][^']{6,}'/g)?.join(' ') || ''].join(' ');
  const shared = [...grams(norm(ours))].filter(g => ref.has(g));
  assert(!shared.length, 'shared 2-grams: ' + shared.join(' | '));
});
gate('copy: reference-only words and platform numbers absent', () => {
  const t = bodyText(distHtml).toLowerCase();
  for (const w of ['memeos', 'meme os', 'pump.fun', 'meteora', 'pumpswap', 'sentinel', 'co-pilot', 'escrow']) assert(!t.includes(w), w);
  assert(!/\b(56|18|17|90%|10%|0\.5 sol)\b/.test(t), 'reference figure leaked');
});
gate('repo hygiene: no CLAUDE.md, no .claude dir, no AI attribution', () => {
  assert(!fs.existsSync(path.join(root, 'CLAUDE.md')) && !fs.existsSync(path.join(root, '.claude')), 'claude files');
  const skip = /node_modules|[\\/](brand|reference|dist)[\\/]|gates[\\/]run\.mjs$|gates[\\/]reference-copy|\.png$|\.jpe?g$|\.jpeg$/i;
  for (const f of walk(root)) { if (skip.test(f)) continue; const t = fs.readFileSync(f, 'utf8'); const m = /claude|anthropic|co-authored|generated (by|with)|\bAI\b|\bLLM\b/i.exec(t); assert(!m, `${path.relative(root, f)}: ${m && m[0]}`); }
  for (const f of distFiles) { if (/\.png$/.test(f)) continue; assert(!/claude|anthropic/i.test(fs.readFileSync(f, 'utf8')), f); }
});
gate('repo content: README, whitepaper, LICENSE present at root and MIT', () => {
  assert(fs.existsSync(path.join(root, 'README.md')) && fs.existsSync(path.join(root, 'docs/whitepaper.md')), 'docs');
  const l = read('LICENSE'); assert(/MIT License/.test(l) && /Copyright \(c\) 2026 DegenOS/.test(l), 'license');
});
gate('a11y: icon-only controls carry labels, tap-target css floor 44px', () => {
  const css = fs.readFileSync(path.join(dist, 'styles.css'), 'utf8');
  for (const sel of ['.ico{', '.cp{', '.ca-btn{', '.tab{', '.btn{']) assert(css.includes(sel), sel);
  assert(/\.ico\{width:44px;height:44px/.test(css) && /\.cp\{width:44px;height:44px/.test(css) && /\.tab\{min-height:44px/.test(css) && /\.btn\{[^}]*min-height:44px/.test(css), '44px floors');
  assert(!/<a[^>]*href="#"/.test(distHtml), 'dead href');
});

fs.rmSync(tmp, { recursive: true, force: true });
console.log(`\ngates: ${n - failed}/${n} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
