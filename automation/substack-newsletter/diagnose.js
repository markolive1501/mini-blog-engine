// diagnose.js — check what's on the Substack publish page right now
const WebSocket = require('C:/Users/marko/.openclaw/mini-blog-engine/automation/substack-newsletter/node_modules/ws');
const https = require('https');
const http = require('http');
const fs = require('fs');

const TARGET_ID = 'CF712D9456053DAE8F6EC1FEDDE93571';
const WS_URL = `ws://127.0.0.1:18800/devtools/page/${TARGET_ID}`;

let ws;
let msgId = 0;
const pending = {};

function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++msgId;
    pending[id] = (err, result) => err ? reject(err) : resolve(result);
    ws.send(JSON.stringify({ id, method, params }));
    setTimeout(() => { if (pending[id]) { delete pending[id]; reject(new Error('timeout')); } }, 15000);
  });
}

function axVal(prop) {
  if (!prop) return '';
  if (typeof prop === 'string') return prop;
  if (typeof prop.value === 'string') return prop.value;
  return '';
}

function flattenNodes(nodes, result = []) {
  if (!nodes) return result;
  for (const n of nodes) { result.push(n); if (n.children) flattenNodes(n.children, result); }
  return result;
}

(async () => {
  ws = new WebSocket(WS_URL);
  ws.on('open', async () => {
    // Navigate to publish
    await send('Page.navigate', { url: 'https://orbit286020.substack.com/publish' });
    await new Promise(r => setTimeout(r, 4000));
    
    const url = await send('Runtime.evaluate', { expression: 'window.location.href', returnByValue: true });
    console.log('URL:', url.result ? url.result.value : 'unknown');
    
    // Screenshot
    const ss = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('C:/Users/marko/.openclaw/mini-blog-engine/automation/substack-newsletter/screenshots/diagnose.png', Buffer.from(ss.data, 'base64'));
    console.log('Screenshot saved');
    
    // Get accessibility tree
    const tree = await send('Accessibility.getFullAXTree');
    const nodes = flattenNodes(tree.nodes || []);
    console.log('Total nodes:', nodes.length);
    
    // Show all buttons
    console.log('\n=== ALL BUTTONS ===');
    nodes.filter(n => n.role && n.role.value && n.role.value.toLowerCase() === 'button')
      .forEach(n => console.log(' -', JSON.stringify(axVal(n.name)), '|', n.backendDOMNodeId));
    
    // Show all textboxes
    console.log('\n=== ALL TEXTBOXES ===');
    nodes.filter(n => n.role && n.role.value && n.role.value.toLowerCase() === 'textbox')
      .forEach(n => console.log(' -', JSON.stringify(axVal(n.name)), '|', n.backendDOMNodeId));
    
    // Show dialogs
    console.log('\n=== DIALOGS ===');
    nodes.filter(n => n.role && n.role.value && n.role.value.toLowerCase() === 'dialog')
      .forEach(n => {
        console.log('Dialog:', JSON.stringify(axVal(n.name)), '| children:', n.childIds ? n.childIds.length : 0);
        // Show children of dialog
        const kids = flattenNodes(n.children || []);
        kids.filter(k => k.role && k.role.value && k.role.value.toLowerCase() === 'button')
          .forEach(k => console.log('  → button:', JSON.stringify(axVal(k.name)), '|', k.backendDOMNodeId));
      });
    
    // Show contenteditables
    console.log('\n=== CONTENTEDITABLE ELEMENTS ===');
    const ceResult = await send('Runtime.evaluate', {
      expression: `
        (function() {
          var els = document.querySelectorAll('[contenteditable="true"], .ProseMirror');
          var result = [];
          for (var i = 0; i < els.length; i++) {
            result.push(els[i].tagName + ':' + els[i].className + ':' + els[i].getAttribute('contenteditable') + ':' + els[i].getAttribute('data-sentry-element') || 'none');
          }
          return result.join(' | ');
        })()
      `,
      returnByValue: true
    });
    console.log('CE elements:', ceResult.result ? ceResult.result.value : 'none');
    
    ws.close();
  });
  ws.on('message', data => {
    const msg = JSON.parse(data.toString());
    if (msg.id && pending[msg.id]) {
      const cb = pending[msg.id]; delete pending[msg.id]; cb(null, msg.result);
    }
  });
  ws.on('error', e => console.error('WS error:', e.message));
})();
