// step1-open-editor.js — Test step 1: open fresh Substack editor
const WebSocket = require('C:/Users/marko/.openclaw/mini-blog-engine/automation/substack-newsletter/node_modules/ws');
const fs = require('fs');
const TARGET = 'CF712D9456053DAE8F6EC1FEDDE93571';
const WS_URL = `ws://127.0.0.1:18800/devtools/page/${TARGET}`;
const SCREENSHOT_DIR = 'C:/Users/marko/.openclaw/mini-blog-engine/automation/substack-newsletter/screenshots/';

let ws, msgId = 0;
const p = {};
const send = (m, ps = {}) => new Promise((rs, rj) => {
  const id = ++msgId;
  p[id] = (e, r) => e ? rj(e) : rs(r);
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
  const path = `${SCREENSHOT_DIR}step1-${label}.png`;
  fs.writeFileSync(path, Buffer.from(ss.data, 'base64'));
  return path;
}

(async () => {
  ws = new WebSocket(WS_URL);
  ws.on('open', async () => {
    console.log('[1] Connected');
    
    // Navigate to fresh post editor
    await send('Page.navigate', { url: 'https://orbit286020.substack.com/publish/post/' });
    await new Promise(r => setTimeout(r, 5000));
    
    const url = await send('Runtime.evaluate', { expression: 'window.location.href', returnByValue: true });
    console.log('[2] URL:', url.result ? url.result.value : 'unknown');
    
    await saveScreenshot('editor-loaded');
    
    const { nodes } = await snap();
    
    // Show all textboxes
    console.log('\n[3] TEXTBOXES:');
    nodes.filter(n => n.role && n.role.value && n.role.value.toLowerCase() === 'textbox')
      .forEach(n => console.log('  -', JSON.stringify(axVal(n.name)), '| nodeId:', n.backendDOMNodeId));
    
    // Show all buttons
    console.log('\n[4] BUTTONS:');
    nodes.filter(n => n.role && n.role.value && n.role.value.toLowerCase() === 'button')
      .forEach(n => console.log('  -', JSON.stringify(axVal(n.name))));
    
    // Check ProseMirror
    const pm = await send('Runtime.evaluate', {
      expression: `document.querySelector('.ProseMirror') ? 'found' : 'not found'`,
      returnByValue: true
    });
    console.log('\n[5] ProseMirror:', pm.result ? pm.result.value : 'none');
    
    console.log('\n✅ Step 1 complete — editor loaded. Screenshot saved.');
    ws.close();
  });
  ws.on('message', d => { const m = JSON.parse(d); if (m.id && p[m.id]) { const c = p[m.id]; delete p[m.id]; c(null, m.result); } });
  ws.on('error', e => console.error('WS error:', e.message));
})();
