const ws = require('C:/Users/marko/.openclaw/mini-blog-engine/automation/substack-newsletter/node_modules/ws');
const TARGET = 'EC2E01079798BBC0AA6B5FCA0534ABE2';
const ws2 = new ws('ws://127.0.0.1:18800/devtools/page/' + TARGET);
let msgId = 0;
const p = {};

ws2.on('open', async () => {
  const send = (m, ps) => new Promise((rs, rj) => {
    const id = ++msgId;
    p[id] = (e, r) => e ? rj(e) : rs(r);
    ws2.send(JSON.stringify({ id, method: m, params: ps || {} }));
    setTimeout(() => { if (p[id]) { delete p[id]; rj(new Error('timeout')); } }, 10000);
  });

  // Get dialog buttons
  const tree = await send('Accessibility.getFullAXTree', {});
  const flatten = (arr, r = []) => { for (const n of arr) { r.push(n); if (n.children) flatten(n.children, r); } return r; };
  const nodes = flatten(tree.nodes || []);

  console.log('Total nodes:', nodes.length);

  // Show ALL dialog content
  nodes.filter(n => n.role && n.role.value && n.role.value.toLowerCase() === 'dialog').forEach(d => {
    const name = d.name && d.name.value ? d.name.value : (d.name || '');
    console.log('Dialog:', JSON.stringify(name));
    const kids = flatten(d.children || []);
    console.log('All children:');
    kids.forEach(k => {
      const r = k.role && k.role.value ? k.role.value : '';
      const n = k.name && k.name.value ? k.name.value : (k.name || '');
      console.log('  ', r, '|', JSON.stringify(n));
    });
  });

  // Click "Send to everyone now" INSIDE the Publish confirmation dialog
  const r = await send('Runtime.evaluate', {
    expression: `
      (function() {
        var dialogs = document.querySelectorAll('[role="dialog"]');
        for (var d = 0; d < dialogs.length; d++) {
          var btns = dialogs[d].querySelectorAll('button');
          for (var i = 0; i < btns.length; i++) {
            var t = (btns[i].textContent || '').trim();
            if (t.includes('Send to everyone now')) {
              btns[i].click();
              return 'clicked dialog button: ' + t;
            }
          }
        }
        return 'not found';
      })()
    `,
    returnByValue: true
  });
  console.log('Dialog click result:', r.result ? r.result.value : 'none');

  // Wait for publish to complete
  await new Promise(resolve => setTimeout(resolve, 6000));

  const urlResult = await send('Runtime.evaluate', { expression: 'window.location.href', returnByValue: true });
  console.log('URL after dialog confirm:', urlResult.result ? urlResult.result.value : 'unknown');

  // Check if dialog is gone
  const tree2 = await send('Accessibility.getFullAXTree', {});
  const nodes2 = flatten(tree2.nodes || []);
  const stillHasDialog = nodes2.some(n => n.role && n.role.value && n.role.value.toLowerCase() === 'dialog');
  console.log('Dialog still open:', stillHasDialog);

  if (!stillHasDialog) {
    console.log('\n========================================');
    console.log('✅ PUBLISH APPEARS SUCCESSFUL!');
    console.log('========================================');
  }

  ws2.close();
});

ws2.on('message', d => { const m = JSON.parse(d); if (m.id && p[m.id]) { const c = p[m.id]; delete p[m.id]; c(null, m.result); } });
ws2.on('error', e => console.error(e.message));
