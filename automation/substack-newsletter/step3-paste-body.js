// step3-paste-body.js — Paste body content into ProseMirror editor
// Uses innerHTML approach (confirmed working: inserts content AND clears the "Please write something" warning)
const WebSocket = require('C:/Users/marko/.openclaw/mini-blog-engine/automation/substack-newsletter/node_modules/ws');
const fs = require('fs');
const TARGET = 'CF712D9456053DAE8F6EC1FEDDE93571';
const WS_URL = `ws://127.0.0.1:18800/devtools/page/${TARGET}`;
const SCREENSHOT_DIR = 'C:/Users/marko/.openclaw/mini-blog-engine/automation/substack-newsletter/screenshots/';

const BODY = `Microsoft Copilot started as an autocomplete for code. Type a function name, it fills in the body. Helpful, but limited. It didn't understand context — your project structure, your coding style, your architecture decisions.

That changed. Copilot is now something closer to a pair programmer who never gets tired, never gets snappy, and has read essentially every public code repository on earth.

**What the new Copilot actually does**

The shift is from prediction to reasoning. Instead of just finishing your line, it can:

- Explain what a block of unfamiliar code does, line by line
- Suggest entire refactors based on your comments
- Write tests that actually match your implementation's intent
- Spot potential bugs before you run the code
- Navigate a new codebase and answer questions about it

The difference sounds small but feels large. It's the difference between a smart clipboard and a thoughtful colleague.

**The context window is the key**

What makes this work isn't just the underlying model — it's the context window. Copilot now has access to your entire codebase via the agent mode. It can read your existing functions, understand your naming conventions, see how your modules fit together.

A simple example: you ask it to "add authentication to this endpoint." It reads your existing auth middleware, sees how your other endpoints handle sessions, and writes code that actually fits your pattern — not generic boilerplate.

**What developers are actually saying**

The response from professional developers has been more positive than expected. The initial fear was that AI would write bad code that looked plausible — the so-called "fluent speaker" problem. That still happens. But with better context and the ability to run and test code, developers report catching those cases quickly.

The developers who get the most value treat Copilot like a very knowledgeable junior colleague: they review everything it writes, they ask it to explain its reasoning, and they use it for the tedious parts — writing boilerplate, searching documentation, generating test cases — while they focus on the architectural decisions that actually require human judgment.

**The practical impact**

Across Microsoft's own engineering org, the numbers are telling. Developers complete certain categories of tasks 30-40% faster when using Copilot. For the kinds of repetitive, well-defined tasks that make up a surprising amount of coding work, the speedup is real.

This doesn't mean the job is changing tomorrow. But it does mean the baseline of what a single developer can accomplish is shifting upward. The bottleneck is no longer typing speed — it's knowing what to build.`;

let ws, msgId = 0;
const p = {};
const send = (m, ps = {}) => new Promise((rs, rj) => {
  const id = ++msgId; p[id] = (e, r) => e ? rj(e) : rs(r);
  ws.send(JSON.stringify({ id, method: m, params: ps }));
  setTimeout(() => { if (p[id]) { delete p[id]; rj(new Error('timeout: ' + m)); } }, 15000);
});

async function saveScreenshot(label) {
  const ss = await send('Page.captureScreenshot', { format: 'png' });
  const path = `${SCREENSHOT_DIR}step3-${label}.png`;
  fs.writeFileSync(path, Buffer.from(ss.data, 'base64'));
  return path;
}

(async () => {
  ws = new WebSocket(WS_URL);
  ws.on('open', async () => {
    try {
      // Check we're on the editor
      const url = await send('Runtime.evaluate', { expression: 'window.location.href', returnByValue: true });
      console.log('[1] URL:', url.result ? url.result.value : 'unknown');
      
      // Check current body state
      const beforeBody = await send('Runtime.evaluate', {
        expression: `
          (function() {
            var pm = document.querySelector('.ProseMirror');
            if (!pm) return 'no ProseMirror';
            return 'textContent length: ' + pm.textContent.length + ' | html: ' + pm.innerHTML.substring(0, 100);
          })()
        `,
        returnByValue: true
      });
      console.log('[2] Before — ProseMirror:', beforeBody.result ? beforeBody.result.value : 'none');
      
      // Check warning
      const beforeWarn = await send('Runtime.evaluate', {
        expression: `
          (function() {
            var els = document.querySelectorAll('*');
            for (var i = 0; i < els.length; i++) {
              if ((els[i].textContent || '').includes('Please write something')) return 'WARNING: ' + els[i].textContent.trim().substring(0, 80);
            }
            return 'no warning';
          })()
        `,
        returnByValue: true
      });
      console.log('[3] Before — warning:', beforeWarn.result ? beforeWarn.result.value : 'none');
      
      // Build HTML for body — convert newlines to paragraphs
      const paragraphs = BODY.split('\n\n').map(p => p.trim()).filter(p => p);
      // Remove bold markers for plain text insertion
      const htmlParas = paragraphs.map(p => {
        const clean = p.replace(/\*\*(.+?)\*\*/g, '$1');
        return `<p>${clean.replace(/\n/g, '<br>')}</p>`;
      }).join('');
      
      console.log('[4] Inserting', paragraphs.length, 'paragraphs via innerHTML...');
      const result = await send('Runtime.evaluate', {
        expression: `
          (function(html) {
            var pm = document.querySelector('.ProseMirror');
            if (!pm) return 'no ProseMirror';
            pm.innerHTML = html;
            pm.dispatchEvent(new Event('input', { bubbles: true }));
            return 'inserted, new length: ' + pm.textContent.length;
          })($1)
        `,
        returnByValue: true,
        args: [htmlParas]
      });
      console.log('[5] Insert result:', result.result ? result.result.value : 'none');
      
      // Check warning is gone
      const afterWarn = await send('Runtime.evaluate', {
        expression: `
          (function() {
            var els = document.querySelectorAll('*');
            for (var i = 0; i < els.length; i++) {
              if ((els[i].textContent || '').includes('Please write something')) return 'WARNING STILL THERE: ' + els[i].textContent.trim().substring(0, 80);
            }
            return 'no warning';
          })()
        `,
        returnByValue: true
      });
      console.log('[6] After — warning:', afterWarn.result ? afterWarn.result.value : 'none');
      
      await new Promise(r => setTimeout(r, 1000));
      await saveScreenshot('body-pasted');
      
      // Check body text
      const afterBody = await send('Runtime.evaluate', {
        expression: `
          (function() {
            var pm = document.querySelector('.ProseMirror');
            if (!pm) return 'no ProseMirror';
            return 'length: ' + pm.textContent.length + ' | preview: ' + pm.textContent.substring(0, 100);
          })()
        `,
        returnByValue: true
      });
      console.log('[7] After — ProseMirror:', afterBody.result ? afterBody.result.value : 'none');
      
      console.log('\n✅ Step 3 complete — body inserted. Screenshot saved.');
      
    } catch (e) {
      console.error('[ERROR]', e.message);
    }
    ws.close();
  });
  ws.on('message', d => { const m = JSON.parse(d); if (m.id && p[m.id]) { const c = p[m.id]; delete p[m.id]; c(null, m.result); } });
  ws.on('error', e => console.error('WS error:', e.message));
})();
