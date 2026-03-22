// Test: use CDP helper to publish Substack draft
const path = require('path');
const { BrowserHelper } = require(path.join(process.env.USERPROFILE || 'C:\\Users\\marko', '.openclaw', 'mini-blog-engine', 'automation', 'substack-newsletter', 'browser-helper.js'));

(async () => {
  const browser = new BrowserHelper('CF712D9456053DAE8F6EC1FEDDE93571');
  await browser.connect();
  console.log('Connected');

  await browser.navigate('https://orbit286020.substack.com/publish/post/191709943');
  console.log('Draft page loaded');

  // Get the accessibility tree
  const tree = await browser.snapshot();
  const nodes = tree.nodes || [];

  // Find the Continue button
  const continueNode = browser._findNode(nodes, 'button', 'Continue');
  if (continueNode) {
    console.log('Found Continue button, clicking...');
    await browser.click(continueNode.nodeId);
    await browser.waitForLoad(5000);
  } else {
    console.log('Continue button not found');
  }

  // Get updated tree
  const tree2 = await browser.snapshot();
  const nodes2 = tree2.nodes || [];

  // Find "Send to everyone now" button
  const publishNode = browser._findNode(nodes2, 'button', 'Send to everyone now');
  if (publishNode) {
    console.log('Found publish button, clicking...');
    await browser.click(publishNode.nodeId);
    console.log('Clicked publish, waiting 8s...');
    await browser.waitForLoad(8000);

    // Check URL
    const urlResult = await browser.send('Runtime.evaluate', {
      expression: 'window.location.href',
      returnByValue: true
    });
    console.log('Final URL:', urlResult.result ? urlResult.result.value : 'unknown');
  } else {
    console.log('Publish button not found in tree');
    // Print some nodes for debugging
    for (const n of nodes2.slice(0, 50)) {
      if (n.role && n.name) {
        console.log(' ', n.role, ':', n.name);
      }
    }
  }

  // Disconnect
  browser.ws.close();
  console.log('Done');
})().catch(e => {
  console.error('ERROR:', e.message);
  process.exit(1);
});
