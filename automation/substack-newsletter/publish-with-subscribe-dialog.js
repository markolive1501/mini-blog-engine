// publish-with-subscribe-dialog.js
// Handles the Substack "Add subscribe buttons" dialog that blocks automated publishing
// Substack shows this dialog after "Send to everyone now" — we detect it and auto-click "Publish without buttons"
const WebSocket = require('C:/Users/marko/.openclaw/mini-blog-engine/automation/substack-newsletter/node_modules/ws');
const http = require('http');
const https = require('https');

const TARGET_ID = 'CF712D9456053DAE8F6EC1FEDDE93571';
const WS_URL = `ws://127.0.0.1:18800/devtools/page/${TARGET_ID}`;
const POST_URL = process.argv[2] || 'https://orbit286020.substack.com/publish';

let ws;
let msgId = 0;
const pending = {};

function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++msgId;
    pending[id] = (err, result) => err ? reject(err) : resolve(result);
    ws.send(JSON.stringify({ id, method, params }));
    setTimeout(() => {
      if (pending[id]) { delete pending[id]; reject(new Error('timeout')); }
    }, 20000);
  });
}

function axVal(prop) {
  if (!prop) return '';
  if (typeof prop === 'string') return prop;
  if (typeof prop.value === 'string') return prop.value;
  return '';
}

function flattenNodes(nodes, result = []) {
  for (const n of nodes) { result.push(n); if (n.children) flattenNodes(n.children, result); }
  return result;
}

function findDialogButton(tree, texts) {
  const nodes = flattenNodes(tree.nodes || []);
  // Look in ALL dialogs
  const allDialogs = nodes.filter(n => 
    n.role && n.role.value && n.role.value.toLowerCase() === 'dialog'
  );
  for (const dialog of allDialogs) {
    const dialogNodes = flattenNodes([dialog]);
    for (const btn of dialogNodes) {
      if (btn.role && btn.role.value && btn.role.value.toLowerCase() === 'button') {
        const name = axVal(btn.name);
        if (texts.some(t => name.includes(t))) {
          return btn;
        }
      }
    }
  }
  // Fallback: search all nodes
  for (const n of nodes) {
    if (n.role && n.role.value && n.role.value.toLowerCase() === 'button') {
      const name = axVal(n.name);
      if (texts.some(t => name.includes(t))) return n;
    }
  }
  return null;
}

function checkForDialog(tree) {
  const nodes = flattenNodes(tree.nodes || []);
  const dialogs = nodes.filter(n => n.role && n.role.value && n.role.value.toLowerCase() === 'dialog');
  return dialogs.length > 0;
}

