// publish-fresh.js — Full Substack publish pipeline with proper dialog handling
const WebSocket = require('C:/Users/marko/.openclaw/mini-blog-engine/automation/substack-newsletter/node_modules/ws');
const fs = require('fs');

const TARGET_ID = 'CF712D9456053DAE8F6EC1FEDDE93571';
const WS_URL = `ws://127.0.0.1:18800/devtools/page/${TARGET_ID}`;
const EDITOR_URL = 'https://orbit286020.substack.com/publish/post';
const SCREENSHOT_DIR = 'C:/Users/marko/.openclaw/mini-blog-engine/automation/substack-newsletter/screenshots';

let ws;
let msgId = 0;
const pending = {};

function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++msgId;
    pending[id] = (err, result) => err ? reject(err) : resolve(result);
    ws.send(JSON.stringify({ id, method, params }));
    setTimeout(() => { if (pending[id]) { delete pending[id]; reject(new Error(`${method} timeout`)); } }, 20000);
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

async function screenshot(label) {
  try {
    const ss = await send('Page.captureScreenshot', { format: 'png', quality: 80 });
    const ts = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    const path = `${SCREENSHOT_DIR}/${ts}-${label}.png`;
    fs.writeFileSync(path, Buffer.from(ss.data, 'base64'));
    console.log(`[Screenshot] ${label}`);
  } catch(e) { console.log(`[Screenshot error] ${e.message}`); }
}

async function getUrl() {
  const r = await send('Runtime.evaluate', { expression: 'window.location.href', returnByValue: true });
  return r && r.result ? r.result.value : '';
}

async function clickElement(nodeId, label) {
  try {
    const res = await send('DOM.requestNode', { backendNodeId: nodeId });
    const oid = res.object ? res.object.objectId : res.objectId;
    const q = await send('DOM.getContentQuads', { objectId: oid }).catch(() => null);
    if (q && q.quads && q.quads.length > 0) {
      const qq = q.quads[0];
      const x = (qq[0]+qq[2]+qq[4]+qq[6])/4, y = (qq[1]+qq[3]+qq[5]+qq[7])/4;
      // Hover first
      await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: 'none', clickCount: 0, modifiers: 0 });
      await new Promise(r => setTimeout(r, 200));
      await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1, modifiers: 0 });
      await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1, modifiers: 0 });
      console.log(`[Click] ${label} at (${x.toFixed(0)}, ${y.toFixed(0)})`);
      return true;
    }
  } catch(e) { console.log(`[Click error] ${label}: ${e.message}`); }
  return false;
}

async function jsClick(textMatch) {
  const r = await send('Runtime.evaluate', {
    expression: `
      (function() {
        var els = document.querySelectorAll('button, [role="button"], a, div[tabindex="0"]');
        for (var i = 0; i < els.length; i++) {
          if (els[i].textContent.trim().includes('${textMatch}')) {
            els[i].click();
            return 'clicked: ' + els[i].textContent.trim().substring(0, 60);
          }
        }
        return 'not found';
      })()
    `,
    returnByValue: true
  });
  return r && r.result ? r.result.value : 'no result';
}

async function typeText(text) {
  // Select all first
  await send('Input.dispatchKeyEvent', { type: 'keyDown', modifiers: 3, key: 'a' });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', modifiers: 3, key: 'a' });
  await new Promise(r => setTimeout(r, 100));
  // Type character by character
  for (const ch of text) {
    await send('Input.dispatchKeyEvent', { type: 'keyDown', text: ch, key: ch });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', text: ch, key: ch });
    await new Promise(r => setTimeout(r, 30));
  }
}

async function tree() {
  const t = await send('Accessibility.getFullAXTree');
  return { tree: t, nodes: flattenNodes(t.nodes || []) };
}

async function waitForDialog(timeoutMs = 10000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const { nodes } = await tree();
    const dialogs = nodes.filter(n => n.role && n.role.value && n.role.value.toLowerCase() === 'dialog');
    if (dialogs.length > 0) {
      console.log('[Dialog] Detected');
      return true;
    }
    await new Promise(r => setTimeout(r, 1000));
  }
  console.log('[Dialog] Not detected within', timeoutMs, 'ms');
  return false;
}

