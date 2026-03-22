const ws = require('C:/Users/marko/.openclaw/mini-blog-engine/automation/substack-newsletter/node_modules/ws');
const fs = require('fs');
const TARGET = 'EC2E01079798BBC0AA6B5FCA0534ABE2';
const WS_URL = 'ws://127.0.0.1:18800/devtools/page/' + TARGET;
const SCREENSHOT_DIR = 'C:/Users/marko/.openclaw/mini-blog-engine/automation/substack-newsletter/screenshots/';

let msgId = 0;
const p = {};
const targetWs = new ws(WS_URL);

const send = (m, ps) => new Promise((rs, rj) => {
  const id = ++msgId;
  p[id] = (e, r) => e ? rj(e) : rs(r);
  targetWs.send(JSON.stringify({ id, method: m, params: ps || {} }));
  setTimeout(() => { if (p[id]) { delete p[id]; rj(new Error('timeout')); } }, 15000);
});

function flatten(nodes, r = []) {
  if (!nodes) return r;
  for (const n of nodes) { r.push(n); if (n.children) flatten(n.children, r); }
  return r;
}

async function ss(label) {
  try {
    const r = await send('Page.captureScreenshot', { format: 'png' });
    const path = SCREENSHOT_DIR + 'fp2-' + label + '.png';
    fs.writeFileSync(path, Buffer.from(r.data, 'base64'));
    console.log('[📸] ' + path);
  } catch (e) { console.log('[📸 failed]', e.message); }
}

async function jsClickContaining(text) {
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

async function fillByPlaceholder(placeholder, text) {
  const r = await send('Runtime.evaluate', {
    expression: `
      (function(ph, txt) {
        var inputs = document.querySelectorAll('input, textarea');
        for (var i = 0; i < inputs.length; i++) {
          var phAttr = (inputs[i].placeholder || '').toLowerCase();
          if (phAttr.includes(ph.toLowerCase())) {
            inputs[i].focus();
            inputs[i].select();
            document.execCommand('insertText', false, txt);
            return 'filled: ' + inputs[i].placeholder;
          }
        }
        return 'not found: ' + ph;
      })(arguments[0], arguments[1])
    `,
    returnByValue: true,
    args: [placeholder, text]
  });
  return r.result ? r.result.value : 'no result';
}

targetWs.on('open', async () => {
  try {
    // Check URL and textboxes
    const url = await send('Runtime.evaluate', { expression: 'window.location.href', returnByValue: true });
    console.log('[🌐]', url.result ? url.result.value : 'unknown');

    const tree = await send('Accessibility.getFullAXTree', {});
    const nodes = flatten(tree.nodes || []);
    console.log('[a11y] Total nodes:', nodes.length);

    // Show textboxes
    const tbs = nodes.filter(n => n.role && n.role.value && n.role.value.toLowerCase() === 'textbox');
    console.log('[textboxes]', tbs.length);
    tbs.forEach(n => {
      const name = n.name && n.name.value ? n.name.value : (n.name || '');
      console.log('  -', JSON.stringify(name), 'id:', n.backendDOMNodeId);
    });

    // Show buttons
    const btns = nodes.filter(n => n.role && n.role.value && n.role.value.toLowerCase() === 'button');
    console.log('[buttons]', btns.length);
    btns.forEach(n => {
      const name = n.name && n.name.value ? n.name.value : (n.name || '');
      console.log('  -', JSON.stringify(name));
    });

    // Show ProseMirror
    const pmResult = await send('Runtime.evaluate', {
      expression: `var pm=document.querySelector('.ProseMirror'); pm ? 'found:text='+pm.textContent.length : 'not found'`,
      returnByValue: true
    });
    console.log('[ProseMirror]', pmResult.result ? pmResult.result.value : 'none');

    await ss('01-state');
    console.log('[DONE - state captured]');

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
