const ws = require('ws');
const TARGET = 'EC2E01079798BBC0AA6B5FCA0534ABE2';
const ws2 = new ws('ws://127.0.0.1:18800/devtools/page/' + TARGET);
let msgId = 0;
const p = {};
ws2.on('open', async () => {
  const send = (m, ps) => new Promise((rs, rj) => { const id = ++msgId; p[id] = (e, r) => e ? rj(e) : rs(r); ws2.send(JSON.stringify({ id, method: m, params: ps || {} })); setTimeout(() => { if (p[id]) { delete p[id]; rj(new Error('timeout')) } }, 15000); });

  // Navigate using CDP Page.navigate so WebSocket stays connected
  console.log('[navigating to fresh editor...]');
  await send('Page.navigate', { url: 'https://orbit286020.substack.com/publish/post/%C2%A0' });
  await new Promise(r => setTimeout(r, 5000));

  const url = await send('Runtime.evaluate', { expression: 'window.location.href', returnByValue: true });
  console.log('URL:', url.result ? url.result.value : 'none');

  const tree = await send('Accessibility.getFullAXTree', {});
  const flatten = (arr, r = []) => { for (const n of arr) { r.push(n); if (n.children) flatten(n.children, r); } return r; };
  const nodes = flatten(tree.nodes || []);
  const tbs = nodes.filter(n => n.role && n.role.value && n.role.value.toLowerCase() === 'textbox');
  console.log('Textboxes:', tbs.length);
  tbs.forEach(n => console.log('  -', JSON.stringify(n.name && n.name.value || n.name || '')));

  const pm = await send('Runtime.evaluate', { expression: 'var pm = document.querySelector(".ProseMirror"); pm ? "text:" + pm.textContent.length : "no pm"', returnByValue: true });
  console.log('PM:', pm.result ? pm.result.value : 'none');

  ws2.close();
  process.exit(0);
});
ws2.on('message', d => { const m = JSON.parse(d); if (m.id && p[m.id]) { const c = p[m.id]; delete p[m.id]; c(null, m.result); } });
ws2.on('error', e => console.error(e.message));
