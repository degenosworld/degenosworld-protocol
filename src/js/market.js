import { tweenNumber, reduced } from './motion.js';

const POLL_MS = 60000, BACKOFF_BASE = 2000, BACKOFF_MAX = 60000, TOP_N = 10;
const nf = (n, d = 2) => n.toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: d });
export const fmtUsd = n => {
  if (!isFinite(n)) return '—';
  const a = Math.abs(n);
  if (a >= 1e9) return '$' + nf(n / 1e9) + 'B';
  if (a >= 1e6) return '$' + nf(n / 1e6) + 'M';
  if (a >= 1e3) return '$' + nf(n / 1e3) + 'K';
  return '$' + nf(n);
};
export const fmtPrice = n => {
  if (!isFinite(n)) return '—';
  if (n === 0) return '$0';
  if (n >= 1) return '$' + nf(n);
  const digits = Math.min(10, Math.max(4, 2 - Math.floor(Math.log10(n))));
  return '$' + n.toFixed(digits);
};
export const fmtPct = n => (isFinite(n) ? (n >= 0 ? '+' : '−') + nf(Math.abs(n)) + '%' : '—');

const COPY_ICON = '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="5" y="5" width="8" height="8"/><path d="M3 11V3h8"/></svg>';
const CHECK_ICON = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.5l3.2 3L13 4.5"/></svg>';

export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch (e) {
    const ta = document.createElement('textarea'); ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select(); let ok = false; try { ok = document.execCommand('copy'); } catch (e2) { ok = false; } ta.remove(); return ok;
  }
}

