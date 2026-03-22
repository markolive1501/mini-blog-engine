// publish-complete.js — writes a full post and handles the subscribe dialog
// Key insight: use /publish/post/ (no ID) to get a fresh draft editor
const WebSocket = require('C:/Users/marko/.openclaw/mini-blog-engine/automation/substack-newsletter/node_modules/ws');
const fs = require('fs');

const TARGET_ID = 'CF712D9456053DAE8F6EC1FEDDE93571';
const WS_URL = `ws://127.0.0.1:18800/devtools/page/${TARGET_ID}`;

const POST = {
  title: 'Why Robotaxis Are Closer Than You Think — And Why It Matters',
  emailTitle: 'Why Robotaxis Are Closer Than You Think',
  subtitle: 'The quiet revolution happening on city streets right now',
  description: 'Robotaxis are no longer science fiction. Waymo runs 100,000+ driverless rides per week. Here is why this matters for every city.',
  body: `The next time you're in San Francisco, Phoenix, or Wuhan, look closely at the cars driving past you. One in every fifty — maybe fewer, maybe more — has no one behind the wheel.

Robotaxis have been "almost here" for a decade. But in 2026, something shifted. The technology didn't get twice as good. It got ten times more deployed.

**What changed?** Two things. First, the sensors — lidar, radar, cameras — got cheap enough to put on every car without making the whole thing cost $200,000. Second, and less obvious: the AI learned to handle the hard cases. Not the 95% of driving that's straightforward highway cruising, but the other 5% — the jaywalking pedestrian, the delivery truck blocking a lane, the cyclist who doesn't signal.

Waymo is now running over 100,000 driverless rides per week across multiple US cities. Baidu's Apollo Go covers parts of Beijing and Shenzhen. WeRide is in Dubai, Singapore, and has deals with Hyundai for Korean deployment.

The economic logic is hard to argue with. A robotaxi runs 22 hours a day, never takes a break, never gets tired, never costs overtime. At scale, estimates suggest per-mile costs could fall below $0.25 — cheaper than owning a car even with a cheap loan.

For cities, the ripple effects are significant. Parking lots take up something like 30% of land area in some urban centres. If car ownership drops, that space gets reclaimed. Traffic patterns change when vehicles are coordinated rather than individual.

But here's what matters most: road fatalities. Globally, about 1.3 million people die in car crashes every year. 94% of them are due to human error. Removing humans from the equation doesn't eliminate crashes, but it dramatically reduces the most catastrophic ones.

This isn't science fiction anymore. It's city infrastructure. The question isn't whether robotaxis are coming — it's how fast cities adapt to them.`
};

let ws;
let msgId = 0;
const pending = {};

function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++msgId;
    pending[id] = (err, result) => err ? reject(err) : resolve(result);
    ws.send(JSON.stringify({ id, method, params }));
    setTimeout(() => { if (pending[id]) { delete pending[id]; reject(new Error(`timeout: ${method}`)); } }, 20000);
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

async function jsClickContaining(...texts) {
  const result = await send('Runtime.evaluate', {
    expression: `
      (function(texts) {
        var all = document.querySelectorAll('button, [role="button"]');
        for (var i = 0; i < all.length; i++) {
          var t = (all[i].textContent || '').trim();
          for (var j = 0; j < texts.length; j++) {
            if (t.toLowerCase().includes(texts[j].toLowerCase())) {
              all[i].click();
              return 'clicked: ' + t.substring(0, 80);
            }
          }
        }
        return 'not found';
      })($1)
    `,
    returnByValue: true,
    args: texts
  });
  return result.result ? result.result.value : 'no result';
}

async function fillTextboxByPlaceholder(placeholder, text) {
  const result = await send('Runtime.evaluate', {
    expression: `
      (function(ph, txt) {
        var inputs = document.querySelectorAll('input[placeholder*="'+ph+'"], textarea[placeholder*="'+ph+'"]');
        for (var i = 0; i < inputs.length; i++) {
          if (inputs[i].placeholder.toLowerCase().includes(ph.toLowerCase())) {
            inputs[i].focus();
            inputs[i].select();
            document.execCommand('insertText', false, txt);
            return 'filled: ' + inputs[i].placeholder;
          }
        }
        return 'not found: ' + ph;
      })($1, $2)
    `,
    returnByValue: true,
    args: [placeholder, text]
  });
  return result.result ? result.result.value : 'no result';
}

