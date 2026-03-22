// write-and-publish-post.js
// Writes a complete post to Substack and handles the subscribe dialog
const WebSocket = require('C:/Users/marko/.openclaw/mini-blog-engine/automation/substack-newsletter/node_modules/ws');
const fs = require('fs');

const TARGET_ID = 'CF712D9456053DAE8F6EC1FEDDE93571';
const WS_URL = `ws://127.0.0.1:18800/devtools/page/${TARGET_ID}`;

const POST = {
  title: 'Why Robotaxis Are Closer Than You Think — And Why It Matters',
  emailTitle: 'Why Robotaxis Are Closer Than You Think',
  subtitle: 'The quiet revolution happening on city streets right now',
  body: `The next time you're in San Francisco, Phoenix, or Wuhan, look closely at the cars driving past you. One in every fifty — maybe fewer, maybe more — has no one behind the wheel.

Robotaxis have been "almost here" for a decade. But in 2026, something shifted. The technology didn't get twice as good. It got ten times more deployed.

What changed? Two things. First, the sensors — lidar, radar, cameras — got cheap enough to put on every car without making the whole thing cost $200,000. Second, and less obvious: the AI learned to handle the hard cases. Not the 95% of driving that's straightforward highway cruising, but the other 5% — the jaywalking pedestrian, the delivery truck blocking a lane, the cyclist who doesn't signal.

Waymo is now running over 100,000 driverless rides per week across multiple US cities. Baidu's Apollo Go covers parts of Beijing and Shenzhen. WeRide is in Dubai, Singapore, and has deals with Hyundai for Korean deployment.

The economic logic is hard to argue with. A robotaxi runs 22 hours a day, never takes a break, never gets tired, never costs overtime. At scale, estimates suggest per-mile costs could fall below $0.25 — cheaper than owning a car even with a cheap loan.

For cities, the ripple effects are significant. Parking lots take up something like 30% of land area in some urban centres. If car ownership drops, that space gets reclaimed. Traffic patterns change when vehicles are coordinated rather than individual.

But here's what matters most: road fatalities. Globally, about 1.3 million people die in car crashes every year. 94% of them are due to human error. Removing humans from the equation doesn't eliminate crashes, but it dramatically reduces the most catastrophic ones.

This isn't science fiction anymore. It's city infrastructure. The question isn't whether robotaxis are coming — it's how fast cities adapt to them.

Just looking at new ways to spread the positive tech advancements to the world one reader at a time.`
};

let ws;
let msgId = 0;
const pending = {};

function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++msgId;
    pending[id] = (err, result) => err ? reject(err) : resolve(result);
    ws.send(JSON.stringify({ id, method, params }));
    setTimeout(() => { if (pending[id]) { delete pending[id]; reject(new Error('timeout')); } }, 20000);
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

function findByText(nodes, text) {
  text = text.toLowerCase();
  for (const n of nodes) {
    const name = axVal(n.name).toLowerCase();
    if (name.includes(text)) return n;
  }
  return null;
}

async function jsClick(text) {
  // Use JS to find and click an element by its visible text — most reliable for Substack React
  const result = await send('Runtime.evaluate', {
    expression: `
      (function() {
        // Find any element with this text
        var all = document.querySelectorAll('button, [role="button"], a, span, div');
        for (var i = 0; i < all.length; i++) {
          var t = all[i].textContent || '';
          if (t.trim().toLowerCase().includes(${JSON.stringify(text.toLowerCase())})) {
            var el = all[i];
            // Walk up to find a clickable parent
            while (el && el.tagName !== 'BUTTON' && el.getAttribute('role') !== 'button' && el.tagName !== 'A') {
              el = el.parentElement;
            }
            if (el) { el.click(); return 'clicked: ' + t.trim().substring(0, 60); }
          }
        }
        return 'not found: ' + ${JSON.stringify(text)};
      })()
    `,
    returnByValue: true
  });
  return result.result ? result.result.value : 'no result';
}

async function jsClickByTextContaining(texts) {
  const result = await send('Runtime.evaluate', {
    expression: `
      (function() {
        var all = document.querySelectorAll('button, [role="button"]');
        for (var i = 0; i < all.length; i++) {
          var t = (all[i].textContent || '').trim().toLowerCase();
          for (var j = 0; j < arguments.length; j++) {
            if (t.includes(arguments[j].toLowerCase())) {
              all[i].click();
              return 'clicked: ' + all[i].textContent.trim().substring(0, 80);
            }
          }
        }
        return 'not found';
      })()
    `,
    returnByValue: true,
    arguments: texts
  });
  return result.result ? result.result.value : 'no result';
}

