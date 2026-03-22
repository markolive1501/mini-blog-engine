/**
 * publish-post.js
 * Substack publish automation using pure JS DOM interaction.
 *
 * All button clicks use Runtime.evaluate + element.click() to bypass
 * React's synthetic event system (CDP mouse events don't fire React handlers).
 * Body insertion uses innerHTML + ProseMirror dispatchEvent (not execCommand).
 *
 * Usage: node publish-post.js <temp-json-file>
 *   temp-json-file: JSON with { title, url, body }
 */

const fs = require('fs');
const path = require('path');
const { BrowserHelper } = require('./browser-helper');

const CONFIG_PATH     = path.join(__dirname, 'config.json');
const LOG_DIR          = path.join(__dirname, 'logs');
const SCREENSHOT_DIR   = path.join(__dirname, 'screenshots');

function loadJson(filePath) {
    if (!fs.existsSync(filePath)) return null;
    try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); }
    catch { return null; }
}

function log(level, msg) {
    const ts = new Date().toISOString();
    const line = `[${ts}] [${level}] ${msg}`;
    console.error(line);
    const logFile = path.join(LOG_DIR, `${new Date().toISOString().slice(0, 10)}.log`);
    fs.appendFileSync(logFile, line + '\n');
}

function slugify(text) {
    return (text || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50);
}

async function takeScreenshot(helper, label) {
    const slug = slugify(label || 'publish');
    const ts = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    const filePath = path.join(SCREENSHOT_DIR, `${ts}-${slug}.png`);
    try {
        await helper.screenshot(filePath);
        log('INFO', `Screenshot: ${filePath}`);
    } catch (e) {
        log('WARN', `Screenshot failed: ${e.message}`);
    }
    return filePath;
}

/**
 * Execute JS in the browser and return the result (value or description).
 */
async function js(helper, expr) {
    try {
        const r = await helper.send('Runtime.evaluate', {
            expression: expr,
            returnByValue: true,
            awaitPromise: false,
        });
        if (!r) return null;
        if (r.exceptionInfo) return r.exceptionInfo.description || null;
        return r.result && r.result.value !== undefined ? r.result.value : r.result.description || null;
    } catch(e) {
        return null;
    }
}

/**
 * Click a button/interactive element by partial text match.
 * Uses element.click() via Runtime.evaluate — the ONLY way that works with React.
 */
async function jsClickByText(helper, text, timeoutMs = 0) {
    if (timeoutMs > 0) {
        await new Promise(r => setTimeout(r, timeoutMs));
    }
    return await js(helper, `
        (function() {
            var target = '${text.replace(/'/g, "\\'")}';
            var els = document.querySelectorAll('button, [role="button"], a, div[tabindex="0"], span');
            var best = null;
            for (var i = 0; i < els.length; i++) {
                var t = els[i].textContent.trim();
                if (t.toLowerCase().includes(target.toLowerCase())) {
                    best = els[i];
                    if (t.toLowerCase() === target.toLowerCase()) {
                        best.click();
                        return 'EXACT clicked: ' + t.substring(0, 80);
                    }
                }
            }
            if (best) {
                best.click();
                return 'clicked: ' + best.textContent.trim().substring(0, 80);
            }
            return 'not found: ' + target;
        })()
    `);
}

/**
 * Find and fill the metadata title textbox (placeholder="Add a title...").
 */
async function typeMetadataTitle(helper, title) {
    const escaped = title.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/`/g, '\\`').replace(/\$/g, '\\$');
    const found = await js(helper, `
        (function() {
            var els = document.querySelectorAll('[placeholder="Add a title..."]');
            if (els.length > 0) {
                els[0].focus();
                return 'found';
            }
            return 'not found';
        })()
    `);
    if (!found || !found.includes('found')) {
        log('WARN', 'Metadata title field not found');
        return false;
    }
    // Type character by character
    for (const char of title) {
        await helper.send('Input.dispatchKeyEvent', { type: 'keyDown', text: char });
        await new Promise(r => setTimeout(r, 15));
        await helper.send('Input.dispatchKeyEvent', { type: 'keyUp', text: char });
        await new Promise(r => setTimeout(r, 15));
    }
    return true;
}

