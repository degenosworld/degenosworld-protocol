import { initReveal, initProgress, initParallax, initSpotlight } from './motion.js';
import { startMarket, copyText } from './market.js';

const reg = JSON.parse(document.getElementById('register').textContent).records;

// contract slot: wiring follows the rendered state, never a hard-coded one
document.querySelectorAll('#ca [data-copy]').forEach(btn => {
  btn.addEventListener('click', async () => {
    const v = btn.dataset.copy; if (!v) return;
    const ok = await copyText(v);
    const lbl = document.querySelector('#ca [data-copy-label]'), live = document.getElementById('ca-live');
    if (lbl) {
      lbl.textContent = ok ? 'Copied' : 'Press Ctrl+C'; lbl.parentElement.classList.toggle('done', ok);
      setTimeout(() => { lbl.textContent = 'Copy'; lbl.parentElement.classList.remove('done'); }, 1600);
    }
    if (live) live.textContent = ok ? 'Address copied' : 'Copy failed';
  });
});

initProgress();
initReveal();
initParallax();
initSpotlight();
startMarket(reg.market);
