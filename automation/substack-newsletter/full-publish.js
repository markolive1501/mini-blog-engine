// full-publish.js — Complete Substack publish using CDP navigation + DOM manipulation
// Navigate via CDP so WebSocket stays connected; use "Publish without buttons"
const ws = require('ws');
const fs = require('fs');
const TARGET = 'EC2E01079798BBC0AA6B5FCA0534ABE2';
const WS_URL = 'ws://127.0.0.1:18800/devtools/page/' + TARGET;
const SCREENSHOT_DIR = 'C:/Users/marko/.openclaw/mini-blog-engine/automation/substack-newsletter/screenshots/';

const TITLE = 'Copilot Is Now Your Coding Partner, Not Just Your Autocomplete';
const EMAIL_TITLE = 'Copilot Is Now Your Coding Partner, Not Just Your Autocomplete';
const SUBTITLE = 'Microsoft Copilot has evolved from prediction engine to AI pair programmer. Here is what that actually means.';
const DESCRIPTION = 'AI coding agents are moving from novelty to necessity. They understand project context, refactor entire modules, write tests, and reason across thousands of lines of code.';

const BODY_HTML = '<p>Microsoft Copilot started as an autocomplete for code. Type a function name, it fills in the body. Helpful, but limited. It did not understand context — your project structure, your coding style, your architecture decisions.</p><p>That changed. Copilot is now something closer to a pair programmer who never gets tired, never gets snappy, and has read essentially every public code repository on earth.</p><p><strong>What the new Copilot actually does</strong></p><p>The shift is from prediction to reasoning. Instead of just finishing your line, it can explain what a block of unfamiliar code does line by line, suggest entire refactors based on your comments, write tests that actually match your implementation\'s intent, spot potential bugs before you run the code, and navigate a new codebase and answer questions about it.</p><p>The difference sounds small but feels large. It is the difference between a smart clipboard and a thoughtful colleague.</p><p><strong>The context window is the key</strong></p><p>What makes this work is not just the underlying model — it is the context window. Copilot now has access to your entire codebase via the agent mode. It can read your existing functions, understand your naming conventions, see how your modules fit together.</p><p>A simple example: you ask it to add authentication to this endpoint. It reads your existing auth middleware, sees how your other endpoints handle sessions, and writes code that actually fits your pattern — not generic boilerplate.</p><p><strong>What developers are actually saying</strong></p><p>The response from professional developers has been more positive than expected. The initial fear was that AI would write bad code that looked plausible — the so-called fluent speaker problem. That still happens. But with better context and the ability to run and test code, developers report catching those cases quickly.</p><p>The developers who get the most value treat Copilot like a very knowledgeable junior colleague: they review everything it writes, they ask it to explain its reasoning, and they use it for the tedious parts while they focus on the architectural decisions that actually require human judgment.</p><p><strong>The practical impact</strong></p><p>Across Microsoft\'s own engineering org, developers complete certain categories of tasks 30-40% faster when using Copilot. For the kinds of repetitive, well-defined tasks that make up a surprising amount of coding work, the speedup is real.</p><p>This does not mean the job is changing tomorrow. But it does mean the baseline of what a single developer can accomplish is shifting upward. The bottleneck is no longer typing speed — it is knowing what to build.</p>';

let msgId = 0;
const p = {};
const targetWs = new ws(WS_URL);

const send = (m, ps) => new Promise((rs, rj) => {
  const id = ++msgId;
  p[id] = (e, r) => e ? rj(e) : rs(r);
  targetWs.send(JSON.stringify({ id, method: m, params: ps || {} }));
  setTimeout(() => { if (p[id]) { delete p[id]; rj(new Error('timeout')); } }, 20000);
});

async function ss(label) {
  try {
    const r = await send('Page.captureScreenshot', { format: 'png' });
    const path = SCREENSHOT_DIR + 'fp2-' + label + '.png';
    fs.writeFileSync(path, Buffer.from(r.data, 'base64'));
    console.log('[s] ' + path);
  } catch (e) { console.log('[ss]', e.message); }
}

