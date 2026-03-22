const ws = require('C:/Users/marko/.openclaw/mini-blog-engine/automation/substack-newsletter/node_modules/ws');
const WebSocket = ws;
const fs = require('fs');
const TARGET = 'EC2E01079798BBC0AA6B5FCA0534ABE2';
const WS_URL = 'ws://127.0.0.1:18800/devtools/page/' + TARGET;
const SCREENSHOT_DIR = 'C:/Users/marko/.openclaw/mini-blog-engine/automation/substack-newsletter/screenshots/';

const BODY = `AI coding agents are moving from novelty to necessity. They don't just autocomplete snippets — they understand project context, refactor entire modules, write tests, and reason about architecture across thousands of lines of code.

The implications for how software gets built are significant. Traditional estimates suggest professional developers spend roughly half their time debugging and maintaining code they've already written. AI agents trained on vast codebases are starting to compress that cycle dramatically.

This is not about replacing developers. It is about changing what "development work" actually means — from typing code to directing intelligence.

**What the new generation of AI coding tools can do**

The shift goes beyond autocomplete. Modern AI coding assistants can:

- Read an entire codebase and answer questions about architecture
- Suggest refactors that account for patterns across hundreds of files
- Write test suites that actually cover edge cases rather than just happy paths
- Spot potential bugs before code is committed
- Navigate陌生的 codebases and explain what pieces do

The key enabler is context window size. When an AI can see your entire project — not just the file you're editing — it can reason about code the way a senior developer would: with full awareness of how pieces fit together.

**What developers are actually reporting**

The response from professional developers has been more positive than the initial skepticism predicted. The fear was plausible-sounding but wrong code — the "fluent speaker" problem where AI generates confident nonsense. That still happens. But developers who use these tools daily report that catching those cases is straightforward when you understand what you're asking the AI to do.

The developers getting the most value treat AI coding assistants like a very knowledgeable junior colleague: they review everything the AI writes, they ask it to explain its reasoning, and they use it for the tedious parts — writing boilerplate, searching documentation, generating test cases — while they focus on the architectural decisions.

**The practical numbers**

Across Microsoft's own engineering organization, developers complete certain categories of tasks 30-40% faster when using AI coding assistants. For the well-defined, repetitive tasks that make up a surprising amount of day-to-day coding work, the speedup is measurable and real.

This does not mean the job is changing overnight. But it does mean the baseline of what a single developer can accomplish is shifting upward. The bottleneck is no longer typing speed — it is knowing what to build.`;

let msgId = 0;
const p = {};

const targetWs = new WebSocket(WS_URL);

