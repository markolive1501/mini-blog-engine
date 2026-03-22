// step6-handle-dialog.js — Handle the subscribe dialog and confirm publish
// This is the final step — runs after step5 sends the post
// Strategy: try "Publish without buttons" first (it still publishes), then fall back to "Add subscribe buttons"
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
  const path = `${SCREENSHOT_DIR}step6-${label}.png`;
  fs.writeFileSync(path, Buffer.from(ss.data, 'base64'));
  return path;
}

async function jsClickDialogButton(textHint) {
  // Try to find and click a button inside any dialog that contains textHint
  const result = await send('Runtime.evaluate', {
    expression: `
      (function(hint) {
        // Strategy 1: look in role=dialog elements
        var dialogs = document.querySelectorAll('[role="dialog"], .modal, .overlay, .dialog');
        for (var d = 0; d < dialogs.length; d++) {
          var buttons = dialogs[d].querySelectorAll('button, [role="button"]');
          for (var i = 0; i < buttons.length; i++) {
            var t = (buttons[i].textContent || '').trim().toLowerCase();
            if (t.includes(hint.toLowerCase())) {
              buttons[i].click();
              return 'found in dialog: ' + buttons[i].textContent.trim();
            }
          }
        }
        // Strategy 2: global search for button with this text
        var all = document.querySelectorAll('button');
        for (var i = 0; i < all.length; i++) {
          var t = (all[i].textContent || '').trim().toLowerCase();
          if (t.includes(hint.toLowerCase())) {
            all[i].click();
            return 'found globally: ' + all[i].textContent.trim();
          }
        }
        return 'not found: ' + hint;
      })(arguments[0])
    `,
    returnByValue: true,
    args: [textHint]
  });
  return result.result ? result.result.value : 'no result';
}

(async () => {
  ws = new WebSocket(WS_URL);
  ws.on('open', async () => {
    try {
      const url = await send('Runtime.evaluate', { expression: 'window.location.href', returnByValue: true });
      console.log('[1] Current URL:', url.result ? url.result.value : 'unknown');
      
      await saveScreenshot('dialog-check');
      
      const nodes = await snap();
      
      // Check for dialogs
      const dialogs = nodes.filter(n =>
        n.role && n.role.value && n.role.value.toLowerCase() === 'dialog'
      );
      
      console.log('\n[2] Dialogs found:', dialogs.length);
      
      if (dialogs.length > 0) {
        // Show all dialog content
        for (const d of dialogs) {
          const kids = flatten(d.children || []);
          console.log('\n[3] Dialog buttons:');
          kids.filter(k => k.role && k.role.value && k.role.value.toLowerCase() === 'button')
            .forEach(k => console.log('  →', JSON.stringify(axVal(k.name))));
        }
        
        // Try "Publish without buttons" first
        console.log('\n[4] Clicking "Publish without buttons"...');
        const r1 = await jsClickDialogButton('without');
        console.log('[4] Result:', r1);
        
        await new Promise(r => setTimeout(r, 5000));
        await saveScreenshot('after-dialog-click');
        
        const url2 = await send('Runtime.evaluate', { expression: 'window.location.href', returnByValue: true });
        console.log('\n[5] URL after click:', url2.result ? url2.result.value : 'unknown');
        
        // Check if dialog is gone
        const nodes2 = await snap();
        const stillHasDialog = nodes2.some(n =>
          n.role && n.role.value && n.role.value.toLowerCase() === 'dialog'
        );
        
        if (!stillHasDialog) {
          console.log('\n[6] ✅ DIALOG CLOSED — publish should have succeeded!');
          if (url2.result && (url2.result.value.includes('/p/') || url2.result.value.includes('substack.com'))) {
            console.log('[6] ✅ POST PUBLISHED — URL:', url2.result.value);
          }
        } else {
          // Try "Add subscribe buttons" as fallback
          console.log('\n[6] Dialog still open — trying "Add subscribe buttons"...');
          const r2 = await jsClickDialogButton('subscribe');
          console.log('[6] Result:', r2);
          await new Promise(r => setTimeout(r, 5000));
          
          const url3 = await send('Runtime.evaluate', { expression: 'window.location.href', returnByValue: true });
          console.log('[7] URL after fallback:', url3.result ? url3.result.value : 'unknown');
          
          const nodes3 = await snap();
          const stillHasDialog2 = nodes3.some(n =>
            n.role && n.role.value && n.role.value.toLowerCase() === 'dialog'
          );
          
          if (!stillHasDialog2) {
            console.log('[7] ✅ POST PUBLISHED via fallback!');
          } else {
            console.log('[7] ❌ Dialog still open after all attempts');
          }
        }
      } else {
        // No dialog — check if already published
        console.log('[2] No dialog present.');
        if (url.result && url.result.value.includes('/p/')) {
          console.log('[2] ✅ ALREADY PUBLISHED — URL:', url.result.value);
        } else {
          console.log('[2] ⚠️ No dialog and URL does not indicate publish — may need manual check');
        }
      }
      
      // Final screenshot
      await saveScreenshot('final');
      console.log('\n✅ Step 6 complete.');
      
    } catch (e) {
      console.error('[ERROR]', e.message);
    }
    ws.close();
  });
  ws.on('message', d => { const m = JSON.parse(d); if (m.id && p[m.id]) { const c = p[m.id]; delete p[m.id]; c(null, m.result); } });
  ws.on('error', e => console.error('WS error:', e.message));
})();
