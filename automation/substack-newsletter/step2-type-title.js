// step2-type-title.js — Type title + description into the editor
// Requires step1 to have been run (editor already open at /publish/post/)
const WebSocket = require('C:/Users/marko/.openclaw/mini-blog-engine/automation/substack-newsletter/node_modules/ws');
const fs = require('fs');
const TARGET = 'CF712D9456053DAE8F6EC1FEDDE93571';
const WS_URL = `ws://127.0.0.1:18800/devtools/page/${TARGET}`;
const SCREENSHOT_DIR = 'C:/Users/marko/.openclaw/mini-blog-engine/automation/substack-newsletter/screenshots/';

const TITLE = 'Copilot Is Now Your Coding Partner, Not Just Your Autocomplete';
const DESCRIPTION = 'Microsoft Copilot has evolved from a prediction engine into an AI pair programmer. Here is what that actually means for developers.';
const EMAIL_TITLE = 'Copilot Is Now Your Coding Partner, Not Just Your Autocomplete';

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
  return { tree, nodes: flatten(tree.nodes || []) };
}

async function saveScreenshot(label) {
  const ss = await send('Page.captureScreenshot', { format: 'png' });
  const path = `${SCREENSHOT_DIR}step2-${label}.png`;
  fs.writeFileSync(path, Buffer.from(ss.data, 'base64'));
  return path;
}

async function typeText(text, delayMs = 30) {
  // Select all first
  await send('Input.dispatchKeyEvent', { type: 'keyDown', modifiers: 3, key: 'a' });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', modifiers: 3, key: 'a' });
  await new Promise(r => setTimeout(r, 100));
  for (const ch of text) {
    await send('Input.dispatchKeyEvent', { type: 'keyDown', text: ch });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', text: ch });
    await new Promise(r => setTimeout(r, delayMs));
  }
}

(async () => {
  ws = new WebSocket(WS_URL);
  ws.on('open', async () => {
    try {
      console.log('[1] Connected — getting current state...');
      
      // Make sure we're on the editor
      const url = await send('Runtime.evaluate', { expression: 'window.location.href', returnByValue: true });
      console.log('[2] URL:', url.result ? url.result.value : 'unknown');
      
      const { nodes } = await snap();
      
      // ── Find and fill metadata title ──────────────────────────────────────
      const titleTB = nodes.find(n =>
        n.role && n.role.value && n.role.value.toLowerCase() === 'textbox' &&
        axVal(n.name).toLowerCase().includes('add a title')
      );
      
      if (titleTB) {
        console.log('[3] Filling METADATA TITLE (nodeId:', titleTB.backendDOMNodeId, ')...');
        await send('DOM.focus', { backendNodeId: titleTB.backendDOMNodeId });
        await new Promise(r => setTimeout(r, 300));
        await typeText(TITLE);
        console.log('[3] ✅ Metadata title filled');
      } else {
        console.log('[3] ❌ Metadata title NOT FOUND');
      }
      
      await new Promise(r => setTimeout(r, 500));
      await saveScreenshot('after-title');
      
      // ── Find and fill description ─────────────────────────────────────────
      const { nodes: nodes2 } = await snap();
      const descTB = nodes2.find(n =>
        n.role && n.role.value && n.role.value.toLowerCase() === 'textbox' &&
        axVal(n.name).toLowerCase().includes('add a description')
      );
      
      if (descTB) {
        console.log('[4] Filling DESCRIPTION (nodeId:', descTB.backendDOMNodeId, ')...');
        await send('DOM.focus', { backendNodeId: descTB.backendDOMNodeId });
        await new Promise(r => setTimeout(r, 300));
        await typeText(DESCRIPTION, 20);
        console.log('[4] ✅ Description filled');
      } else {
        console.log('[4] ❌ Description NOT FOUND');
      }
      
      await new Promise(r => setTimeout(r, 500));
      await saveScreenshot('after-desc');
      
      // ── Expand Email header section and fill email title ──────────────────
      console.log('[5] Looking for Email header section button...');
      const { nodes: nodes3 } = await snap();
      const emailBtn = nodes3.find(n =>
        n.role && n.role.value && n.role.value.toLowerCase() === 'button' &&
        axVal(n.name).toLowerCase().includes('email header')
      );
      
      if (emailBtn) {
        console.log('[5] Clicking Email header / footer button...');
        await send('Runtime.evaluate', {
          expression: `
            (function() {
              var all = document.querySelectorAll('button');
              for (var i = 0; i < all.length; i++) {
                if ((all[i].textContent || '').includes('Email header')) {
                  all[i].click(); return 'clicked';
                }
              }
              return 'not found';
            })()
          `,
          returnByValue: true
        });
        await new Promise(r => setTimeout(r, 1500));
        await saveScreenshot('after-email-expand');
      }
      
      const { nodes: nodes4 } = await snap();
      
      // Email title textbox — placeholder="Title"
      const emailTitleTB = nodes4.find(n =>
        n.role && n.role.value && n.role.value.toLowerCase() === 'textbox' &&
        axVal(n.name) === 'Title'
      );
      
      if (emailTitleTB) {
        console.log('[6] Filling EMAIL TITLE (nodeId:', emailTitleTB.backendDOMNodeId, ')...');
        await send('DOM.focus', { backendNodeId: emailTitleTB.backendDOMNodeId });
        await new Promise(r => setTimeout(r, 300));
        await typeText(EMAIL_TITLE, 20);
        console.log('[6] ✅ Email title filled');
      } else {
        console.log('[6] ❌ Email title textbox NOT FOUND — this is the critical missing field');
      }
      
      await new Promise(r => setTimeout(r, 500));
      await saveScreenshot('after-email-title');
      
      console.log('\n✅ Step 2 complete — all title fields filled. Screenshots saved.');
      
    } catch (e) {
      console.error('[ERROR]', e.message);
    }
    ws.close();
  });
  ws.on('message', d => { const m = JSON.parse(d); if (m.id && p[m.id]) { const c = p[m.id]; delete p[m.id]; c(null, m.result); } });
  ws.on('error', e => console.error('WS error:', e.message));
})();