async function runJs(fn) {
  try {
    const r = await send('Runtime.evaluate', {
      expression: '(function(){return (' + fn.toString() + ')()})()',
      returnByValue: true
    });
    return r && r.result ? r.result.value : null;
  } catch (e) { return null; }
}

async function clickButtonContaining(text) {
  try {
    const r = await send('Runtime.evaluate', {
      expression: '(function(t){var all=document.querySelectorAll("button,[role=button]");for(var i=0;i<all.length;i++){var ct=(all[i].textContent||"").trim();if(ct.toLowerCase().includes(t.toLowerCase())){all[i].click();return "clicked:"+ct}}return "not found:"+t})(arguments[0])',
      returnByValue: true,
      args: [text]
    });
    return r && r.result ? r.result.value : null;
  } catch (e) { return null; }
}

async function clickInDialogContaining(text) {
  try {
    const r = await send('Runtime.evaluate', {
      expression: '(function(t){var ds=document.querySelectorAll("[role=dialog]");for(var d=0;d<ds.length;d++){var bs=ds[d].querySelectorAll("button");for(var i=0;i<bs.length;i++){var ct=(bs[i].textContent||"").trim();if(ct.toLowerCase().includes(t.toLowerCase())){bs[i].click();return "clicked:"+ct}}}return "not found:"+t})(arguments[0])',
      returnByValue: true,
      args: [text]
    });
    return r && r.result ? r.result.value : null;
  } catch (e) { return null; }
}

async function waitForDialog(timeoutMs) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    await new Promise(r => setTimeout(r, 1500));
    try {
      const r = await send('Runtime.evaluate', {
        expression: 'document.querySelectorAll("[role=dialog]").length > 0 ? "yes" : "no"',
        returnByValue: true
      });
      if (r && r.result && r.result.value === 'yes') return true;
    } catch (e) { /* keep waiting */ }
  }
  return false;
}

async function isDialogOpen() {
  try {
    const r = await send('Runtime.evaluate', {
      expression: 'document.querySelectorAll("[role=dialog]").length > 0 ? "yes" : "no"',
      returnByValue: true
    });
    return r && r.result && r.result.value === 'yes';
  } catch (e) { return false; }
}

async function getUrl() {
  try {
    const r = await send('Runtime.evaluate', { expression: 'window.location.href', returnByValue: true });
    return r && r.result ? r.result.value : null;
  } catch (e) { return null; }
}