(async () => {
  ws = new WebSocket(WS_URL);
  
  ws.on('open', async () => {
    try {
      // ── Step 1: Open fresh draft editor ─────────────────────────────────
      console.log('[1] Opening fresh draft editor...');
      await send('Page.navigate', { url: 'https://orbit286020.substack.com/publish/post/' });
      await new Promise(r => setTimeout(r, 5000));
      
      const url = await send('Runtime.evaluate', { expression: 'window.location.href', returnByValue: true });
      console.log('[2] Editor URL:', url.result ? url.result.value : 'unknown');
      
      let ss = await send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync('C:/Users/marko/.openclaw/mini-blog-engine/automation/substack-newsletter/screenshots/pc1-editor.png', Buffer.from(ss.data, 'base64'));
      console.log('[2] Screenshot saved');
      
      let tree = await send('Accessibility.getFullAXTree');
      let nodes = flattenNodes(tree.nodes || []);
      
      // ── Step 2: Fill metadata title ─────────────────────────────────────
      const titleTB = nodes.find(n =>
        n.role && n.role.value && n.role.value.toLowerCase() === 'textbox' &&
        axVal(n.name).toLowerCase().includes('add a title')
      );
      if (titleTB) {
        console.log('[3] Filling metadata title (nodeId:', titleTB.backendDOMNodeId + ')...');
        await send('DOM.focus', { backendNodeId: titleTB.backendDOMNodeId });
        await new Promise(r => setTimeout(r, 300));
        await send('Input.dispatchKeyEvent', { type: 'keyDown', modifiers: 3, key: 'a' });
        await send('Input.dispatchKeyEvent', { type: 'keyUp', modifiers: 3, key: 'a' });
        for (const ch of POST.title) {
          await send('Input.dispatchKeyEvent', { type: 'keyDown', text: ch });
          await send('Input.dispatchKeyEvent', { type: 'keyUp', text: ch });
          await new Promise(r => setTimeout(r, 20));
        }
        console.log('[3] Metadata title done');
      } else {
        console.log('[3] ERROR: title textbox not found');
      }
      await new Promise(r => setTimeout(r, 800));
      
      // ── Step 3: Fill description ────────────────────────────────────────
      tree = await send('Accessibility.getFullAXTree');
      nodes = flattenNodes(tree.nodes || []);
      const descTB = nodes.find(n =>
        n.role && n.role.value && n.role.value.toLowerCase() === 'textbox' &&
        axVal(n.name).toLowerCase().includes('add a description')
      );
      if (descTB) {
        console.log('[4] Filling description...');
        await send('DOM.focus', { backendNodeId: descTB.backendDOMNodeId });
        await new Promise(r => setTimeout(r, 300));
        await send('Input.dispatchKeyEvent', { type: 'keyDown', modifiers: 3, key: 'a' });
        await send('Input.dispatchKeyEvent', { type: 'keyUp', modifiers: 3, key: 'a' });
        for (const ch of POST.description) {
          await send('Input.dispatchKeyEvent', { type: 'keyDown', text: ch });
          await send('Input.dispatchKeyEvent', { type: 'keyUp', text: ch });
          await new Promise(r => setTimeout(r, 20));
        }
        console.log('[4] Description done');
      }
      await new Promise(r => setTimeout(r, 800));
      
      // ── Step 4: Fill email title (CRITICAL — this is in the Email section) ──
      // First expand the Email header/footer section
      console.log('[5] Expanding Email header section...');
      await jsClickContaining('email header', 'email');
      await new Promise(r => setTimeout(r, 1500));
      
      tree = await send('Accessibility.getFullAXTree');
      nodes = flattenNodes(tree.nodes || []);
      
      // The email title textbox has placeholder "Title" (exact match)
      const emailTitleTB = nodes.find(n =>
        n.role && n.role.value && n.role.value.toLowerCase() === 'textbox' &&
        axVal(n.name) === 'Title'
      );
      if (emailTitleTB) {
        console.log('[5] Filling email title (nodeId:', emailTitleTB.backendDOMNodeId + ')...');
        await send('DOM.focus', { backendNodeId: emailTitleTB.backendDOMNodeId });
        await new Promise(r => setTimeout(r, 300));
        await send('Input.dispatchKeyEvent', { type: 'keyDown', modifiers: 3, key: 'a' });
        await send('Input.dispatchKeyEvent', { type: 'keyUp', modifiers: 3, key: 'a' });
        for (const ch of POST.emailTitle) {
          await send('Input.dispatchKeyEvent', { type: 'keyDown', text: ch });
          await send('Input.dispatchKeyEvent', { type: 'keyUp', text: ch });
          await new Promise(r => setTimeout(r, 20));
        }
        console.log('[5] Email title done');
      } else {
        console.log('[5] Email title textbox not found — trying JS fallback');
        const r = await fillTextboxByPlaceholder('title', POST.emailTitle);
        console.log('[5] JS fill result:', r);
      }
      await new Promise(r => setTimeout(r, 800));
      
      // ── Step 5: Fill subtitle ────────────────────────────────────────────
      tree = await send('Accessibility.getFullAXTree');
      nodes = flattenNodes(tree.nodes || []);
      const subtitleTB = nodes.find(n =>
        n.role && n.role.value && n.role.value.toLowerCase() === 'textbox' &&
        axVal(n.name).toLowerCase().includes('subtitle')
      );
      if (subtitleTB) {
        console.log('[6] Filling subtitle...');
        await send('DOM.focus', { backendNodeId: subtitleTB.backendDOMNodeId });
        await new Promise(r => setTimeout(r, 300));
        await send('Input.dispatchKeyEvent', { type: 'keyDown', modifiers: 3, key: 'a' });
        await send('Input.dispatchKeyEvent', { type: 'keyUp', modifiers: 3, key: 'a' });
        for (const ch of POST.subtitle) {
          await send('Input.dispatchKeyEvent', { type: 'keyDown', text: ch });
          await send('Input.dispatchKeyEvent', { type: 'keyUp', text: ch });
          await new Promise(r => setTimeout(r, 20));
        }
        console.log('[6] Subtitle done');
      }
      await new Promise(r => setTimeout(r, 800));
      
      ss = await send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync('C:/Users/marko/.openclaw/mini-blog-engine/automation/substack-newsletter/screenshots/pc2-fields-filled.png', Buffer.from(ss.data, 'base64'));
      
      // ── Step 6: Paste body into ProseMirror ─────────────────────────────
      console.log('[7] Pasting body into ProseMirror...');
      const bodyResult = await send('Runtime.evaluate', {
        expression: `
          (function() {
            var pm = document.querySelector('.ProseMirror');
            if (!pm) return 'PROSEMIRROR NOT FOUND';
            pm.focus();
            return 'prosemirror found, height=' + pm.offsetHeight;
          })()
        `,
        returnByValue: true
      });
      console.log('[7]', bodyResult.result ? bodyResult.result.value : 'no result');
      
      // Insert body text paragraph by paragraph
      const paras = POST.body.split('\n\n');
      for (let i = 0; i < paras.length; i++) {
        const text = paras[i].trim();
        if (!text) continue;
        // Replace **text** with styled spans
        const cleanText = text.replace(/\*\*(.+?)\*\*/g, '$1');
        await send('Runtime.evaluate', {
          expression: `
            (function(txt) {
              var pm = document.querySelector('.ProseMirror');
              if (!pm) return 'no pm';
              var el = document.activeElement;
              if (!el || !el.className || !el.className.includes('ProseMirror')) {
                pm.focus();
                el = pm;
              }
              document.execCommand('insertText', false, txt);
              return 'inserted: ' + txt.substring(0, 30);
            })($1)
          `,
          returnByValue: true,
          args: [cleanText]
        });
        // Add double newline for paragraph break
        if (i < paras.length - 1) {
          await send('Runtime.evaluate', {
            expression: `document.execCommand('insertParagraph', false, null)`,
            returnByValue: true
          });
        }
        await new Promise(r => setTimeout(r, 100));
      }
      console.log('[8] Body paragraphs inserted:', paras.length);
      
      await new Promise(r => setTimeout(r, 2000));
      
      ss = await send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync('C:/Users/marko/.openclaw/mini-blog-engine/automation/substack-newsletter/screenshots/pc3-body-pasted.png', Buffer.from(ss.data, 'base64'));
      
      // ── Step 7: Click Continue ───────────────────────────────────────────
      console.log('[9] Looking for Continue button...');
      tree = await send('Accessibility.getFullAXTree');
      nodes = flattenNodes(tree.nodes || []);
      
      let continueBtn = nodes.find(n =>
        n.role && n.role.value && n.role.value.toLowerCase() === 'button' &&
        axVal(n.name) === 'Continue'
      );
      if (continueBtn) {
        console.log('[9] Clicking Continue...');
        await jsClickContaining('continue');
      } else {
        console.log('[9] Continue not in tree — trying JS click');
        await jsClickContaining('continue');
      }
      await new Promise(r => setTimeout(r, 5000));
      
      ss = await send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync('C:/Users/marko/.openclaw/mini-blog-engine/automation/substack-newsletter/screenshots/pc4-after-continue.png', Buffer.from(ss.data, 'base64'));
      console.log('[10] Screenshot after Continue');
      
      // ── Step 8: Click "Send to everyone now" ──────────────────────────────
      console.log('[11] Looking for Send button...');
      tree = await send('Accessibility.getFullAXTree');
      nodes = flattenNodes(tree.nodes || []);
      
      // Look for the Send button
      let sendBtn = nodes.find(n =>
        n.role && n.role.value && n.role.value.toLowerCase() === 'button' &&
        (axVal(n.name).includes('Send to everyone now') || axVal(n.name).includes('Email subscribers'))
      );
      
      if (sendBtn) {
        console.log('[11] Found:', axVal(sendBtn.name), '— clicking via JS');
        await jsClickContaining('Send to everyone now');
      } else {
        console.log('[11] Not found — listing all buttons:');
        nodes.filter(n => n.role && n.role.value && n.role.value.toLowerCase() === 'button')
          .forEach(n => console.log('  button:', JSON.stringify(axVal(n.name))));
        // Try JS anyway
        await jsClickContaining('send', 'everyone');
      }
      
      await new Promise(r => setTimeout(r, 5000));
      
      ss = await send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync('C:/Users/marko/.openclaw/mini-blog-engine/automation/substack-newsletter/screenshots/pc5-after-send.png', Buffer.from(ss.data, 'base64'));
      console.log('[12] Screenshot after Send');
      
      // ── Step 9: Handle subscribe dialog ───────────────────────────────────
      console.log('[13] Checking for subscribe dialog...');
      await new Promise(r => setTimeout(r, 3000));
      
      tree = await send('Accessibility.getFullAXTree');
      const hasDialog = (tree.nodes || []).some(n =>
        n.role && n.role.value && n.role.value.toLowerCase() === 'dialog'
      );
      console.log('[13] Dialog present:', hasDialog);
      
      if (hasDialog) {
        console.log('[14] Subscribe dialog detected — clicking "Publish without buttons"...');
        
        // Click the "Publish without buttons" secondary option
        let result = await send('Runtime.evaluate', {
          expression: `
            (function() {
              var all = document.querySelectorAll('[role="dialog"] button, .modal button, dialog button');
              var names = [];
              for (var i = 0; i < all.length; i++) {
                names.push(all[i].textContent.trim());
              }
              // Click "Publish without buttons"
              for (var i = 0; i < all.length; i++) {
                var t = (all[i].textContent || '').trim();
                if (t.toLowerCase().includes('without')) {
                  all[i].click(); return 'CLICKED: ' + t;
                }
              }
              // If not found, click the first button (usually "Add subscribe buttons" which also publishes)
              if (all.length > 0) {
                all[0].click(); return 'CLICKED FIRST: ' + names[0];
              }
              return 'NO BUTTONS: ' + names.join(', ');
            })()
          `,
          returnByValue: true
        });
        console.log('[14] Click result:', result.result ? result.result.value : 'none');
        
        await new Promise(r => setTimeout(r, 6000));
        
        // Check URL
        const postUrl = await send('Runtime.evaluate', { expression: 'window.location.href', returnByValue: true });
        console.log('[15] URL after dialog:', postUrl.result ? postUrl.result.value : 'unknown');
        
        const finalTree = await send('Accessibility.getFullAXTree');
        const dialogStillOpen = (finalTree.nodes || []).some(n =>
          n.role && n.role.value && n.role.value.toLowerCase() === 'dialog'
        );
        console.log('[15] Dialog still open:', dialogStillOpen);
        
        if (!dialogStillOpen && postUrl.result && postUrl.result.value.includes('/p/')) {
          console.log('[15] ✅ PUBLISH SUCCESSFUL!');
        } else if (!dialogStillOpen) {
          console.log('[15] ⚠️ Dialog closed but URL unexpected — might have succeeded');
        } else {
          console.log('[15] ⚠️ Dialog still open — post may not have published');
        }
      } else {
        // No dialog — check URL
        const postUrl = await send('Runtime.evaluate', { expression: 'window.location.href', returnByValue: true });
        console.log('[13] No dialog. URL:', postUrl.result ? postUrl.result.value : 'unknown');
        if (postUrl.result && postUrl.result.value.includes('/p/')) {
          console.log('[13] ✅ APPEARS PUBLISHED');
        }
      }
      
      ss = await send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync('C:/Users/marko/.openclaw/mini-blog-engine/automation/substack-newsletter/screenshots/pc6-final.png', Buffer.from(ss.data, 'base64'));
      console.log('[DONE]');
      
    } catch(e) {
      console.error('[ERROR]', e.message, e.stack);
    }
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