(async () => {
  ws = new WebSocket(WS_URL);
  
  ws.on('open', async () => {
    console.log('[0] Connected to browser');
    
    // ── Step 1: Navigate to editor ────────────────────────────────────────
    console.log('[1] Navigating to editor...');
    await send('Page.navigate', { url: EDITOR_URL });
    await new Promise(r => setTimeout(r, 5000));
    
    const url = await getUrl();
    console.log('[2] URL:', url);
    await screenshot('editor-loaded');
    
    // ── Step 2: Fill title ────────────────────────────────────────────────
    const { nodes: n2 } = await tree();
    const titleBox = n2.find(n =>
      n.role && n.role.value && n.role.value.toLowerCase() === 'textbox' &&
      axVal(n.name).toLowerCase().includes('add a title')
    );
    if (titleBox) {
      console.log('[3] Filling title...');
      await clickElement(titleBox.backendDOMNodeId, 'title textbox');
      await new Promise(r => setTimeout(r, 300));
      await typeText('AI Coding Agents Are Rewriting the Rules of Software Development');
      console.log('[4] Title filled');
    } else {
      console.log('[3] Title textbox NOT found');
    }
    await new Promise(r => setTimeout(r, 500));
    
    // ── Step 3: Fill email title (in Email header section) ───────────────
    // First expand Email header section if present
    const { nodes: n3 } = await tree();
    const emailSectionBtn = n3.find(n =>
      n.role && n.role.value && n.role.value.toLowerCase() === 'button' &&
      axVal(n.name).toLowerCase().includes('email header')
    );
    if (emailSectionBtn) {
      console.log('[5] Expanding Email header section...');
      await clickElement(emailSectionBtn.backendDOMNodeId, 'Email header button');
      await new Promise(r => setTimeout(r, 1000));
    }
    
    const { nodes: n4 } = await tree();
    const emailTitleBox = n4.find(n =>
      n.role && n.role.value && n.role.value.toLowerCase() === 'textbox' &&
      axVal(n.name) === 'Title'
    );
    if (emailTitleBox) {
      console.log('[6] Filling email title...');
      await clickElement(emailTitleBox.backendDOMNodeId, 'email title textbox');
      await new Promise(r => setTimeout(r, 300));
      await typeText('AI Coding Agents Are Rewriting the Rules of Software Development');
      console.log('[7] Email title filled');
    } else {
      console.log('[6] Email title textbox NOT found');
    }
    await new Promise(r => setTimeout(r, 500));
    
    // ── Step 4: Fill body ─────────────────────────────────────────────────
    console.log('[8] Filling body...');
    const bodyResult = await send('Runtime.evaluate', {
      expression: `
        (function() {
          var pm = document.querySelector('.ProseMirror');
          if (pm) { pm.focus(); return 'focused ProseMirror'; }
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
    console.log('[9] Body focus:', bodyResult && bodyResult.result ? bodyResult.result.value : 'none');
    
    const bodyText = 'AI coding agents are moving from novelty to necessity. They don\'t just autocomplete snippets — they understand project context, refactor entire modules, write tests, and reason about architecture across thousands of lines of code.\n\nThe implications for how software gets built are significant. Traditional estimates suggest professional developers spend roughly half their time debugging and maintaining code they\'ve already written. AI agents trained on vast codebases are starting to compress that cycle dramatically.\n\nThis is not about replacing developers. It\'s about changing what "development work" actually means — from typing code to directing intelligence.';
    
    const insertResult = await send('Runtime.evaluate', {
      expression: `
        (function() {
          var pm = document.querySelector('.ProseMirror');
          if (!pm) return 'no ProseMirror';
          pm.focus();
          document.execCommand('selectAll', false, null);
          var text = \`${bodyText.replace(/`/g, '\\`').replace(/\\/g, '\\\\').replace(/\$/g, '\\$')}\`;
          var lines = text.split('\\n');
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
    console.log('[10] Body insert:', insertResult && insertResult.result ? insertResult.result.value : 'none');
    await screenshot('body-filled');
    await new Promise(r => setTimeout(r, 1000));
    
    // ── Step 5: Click Continue ─────────────────────────────────────────────
    const { nodes: n5 } = await tree();
    const continueBtn = n5.find(n =>
      n.role && n.role.value && n.role.value.toLowerCase() === 'button' &&
      axVal(n.name) === 'Continue'
    );
    if (continueBtn) {
      console.log('[11] Clicking Continue...');
      await clickElement(continueBtn.backendDOMNodeId, 'Continue');
      await new Promise(r => setTimeout(r, 5000));
      await screenshot('after-continue');
    } else {
      console.log('[11] Continue button NOT found');
    }
    
    // ── Step 6: Click "Send to everyone now" ──────────────────────────────
    const { nodes: n6 } = await tree();
    const sendBtn = n6.find(n =>
      n.role && n.role.value && n.role.value.toLowerCase() === 'button' &&
      axVal(n.name).includes('Send to everyone now')
    );
    if (sendBtn) {
      console.log('[12] Clicking "Send to everyone now"...');
      await clickElement(sendBtn.backendDOMNodeId, 'Send to everyone now');
      await screenshot('after-send-click');
      
      // ── Step 7: Wait for subscribe dialog and handle it ─────────────────
      const dialogDetected = await waitForDialog(10000);
      await screenshot('dialog-check');
      
      if (dialogDetected) {
        console.log('[13] Subscribe dialog appeared — attempting auto-click...');
        
        // Try JS click on "Publish without buttons"
        const jsResult1 = await jsClick('Publish without buttons');
        console.log('[14] JS click result:', jsResult1);
        await new Promise(r => setTimeout(r, 3000));
        
        // Check if dialog closed
        const { nodes: n7 } = await tree();
        const stillDialog = n7.some(n => n.role && n.role.value && n.role.value.toLowerCase() === 'dialog');
        
        if (!stillDialog) {
          console.log('[15] ✅ SUCCESS — dialog closed, post published!');
          await screenshot('publish-success');
        } else {
          console.log('[15] Dialog still open — trying "Don\'t ask again" + Publish...');
          
          // Try "Don't ask again" checkbox approach
          const dontAskResult = await send('Runtime.evaluate', {
            expression: `
              (function() {
                // Find all checkboxes in the dialog
                var boxes = document.querySelectorAll('[role="checkbox"], input[type="checkbox"]');
                var result = [];
                for (var i = 0; i < boxes.length; i++) {
                  result.push(boxes[i].textContent || boxes[i].value || boxes[i].placeholder || boxes[i].className);
                }
                // Also try finding by text near "again"
                var labels = document.querySelectorAll('label, span, div');
                for (var i = 0; i < labels.length; i++) {
                  if (labels[i].textContent.toLowerCase().includes('again')) {
                    // Try to find associated checkbox
                    var parent = labels[i].closest('[role="dialog"]') || labels[i].parentElement;
                    var cb = parent ? parent.querySelector('[role="checkbox"], input[type="checkbox"]') : null;
                    if (cb) { cb.click(); return 'clicked: ' + labels[i].textContent; }
                  }
                }
                return 'checkboxes: ' + result.join(', ');
              })()
            `,
            returnByValue: true
          });
          console.log('[15b] Don\'t ask again:', dontAskResult && dontAskResult.result ? dontAskResult.result.value : 'none');
          await new Promise(r => setTimeout(r, 2000));
          
          // Final JS click attempt
          const jsResult2 = await jsClick('Publish without buttons');
          console.log('[16] Final JS click:', jsResult2);
          await new Promise(r => setTimeout(r, 4000));
          
          const finalUrl = await getUrl();
          console.log('[17] Final URL:', finalUrl);
          await screenshot('final-state');
        }
      } else {
        // No dialog appeared — check URL for success
        const finalUrl = await getUrl();
        console.log('[13] No dialog. Final URL:', finalUrl);
        if (finalUrl.includes('/confirm') || finalUrl.includes('/success')) {
          console.log('[14] ✅ Possibly published!');
        }
      }
    } else {
      console.log('[12] Send button NOT found — buttons available:');
      const { nodes: n6b } = await tree();
      n6b.filter(n => n.role && n.role.value && n.role.value.toLowerCase() === 'button')
        .forEach(n => console.log('  -', axVal(n.name)));
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
