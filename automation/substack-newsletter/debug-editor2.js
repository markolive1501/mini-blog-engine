const { BrowserHelper } = require('./browser-helper');
const h = new BrowserHelper('CF712D9456053DAE8F6EC1FEDDE93571');
h.connect().then(async () => {
  await h.navigate('https://orbit286020.substack.com/publish/home');
  await h.wait(2000);
  
  // Click "Create post" via JS
  await h.send('Runtime.evaluate', {
    expression: `[...document.querySelectorAll("button")].find(el => el.textContent.trim() === "Create post").click()`,
    returnByValue: false,
  });
  await h.wait(3000);
  
  const url = await h.getUrl();
  console.log('URL:', url);
  
  // Find ALL contenteditable elements
  const r1 = await h.send('Runtime.evaluate', {
    expression: 'JSON.stringify([...document.querySelectorAll("[contenteditable]")].map(el => el.tagName + ":" + el.contentEditable + ":" + (el.className||"").substring(0,60) + ":" + (el.id||"").substring(0,40)).slice(0,20))',
    returnByValue: true,
  });
  console.log('Contenteditable elements:', r1.result?.value);
  
  // Check for prosemirror or lexical editors
  const r2 = await h.send('Runtime.evaluate', {
    expression: 'JSON.stringify([...document.querySelectorAll(".ProseMirror, .lexical-editor, [data-slate-editor], .editor-content, [role="textbox"]")].map(el => el.className.substring(0,60)).slice(0,10))',
    returnByValue: true,
  });
  console.log('Rich text editors:', r2.result?.value);
  
  // Get more form element details
  const r3 = await h.send('Runtime.evaluate', {
    expression: 'JSON.stringify([...document.querySelectorAll("input, textarea, [contenteditable]")].map(el => ({ tag: el.tagName, placeholder: el.placeholder||"", id: el.id||"", cls: (el.className||"").substring(0,40), ce: el.contentEditable||"" })).slice(0,20))',
    returnByValue: true,
  });
  console.log('All inputs:', r3.result?.value);

  await h.screenshot('debug-editor2.png');
  console.log('Screenshot saved');
  
  h.close();
}).catch(e => console.error(e.message));
