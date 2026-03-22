const ws = require('C:/Users/marko/.openclaw/mini-blog-engine/automation/substack-newsletter/node_modules/ws');
const fs = require('fs');
const TARGET = 'EC2E01079798BBC0AA6B5FCA0534ABE2';
const WS_URL = 'ws://127.0.0.1:18800/devtools/page/' + TARGET;
const SCREENSHOT_DIR = 'C:/Users/marko/.openclaw/mini-blog-engine/automation/substack-newsletter/screenshots/';

let msgId = 0;
const p = {};
const targetWs = new ws(WS_URL);

const send = (m, ps) => new Promise((rs, rj) => {
  const id = ++msgId;
  p[id] = (e, r) => e ? rj(e) : rs(r);
  targetWs.send(JSON.stringify({ id, method: m, params: ps || {} }));
  setTimeout(() => { if (p[id]) { delete p[id]; rj(new Error('timeout: ' + m)); } }, 15000);
});

async function ss(label) {
  try {
    const r = await send('Page.captureScreenshot', { format: 'png' });
    const path = SCREENSHOT_DIR + 'fp2-' + label + '.png';
    fs.writeFileSync(path, Buffer.from(r.data, 'base64'));
    console.log('[📸] ' + path);
  } catch (e) { console.log('[📸 error]', e.message); }
}

targetWs.on('open', async () => {
  try {
    const url = await send('Runtime.evaluate', { expression: 'window.location.href', returnByValue: true });
    console.log('[🌐]', url.result ? url.result.value : 'unknown');

    // Check dialog
    const flatten = (arr, r = []) => { for (const n of arr) { r.push(n); if (n.children) flatten(n.children, r); } return r; };
    const tree = await send('Accessibility.getFullAXTree', {});
    const nodes = flatten(tree.nodes || []);
    const dialogs = nodes.filter(n => n.role && n.role.value && n.role.value.toLowerCase() === 'dialog');
    console.log('[dialogs]', dialogs.length);
    for (const d of dialogs) {
      const kids = flatten(d.children || []);
      kids.filter(k => k.role && k.role.value && k.role.value.toLowerCase() === 'button')
        .forEach(b => console.log('  button:', JSON.stringify(b.name && b.name.value || b.name || '')));
    }

    // Click "Add subscribe buttons" — the primary option
    console.log('[click] Add subscribe buttons...');
    const r = await send('Runtime.evaluate', {
      expression: `
        (function() {
          var dialogs = document.querySelectorAll('[role="dialog"]');
          for (var d = 0; d < dialogs.length; d++) {
            var btns = dialogs[d].querySelectorAll('button');
            for (var i = 0; i < btns.length; i++) {
              var t = (btns[i].textContent || '').trim();
              if (t.toLowerCase().includes('add subscribe')) {
                btns[i].click();
                return 'clicked: ' + t;
              }
            }
          }
          return 'not found';
        })()
      `,
      returnByValue: true
    });
    console.log('[result]', r.result ? r.result.value : 'none');

    await new Promise(r => setTimeout(r, 6000));
    await ss('after-subscribe-click');

    const url2 = await send('Runtime.evaluate', { expression: 'window.location.href', returnByValue: true });
    console.log('[final url]', url2.result ? url2.result.value : 'unknown');

    const tree2 = await send('Accessibility.getFullAXTree', {});
    const nodes2 = flatten(tree2.nodes || []);
    const stillDialog = nodes2.some(n => n.role && n.role.value && n.role.value.toLowerCase() === 'dialog');
    console.log('[dialog still open]', stillDialog);

    if (!stillDialog) {
      console.log('\n========================================');
      console.log('✅ PUBLISH APPEARS SUCCESSFUL!');
      console.log('========================================');
    }

  } catch (e) {
    console.error('[ERROR]', e.message);
  }
  targetWs.close();
});

targetWs.on('message', d => {
  const m = JSON.parse(d);
  if (m.id && p[m.id]) { const c = p[m.id]; delete p[m.id]; c(null, m.result); }
});
targetWs.on('error', e => console.error('WS error:', e.message));
