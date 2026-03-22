const WebSocket = require('C:/Users/marko/.openclaw/mini-blog-engine/automation/substack-newsletter/node_modules/ws');
const WS_URL = 'ws://127.0.0.1:18800/devtools/page/CF712D9456053DAE8F6EC1FEDDE93571';
const ws = new WebSocket(WS_URL);
let msgId = 0;
const p = {};
ws.on('open', async () => {
  const send = (m,ps={}) => new Promise((rs,rj) => { const id=++msgId; p[id]=(e,r)=>e?rj(e):rs(r); ws.send(JSON.stringify({id,method:m,params:ps})); setTimeout(()=>{if(p[id]){delete p[id];rj(new Error('timeout'))}},15000); });

  await send('Page.navigate', {url:'https://orbit286020.substack.com/publish/post/'});
  await new Promise(r=>setTimeout(r,5000));
  
  // Try innerHTML approach
  const insert = await send('Runtime.evaluate', {
    expression: `
      (function() {
        var pm = document.querySelector('.ProseMirror');
        if (!pm) return 'no pm';
        pm.innerHTML = '<p>The next time you are in San Francisco, Phoenix, or Wuhan, look closely at the cars driving past you. One in every fifty has no one behind the wheel.</p><p>Robotaxis have been almost here for a decade. But in 2026, something shifted.</p>';
        pm.dispatchEvent(new Event('input', {bubbles:true}));
        return 'html: ' + pm.innerHTML.substring(0,150);
      })()
    `,
    returnByValue: true
  });
  console.log('Insert result:', insert.result ? insert.result.value : 'none');
  
  // Check warning
  const warn = await send('Runtime.evaluate', {
    expression: `
      (function() {
        var els = document.querySelectorAll('*');
        for (var i=0;i<els.length;i++) {
          if (els[i].textContent.includes('Please write something')) return 'WARNING: ' + els[i].textContent;
        }
        return 'no warning';
      })()
    `,
    returnByValue: true
  });
  console.log('Warning check:', warn.result ? warn.result.value : 'none');

  ws.close();
});
ws.on('message', d => { const m=JSON.parse(d); if(m.id&&p[m.id]){const c=p[m.id];delete p[m.id];c(null,m.result);} });
ws.on('error', e=>console.error(e.message));
