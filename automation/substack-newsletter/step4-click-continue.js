// step4-click-continue.js — Click Continue button using JS element.click()
// Uses JS click (not CDP coordinates) — this is critical for Substack React buttons
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
  const path = `${SCREENSHOT_DIR}step4-${label}.png`;
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
      
      // Take before screenshot
      await saveScreenshot('before-continue');
      
      // Show all buttons
      const nodes = await snap();
      console.log('\n[2] ALL BUTTONS:');
      nodes.filter(n => n.role && n.role.value && n.role.value.toLowerCase() === 'button')
        .forEach(n => console.log('  -', JSON.stringify(axVal(n.name))));
      
      // Click Continue using JS (most reliable for React)
      console.log('\n[3] Clicking Continue via JS element.click()...');
      const result = await jsClickContaining('Continue');
      console.log('[3] JS click result:', result);
      
      await new Promise(r => setTimeout(r, 5000));
      await saveScreenshot('after-continue');
      
      const url2 = await send('Runtime.evaluate', { expression: 'window.location.href', returnByValue: true });
      console.log('\n[4] URL after Continue:', url2.result ? url2.result.value : 'unknown');
      
      // Check for Send button
      const nodes2 = await snap();
      console.log('\n[5] BUTTONS AFTER CONTINUE:');
      nodes2.filter(n => n.role && n.role.value && n.role.value.toLowerCase() === 'button')
        .forEach(n => console.log('  -', JSON.stringify(axVal(n.name))));
      
      // Check for any send-related button
      const sendBtn = nodes2.find(n =>
        n.role && n.role.value && n.role.value.toLowerCase() === 'button' &&
        (axVal(n.name).includes('Send') || axVal(n.name).includes('send') || axVal(n.name).includes('everyone'))
      );
      if (sendBtn) {
        console.log('\n[6] ✅ SEND BUTTON FOUND:', axVal(sendBtn.name));
      } else {
        console.log('\n[6] ❌ Send button NOT FOUND yet — may need to scroll down');
      }
      
      console.log('\n✅ Step 4 complete. Screenshot saved.');
      
    } catch (e) {
      console.error('[ERROR]', e.message);
    }
    ws.close();
  });
  ws.on('message', d => { const m = JSON.parse(d); if (m.id && p[m.id]) { const c = p[m.id]; delete p[m.id]; c(null, m.result); } });
  ws.on('error', e => console.error('WS error:', e.message));
})();