(async () => {
  ws = new WebSocket(WS_URL);
  
  ws.on('open', async () => {
    console.log('[1] Connected, navigating to Substack...');
    
    // Navigate to the publish page
    await send('Page.navigate', { url: POST_URL });
    await new Promise(r => setTimeout(r, 4000));
    
    let tree = await send('Accessibility.getFullAXTree');
    let nodes = flattenNodes(tree.nodes || []);
    console.log('[2] Page loaded, nodes:', nodes.length);
    
    // ── Step 1: Click "New free post" ──────────────────────────────────────
    let freePostBtn = nodes.find(n => 
      n.role && n.role.value && n.role.value.toLowerCase() === 'button' &&
      axVal(n.name).toLowerCase().includes('free post')
    );
    if (freePostBtn) {
      console.log('[3] Clicking "New free post"...');
      await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 0, y: 0, button: 'none', clickCount: 0, modifiers: 0 });
      try {
        const res = await send('DOM.requestNode', { backendNodeId: freePostBtn.backendDOMNodeId });
        const oid = res.object ? res.object.objectId : res.objectId;
        const q = await send('DOM.getContentQuads', { objectId: oid }).catch(() => null);
        if (q && q.quads && q.quads.length > 0) {
          const qq = q.quads[0];
          const x = (qq[0]+qq[2]+qq[4]+qq[6])/4, y = (qq[1]+qq[3]+qq[5]+qq[7])/4;
          await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
          await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
          console.log('[4] Clicked at', x.toFixed(0), y.toFixed(0));
        }
      } catch(e) { console.log('[4] Click error:', e.message); }
      await new Promise(r => setTimeout(r, 3000));
    }
    
    // ── Step 2: Fill title ────────────────────────────────────────────────
    tree = await send('Accessibility.getFullAXTree');
    nodes = flattenNodes(tree.nodes || []);
    
    const titleBox = nodes.find(n =>
      n.role && n.role.value && n.role.value.toLowerCase() === 'textbox' &&
      axVal(n.name).toLowerCase().includes('add a title')
    );
    if (titleBox) {
      console.log('[5] Typing title...');
      try {
        const res = await send('DOM.requestNode', { backendNodeId: titleBox.backendDOMNodeId });
        const oid = res.object ? res.object.objectId : res.objectId;
        await send('DOM.focus', { objectId: oid }).catch(() => {});
        await new Promise(r => setTimeout(r, 300));
        await send('Input.dispatchKeyEvent', { type: 'keyDown', modifiers: 3, key: 'a' });
        await send('Input.dispatchKeyEvent', { type: 'keyUp', modifiers: 3, key: 'a' });
        const title = 'AI Coding Agents Are Rewriting the Rules of Software Development';
        for (const ch of title) {
          await send('Input.dispatchKeyEvent', { type: 'keyDown', text: ch });
          await send('Input.dispatchKeyEvent', { type: 'keyUp', text: ch });
          await new Promise(r => setTimeout(r, 20));
        }
        console.log('[6] Title typed');
      } catch(e) { console.log('[6] Title error:', e.message); }
      await new Promise(r => setTimeout(r, 500));
    }
    
    // ── Step 3: Fill email title ─────────────────────────────────────────
    tree = await send('Accessibility.getFullAXTree');
    nodes = flattenNodes(tree.nodes || []);
    
    const emailTitleBox = nodes.find(n =>
      n.role && n.role.value && n.role.value.toLowerCase() === 'textbox' &&
      axVal(n.name) === 'Title'
    );
    if (emailTitleBox) {
      console.log('[7] Typing email title...');
      try {
        const res = await send('DOM.requestNode', { backendNodeId: emailTitleBox.backendDOMNodeId });
        const oid = res.object ? res.object.objectId : res.objectId;
        await send('DOM.focus', { objectId: oid }).catch(() => {});
        await new Promise(r => setTimeout(r, 300));
        await send('Input.dispatchKeyEvent', { type: 'keyDown', modifiers: 3, key: 'a' });
        await send('Input.dispatchKeyEvent', { type: 'keyUp', modifiers: 3, key: 'a' });
        const et = 'AI Coding Agents Are Rewriting the Rules of Software Development';
        for (const ch of et) {
          await send('Input.dispatchKeyEvent', { type: 'keyDown', text: ch });
          await send('Input.dispatchKeyEvent', { type: 'keyUp', text: ch });
          await new Promise(r => setTimeout(r, 20));
        }
        console.log('[8] Email title typed');
      } catch(e) { console.log('[8] Email title error:', e.message); }
      await new Promise(r => setTimeout(r, 500));
    }
    
    // ── Step 4: Click into body and paste ─────────────────────────────────
    tree = await send('Accessibility.getFullAXTree');
    nodes = flattenNodes(tree.nodes || []);
    
    // Find the contenteditable ProseMirror body
    const bodyResult = await send('Runtime.evaluate', {
      expression: `
        (function() {
          var pm = document.querySelector('.ProseMirror');
          if (pm) { pm.focus(); return 'focused'; }
          var els = document.querySelectorAll('[contenteditable="true"]');
          for (var i = 0; i < els.length; i++) {
            if (els[i].className.includes('ProseMirror')) {
              els[i].focus(); return 'focused: ' + els[i].className;
            }
          }
          return 'not found';
        })()
      `,
      returnByValue: true
    });
    console.log('[9] Body focus:', axVal(bodyResult.result));
    
    const bodyText = 'AI coding agents are moving from novelty to necessity. They don\'t just autocomplete snippets — they understand project context, refactor entire modules, write tests, and reason about architecture across thousands of lines of code.\n\nThe implications for how software gets built are significant. Traditional estimates suggest professional developers spend roughly half their time debugging and maintaining code they\'ve already written. AI agents trained on vast codebases are starting to compress that cycle dramatically.\n\nThis is not about replacing developers. It\'s about changing what "development work" actually means — from typing code to directing intelligence.';
    
    await send('Runtime.evaluate', {
      expression: `
        (function() {
          var pm = document.querySelector('.ProseMirror');
          if (!pm) return 'no pm';
          pm.focus();
          document.execCommand('selectAll', false, null);
          var lines = (\`${bodyText.replace(/`/g, '\\`').replace(/\$/g, '\\$')}\`).split('\\n');
          var fragment = document.createDocumentFragment();
          for (var i = 0; i < lines.length; i++) {
            if (i > 0) fragment.appendChild(document.createElement('br'));
            if (lines[i]) fragment.appendChild(document.createTextNode(lines[i]));
          }
          document.execCommand('insertHTML', false, fragment.innerHTML);
          return 'inserted ' + lines.length + ' lines';
        })()
      `,
      returnByValue: true
    });
    console.log('[10] Body pasted');
    await new Promise(r => setTimeout(r, 1000));
    
    // ── Step 5: Click Continue ─────────────────────────────────────────────
    tree = await send('Accessibility.getFullAXTree');
    nodes = flattenNodes(tree.nodes || []);
    
    const continueBtn = nodes.find(n =>
      n.role && n.role.value && n.role.value.toLowerCase() === 'button' &&
      axVal(n.name) === 'Continue'
    );
    if (continueBtn) {
      console.log('[11] Clicking Continue...');
      try {
        const res = await send('DOM.requestNode', { backendNodeId: continueBtn.backendDOMNodeId });
        const oid = res.object ? res.object.objectId : res.objectId;
        const q = await send('DOM.getContentQuads', { objectId: oid }).catch(() => null);
        if (q && q.quads && q.quads.length > 0) {
          const qq = q.quads[0];
          const x = (qq[0]+qq[2]+qq[4]+qq[6])/4, y = (qq[1]+qq[3]+qq[5]+qq[7])/4;
          await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: 'none', clickCount: 0 });
          await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
          await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
          console.log('[12] Continue clicked');
        }
      } catch(e) { console.log('[12] Continue error:', e.message); }
      await new Promise(r => setTimeout(r, 4000));
    }
    
    // ── Step 6: Click "Send to everyone now" ─────────────────────────────
    tree = await send('Accessibility.getFullAXTree');
    nodes = flattenNodes(tree.nodes || []);
    
    const sendBtn = nodes.find(n =>
      n.role && n.role.value && n.role.value.toLowerCase() === 'button' &&
      axVal(n.name).includes('Send to everyone now')
    );
    if (sendBtn) {
      console.log('[13] Clicking "Send to everyone now"...');
      try {
        const res = await send('DOM.requestNode', { backendNodeId: sendBtn.backendDOMNodeId });
        const oid = res.object ? res.object.objectId : res.objectId;
        const q = await send('DOM.getContentQuads', { objectId: oid }).catch(() => null);
        if (q && q.quads && q.quads.length > 0) {
          const qq = q.quads[0];
          const x = (qq[0]+qq[2]+qq[4]+qq[6])/4, y = (qq[1]+qq[3]+qq[5]+qq[7])/4;
          await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: 'none', clickCount: 0 });
          await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
          await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
          console.log('[14] Send clicked at', x.toFixed(0), y.toFixed(0));
        }
      } catch(e) { console.log('[14] Send error:', e.message); }
      
      // Wait for subscribe dialog
      console.log('[15] Waiting for subscribe dialog...');
      await new Promise(r => setTimeout(r, 5000));
      
      // ── Step 7: Handle subscribe dialog ──────────────────────────────────
      tree = await send('Accessibility.getFullAXTree');
      
      const hasDialog = checkForDialog(tree);
      console.log('[16] Dialog present:', hasDialog);
      
      if (hasDialog) {
        // Try "Publish without buttons" button
        let pubBtn = findDialogButton(tree, ['Publish without buttons']);
        if (pubBtn) {
          console.log('[17] Found "Publish without buttons" button');
          try {
            const res = await send('DOM.requestNode', { backendNodeId: pubBtn.backendDOMNodeId });
            const oid = res.object ? res.object.objectId : res.objectId;
            // Try JS click first
            await send('Runtime.evaluate', {
              expression: `
                (function() {
                  var all = document.querySelectorAll('button, [role="button"]');
                  for (var i = 0; i < all.length; i++) {
                    if (all[i].textContent.includes('Publish without buttons')) {
                      all[i].click(); return 'clicked: ' + all[i].textContent;
                    }
                  }
                  return 'not found';
                })()
              `,
              returnByValue: true
            });
            console.log('[18] JS clicked "Publish without buttons"');
            await new Promise(r => setTimeout(r, 5000));
          } catch(e) { console.log('[18] Error:', e.message); }
        } else {
          // Try "Don't ask again" + "Publish without buttons" in one go
          console.log('[17] "Publish without buttons" not found — trying direct JS');
          const jsResult = await send('Runtime.evaluate', {
            expression: `
              (function() {
                var all = document.querySelectorAll('button, [role="button"]');
                var result = [];
                for (var i = 0; i < all.length; i++) {
                  var t = all[i].textContent.trim();
                  if (t) result.push(t);
                }
                return JSON.stringify(result);
              })()
            `,
            returnByValue: true
          });
          console.log('[17] All buttons:', axVal(jsResult.result));
          
          // Try clicking any button in a dialog that says "without"
          await send('Runtime.evaluate', {
            expression: `
              (function() {
                var all = document.querySelectorAll('[role="dialog"] button, .modal button, .overlay button');
                for (var i = 0; i < all.length; i++) {
                  if (all[i].textContent.includes('without')) {
                    all[i].click(); return 'clicked: ' + all[i].textContent;
                  }
                }
                // Fallback: any button with "publish" or "send" in dialogs
                for (var i = 0; i < all.length; i++) {
                  var t = all[i].textContent.toLowerCase();
                  if (t.includes('publish') || t.includes('send') || t.includes('without')) {
                    all[i].click(); return 'clicked: ' + all[i].textContent;
                  }
                }
                return 'nothing found';
              })()
            `,
            returnByValue: true
          });
          console.log('[18] Dialog button JS click attempted');
          await new Promise(r => setTimeout(r, 5000));
        }
        
        // Check if dialog closed (publish succeeded)
        const urlResult = await send('Runtime.evaluate', { expression: 'window.location.href', returnByValue: true });
        console.log('[19] URL after dialog handling:', urlResult.result ? urlResult.result.value : 'unknown');
        
        tree = await send('Accessibility.getFullAXTree');
        const stillHasDialog = checkForDialog(tree);
        console.log('[20] Dialog still open:', stillHasDialog);
        
        if (!stillHasDialog) {
          console.log('[21] ✅ PUBLISH SUCCEEDED — dialog closed');
        } else {
          console.log('[21] ⚠️ Dialog still open — trying screenshot');
          await send('Page.captureScreenshot', { format: 'png' }).catch(() => {});
        }
      } else {
        // No dialog — check URL for success indicators
        const urlResult = await send('Runtime.evaluate', { expression: 'window.location.href', returnByValue: true });
        console.log('[16] No dialog. URL:', urlResult.result ? urlResult.result.value : 'unknown');
      }
    } else {
      console.log('[13] Send button not found');
    }
    
    ws.close();
    console.log('[DONE]');
  });

  ws.on('message', data => {
    const msg = JSON.parse(data.toString());
    if (msg.id && pending[msg.id]) {
      const cb = pending[msg.id]; delete pending[msg.id]; cb(null, msg.result);
    }
  });
  ws.on('error', e => console.error('WS error:', e.message));
})();
