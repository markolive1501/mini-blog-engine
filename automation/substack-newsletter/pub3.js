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
  setTimeout(() => { if (p[id]) { delete p[id]; rj(new Error('timeout')); } }, 15000);
});

function flatten(nodes, r = []) {
  if (!nodes) return r;
  for (const n of nodes) { r.push(n); if (n.children) flatten(n.children, r); }
  return r;
}

async function ss(label) {
  const r = await send('Page.captureScreenshot', { format: 'png' });
  const path = SCREENSHOT_DIR + 'pub-' + label + '.png';
  fs.writeFileSync(path, Buffer.from(r.data, 'base64'));
  console.log('[📸] ' + path);
  return path;
}

async function jsClickText(text) {
  const r = await send('Runtime.evaluate', {
    expression: `
      (function(t) {
        var all = document.querySelectorAll('button, [role="button"]');
        for (var i = 0; i < all.length; i++) {
          var ct = (all[i].textContent || '').trim();
          if (ct.toLowerCase().includes(t.toLowerCase())) {
            all[i].click();
            return 'clicked: ' + ct;
          }
        }
        return 'not found: ' + t;
      })(arguments[0])
    `,
    returnByValue: true,
    args: [text]
  });
  return r.result ? r.result.value : 'no result';
}

targetWs.on('open', async () => {
  try {
    const url = await send('Runtime.evaluate', { expression: 'window.location.href', returnByValue: true });
    console.log('[1] URL:', url.result ? url.result.value : 'unknown');

    // Check what dialog is open
    const tree = await send('Accessibility.getFullAXTree', {});
    const nodes = flatten(tree.nodes || []);
    const dialogs = nodes.filter(n => n.role && n.role.value && n.role.value.toLowerCase() === 'dialog');
    console.log('[2] Dialogs:', dialogs.length);

    for (const d of dialogs) {
      const name = d.name && d.name.value ? d.name.value : (d.name || '');
      console.log('   Dialog name:', JSON.stringify(name));
      const kids = flatten(d.children || []);
      kids.filter(k => k.role && k.role.value && k.role.value.toLowerCase() === 'button')
        .forEach(b => console.log('   button:', JSON.stringify(b.name && b.name.value || b.name || '')));
    }

    await ss('dialog-check');

    // Try clicking Send to everyone now (this is what publishes)
    console.log('[3] Clicking "Send to everyone now"...');
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
                return 'clicked: ' + t;
              }
            }
          }
          return 'Send to everyone now button not found in dialog';
        })()
      `,
      returnByValue: true
    });
    console.log('[3]', r.result ? r.result.value : 'none');

    // Wait for publish
    console.log('[4] Waiting 8 seconds for publish to complete...');
    await new Promise(r => setTimeout(r, 8000));
    await ss('after-publish-click');

    const url2 = await send('Runtime.evaluate', { expression: 'window.location.href', returnByValue: true });
    console.log('[5] URL after publish:', url2.result ? url2.result.value : 'unknown');

    // Check if dialog is gone
    const tree2 = await send('Accessibility.getFullAXTree', {});
    const nodes2 = flatten(tree2.nodes || []);
    const stillHasDialog = nodes2.some(n => n.role && n.role.value && n.role.value.toLowerCase() === 'dialog');
    console.log('[6] Dialog still open:', stillHasDialog);

    if (!stillHasDialog && url2.result && !url2.result.value.includes('/publish/')) {
      console.log('\n========================================');
      console.log('✅ PUBLISHED SUCCESSFULLY!');
      console.log('========================================');
    } else if (!stillHasDialog) {
      console.log('\n========================================');
      console.log('⚠️ Dialog closed but URL:', url2.result ? url2.result.value : 'unknown');
      console.log('========================================');
    } else {
      console.log('\n========================================');
      console.log('⚠️ Dialog still open — needs manual click');
      console.log('========================================');
    }

    console.log('\n[DONE]');
  } catch (e) {
    console.error('[ERROR]', e.message);
  }
  targetWs.close();
});

targetWs.on('message', d => { const m = JSON.parse(d); if (m.id && p[m.id]) { const c = p[m.id]; delete p[m.id]; c(null, m.result); } });
targetWs.on('error', e => console.error('WS error:', e.message));