/**
 * Expand the "Email header / footer" collapsible section, then fill the
 * email title input (placeholder="Title") inside it.
 */
async function typeEmailTitle(helper, title) {
    // Expand the section
    const expanded = await js(helper, `
        (function() {
            var els = document.querySelectorAll('button, div[role="button"], div[tabindex="0"]');
            for (var i = 0; i < els.length; i++) {
                var t = els[i].textContent.trim();
                if (t.toLowerCase().includes('email header')) {
                    els[i].click();
                    return 'expanded: ' + t.substring(0, 80);
                }
            }
            return 'not found';
        })()
    `);
    log('INFO', `Email header expand: ${expanded}`);
    await new Promise(r => setTimeout(r, 2000));

    // Now find and fill the Title input
    const found = await js(helper, `
        (function() {
            var inputs = document.querySelectorAll('input[placeholder]');
            for (var i = 0; i < inputs.length; i++) {
                if (inputs[i].placeholder === 'Title') {
                    inputs[i].focus();
                    inputs[i].select();
                    return 'found';
                }
            }
            return 'not found';
        })()
    `);
    if (!found || !found.includes('found')) {
        log('WARN', 'Email title input not found');
        return false;
    }
    for (const char of title) {
        await helper.send('Input.dispatchKeyEvent', { type: 'keyDown', text: char });
        await new Promise(r => setTimeout(r, 15));
        await helper.send('Input.dispatchKeyEvent', { type: 'keyUp', text: char });
        await new Promise(r => setTimeout(r, 15));
    }
    return true;
}

/**
 * Fill the subtitle/description field (placeholder="Write a short description...").
 */
async function typeSubtitle(helper, subtitle) {
    const found = await js(helper, `
        (function() {
            var els = document.querySelectorAll('[placeholder="Write a short description..."]');
            if (els.length > 0) {
                els[0].focus();
                return 'found';
            }
            return 'not found';
        })()
    `);
    if (!found || !found.includes('found')) {
        log('WARN', 'Subtitle field not found');
        return false;
    }
    for (const char of subtitle) {
        await helper.send('Input.dispatchKeyEvent', { type: 'keyDown', text: char });
        await new Promise(r => setTimeout(r, 15));
        await helper.send('Input.dispatchKeyEvent', { type: 'keyUp', text: char });
        await new Promise(r => setTimeout(r, 15));
    }
    return true;
}

/**
 * Fill the ProseMirror body using innerHTML approach:
 * 1. Set innerHTML with paragraphs
 * 2. Dispatch 'input' event on the ProseMirror node so React registers the change
 */
async function typeBody(helper, bodyText) {
    const escaped = bodyText
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
        .replace(/`/g, '\\`')
        .replace(/\$/g, '\\$');

    const result = await js(helper, `
        (function() {
            var pm = document.querySelector('.ProseMirror');
            if (!pm) return 'ProseMirror not found';

            pm.focus();

            // Build paragraph HTML
            var lines = (\`${escaped}\`).split('\\n');
            var html = '';
            for (var i = 0; i < lines.length; i++) {
                var line = lines[i].trim();
                if (line === '') {
                    html += '<p><br></p>';
                } else {
                    html += '<p>' + line + '</p>';
                }
            }

            pm.innerHTML = html;

            // Dispatch React-compatible input event
            pm.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));

            return 'inserted ' + lines.length + ' lines, innerText: ' + pm.innerText.length + ' chars';
        })()
    `);
    log('INFO', `Body insert: ${result}`);
    return result && !result.includes('not found');
}

/**
 * Click Continue button.
 */
async function clickContinue(helper) {
    return await jsClickByText(helper, 'Continue', 0);
}

/**
 * Click "Send to everyone now" button.
 */
async function clickSendToEveryone(helper) {
    return await jsClickByText(helper, 'Send to everyone now', 0);
}

/**
 * Wait for a dialog to appear in the accessibility tree.
 */
async function waitForDialog(helper, timeoutMs = 15000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        const tree = await helper.snapshot().catch(() => null);
        if (!tree || !tree.nodes) { await new Promise(r => setTimeout(r, 1000)); continue; }
        function hasDialog(nodes) {
            for (const n of nodes) {
                if (n.role && n.role.value && n.role.value.toLowerCase() === 'dialog') return true;
                if (n.children && hasDialog(n.children)) return true;
            }
            return false;
        }
        if (hasDialog(tree.nodes)) return true;
        await new Promise(r => setTimeout(r, 1000));
    }
    return false;
}

