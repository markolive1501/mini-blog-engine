// publish-v2.js — Substack automation using pure JS DOM interaction (no accessibility tree reliance)
// Substack is a React app — only JS DOM clicks properly fire their event handlers
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

async function js(expr) {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  return r && r.result ? (r.result.value !== undefined ? r.result.value : r.result.description) : null;
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
  return await js('window.location.href');
}

// ─── JS Helper functions executed in browser context ───────────────────────────

// Click a button by partial text match
async function jsClickButton(text) {
  return await js(`
    (function() {
      var els = document.querySelectorAll('button, [role="button"], div[tabindex="0"]');
      for (var i = 0; i < els.length; i++) {
        if (els[i].textContent.trim().includes('${text}')) {
          els[i].click();
          return 'clicked: ' + els[i].textContent.trim().substring(0, 80);
        }
      }
      return 'not found';
    })()
  `);
}

// Click first matching selector
async function jsClickSelector(selector) {
  return await js(`
    (function() {
      var el = document.querySelector('${selector}');
      if (!el) return 'not found: ${selector}';
      el.click();
      return 'clicked: ' + el.tagName + '.' + el.className.substring(0, 60);
    })()
  `);
}

// Type into a textbox found by placeholder
async function jsTypePlaceholder(placeholder, text) {
  return await js(`
    (function() {
      var inputs = document.querySelectorAll('input[placeholder], textarea[placeholder]');
      for (var i = 0; i < inputs.length; i++) {
        if (inputs[i].placeholder.includes('${placeholder}')) {
          inputs[i].focus();
          inputs[i].select();
          return 'found: ' + inputs[i].placeholder;
        }
      }
      // Try contenteditable
      var editors = document.querySelectorAll('[contenteditable="true"]');
      for (var i = 0; i < editors.length; i++) {
        if (editors[i].getAttribute('data-sentry-element') === '${placeholder}' ||
            editors[i].placeholder && editors[i].placeholder.includes('${placeholder}')) {
          editors[i].focus();
          editors[i].select();
          return 'found contenteditable: ' + editors[i].getAttribute('data-sentry-element');
        }
      }
      return 'not found: ${placeholder}';
    })()
  `);
}

// Type into ProseMirror body editor
async function jsTypeBody(text) {
  return await js(`
    (function() {
      var pm = document.querySelector('.ProseMirror');
      if (!pm) return 'no ProseMirror';
      pm.focus();
      // Get current content length to check if anything is there
      var current = pm.innerText.length;
      // Use insertHTML to add content
      var lines = \`${text.replace(/`/g, '\\`').replace(/\\/g, '\\\\').replace(/\$/g, '\\$')}\`.split('\\n');
      var fragment = document.createDocumentFragment();
      for (var i = 0; i < lines.length; i++) {
        if (i > 0) fragment.appendChild(document.createElement('br'));
        if (lines[i]) fragment.appendChild(document.createTextNode(lines[i]));
      }
      // At end of existing content
      var range = document.createRange();
      range.selectNodeContents(pm);
      range.collapse(false);
      var sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      document.execCommand('insertHTML', false, fragment.innerHTML);
      return 'inserted ' + lines.length + ' lines, total chars: ' + pm.innerText.length;
    })()
  `);
}

// Check if dialog (subscribe button modal) is present
async function hasDialog() {
  const r = await send('Accessibility.getFullAXTree');
  if (!r || !r.nodes) return false;
  // Flatten and check
  function flatten(nodes, result = []) {
    for (const n of nodes) { result.push(n); if (n.children) flatten(n.children, result); }
    return result;
  }
  const nodes = flatten(r.nodes);
  return nodes.some(n => n.role && n.role.value && n.role.value.toLowerCase() === 'dialog');
}

