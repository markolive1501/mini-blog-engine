const { BrowserHelper } = require('./browser-helper');
const h = new BrowserHelper('CF712D9456053DAE8F6EC1FEDDE93571');
h.connect().then(async () => {
  await h.navigate('https://orbit286020.substack.com/publish');
  await h.wait(3000);
  
  const r = await h.send('Runtime.evaluate', {
    expression: 'JSON.stringify([...document.querySelectorAll("button, a")].map(el => el.textContent.trim()).filter(t => t.includes("Create") || t.includes("Free") || t.includes("Post")))',
    returnByValue: true,
  });
  console.log('Buttons:', r.result?.value);
  
  const url = await h.getUrl();
  console.log('Current URL:', url);
  
  h.close();
}).catch(e => console.error(e.message));