async function waitForEditor(helper, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const tree = await send('Accessibility.getFullAXTree');
    const nodes = flattenNodes(tree.nodes || []);
    const titleBox = nodes.find(n =>
      n.role && n.role.value && n.role.value.toLowerCase() === 'textbox' &&
      axVal(n.name).toLowerCase().includes('add a title')
    );
    if (titleBox) return true;
    await new Promise(r => setTimeout(r, 1000));
  }
  return false;
}

(async () => {
  ws = new WebSocket(WS_URL);
  
  ws.on('open', async () => {
    try {
      console.log('[1] Connected, opening Substack...');
      
      // ── Step 1: Navigate to publish dashboard ─────────────────────────────
      await send('Page.navigate', { url: 'https://orbit286020.substack.com/publish/home' });
      await new Promise(r => setTimeout(r, 3000));
      
      let url = await send('Runtime.evaluate', { expression: 'window.location.href', returnByValue: true });
      console.log('[2] URL:', url.result ? url.result.value : 'unknown');
      
      // Screenshot
      let ss = await send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync('C:/Users/marko/.openclaw/mini-blog-engine/automation/substack-newsletter/screenshots/step1-dashboard.png', Buffer.from(ss.data, 'base64'));
      
      let tree = await send('Accessibility.getFullAXTree');
      let nodes = flattenNodes(tree.nodes || []);
      
      // ── Step 2: Click "Create" to write a new post ────────────────────────
      // On the publish dashboard, look for "Create post" or similar
      let createBtn = findByText(nodes, 'create');
      if (!createBtn) createBtn = findByText(nodes, 'new post');
      if (!createBtn) createBtn = findByText(nodes, 'free post');
      if (!createBtn) createBtn = findByText(nodes, 'write');
      
      if (createBtn) {
        console.log('[3] Found button:', axVal(createBtn.name), '— clicking');
        await jsClick(axVal(createBtn.name));
      } else {
        // Try JS click as fallback
        console.log('[3] No create button via accessibility, trying JS');
        const jsResult = await send('Runtime.evaluate', {
          expression: `
            (function() {
              var all = document.querySelectorAll('button');
              var found = [];
              for (var i = 0; i < all.length; i++) {
                found.push(all[i].textContent.trim().substring(0, 50));
              }
              return JSON.stringify(found);
            })()
          `,
          returnByValue: true
        });
        console.log('[3] All buttons:', jsResult.result ? jsResult.result.value : 'none');
        // Click the first "Create" button we find
        await send('Runtime.evaluate', {
          expression: `
            (function() {
              var all = document.querySelectorAll('button, [role="button"]');
              for (var i = 0; i < all.length; i++) {
                var t = (all[i].textContent || '').trim().toLowerCase();
                if (t.includes('create') || t.includes('free post') || t.includes('new post')) {
                  all[i].click(); return 'clicked: ' + t;
                }
              }
              return 'not found';
            })()
          `,
          returnByValue: true
        });
      }
      
      console.log('[4] Waiting for editor to load...');
      await new Promise(r => setTimeout(r, 5000));
      
      ss = await send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync('C:/Users/marko/.openclaw/mini-blog-engine/automation/substack-newsletter/screenshots/step2-after-create.png', Buffer.from(ss.data, 'base64'));
      
      url = await send('Runtime.evaluate', { expression: 'window.location.href', returnByValue: true });
      console.log('[5] URL after create:', url.result ? url.result.value : 'unknown');
      
      // ── Step 3: Wait for editor to be ready ──────────────────────────────
      const editorReady = await waitForEditor(ws, 15000);
      console.log('[6] Editor ready:', editorReady);
      
      if (!editorReady) {
        console.log('[6] Editor did not load — taking screenshot and exiting');
        ss = await send('Page.captureScreenshot', { format: 'png' });
        fs.writeFileSync('C:/Users/marko/.openclaw/mini-blog-engine/automation/substack-newsletter/screenshots/step3-editor-missing.png', Buffer.from(ss.data, 'base64'));
        ws.close();
        return;
      }
      
      // ── Step 4: Check what's in the editor ────────────────────────────────
      tree = await send('Accessibility.getFullAXTree');
      nodes = flattenNodes(tree.nodes || []);
      
      // Show all textboxes
      console.log('[7] Textboxes:');
      nodes.filter(n => n.role && n.role.value && n.role.value.toLowerCase() === 'textbox')
        .forEach(n => console.log('  -', JSON.stringify(axVal(n.name)), '|', n.backendDOMNodeId));
      
      // Show all buttons
      console.log('[7] Buttons:');
      nodes.filter(n => n.role && n.role.value && n.role.value.toLowerCase() === 'button')
        .slice(0, 20)
        .forEach(n => console.log('  -', JSON.stringify(axVal(n.name)), '|', n.backendDOMNodeId));
      
      // ── Step 5: Type the title ─────────────────────────────────────────────
      const titleBox = nodes.find(n =>
        n.role && n.role.value && n.role.value.toLowerCase() === 'textbox' &&
        axVal(n.name).toLowerCase().includes('add a title')
      );
      
      if (titleBox) {
        console.log('[8] Typing title into:', axVal(titleBox.name), 'nodeId:', titleBox.backendDOMNodeId);
        await send('DOM.focus', { backendNodeId: titleBox.backendDOMNodeId }).catch(() => {});
        await new Promise(r => setTimeout(r, 500));
        
        // Clear and type
        await send('Input.dispatchKeyEvent', { type: 'keyDown', modifiers: 3, key: 'a' });
        await send('Input.dispatchKeyEvent', { type: 'keyUp', modifiers: 3, key: 'a' });
        await new Promise(r => setTimeout(r, 200));
        
        for (const ch of POST.title) {
          await send('Input.dispatchKeyEvent', { type: 'keyDown', text: ch });
          await send('Input.dispatchKeyEvent', { type: 'keyUp', text: ch });
          await new Promise(r => setTimeout(r, 30));
        }
        console.log('[9] Title typed:', POST.title.substring(0, 50));
      } else {
        console.log('[8] Title textbox NOT FOUND');
      }
      
      await new Promise(r => setTimeout(r, 1000));
      
      // ── Step 6: Type the subtitle ─────────────────────────────────────────
      tree = await send('Accessibility.getFullAXTree');
      nodes = flattenNodes(tree.nodes || []);
      const subtitleBox = nodes.find(n =>
        n.role && n.role.value && n.role.value.toLowerCase() === 'textbox' &&
        axVal(n.name).toLowerCase().includes('subtitle')
      );
      if (subtitleBox) {
        console.log('[10] Typing subtitle...');
        await send('DOM.focus', { backendNodeId: subtitleBox.backendDOMNodeId }).catch(() => {});
        await new Promise(r => setTimeout(r, 300));
        await send('Input.dispatchKeyEvent', { type: 'keyDown', modifiers: 3, key: 'a' });
        await send('Input.dispatchKeyEvent', { type: 'keyUp', modifiers: 3, key: 'a' });
        for (const ch of POST.subtitle) {
          await send('Input.dispatchKeyEvent', { type: 'keyDown', text: ch });
          await send('Input.dispatchKeyEvent', { type: 'keyUp', text: ch });
          await new Promise(r => setTimeout(r, 30));
        }
        console.log('[10] Subtitle typed');
      } else {
        console.log('[10] Subtitle textbox not found — skipping');
      }
      
      await new Promise(r => setTimeout(r, 1000));
      
      // ── Step 7: Fill the email title (separate from metadata title) ───────
      // Expand "Email header / footer" section
      const emailSectionBtn = nodes.find(n =>
        n.role && n.role.value && n.role.value.toLowerCase() === 'button' &&
        axVal(n.name).toLowerCase().includes('email header')
      );
      if (emailSectionBtn) {
        console.log('[11] Clicking Email header section...');
        await send('Runtime.evaluate', {
          expression: `
            (function() {
              var all = document.querySelectorAll('button, [role="button"]');
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
        await new Promise(r => setTimeout(r, 1000));
      }
      
      // Find and fill the email title textbox
      tree = await send('Accessibility.getFullAXTree');
      nodes = flattenNodes(tree.nodes || []);
      const emailTitleBox = nodes.find(n =>
        n.role && n.role.value && n.role.value.toLowerCase() === 'textbox' &&
        axVal(n.name) === 'Title'
      );
      if (emailTitleBox) {
        console.log('[12] Filling email title...');
        await send('DOM.focus', { backendNodeId: emailTitleBox.backendDOMNodeId }).catch(() => {});
        await new Promise(r => setTimeout(r, 300));
        await send('Input.dispatchKeyEvent', { type: 'keyDown', modifiers: 3, key: 'a' });
        await send('Input.dispatchKeyEvent', { type: 'keyUp', modifiers: 3, key: 'a' });
        for (const ch of POST.emailTitle) {
          await send('Input.dispatchKeyEvent', { type: 'keyDown', text: ch });
          await send('Input.dispatchKeyEvent', { type: 'keyUp', text: ch });
          await new Promise(r => setTimeout(r, 30));
        }
        console.log('[12] Email title filled');
      } else {
        console.log('[12] Email title textbox not found — will fill via JS after body');
      }
      
      // ── Step 8: Paste body content ─────────────────────────────────────────
      // Find and click the ProseMirror body editor
      console.log('[13] Pasting body content...');
      const bodyResult = await send('Runtime.evaluate', {
        expression: `
          (function() {
            // First try: find the contenteditable that IS the body (not a placeholder)
            var pm = document.querySelector('.ProseMirror');
            if (pm) {
              pm.focus();
              return 'prosemirror found: ' + pm.className;
            }
            // Try fallback
            var els = document.querySelectorAll('[contenteditable="true"]');
            for (var i = 0; i < els.length; i++) {
              if (els[i].offsetHeight > 0 && els[i].className) {
                els[i].focus();
                return 'ce found: ' + els[i].className + ' h:' + els[i].offsetHeight;
              }
            }
            return 'not found';
          })()
        `,
        returnByValue: true
      });
      console.log('[13] Body editor:', bodyResult.result ? bodyResult.result.value : 'no result');
      
      // Use insertText or insertHTML to put content in
      const escapedBody = POST.body.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$/g, '\\$');
      await send('Runtime.evaluate', {
        expression: `
          (function() {
            var pm = document.querySelector('.ProseMirror');
            if (!pm) return 'no prosemirror';
            pm.focus();
            
            // Insert paragraph by paragraph
            var paragraphs = arguments[0].split('\\n\\n');
            for (var i = 0; i < paragraphs.length; i++) {
              if (i > 0) {
                document.execCommand('insertParagraph', false, null);
              }
              var text = paragraphs[i].trim();
              if (text) {
                document.execCommand('insertText', false, text);
              }
            }
            return 'inserted ' + paragraphs.length + ' paragraphs';
          })()
        `,
        returnByValue: true,
        arguments: [escapedBody]
      });
      console.log('[14] Body content inserted');
      
      await new Promise(r => setTimeout(r, 2000));
      
      ss = await send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync('C:/Users/marko/.openclaw/mini-blog-engine/automation/substack-newsletter/screenshots/step4-body-entered.png', Buffer.from(ss.data, 'base64'));
      
      // ── Step 9: Click Continue ─────────────────────────────────────────────
      tree = await send('Accessibility.getFullAXTree');
      nodes = flattenNodes(tree.nodes || []);
      
      let continueBtn = nodes.find(n =>
        n.role && n.role.value && n.role.value.toLowerCase() === 'button' &&
        axVal(n.name) === 'Continue'
      );
      if (continueBtn) {
        console.log('[15] Clicking Continue...');
        await jsClick('Continue');
        // Fallback: DOM click
        await send('DOM.focus', { backendNodeId: continueBtn.backendDOMNodeId }).catch(() => {});
      } else {
        console.log('[15] Continue not found, trying JS');
        await jsClick('Continue');
      }
      
      await new Promise(r => setTimeout(r, 5000));
      
      ss = await send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync('C:/Users/marko/.openclaw/mini-blog-engine/automation/substack-newsletter/screenshots/step5-after-continue.png', Buffer.from(ss.data, 'base64'));
      
      // ── Step 10: Look for "Send to everyone now" ───────────────────────────
      tree = await send('Accessibility.getFullAXTree');
      nodes = flattenNodes(tree.nodes || []);
      
      let sendBtn = nodes.find(n =>
        n.role && n.role.value && n.role.value.toLowerCase() === 'button' &&
        axVal(n.name).includes('Send to everyone now')
      );
      
      if (!sendBtn) {
        // Try "Email" tab or "Send" options
        console.log('[16] Send button not found — checking for email options...');
        const emailTab = nodes.find(n =>
          n.role && n.role.value && n.role.value.toLowerCase() === 'button' &&
          axVal(n.name).toLowerCase().includes('email')
        );
        if (emailTab) {
          console.log('[16] Clicking Email button...');
          await jsClick(axVal(emailTab.name));
          await new Promise(r => setTimeout(r, 2000));
        }
        
        // List all buttons after Continue
        tree = await send('Accessibility.getFullAXTree');
        nodes = flattenNodes(tree.nodes || []);
        console.log('[16] All buttons now:');
        nodes.filter(n => n.role && n.role.value && n.role.value.toLowerCase() === 'button')
          .forEach(n => console.log('  -', JSON.stringify(axVal(n.name))));
      } else {
        console.log('[16] Found Send button, clicking...');
        await jsClick('Send to everyone now');
        await new Promise(r => setTimeout(r, 3000));
      }
      
      // ── Step 11: Handle subscribe dialog ───────────────────────────────────
      console.log('[17] Waiting for subscribe dialog...');
      await new Promise(r => setTimeout(r, 5000));
      
      tree = await send('Accessibility.getFullAXTree');
      const hasDialog = (tree.nodes || []).some(n =>
        n.role && n.role.value && n.role.value.toLowerCase() === 'dialog'
      );
      console.log('[18] Dialog present:', hasDialog);
      
      if (hasDialog) {
        console.log('[19] Clicking "Publish without buttons" or "Add subscribe buttons"...');
        
        // Try "Publish without buttons" first (it was the secondary option that still publishes)
        let result = await send('Runtime.evaluate', {
          expression: `
            (function() {
              var all = document.querySelectorAll('[role="dialog"] button, .modal button, button');
              for (var i = 0; i < all.length; i++) {
                var t = (all[i].textContent || '').trim().toLowerCase();
                if (t.includes('publish without')) {
                  all[i].click(); return 'clicked: ' + all[i].textContent.trim();
                }
              }
              // Also try "Add subscribe" since that definitely publishes
              for (var i = 0; i < all.length; i++) {
                var t = (all[i].textContent || '').trim().toLowerCase();
                if (t.includes('add subscribe') || t.includes('subscribe')) {
                  all[i].click(); return 'clicked: ' + all[i].textContent.trim();
                }
              }
              return 'nothing matched';
            })()
          `,
          returnByValue: true
        });
        console.log('[19] Dialog click result:', result.result ? result.result.value : 'no result');
        
        await new Promise(r => setTimeout(r, 5000));
        
        // Check if published
        url = await send('Runtime.evaluate', { expression: 'window.location.href', returnByValue: true });
        console.log('[20] URL after dialog:', url.result ? url.result.value : 'unknown');
        
        // Check for dialog still open
        tree = await send('Accessibility.getFullAXTree');
        const stillHasDialog = (tree.nodes || []).some(n =>
          n.role && n.role.value && n.role.value.toLowerCase() === 'dialog'
        );
        
        if (!stillHasDialog) {
          console.log('[21] ✅ PUBLISH APPEARS SUCCESSFUL — dialog closed');
        } else {
          console.log('[21] ⚠️ Dialog still open — trying "Add subscribe buttons"');
          await jsClick('Add subscribe buttons');
          await new Promise(r => setTimeout(r, 5000));
        }
      } else {
        // No dialog — check URL
        url = await send('Runtime.evaluate', { expression: 'window.location.href', returnByValue: true });
        console.log('[18] No dialog. URL:', url.result ? url.result.value : 'unknown');
        
        // Check if already redirected to published page
        if (url.result && url.result.value.includes('/p/')) {
          console.log('[18] ✅ APPEARS PUBLISHED — URL has post slug');
        }
      }
      
      // Final screenshot
      ss = await send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync('C:/Users/marko/.openclaw/mini-blog-engine/automation/substack-newsletter/screenshots/step6-final.png', Buffer.from(ss.data, 'base64'));
      
      console.log('[DONE]');
      
    } catch(e) {
      console.error('[ERROR]', e.message);
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
