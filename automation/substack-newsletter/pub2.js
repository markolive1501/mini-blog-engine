const ws = require('C:/Users/marko/.openclaw/mini-blog-engine/automation/substack-newsletter/node_modules/ws');
const fs = require('fs');
const TARGET = 'EC2E01079798BBC0AA6B5FCA0534ABE2';
const WS_URL = 'ws://127.0.0.1:18800/devtools/page/' + TARGET;
const SCREENSHOT_DIR = 'C:/Users/marko/.openclaw/mini-blog-engine/automation/substack-newsletter/screenshots/';

const TITLE = 'AI Coding Agents Are Rewriting the Rules of Software Development';
const EMAIL_TITLE = 'AI Coding Agents Are Rewriting the Rules of Software Development';
const SUBTITLE = 'Microsoft Copilot has evolved from prediction engine to AI pair programmer. Here is what that actually means.';
const DESCRIPTION = 'AI coding agents are moving from novelty to necessity. They understand project context, refactor entire modules, and reason across thousands of lines of code.';

const BODY_HTML = `<p>AI coding agents are moving from novelty to necessity. They don't just autocomplete snippets — they understand project context, refactor entire modules, write tests, and reason about architecture across thousands of lines of code.</p>
<p>The implications for how software gets built are significant. Traditional estimates suggest professional developers spend roughly half their time debugging and maintaining code they've already written. AI agents trained on vast codebases are starting to compress that cycle dramatically.</p>
<p>This is not about replacing developers. It is about changing what "development work" actually means — from typing code to directing intelligence.</p>
<p><strong>What the new generation of AI coding tools can do</strong></p>
<p>The shift goes beyond autocomplete. Modern AI coding assistants can read an entire codebase and answer questions about architecture, suggest refactors that account for patterns across hundreds of files, write test suites that actually cover edge cases, and spot potential bugs before code is committed.</p>
<p>The key enabler is context window size. When an AI can see your entire project — not just the file you're editing — it can reason about code the way a senior developer would: with full awareness of how pieces fit together.</p>
<p><strong>What developers are actually reporting</strong></p>
<p>The response from professional developers has been more positive than the initial skepticism predicted. The fear was plausible-sounding but wrong code — the "fluent speaker" problem where AI generates confident nonsense. That still happens. But developers who use these tools daily report that catching those cases is straightforward when you understand what you're asking the AI to do.</p>
<p>The developers getting the most value treat AI coding assistants like a very knowledgeable junior colleague: they review everything the AI writes, they ask it to explain its reasoning, and they use it for the tedious parts while they focus on the architectural decisions.</p>
<p><strong>The practical numbers</strong></p>
<p>Across Microsoft's own engineering organization, developers complete certain categories of tasks 30-40% faster when using AI coding assistants. For the well-defined, repetitive tasks that make up a surprising amount of day-to-day coding work, the speedup is measurable and real.</p>
<p>This does not mean the job is changing overnight. But it does mean the baseline of what a single developer can accomplish is shifting upward. The bottleneck is no longer typing speed — it is knowing what to build.</p>`;

let msgId = 0;
const p = {};

const targetWs = new ws(WS_URL);

