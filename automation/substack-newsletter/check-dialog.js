const WebSocket = require('C:/Users/marko/.openclaw/mini-blog-engine/automation/substack-newsletter/node_modules/ws');
const TARGET = 'EC2E01079798BBC0AA6B5FCA0534ABE2';
const WS_URL = 'ws://127.0.0.1:18800/devtools/page/' + TARGET;
const ws = new WebSocket(WS_URL);
let msgId = 0;
const p = {};

ws.on('open', async () => {
  const send = (m, ps) => new Promise((rs, rj) => {
    const id = ++msgId;
    p[id] = (e, r) => e ? rj(e) : rs(r);
    ws.send(JSON.stringify({ id, method: m, params: ps || {} }));
    setTimeout(() => { if (p[id]) { delete p[id]; rj(new Error('timeout')); } }, 10000);
  });

  const url = await send('Runtime.evaluate', { expression: 'window.location.href', returnByValue: true });
  console.log('URL:', url.result ? url.result.value : 'unknown');

  const tree = await send('Accessibility.getFullAXTree', {});
  const flatten = (arr, r = []) => {
    for (const n of arr) { r.push(n); if (n.children) flatten(n.children, r); }
    return r;
  };
  const nodes = flatten(tree.nodes || []);
  console.log('Total nodes:', nodes.length);
  console.log('Dialogs:', nodes.filter(n => n.role && n.role.value && n.role.value.toLowerCase() === 'dialog').length);

  // Dismiss the "Don't leave" dialog
  const dismiss = await send('Runtime.evaluate', {
    expression: `
      (function() {
        var dialogs = document.querySelectorAll('[role="dialog"]');
        for (var d = 0; d < dialogs.length; d++) {
          var buttons = dialogs[d].querySelectorAll('button');
          for (var i = 0; i < buttons.length; i++) {
            var t = (buttons[i].textContent || '').trim().toLowerCase();
            if (t.includes('leave') || t.includes('discard') || t.includes('keep') || t.includes('save') || t.includes('dismiss') || t.includes('close')) {
              buttons[i].click();
              return 'clicked: ' + buttons[i].textContent.trim();
            }
          }
        }
        return 'no dismiss button found';
      })()
    `,
    returnByValue: true
  });
  console.log('Dismiss result:', dismiss.result ? dismiss.result.value : 'none');

  ws.close();
});

ws.on('message', d => {
  const m = JSON.parse(d);
  if (m.id && p[m.id]) { const c = p[m.id]; delete p[m.id]; c(null, m.result); }
});
ws.on('error', e => console.error('WS error:', e.message));