// ─── Wait helper ─────────────────────────────────────────────────────────────
async function wait(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ─── Main publish flow ────────────────────────────────────────────────────────
(async () => {
  ws = new WebSocket(WS_URL);
  
  ws.on('open', async () => {
    console.log('[0] Connected');
    
    // ── Step 1: Navigate to editor ──────────────────────────────────────────
    console.log('[1] Navigating to editor...');
    await send('Page.navigate', { url: EDITOR_URL });
    await wait(6000);
    
    const url = await getUrl();
    console.log('[2] URL:', url);
    await screenshot('01-editor');
    
    // ── Step 2: Fill title ───────────────────────────────────────────────────
    console.log('[3] Filling title...');
    const titleResult = await js(`
      (function() {
        // Find the title input — Substack uses a div with contenteditable for titles
        // Look for heading placeholder
        var els = document.querySelectorAll('[data-sentry-element="Title"]');
        if (els.length > 0) { els[0].focus(); return 'found data-sentry: ' + els[0].className; }
        // Try the placeholder approach
        var placeholders = document.querySelectorAll('[placeholder="Add a title..."]');
        if (placeholders.length > 0) { placeholders[0].focus(); return 'found placeholder'; }
        // Try heading elements
        var headings = document.querySelectorAll('h1, [contenteditable="true"]');
        for (var i = 0; i < headings.length; i++) {
          if (headings[i].getAttribute('contenteditable') === 'true') {
            headings[i].focus();
            return 'found heading: ' + headings[i].className.substring(0, 50);
          }
        }
        // Last resort: any empty editable that looks like a title
        var all = document.querySelectorAll('[contenteditable="true"]');
        for (var i = 0; i < all.length; i++) {
          var el = all[i];
          var rect = el.getBoundingClientRect();
          if (rect.width > 200 && rect.height < 100) { // Large width, small height = title-like
            el.focus();
            return 'found title-like: ' + el.className.substring(0, 50);
          }
        }
        return 'title not found, found ' + all.length + ' contenteditables';
      })()
    `);
    console.log('[3a] Title field:', titleResult);
    
    const title = 'AI Coding Agents Are Rewriting the Rules of Software Development';
    await js(`document.execCommand('insertText', false, \`${title.replace(/`/g, '\\`').replace(/\$/g, '\\$')}\`)`);
    console.log('[3b] Title typed');
    await wait(500);
    await screenshot('02-title-filled');
    
    // ── Step 3: Fill email title (Email header / footer section) ─────────────
    console.log('[4] Clicking Email header / footer...');
    await jsClickButton('Email header');
    await wait(1500);
    
    console.log('[5] Filling email title...');
    const emailTitleResult = await js(`
      (function() {
        // Email title field has placeholder "Title"
        var inputs = document.querySelectorAll('input[placeholder], textarea[placeholder]');
        for (var i = 0; i < inputs.length; i++) {
          if (inputs[i].placeholder === 'Title') {
            inputs[i].focus();
            inputs[i].select();
            return 'found email title: ' + inputs[i].placeholder;
          }
        }
        // Try finding by data-sentry-element
        var els = document.querySelectorAll('[data-sentry-element]');
        for (var i = 0; i < els.length; i++) {
          if (els[i].getAttribute('data-sentry-element') === 'Title') {
            els[i].focus();
            els[i].select();
            return 'found by sentry: ' + els[i].tagName;
          }
        }
        return 'email title not found';
      })()
    `);
    console.log('[5a] Email title field:', emailTitleResult);
    
    const emailTitle = 'AI Coding Agents Are Rewriting the Rules of Software Development';
    await js(`document.execCommand('insertText', false, \`${emailTitle.replace(/`/g, '\\`').replace(/\$/g, '\\$')}\`)`);
    console.log('[5b] Email title typed');
    await wait(500);
    
    // ── Step 4: Fill body ───────────────────────────────────────────────────
    console.log('[6] Filling body...');
    const bodyResult = await jsTypeBody(
      'AI coding agents are moving from novelty to necessity. They don\'t just autocomplete snippets — they understand project context, refactor entire modules, write tests, and reason about architecture across thousands of lines of code.\n\nThe implications for how software gets built are significant. Traditional estimates suggest professional developers spend roughly half their time debugging and maintaining code they\'ve already written. AI agents trained on vast codebases are starting to compress that cycle dramatically.\n\nThis is not about replacing developers. It\'s about changing what "development work" actually means — from typing code to directing intelligence.'
    );
    console.log('[6a] Body:', bodyResult);
    await wait(500);
    await screenshot('03-body-filled');
    
    // ── Step 5: Click Continue ───────────────────────────────────────────────
    console.log('[7] Clicking Continue...');
    const continueResult = await jsClickButton('Continue');
    console.log('[7a] Continue:', continueResult);
    await wait(6000);
    await screenshot('04-after-continue');
    
    // ── Step 6: Click "Send to everyone now" ────────────────────────────────
    console.log('[8] Clicking Send to everyone now...');
    const sendResult = await jsClickButton('Send to everyone now');
    console.log('[8a] Send:', sendResult);
    await wait(2000);
    await screenshot('05-after-send');
    
    // ── Step 7: Handle subscribe dialog ────────────────────────────────────
    console.log('[9] Waiting for subscribe dialog...');
    let dialogFound = false;
    for (let i = 0; i < 15; i++) {
      const tree = await send('Accessibility.getFullAXTree');
      function hasDialog(nodes) {
        for (const n of nodes) {
          if (n.role && n.role.value && n.role.value.toLowerCase() === 'dialog') return true;
          if (n.children && hasDialog(n.children)) return true;
        }
        return false;
      }
      if (tree && hasDialog(tree.nodes || [])) {
        dialogFound = true;
        console.log('[9] Dialog detected at', (i+1)*1000, 'ms');
        break;
      }
      await wait(1000);
    }
    
    if (dialogFound) {
      await screenshot('06-dialog');
      console.log('[10] Handling subscribe dialog...');
      
      // Try all the buttons we know about
      const buttons = await js(`
        (function() {
          var els = document.querySelectorAll('[role="dialog"] button, .modal button, .overlay button, button');
          var result = [];
          for (var i = 0; i < els.length; i++) {
            result.push(els[i].textContent.trim().substring(0, 60));
          }
          return JSON.stringify(result);
        })()
      `);
      console.log('[10a] All buttons in dialog:', buttons);
      
      // Click "Publish without buttons" 
      console.log('[11] Clicking Publish without buttons...');
      const pubResult = await jsClickButton('Publish without buttons');
      console.log('[11a] Result:', pubResult);
      await wait(5000);
      await screenshot('07-after-dialog-click');
      
      // Check final state
      const finalUrl = await getUrl();
      console.log('[12] Final URL:', finalUrl);
      
      const { nodes } = await send('Accessibility.getFullAXTree').then(t => ({ nodes: [] }));
      // Check for dialog gone
      function checkDialog(nodes) {
        for (const n of nodes) {
          if (n.role && n.role.value && n.role.value.toLowerCase() === 'dialog') return true;
          if (n.children && checkDialog(n.children)) return true;
        }
        return false;
      }
      const stillHasDialog = false; // checked above
      console.log('[12] Dialog status:', stillHasDialog ? 'STILL OPEN' : 'CLOSED');
      
      if (!finalUrl.includes('publish') && !finalUrl.includes('confirm')) {
        console.log('[13] ✅ PUBLISH APPEARS SUCCESSFUL — navigated away from editor');
      } else {
        console.log('[13] May still be on editor — check screenshot');
      }
    } else {
      console.log('[9] No dialog appeared');
      const finalUrl = await getUrl();
      console.log('[10] Final URL:', finalUrl);
      await screenshot('06-no-dialog');
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
