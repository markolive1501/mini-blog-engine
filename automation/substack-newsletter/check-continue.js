const ws = require('ws');
const TARGET = 'EC2E01079798BBC0AA6B5FCA0534ABE2';
const ws2 = new ws('ws://127.0.0.1:18800/devtools/page/' + TARGET);
let msgId = 0;
const p = {};
ws2.on('open', async () => {
  const send = (m, ps) => new Promise((rs, rj) => { const id = ++msgId; p[id] = (e, r) => e ? rj(e) : rs(r); ws2.send(JSON.stringify({ id, method: m, params: ps || {} })); setTimeout(() => { if (p[id]) { delete p[id]; rj(new Error('timeout')) } }, 10000); });
  const url = await send('Runtime.evaluate', { expression: 'window.location.href', returnByValue: true });
  console.log('URL:', url.result ? url.result.value : 'none');
  const pm = await send('Runtime.evaluate', { expression: 'var pm = document.querySelector(".ProseMirror"); pm ? "text:" + pm.textContent.length : "no pm"', returnByValue: true });
  console.log('PM:', pm.result ? pm.result.value : 'none');
  const dialog = await send('Runtime.evaluate', { expression: 'document.querySelectorAll("[role=dialog]").length', returnByValue: true });
  console.log('Dialogs:', dialog.result ? dialog.result.value : 'none');
  const contBtn = await send('Runtime.evaluate', { expression: 'var bs = document.querySelectorAll("button"); for (var i = 0; i < bs.length; i++) { if ((bs[i].textContent||"").trim() === "Continue") return "found Continue"; } return "not found";', returnByValue: true });
  console.log('Continue:', contBtn.result ? contBtn.result.value : 'none');
  ws2.close();
});
ws2.on('message', d => { const m = JSON.parse(d); if (m.id && p[m.id]) { const c = p[m.id]; delete p[m.id]; c(null, m.result); } });
ws2.on('error', e => console.error(e.message));