const send = (m, ps) => new Promise((rs, rj) => {
  const id = ++msgId;
  p[id] = (e, r) => e ? rj(e) : rs(r);
  targetWs.send(JSON.stringify({ id, method: m, params: ps || {} }));
  setTimeout(() => { if (p[id]) { delete p[id]; rj(new Error('timeout')); } }, 15000);
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

async function ss(label) {
  const r = await send('Page.captureScreenshot', { format: 'png' });
  const path = SCREENSHOT_DIR + 'pub-' + label + '.png';
  fs.writeFileSync(path, Buffer.from(r.data, 'base64'));
  console.log('[📸] ' + path);
  return path;
}

async function jsClick(text) {
  const r = await send('Runtime.evaluate', {
    expression: `
      (function(t) {
        var all = document.querySelectorAll('button, [role="button"]');
        for (var i = 0; i < all.length; i++) {
          var ct = (all[i].textContent || '').trim();
          if (ct.toLowerCase().includes(t.toLowerCase())) {
            all[i].click(); return 'clicked: ' + ct;
          }
        }
        return 'not found: ' + t;
      })(arguments[0])
    `,
    returnByValue: true,
    args: [text]
  });
  return r.result ? r.result.value : 'no result';
}

async function typeChars(text) {
  for (const ch of text) {
    await send('Input.dispatchKeyEvent', { type: 'keyDown', text: ch });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', text: ch });
    await new Promise(r => setTimeout(r, 25));
  }
}

async function fillTB(backendNodeId, text) {
  await send('DOM.focus', { backendNodeId });
  await new Promise(r => setTimeout(r, 200));
  await send('Input.dispatchKeyEvent', { type: 'keyDown', modifiers: 3, key: 'a' });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', modifiers: 3, key: 'a' });
  await new Promise(r => setTimeout(r, 100));
  await typeChars(text);
}

targetWs.on('open', async () => {
  try {
    const url = await send('Runtime.evaluate', { expression: 'window.location.href', returnByValue: true });
    console.log('[🌐]', url.result ? url.result.value : 'unknown');
    await ss('01-editor');

    // ── STEP 1: Fill title ────────────────────────────────────────────────
    let nodes = await snap();
    const titleTB = nodes.find(n =>
      n.role && n.role.value && n.role.value.toLowerCase() === 'textbox' &&
      axVal(n.name).toLowerCase().includes('add a title')
    );
    if (titleTB) {
      console.log('[1] Filling title...');
      await fillTB(titleTB.backendDOMNodeId, TITLE);
      console.log('[1] ✅');
    } else {
      console.log('[1] ❌ title not found');
    }
    await new Promise(r => setTimeout(r, 500));

    // ── STEP 2: Fill description ─────────────────────────────────────────
    nodes = await snap();
    const descTB = nodes.find(n =>
      n.role && n.role.value && n.role.value.toLowerCase() === 'textbox' &&
      axVal(n.name).toLowerCase().includes('add a description')
    );
    if (descTB) {
      console.log('[2] Filling description...');
      await fillTB(descTB.backendDOMNodeId, DESCRIPTION);
      console.log('[2] ✅');
    }
    await new Promise(r => setTimeout(r, 500));

    // ── STEP 3: Expand Email header section ──────────────────────────────
    console.log('[3] Expanding Email header section...');
    await jsClick('Email header');
    await new Promise(r => setTimeout(r, 1500));

    nodes = await snap();
    const emailTitleTB = nodes.find(n =>
      n.role && n.role.value && n.role.value.toLowerCase() === 'textbox' &&
      axVal(n.name) === 'Title'
    );
    if (emailTitleTB) {
      console.log('[4] Filling email title...');
      await fillTB(emailTitleTB.backendDOMNodeId, EMAIL_TITLE);
      console.log('[4] ✅');
    } else {
      console.log('[4] ❌ email title not found');
    }
    await new Promise(r => setTimeout(r, 500));

    // ── STEP 4: Fill subtitle ────────────────────────────────────────────
    nodes = await snap();
    const subTB = nodes.find(n =>
      n.role && n.role.value && n.role.value.toLowerCase() === 'textbox' &&
      axVal(n.name).toLowerCase().includes('subtitle')
    );
    if (subTB) {
      console.log('[5] Filling subtitle...');
      await fillTB(subTB.backendDOMNodeId, SUBTITLE);
      console.log('[5] ✅');
    }
    await new Promise(r => setTimeout(r, 500));
    await ss('02-fields-filled');

    // ── STEP 5: Paste body ──────────────────────────────────────────────
    console.log('[6] Inserting body via innerHTML...');
    const bodyResult = await send('Runtime.evaluate', {
      expression: `
        (function(html) {
          var pm = document.querySelector('.ProseMirror');
          if (!pm) return 'no ProseMirror';
          pm.innerHTML = html;
          pm.dispatchEvent(new Event('input', { bubbles: true }));
          return 'done, length: ' + pm.textContent.length;
        })(arguments[0])
      `,
      returnByValue: true,
      args: [BODY_HTML]
    });
    console.log('[6]', bodyResult.result ? bodyResult.result.value : 'no result');
    await ss('03-body-pasted');

    // ── STEP 6: Click Continue ───────────────────────────────────────────
    console.log('[7] Clicking Continue...');
    await jsClick('Continue');
    await new Promise(r => setTimeout(r, 5000));
    await ss('04-after-continue');

    const url2 = await send('Runtime.evaluate', { expression: 'window.location.href', returnByValue: true });
    console.log('[7] URL:', url2.result ? url2.result.value : 'unknown');

    nodes = await snap();
    const sendBtn = nodes.find(n =>
      n.role && n.role.value && n.role.value.toLowerCase() === 'button' &&
      (axVal(n.name).includes('Send to everyone') || axVal(n.name).includes('Email subscribers'))
    );
    if (sendBtn) {
      console.log('[8] ✅ Found:', axVal(sendBtn.name));
    } else {
      console.log('[8] ⚠️ Send not in tree — listing buttons:');
      nodes.filter(n => n.role && n.role.value && n.role.value.toLowerCase() === 'button')
        .forEach(n => console.log('    -', JSON.stringify(axVal(n.name))));
    }

    // ── STEP 7: Click "Send to everyone now" ─────────────────────────────
    console.log('[9] Clicking Send...');
    await jsClick('Send to everyone');
    await new Promise(r => setTimeout(r, 5000));
    await ss('05-after-send');

    const url3 = await send('Runtime.evaluate', { expression: 'window.location.href', returnByValue: true });
    console.log('[9] URL:', url3.result ? url3.result.value : 'unknown');

    // ── STEP 8: Handle subscribe dialog ──────────────────────────────────
    nodes = await snap();
    const hasDialog = nodes.some(n =>
      n.role && n.role.value && n.role.value.toLowerCase() === 'dialog'
    );
    console.log('[10] Dialog:', hasDialog);

    if (hasDialog) {
      await ss('06-dialog');
      console.log('[11] Dialog buttons:');
      for (const d of nodes.filter(n => n.role && n.role.value && n.role.value.toLowerCase() === 'dialog')) {
        flatten(d.children || []).filter(k => k.role && k.role.value && k.role.value.toLowerCase() === 'button')
          .forEach(b => console.log('    →', JSON.stringify(axVal(b.name))));
      }

      console.log('[11] Clicking "Publish without buttons"...');
      const r = await send('Runtime.evaluate', {
        expression: `
          (function() {
            var dialogs = document.querySelectorAll('[role="dialog"]');
            for (var d = 0; d < dialogs.length; d++) {
              var btns = dialogs[d].querySelectorAll('button');
              for (var i = 0; i < btns.length; i++) {
                var t = (btns[i].textContent || '').trim().toLowerCase();
                if (t.includes('without')) {
                  btns[i].click(); return 'clicked: ' + btns[i].textContent.trim();
                }
              }
            }
            return 'not found';
          })()
        `,
        returnByValue: true
      });
      console.log('[11]', r.result ? r.result.value : 'no result');

      await new Promise(r => setTimeout(r, 6000));
      await ss('07-after-dialog');

      const url4 = await send('Runtime.evaluate', { expression: 'window.location.href', returnByValue: true });
      console.log('[12] Final URL:', url4.result ? url4.result.value : 'unknown');

      nodes = await snap();
      const stillOpen = nodes.some(n => n.role && n.role.value && n.role.value.toLowerCase() === 'dialog');
      if (!stillOpen) {
        console.log('\n========================================');
        console.log('✅ PUBLISH APPEARS SUCCESSFUL!');
        console.log('========================================');
      } else {
        console.log('\n========================================');
        console.log('⚠️ Dialog still open — may need manual click');
        console.log('========================================');
      }
    } else {
      if (url3.result && url3.result.value.includes('/p/')) {
        console.log('\n========================================');
        console.log('✅ PUBLISHED — no dialog needed!');
        console.log('========================================');
      } else {
        console.log('[10] ⚠️ No dialog, URL:', url3.result ? url3.result.value : 'unknown');
      }
    }

    await ss('08-final');
    console.log('\n[DONE]');

  } catch (e) {
    console.error('[ERROR]', e.message);
  }
  targetWs.close();
});

targetWs.on('message', d => {
  const m = JSON.parse(d);
  if (m.id && p[m.id]) { const c = p[m.id]; delete p[m.id]; c(null, m.result); }
});
targetWs.on('error', e => console.error('WS error:', e.message));