targetWs.on('open', async () => {
  const send = (m, ps) => new Promise((rs, rj) => {
    const id = ++msgId;
    p[id] = (e, r) => e ? rj(e) : rs(r);
    targetWs.send(JSON.stringify({ id, method: m, params: ps || {} }));
    setTimeout(() => { if (p[id]) { delete p[id]; rj(new Error('timeout')); } }, 12000);
  });

  async function saveScreenshot(label) {
    const ss = await send('Page.captureScreenshot', { format: 'png' });
    const path = SCREENSHOT_DIR + 'copilot-' + label + '.png';
    fs.writeFileSync(path, Buffer.from(ss.data, 'base64'));
    console.log('[screenshot] ' + path);
    return path;
  }

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

  try {
    const url = await send('Runtime.evaluate', { expression: 'window.location.href', returnByValue: true });
    console.log('[1] URL:', url.result ? url.result.value : 'unknown');

    // Check current body state
    const before = await send('Runtime.evaluate', {
      expression: `
        (function() {
          var pm = document.querySelector('.ProseMirror');
          if (!pm) return 'no ProseMirror';
          return 'text length: ' + pm.textContent.length;
        })()
      `,
      returnByValue: true
    });
    console.log('[2] Body before:', before.result ? before.result.value : 'none');

    // Convert BODY to HTML paragraphs
    const paras = BODY.split('\n\n').map(p => p.trim()).filter(p => p);
    const htmlParas = paras.map(p => {
      const clean = p.replace(/\*\*(.+?)\*\*/g, '$1');
      return '<p>' + clean.replace(/\n/g, '<br>') + '</p>';
    }).join('');

    console.log('[3] Inserting ' + paras.length + ' paragraphs via innerHTML...');
    const insertResult = await send('Runtime.evaluate', {
      expression: `
        (function(html) {
          var pm = document.querySelector('.ProseMirror');
          if (!pm) return 'no ProseMirror';
          pm.innerHTML = html;
          pm.dispatchEvent(new Event('input', { bubbles: true }));
          return 'inserted, new text length: ' + pm.textContent.length;
        })($1)
      `,
      returnByValue: true,
      args: [htmlParas]
    });
    console.log('[4] Insert result:', insertResult.result ? insertResult.result.value : 'none');

    // Check warning
    const warn = await send('Runtime.evaluate', {
      expression: `
        (function() {
          var els = document.querySelectorAll('*');
          for (var i = 0; i < els.length; i++) {
            if ((els[i].textContent || '').includes('Please write something')) return 'WARNING STILL THERE';
          }
          return 'no warning';
        })()
      `,
      returnByValue: true
    });
    console.log('[5] Warning check:', warn.result ? warn.result.value : 'none');

    await saveScreenshot('body-pasted');

    // ── Now click Continue via JS ────────────────────────────────────────────
    console.log('[6] Clicking Continue via JS...');
    const continueResult = await send('Runtime.evaluate', {
      expression: `
        (function() {
          var all = document.querySelectorAll('button');
          for (var i = 0; i < all.length; i++) {
            var t = (all[i].textContent || '').trim();
            if (t === 'Continue') {
              all[i].click();
              return 'clicked Continue';
            }
          }
          return 'Continue button not found';
        })()
      `,
      returnByValue: true
    });
    console.log('[6] Result:', continueResult.result ? continueResult.result.value : 'none');

    await new Promise(r => setTimeout(r, 5000));
    await saveScreenshot('after-continue');

    const url2 = await send('Runtime.evaluate', { expression: 'window.location.href', returnByValue: true });
    console.log('[7] URL after Continue:', url2.result ? url2.result.value : 'unknown');

    // Check buttons
    const tree2 = await send('Accessibility.getFullAXTree', {});
    const nodes2 = flatten(tree2.nodes || []);
    console.log('[8] Buttons after Continue:');
    nodes2.filter(n => n.role && n.role.value && n.role.value.toLowerCase() === 'button')
      .forEach(n => console.log('  -', JSON.stringify(axVal(n.name))));

    // Look for Send button
    const sendBtn = nodes2.find(n =>
      n.role && n.role.value && n.role.value.toLowerCase() === 'button' &&
      (axVal(n.name).includes('Send') || axVal(n.name).includes('Email subscribers'))
    );

    if (sendBtn) {
      console.log('[9] ✅ Send button found:', axVal(sendBtn.name));
    } else {
      console.log('[9] ⚠️ Send button not in tree — may be below fold or not rendered yet');
      // Try scrolling down and checking
      await send('Runtime.evaluate', { expression: 'window.scrollTo(0, document.body.scrollHeight)', returnByValue: true });
      await new Promise(r => setTimeout(r, 1000));
      const tree3 = await send('Accessibility.getFullAXTree', {});
      const nodes3 = flatten(tree3.nodes || []);
      const sendBtn2 = nodes3.find(n =>
        n.role && n.role.value && n.role.value.toLowerCase() === 'button' &&
        (axVal(n.name).includes('Send') || axVal(n.name).includes('Email subscribers'))
      );
      if (sendBtn2) {
        console.log('[9] ✅ Send button found after scroll:', axVal(sendBtn2.name));
      }
    }

    // Click Send to everyone
    console.log('[10] Clicking "Send to everyone now" via JS...');
    const sendResult = await send('Runtime.evaluate', {
      expression: `
        (function() {
          var all = document.querySelectorAll('button');
          for (var i = 0; i < all.length; i++) {
            var t = (all[i].textContent || '').trim();
            if (t.includes('Send to everyone')) {
              all[i].click();
              return 'clicked: ' + t;
            }
          }
          return 'Send to everyone button not found';
        })()
      `,
      returnByValue: true
    });
    console.log('[10] Result:', sendResult.result ? sendResult.result.value : 'none');

    await new Promise(r => setTimeout(r, 5000));
    await saveScreenshot('after-send');

    const url3 = await send('Runtime.evaluate', { expression: 'window.location.href', returnByValue: true });
    console.log('[11] URL after Send:', url3.result ? url3.result.value : 'unknown');

    // Check for dialog
    const tree4 = await send('Accessibility.getFullAXTree', {});
    const nodes4 = flatten(tree4.nodes || []);
    const hasDialog = nodes4.some(n =>
      n.role && n.role.value && n.role.value.toLowerCase() === 'dialog'
    );
    console.log('[12] Dialog present:', hasDialog);

    if (hasDialog) {
      console.log('[13] Dialog found — clicking "Publish without buttons"...');
      const dialogResult = await send('Runtime.evaluate', {
        expression: `
          (function() {
            var dialogs = document.querySelectorAll('[role="dialog"]');
            for (var d = 0; d < dialogs.length; d++) {
              var buttons = dialogs[d].querySelectorAll('button');
              for (var i = 0; i < buttons.length; i++) {
                var t = (buttons[i].textContent || '').trim().toLowerCase();
                if (t.includes('without')) {
                  buttons[i].click();
                  return 'clicked Publish without buttons: ' + buttons[i].textContent.trim();
                }
              }
            }
            // Fallback: just click any subscribe button
            for (var d = 0; d < dialogs.length; d++) {
              var buttons = dialogs[d].querySelectorAll('button');
              for (var i = 0; i < buttons.length; i++) {
                var t = (buttons[i].textContent || '').trim();
                if (t.includes('subscribe') || t.includes('Publish')) {
                  buttons[i].click();
                  return 'clicked: ' + t;
                }
              }
            }
            return 'no dialog button found';
          })()
        `,
        returnByValue: true
      });
      console.log('[13] Dialog click:', dialogResult.result ? dialogResult.result.value : 'none');

      await new Promise(r => setTimeout(r, 6000));
      await saveScreenshot('after-dialog');

      const url4 = await send('Runtime.evaluate', { expression: 'window.location.href', returnByValue: true });
      console.log('[14] URL after dialog:', url4.result ? url4.result.value : 'unknown');

      const tree5 = await send('Accessibility.getFullAXTree', {});
      const nodes5 = flatten(tree5.nodes || []);
      const stillHasDialog = nodes5.some(n =>
        n.role && n.role.value && n.role.value.toLowerCase() === 'dialog'
      );
      console.log('[15] Dialog still open:', stillHasDialog);

      if (!stillHasDialog) {
        console.log('\n========================================');
        console.log('✅ PUBLISH APPEARS SUCCESSFUL!');
        console.log('URL:', url4.result ? url4.result.value : 'unknown');
        console.log('========================================');
      }
    } else {
      console.log('[12] No dialog — check URL for publish indication');
      if (url3.result && (url3.result.value.includes('/p/') || url3.result.value.includes('success'))) {
        console.log('\n========================================');
        console.log('✅ PUBLISHED!');
        console.log('========================================');
      }
    }

    await saveScreenshot('final');
    console.log('\nDONE');

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