export function startMarket(rec) {
  const rowsEl = document.getElementById('rows');
  const tickerEl = document.getElementById('ticker');
  const pill = document.getElementById('status'), pillT = document.getElementById('status-t');
  const msg = document.getElementById('mk-msg');
  if (!rec || rec.state !== 'stated') {
    pill.dataset.s = 'err'; pillT.textContent = 'Feed pending'; msg.textContent = 'Market feed pending'; return;
  }
  let sort = 'vol', data = [], timer = 0, fails = 0, inflight = false, loadedOnce = false;
  const rowMap = new Map();

  const skeleton = () => {
    rowsEl.replaceChildren(...Array.from({ length: TOP_N }, () => {
      const r = document.createElement('div'); r.className = 'row';
      r.innerHTML = '<i class="sk sq"></i><span class="tok"><i class="sk" style="width:60%"></i></span><span class="stats"><i class="sk" style="width:70px"></i><i class="sk" style="width:60px"></i></span><span></span>';
      return r;
    }));
  };
  skeleton();

  const setStatus = (s, t) => { pill.dataset.s = s; pillT.textContent = t; };

  async function getJson(url) {
    const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), 12000);
    try { const r = await fetch(url, { signal: ctl.signal, headers: { accept: 'application/json' } }); if (!r.ok) throw new Error('http ' + r.status); return await r.json(); }
    finally { clearTimeout(to); }
  }

  async function load() {
    const boosts = await getJson(rec.url);
    const addrs = [...new Set((Array.isArray(boosts) ? boosts : []).filter(b => b && b.chainId === 'solana' && b.tokenAddress).map(b => b.tokenAddress))].slice(0, 30);
    if (!addrs.length) throw new Error('empty');
    const pairs = await getJson(rec.pairs + addrs.join(','));
    if (!Array.isArray(pairs)) throw new Error('shape');
    const best = new Map();
    for (const p of pairs) {
      if (!p || p.chainId !== 'solana' || !p.baseToken || !p.baseToken.address) continue;
      const a = p.baseToken.address, liq = +(p.liquidity && p.liquidity.usd) || 0;
      const cur = best.get(a);
      if (!cur || liq > cur.liq) best.set(a, { liq, p });
    }
    const list = [...best.values()].map(({ p, liq }) => ({
      addr: p.baseToken.address, sym: p.baseToken.symbol || '?', name: p.baseToken.name || '',
      img: p.info && typeof p.info.imageUrl === 'string' && /^https:\/\//.test(p.info.imageUrl) ? p.info.imageUrl : '',
      price: parseFloat(p.priceUsd), chg: +(p.priceChange && p.priceChange.h24), vol: +(p.volume && p.volume.h24) || 0, liq,
    }));
    list.sort((a, b) => b.vol - a.vol);
    if (!list.length) throw new Error('empty');
    return list.slice(0, TOP_N);
  }

  function tile(l) {
    const d = document.createElement('span'); d.className = 'logo'; d.setAttribute('aria-hidden', 'true');
    const letter = () => { d.replaceChildren(document.createTextNode((l.sym.replace(/^\$/, '')[0] || '?').toUpperCase())); };
    if (!l.img) letter(); else {
      const im = new Image(); im.alt = ''; im.referrerPolicy = 'no-referrer'; im.loading = 'lazy'; im.decoding = 'async';
      im.onerror = letter; im.src = l.img; d.appendChild(im);
    }
    return d;
  }

  function makeRow(l) {
    const r = document.createElement('div'); r.className = 'row fade-in'; r.dataset.addr = l.addr;
    const tok = document.createElement('span'); tok.className = 'tok';
    const b = document.createElement('b'); const s = document.createElement('small');
    tok.append(b, s);
    const cell = () => { const e = document.createElement('span'); e.className = 'num'; return e; };
    const st = document.createElement('span'); st.className = 'stats';
    const c = { price: cell(), chg: cell(), vol: cell(), liq: cell() };
    st.append(c.price, c.chg, c.vol, c.liq);
    const cp = document.createElement('button'); cp.type = 'button'; cp.className = 'cp'; cp.innerHTML = COPY_ICON; cp.setAttribute('aria-label', 'Copy address for ' + l.sym);
    cp.addEventListener('click', async () => {
      if (await copyText(l.addr)) { cp.classList.add('done'); cp.innerHTML = CHECK_ICON; setTimeout(() => { cp.classList.remove('done'); cp.innerHTML = COPY_ICON; }, 1400); }
    });
    r.append(tile(l), tok, st, cp);
    r._c = c; r._b = b; r._s = s;
    return r;
  }

  function paintRow(r, l) {
    r._b.textContent = l.sym; r._s.textContent = l.name;
    tweenNumber(r._c.price, l.price, fmtPrice);
    tweenNumber(r._c.vol, l.vol, fmtUsd);
    tweenNumber(r._c.liq, l.liq, fmtUsd);
    r._c.chg.className = 'num ' + (l.chg >= 0 ? 'up' : 'dn');
    tweenNumber(r._c.chg, l.chg, fmtPct);
  }

  function render() {
    const view = [...data].sort((a, b) => (isFinite(b[sort]) ? b[sort] : -Infinity) - (isFinite(a[sort]) ? a[sort] : -Infinity));
    if (!loadedOnce) { rowsEl.replaceChildren(); rowMap.clear(); }
    const frag = [];
    view.forEach((l, i) => {
      let r = rowMap.get(l.addr);
      if (!r) { r = makeRow(l); r.style.animationDelay = reduced() ? '0s' : (i * 50) + 'ms'; rowMap.set(l.addr, r); }
      paintRow(r, l); frag.push(r);
    });
    for (const [a, r] of rowMap) if (!view.some(v => v.addr === a)) { r.remove(); rowMap.delete(a); }
    rowsEl.replaceChildren(...frag);
    loadedOnce = true;
  }

  function stats() {
    const set = (k, v, f) => { const el = document.querySelector('[data-stat="' + k + '"]'); if (el) tweenNumber(el, v, f); };
    set('count', data.length, n => String(Math.round(n)));
    set('vol', data.reduce((s, l) => s + l.vol, 0), fmtUsd);
    set('liq', data.reduce((s, l) => s + l.liq, 0), fmtUsd);
    const top = [...data].filter(l => isFinite(l.chg)).sort((a, b) => b.chg - a.chg)[0];
    if (top) { set('best', top.chg, fmtPct); const n = document.querySelector('[data-stat="bestn"]'); if (n) n.textContent = top.sym; }
  }

  function ticker() {
    const mk = () => data.map(l => {
      const s = document.createElement('span');
      const a = document.createElement('b'); a.textContent = l.sym.startsWith('$') ? l.sym : '$' + l.sym;
      const p = document.createElement('span'); p.textContent = fmtPrice(l.price);
      const c = document.createElement('span'); c.className = l.chg >= 0 ? 'up' : 'dn'; c.textContent = (l.chg >= 0 ? '▲ ' : '▼ ') + fmtPct(l.chg);
      s.append(a, p, c); return s;
    });
    tickerEl.replaceChildren(...mk(), ...mk());
  }

  function ok() {
    fails = 0; setStatus('ok', 'Live');
    msg.textContent = data.length + ' tokens on the board';
    render(); stats(); ticker();
  }

  function fail() {
    fails++;
    if (data.length) { setStatus('err', 'Reconnecting'); msg.textContent = 'Feed error, showing last good data'; return; }
    setStatus('err', 'Feed error'); msg.textContent = 'Feed error, retrying';
    const r = document.createElement('div'); r.className = 'row'; r.style.gridTemplateColumns = '1fr'; r.textContent = '—  Market feed unreachable. Retrying.';
    rowsEl.replaceChildren(r);
    document.querySelectorAll('[data-stat]').forEach(e => { if (e.dataset.stat !== 'bestn') e.textContent = '—'; });
    const t = document.createElement('span'); t.textContent = '— feed error';
    tickerEl.replaceChildren(t);
  }

  async function tick() {
    clearTimeout(timer);
    if (document.hidden || inflight) return;
    inflight = true;
    try { data = await load(); ok(); } catch (e) { fail(); } finally { inflight = false; }
    const wait = fails ? Math.min(BACKOFF_MAX, BACKOFF_BASE * 2 ** (fails - 1)) : POLL_MS;
    if (!document.hidden) timer = setTimeout(tick, wait);
  }

  document.addEventListener('visibilitychange', () => { if (document.hidden) clearTimeout(timer); else tick(); });
  document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(x => x.setAttribute('aria-selected', String(x === t)));
    sort = t.dataset.sort; if (data.length) render();
  }));
  tick();
}