/**
 * Handle the subscribe dialog — click "Publish without buttons".
 */
async function handleSubscribeDialog(helper) {
    log('INFO', 'Subscribe dialog detected — clicking "Publish without buttons"...');

    const allBtns = await js(helper, `
        (function() {
            var dialog = document.querySelector('[role="dialog"]');
            if (!dialog) return 'no dialog';
            var btns = dialog.querySelectorAll('button, [role="button"]');
            var result = [];
            for (var i = 0; i < btns.length; i++) {
                result.push(btns[i].textContent.trim());
            }
            return 'dialog buttons: ' + JSON.stringify(result);
        })()
    `);
    log('INFO', allBtns);

    const clicked = await js(helper, `
        (function() {
            var dialog = document.querySelector('[role="dialog"]');
            if (!dialog) return 'no dialog';
            var btns = dialog.querySelectorAll('button, [role="button"]');
            for (var i = 0; i < btns.length; i++) {
                var t = btns[i].textContent.trim();
                if (t.toLowerCase().includes('publish without')) {
                    btns[i].click();
                    return 'clicked: ' + t;
                }
            }
            // Also try broader search
            var all = document.querySelectorAll('button');
            for (var i = 0; i < all.length; i++) {
                var t = all[i].textContent.trim();
                if (t.toLowerCase().includes('without')) {
                    all[i].click();
                    return 'clicked (fallback): ' + t;
                }
            }
            return 'button not found in dialog';
        })()
    `);
    log('INFO', `Publish without buttons: ${clicked}`);

    await new Promise(r => setTimeout(r, 5000));
    return true;
}

