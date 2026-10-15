// Pure render helpers shared by the build and the gates.
const X_PATH = 'M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z';
const GH_PATH = 'M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z';
const ICONS = {
  x: `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="${X_PATH}"/></svg>`,
  github: `<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="${GH_PATH}"/></svg>`,
};
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export const isStated = r => r && r.state === 'stated';
const B58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export function validate(register) {
  const errs = [];
  for (const [id, r] of Object.entries(register.records)) {
    if (!['stated', 'absent', 'unconfirmed'].includes(r.state)) errs.push(`${id}: bad state`);
    if (r.state !== 'stated' && ('value' in r || 'url' in r)) errs.push(`${id}: inert record carries value or url`);
    if (r.state === 'stated' && r.kind === 'address' && !B58.test(r.value || '')) errs.push(`${id}: stated address is not base58`);
    if (r.state === 'stated' && r.kind === 'link' && !/^https:\/\//.test(r.url || '')) errs.push(`${id}: stated link needs https url`);
  }
  return errs;
}

// handle derived from the stored url, never stored separately
export function handleOf(url) {
  try { const p = new URL(url).pathname.split('/').filter(Boolean); return p[0] ? '@' + p[0] : null; } catch { return null; }
}

export function renderCa(rec) {
  const st = rec.state;
  if (st === 'stated') {
    const v = esc(rec.value);
    return `<div class="ca" id="ca" data-state="stated"><div class="wrap ca-in"><span class="ca-label">${esc(rec.label)}</span><button class="ca-val" type="button" data-copy="${v}" aria-label="Copy contract address ${v}">${v}</button><button class="ca-btn" type="button" data-copy="${v}"><span data-copy-label>Copy</span></button><span class="sr" role="status" aria-live="polite" id="ca-live"></span></div></div>`;
  }
  return `<div class="ca" id="ca" data-state="${st}"><div class="wrap ca-in"><span class="ca-label">${esc(rec.label)}</span><span class="ca-val">pending</span></div></div>`;
}

export function renderSocial(id, rec) {
  const icon = ICONS[id];
  if (isStated(rec)) {
    const h = handleOf(rec.url);
    return `<a class="ico" href="${esc(rec.url)}" target="_blank" rel="noopener noreferrer" aria-label="${esc(rec.label)}${h ? ', ' + esc(h) : ''}" data-record="${id}" data-state="stated">${icon}</a>`;
  }
  return `<span class="ico inert" role="img" aria-label="${esc(rec.label)}, pending" data-record="${id}" data-state="${rec.state}">${icon}</span>`;
}

export function renderChips(register) {
  return '<div class="chips">' + ['launcher', 'docs', 'ca', 'x', 'github'].map(id => {
    const r = register.records[id];
    if (!r) return '';
    if (isStated(r) && r.url) return `<a class="chip" style="border-style:solid;color:var(--accent)" href="${esc(r.url)}" target="_blank" rel="noopener noreferrer">${esc(r.label)}</a>`;
    if (isStated(r)) return `<span class="chip" style="border-style:solid;color:var(--accent)">${esc(r.label)}: live</span>`;
    return `<span class="chip" data-record="${id}" data-state="${r.state}">${esc(r.label)} &middot; pending</span>`;
  }).join('') + '</div>';
}

// register as shipped: dates stay in src/register.json only, inert records carry no value or url
export function publicRegister(register) {
  const out = { records: {} };
  for (const [id, r] of Object.entries(register.records)) {
    const { checked, ...rest } = r;
    if (rest.state !== 'stated') { delete rest.value; delete rest.url; }
    out.records[id] = rest;
  }
  return out;
}

export function renderPage(tpl, register) {
  const errs = validate(register);
  if (errs.length) throw new Error('register invalid:\n' + errs.join('\n'));
  const R = register.records;
  const reg = JSON.stringify(publicRegister(register)).replace(/</g, '\u003c');
  return tpl
    .replace('%%REGISTER%%', () => reg)
    .replace('%%SOCIAL%%', () => renderSocial('x', R.x) + renderSocial('github', R.github))
    .replace('%%CA%%', () => renderCa(R.ca))
    .replace('%%CHIPS%%', () => renderChips(register));
}
