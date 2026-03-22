const ws = require('C:/Users/marko/.openclaw/mini-blog-engine/automation/substack-newsletter/node_modules/ws');
const TARGET = 'EC2E01079798BBC0AA6B5FCA0534ABE2';
const ws2 = new ws('ws://127.0.0.1:18800/devtools/page/' + TARGET);
let msgId = 0;
const p = {};

ws2.on('open', async () => {
  const send = (m, ps) => new Promise((rs, rj) => {
    const id = ++msgId;
    p[id] = (e, r) => e ? rj(e) : rs(r);
    ws2.send(JSON.stringify({ id, method: m, params: ps || {} }));
    setTimeout(() => { if (p[id]) { delete p[id]; rj(new Error('timeout')); } }, 10000);
  });

  // Click Done button
  const r = await send('Runtime.evaluate', {
    expression: `
      (function() {
        var all = document.querySelectorAll('button');
        for (var i = 0; i < all.length; i++) {
          var t = (all[i].textContent || '').trim();
          if (t === 'Done') {
            all[i].click();
            return 'clicked Done';
          }
        }
        return 'Done not found';
      })()
    `,
    returnByValue: true
  });
  console.log('Done click:', r.result ? r.result.value : 'none');

  await new Promise(r => setTimeout(r, 3000));

  const url = await send('Runtime.evaluate', { expression: 'window.location.href', returnByValue: true });
  console.log('URL:', url.result ? url.result.value : 'unknown');

  // Navigate to published posts page to verify
  await send('Page.navigate', { url: 'https://orbit286020.substack.com/posts' });
  await new Promise(r => setTimeout(r, 3000));

  const postsUrl = await send('Runtime.evaluate', { expression: 'window.location.href', returnByValue: true });
  console.log('Posts page URL:', postsUrl.result ? postsUrl.result.value : 'unknown');

  // Look for the post title in the accessibility tree
  const tree = await send('Accessibility.getFullAXTree', {});
  const flatten = (arr, r2 = []) => { for (const n of arr) { r2.push(n); if (n.children) flatten(n.children, r2); } return r2; };
  const nodes = flatten(tree.nodes || []);
  const headingNodes = nodes.filter(n =>
    n.role && n.role.value && (n.role.value.toLowerCase() === 'heading' || n.role.value.toLowerCase() === 'link') &&
    n.name && (n.name.value || n.name || '').toLowerCase().includes('ai coding')
  );
  console.log('Found post heading:', headingNodes.length > 0);

  ws2.close();
});

ws2.on('message', d => { const m = JSON.parse(d); if (m.id && p[m.id]) { const c = p[m.id]; delete p[m.id]; c(null, m.result); } });
ws2.on('error', e => console.error(e.message));