async function publishPost(title, postUrl, emailBody) {
    const config = loadJson(CONFIG_PATH);
    if (!config) { log('ERROR', 'config.json not found'); return false; }

    const targetId = config.substack.browserTargetId;
    const helper = new BrowserHelper(targetId);

    log('INFO', `Connecting to browser (targetId=${targetId})`);
    try {
        await helper.connect();
    } catch (err) {
        log('ERROR', `Connection failed: ${err.message}`);
        return false;
    }
    log('INFO', 'Connected');

    let published = false;

    try {
        // ── Step 1: Navigate to editor ─────────────────────────────────────
        log('INFO', 'Navigating to editor...');
        await helper.navigate('https://orbit286020.substack.com/publish/post/');
        await new Promise(r => setTimeout(r, 7000));
        await takeScreenshot(helper, '01-editor-loaded');

        const url = await helper.getUrl();
        log('INFO', `URL: ${url}`);

        // ── Step 2: Type metadata title ───────────────────────────────────
        log('INFO', 'Typing metadata title...');
        const titleOk = await typeMetadataTitle(helper, title);
        if (titleOk) {
            log('INFO', `Title typed: "${title.slice(0, 60)}"`);
        }
        await new Promise(r => setTimeout(r, 500));
        await takeScreenshot(helper, '02-title-filled');

        // ── Step 3: Type email title (inside Email header section) ─────────
        log('INFO', 'Typing email title...');
        const emailTitleOk = await typeEmailTitle(helper, title);
        if (emailTitleOk) {
            log('INFO', `Email title typed: "${title.slice(0, 60)}"`);
        } else {
            log('WARN', 'Could not find email title field');
        }
        await new Promise(r => setTimeout(r, 500));

        // ── Step 4: Type body ───────────────────────────────────────────────
        log('INFO', 'Filling body content via innerHTML...');
        const bodyOk = await typeBody(helper, emailBody);
        if (bodyOk) {
            log('INFO', `Body inserted (${emailBody.length} chars)`);
        } else {
            log('WARN', 'Could not insert body content');
        }
        await new Promise(r => setTimeout(r, 500));
        await takeScreenshot(helper, '03-body-filled');

        // ── Step 5: Click Continue ─────────────────────────────────────────
        log('INFO', 'Clicking Continue...');
        const contResult = await clickContinue(helper);
        log('INFO', `Continue: ${contResult}`);
        await new Promise(r => setTimeout(r, 7000));
        await takeScreenshot(helper, '04-after-continue');

        // ── Step 6: Click "Send to everyone now" ───────────────────────────
        log('INFO', 'Clicking "Send to everyone now"...');
        const sendResult = await clickSendToEveryone(helper);
        log('INFO', `Send: ${sendResult}`);
        await new Promise(r => setTimeout(r, 2000));
        await takeScreenshot(helper, '05-after-send');

        // ── Step 7: Handle subscribe dialog ────────────────────────────────
        const dialogFound = await waitForDialog(helper, 15000);
        await takeScreenshot(helper, '06-dialog-check');

        if (dialogFound) {
            await handleSubscribeDialog(helper);
        } else {
            log('INFO', 'No subscribe dialog appeared');
        }

        // ── Step 8: Check final state ─────────────────────────────────────
        await new Promise(r => setTimeout(r, 5000));
        const finalUrl = await helper.getUrl();
        log('INFO', `Final URL: ${finalUrl}`);
        await takeScreenshot(helper, '07-final-state');

        if (!finalUrl.includes('/publish/post/') && !finalUrl.includes('/editor')) {
            log('INFO', '✅ Publish SUCCESS');
            published = true;
        } else if (finalUrl.includes('share-center') || finalUrl.includes('detail') || finalUrl.includes('posts')) {
            log('INFO', '✅ Publish SUCCESS — on post detail page');
            published = true;
        } else {
            log('WARN', `Still on editor page: ${finalUrl}`);
        }

    } catch (err) {
        log('ERROR', `Exception: ${err.message}\n${err.stack}`);
        await takeScreenshot(helper, '08-exception');
    } finally {
        helper.close();
    }

    return published;
}

// ─── main ─────────────────────────────────────────────────────────────────────
async function main() {
    const [bodyFile] = process.argv.slice(2);
    if (!bodyFile) {
        console.error('[publish-post] Usage: node publish-post.js <temp-json-file>');
        process.exit(1);
    }
    if (!fs.existsSync(bodyFile)) {
        log('ERROR', `Body file not found: ${bodyFile}`);
        process.exit(1);
    }
    let data;
    try {
        data = JSON.parse(fs.readFileSync(bodyFile, 'utf8'));
    } catch(e) {
        log('ERROR', `Invalid JSON in ${bodyFile}: ${e.message}`);
        process.exit(1);
    }
    const { title, url: postUrl, body: emailBody } = data;
    if (!title || !emailBody) {
        log('ERROR', 'JSON must contain title and body fields');
        process.exit(1);
    }

    log('INFO', `Starting publish: "${title}" from ${postUrl || 'no URL'}`);

    const success = await publishPost(title, postUrl, emailBody);

    try { fs.unlinkSync(bodyFile); } catch {}

    if (success) {
        log('INFO', 'RESULT: SUCCESS');
        process.exit(0);
    } else {
        log('ERROR', 'RESULT: FAILURE');
        process.exit(1);
    }
}

main().catch(err => {
    console.error('[publish-post] FATAL:', err.message);
    console.error(err.stack);
    process.exit(1);
});
