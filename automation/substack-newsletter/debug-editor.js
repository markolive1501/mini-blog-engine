const { BrowserHelper } = require('./browser-helper');
const h = new BrowserHelper('CF712D9456053DAE8F6EC1FEDDE93571');
h.connect().then(async () => {
  await h.navigate('https://orbit286020.substack.com/publish/home');
  await h.wait(3000);
  
  // Click "Create post" via JS
  const r1 = await h.send('Runtime.evaluate', {
    expression: `const btn = [...document.querySelectorAll("button")].find(el => el.textContent.trim() === "Create post"); if(btn) { btn.click(); "clicked:" + btn.outerHTML.substring(0,100); } else { "not found"; }`,
    returnByValue: true,
  });
  console.log('Click result:', r1.result?.value);
  
  await h.wait(3000);
  
  const url = await h.getUrl();
  console.log('URL after click:', url);
  
  // Check what's on the new page
  const r2 = await h.send('Runtime.evaluate', {
    expression: 'JSON.stringify([...document.querySelectorAll("button, [contenteditable], input, textarea")].map(el => el.tagName + ":" + (el.contentEditable||"") + ":" + (el.placeholder||el.name||el.id||"").substring(0,40)).slice(0,20))',
    returnByValue: true,
  });
  console.log('Form elements:', r2.result?.value);

  await h.screenshot('debug-editor.png');
  console.log('Screenshot saved to debug-editor.png');
  
  h.close();
}).catch(e => console.error(e.message));