targetWs.on('open', async () => {
  try {
    // Navigate via CDP so WebSocket stays connected
    console.log('[navigate] opening fresh editor...');
    await send('Page.navigate', { url: 'https://orbit286020.substack.com/publish/post/%C2%A0' });
    await new Promise(r => setTimeout(r, 6000));

    const url = await getUrl();
    console.log('[url]', url);
    await ss('01-start');

    // 1: Fill title
    console.log('[1] title');
    await runJs(function(ph, txt) {
      var inputs = document.querySelectorAll('input[placeholder], textarea[placeholder]');
      for (var i = 0; i < inputs.length; i++) {
        if (inputs[i].placeholder.toLowerCase().includes(ph.toLowerCase())) {
          inputs[i].focus();
          inputs[i].select();
          document.execCommand('insertText', false, txt);
          return;
        }
      }
    }.bind(null, 'add a title', TITLE));
    await new Promise(r => setTimeout(r, 400));

    // 2: Fill description
    console.log('[2] description');
    await runJs(function(ph, txt) {
      var inputs = document.querySelectorAll('input[placeholder], textarea[placeholder]');
      for (var i = 0; i < inputs.length; i++) {
        if (inputs[i].placeholder.toLowerCase().includes(ph.toLowerCase())) {
          inputs[i].focus();
          inputs[i].select();
          document.execCommand('insertText', false, txt);
          return;
        }
      }
    }.bind(null, 'add a description', DESCRIPTION));
    await new Promise(r => setTimeout(r, 400));

    // 3: Check if email title is visible; if not, expand Email header
    const emailTitleVisible = await runJs(function() {
      var inputs = document.querySelectorAll('input[placeholder]');
      for (var i = 0; i < inputs.length; i++) {
        if (inputs[i].placeholder === 'Title') return 'yes';
      }
      return 'no';
    });

    if (emailTitleVisible !== 'yes') {
      console.log('[3] expanding email header');
      await clickButtonContaining('email header');
      await new Promise(r => setTimeout(r, 1500));
    } else {
      console.log('[3] email title visible');
    }

    // 4: Fill email title
    console.log('[4] email title');
    await runJs(function(ph, txt) {
      var inputs = document.querySelectorAll('input[placeholder], textarea[placeholder]');
      for (var i = 0; i < inputs.length; i++) {
        if (inputs[i].placeholder.toLowerCase().includes(ph.toLowerCase())) {
          inputs[i].focus();
          inputs[i].select();
          document.execCommand('insertText', false, txt);
          return;
        }
      }
    }.bind(null, 'title', EMAIL_TITLE));
    await new Promise(r => setTimeout(r, 400));

    // 5: Fill subtitle
    console.log('[5] subtitle');
    await runJs(function(ph, txt) {
      var inputs = document.querySelectorAll('input[placeholder], textarea[placeholder]');
      for (var i = 0; i < inputs.length; i++) {
        if (inputs[i].placeholder.toLowerCase().includes(ph.toLowerCase())) {
          inputs[i].focus();
          inputs[i].select();
          document.execCommand('insertText', false, txt);
          return;
        }
      }
    }.bind(null, 'subtitle', SUBTITLE));
    await new Promise(r => setTimeout(r, 500));
    await ss('02-fields');

    // 6: Fill ProseMirror body
    console.log('[6] body');
    const bodyResult = await runJs(function(html) {
      var pm = document.querySelector('.ProseMirror');
      if (!pm) return 'no ProseMirror';
      pm.innerHTML = html;
      pm.dispatchEvent(new Event('input', { bubbles: true }));
      return 'inserted:' + pm.textContent.length;
    }.bind(null, BODY_HTML));
    console.log('[6]', bodyResult);
    await ss('03-body');

    // 7: Click Continue
    console.log('[7] continue');
    const clickResult = await clickButtonContaining('Continue');
    console.log('[7]', clickResult);
    await new Promise(r => setTimeout(r, 5000));
    await ss('04-after-continue');

    // 8: Click "Send to everyone now"
    console.log('[8] send to everyone');
    await clickButtonContaining('Send to everyone');
    await new Promise(r => setTimeout(r, 2000));

    // 9: Wait for first dialog (confirm) and click "Send to everyone now" inside
    console.log('[9] waiting for confirm dialog');
    const hasConfirm = await waitForDialog(8000);
    if (hasConfirm) {
      console.log('[9] clicking Send inside confirm dialog');
      await clickInDialogContaining('Send to everyone');
      await new Promise(r => setTimeout(r, 3000));
    } else {
      console.log('[9] no confirm dialog');
    }

    // 10: Wait for subscribe dialog and click "Publish without buttons"
    console.log('[10] waiting for subscribe dialog');
    const hasSubscribe = await waitForDialog(10000);
    console.log('[10] subscribe dialog:', hasSubscribe);

    if (hasSubscribe) {
      await ss('05-subscribe-dialog');
      console.log('[11] clicking "Publish without buttons"');
      const clickResult2 = await clickInDialogContaining('without');
      console.log('[11]', clickResult2);
      await new Promise(r => setTimeout(r, 6000));
      await ss('06-after-click');
    } else {
      console.log('[10] no subscribe dialog');
    }

    // FINAL
    const finalUrl = await getUrl();
    const dialogOpen = await isDialogOpen();
    console.log('[12] url:', finalUrl);
    console.log('[12] dialog:', dialogOpen);
    await ss('07-final');

    console.log('\n========================================');
    if (!dialogOpen) {
      console.log('DONE! URL:', finalUrl);
    } else {
      console.log('Dialog still open');
    }
    console.log('========================================');

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
