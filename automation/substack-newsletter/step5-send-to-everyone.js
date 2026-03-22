// step5-send-to-everyone.js — Click "Send to everyone now" using JS element.click()
const WebSocket = require('C:/Users/marko/.openclaw/mini-blog-engine/automation/substack-newsletter/node_modules/ws');
const fs = require('fs');
const TARGET = 'CF712D9456053DAE8F6EC1FEDDE93571';
const WS_URL = `ws://127.0.0.1:18800/devtools/page/${TARGET}`;
const SCREENSHOT_DIR = 'C:/Users/marko/.openclaw/mini-blog-engine/automation/substack-newsletter/screenshots/';

let ws, msgId = 0;
const p = {};
const send = (m, ps = {}) => new Promise((rs, rj) => {
  const id = ++msgId; p[id] = (e, r) => e ? rj(e) : rs(r);
  ws.send(JSON.stringify({ id, method: m, params: ps }));
  setTimeout(() => { if (p[id]) { delete p[id]; rj(new Error('timeout: ' + m)); } }, 15000);
});

function axVal(prop) {
  if (!prop) return '';
  if (typeof prop === 'string') return prop;
  if (typeof prop.value === 'string') return prop.value;
  return '';
}

function flatten(nodes, r = []) {
  if (!nodes) return r;
  for (const n of nodes) { r.push(n); if (n.children) flatten(n.children, r); }
  return r;
}

async function snap() {
  const tree = await send('Accessibility.getFullAXTree', {});
  return flatten(tree.nodes || []);
}

async function saveScreenshot(label) {
  const ss = await send('Page.captureScreenshot', { format: 'png' });
  const path = `${SCREENSHOT_DIR}step5-${label}.png`;
  fs.writeFileSync(path, Buffer.from(ss.data, 'base64'));
  return path;
}

async function jsClickContaining(text) {
  const result = await send('Runtime.evaluate', {
    expression: `
      (function(target) {
        var all = document.querySelectorAll('button, [role="button"]');
        for (var i = 0; i < all.length; i++) {
          var t = (all[i].textContent || '').trim();
          if (t && t.toLowerCase().includes(target.toLowerCase())) {
            all[i].click();
            return 'clicked: ' + t;
          }
        }
        return 'not found';
      })(arguments[0])
    `,
    returnByValue: true,
    args: [text]
  });
  return result.result ? result.result.value : 'no result';
}

(async () => {
  ws = new WebSocket(WS_URL);
  ws.on('open', async () => {
    try {
      const url = await send('Runtime.evaluate', { expression: 'window.location.href', returnByValue: true });
      console.log('[1] URL:', url.result ? url.result.value : 'unknown');
      
      const nodes = await snap();
      
      // Show all buttons
      console.log('\n[2] ALL BUTTONS:');
      nodes.filter(n => n.role && n.role.value && n.role.value.toLowerCase() === 'button')
        .forEach(n => console.log('  -', JSON.stringify(axVal(n.name))));
      
      // Look specifically for Send to everyone
      const sendBtn = nodes.find(n =>
        n.role && n.role.value && n.role.value.toLowerCase() === 'button' &&
        axVal(n.name).includes('everyone')
      );
      
      if (sendBtn) {
        console.log('\n[3] Found "Send to everyone" button:', axVal(sendBtn.name), '— clicking via JS...');
        const result = await jsClickContaining('everyone');
        console.log('[3] JS click result:', result);
      } else {
        console.log('\n[3] "Send to everyone" NOT in accessibility tree — trying direct JS search...');
        const result = await send('Runtime.evaluate', {
          expression: `
            (function() {
              var all = document.querySelectorAll('button, [role="button"], a, div');
              var found = [];
              for (var i = 0; i < all.length; i++) {
                var t = (all[i].textContent || '').trim();
                if (t.toLowerCase().includes('everyone') || t.toLowerCase().includes('send') && t.toLowerCase().includes('email')) {
                  found.push(t.substring(0, 80));
                }
              }
              return found.join(' | ');
            })()
          `,
          returnByValue: true
        });
        console.log('[3] JS search result:', result.result ? result.result.value : 'none');
        
        // Try clicking whatever we found
        if (result.result && result.result.value && result.result.value !== 'none') {
          console.log('[3] Attempting JS click...');
          await jsClickContaining('everyone');
        }
      }
      
      await new Promise(r => setTimeout(r, 5000));
      await saveScreenshot('after-send-click');
      
      const url2 = await send('Runtime.evaluate', { expression: 'window.location.href', returnByValue: true });
      console.log('\n[4] URL after Send click:', url2.result ? url2.result.value : 'unknown');
      
      // Check for dialog
      const nodes2 = await snap();
      const hasDialog = nodes2.some(n =>
        n.role && n.role.value && n.role.value.toLowerCase() === 'dialog'
      );
      console.log('\n[5] Dialog present:', hasDialog);
      
      if (hasDialog) {
        // Show dialog buttons
        const dialogs = nodes2.filter(n => n.role && n.role.value && n.role.value.toLowerCase() === 'dialog');
        console.log('\n[6] DIALOG CONTENT:');
        for (const d of dialogs) {
          const kids = flatten(d.children || []);
          kids.filter(k => k.role && k.role.value && k.role.value.toLowerCase() === 'button')
            .forEach(k => console.log('  button:', JSON.stringify(axVal(k.name))));
        }
        console.log('\n[6] ✅ DIALOG OPEN — subscribe options visible!');
      } else {
        console.log('\n[6] No dialog — checking if URL changed to indicate publish...');
        if (url2.result && url2.result.value.includes('/p/')) {
          console.log('[6] ✅ URL changed to /p/ — likely published!');
        }
      }
      
      console.log('\n✅ Step 5 complete. Screenshot saved.');
      
    } catch (e) {
      console.error('[ERROR]', e.message);
    }
    ws.close();
  });
  ws.on('message', d => { const m = JSON.parse(d); if (m.id && p[m.id]) { const c = p[m.id]; delete p[m.id]; c(null, m.result); } });
  ws.on('error', e => console.error('WS error:', e.message));
})();
