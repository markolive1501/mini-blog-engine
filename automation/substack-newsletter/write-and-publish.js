/**
 * write-and-publish.js
 * Complete end-to-end Substack newsletter writer and publisher.
 *
 * Uses pure JS DOM interaction via Runtime.evaluate — element.click() for
 * ALL buttons (CDP mouse events don't fire React handlers on Substack).
 * Body uses innerHTML + ProseMirror dispatchEvent (not execCommand).
 *
 * Usage: node write-and-publish.js
 *   (Edit the TEST_DATA constants below to change what's published)
 */

const fs = require('fs');
const path = require('path');
const { BrowserHelper } = require('./browser-helper');

const CONFIG_PATH     = path.join(__dirname, 'config.json');
const LOG_DIR          = path.join(__dirname, 'logs');
const SCREENSHOT_DIR   = path.join(__dirname, 'screenshots');

// ─── Test data ────────────────────────────────────────────────────────────────
const TEST_DATA = {
    title:      '🚀 Test Post — Orbit Auto-Publish v3',
    subtitle:   'This post was written and published automatically by the Substack browser automation pipeline.',
    emailTitle: '🚀 Test Newsletter — Orbit Auto-Publish v3',
    body: `This is an automated test post published by the Substack browser automation pipeline.

The pipeline uses Chrome DevTools Protocol (CDP) with JavaScript element.click() to bypass React's synthetic event system — because CDP's synthetic mouse events don't fire React onClick handlers on Substack.

What works:
• DOM.focus + Input.dispatchKeyEvent for character-by-character typing
• Runtime.evaluate + element.innerHTML for ProseMirror body insertion
• Runtime.evaluate + element.click() for ALL button interactions
• innerHTML + dispatchEvent(new Event('input', {bubbles:true})) for React state updates

This is paragraph two with some body text content.

And this is paragraph three — the automation is working correctly!

— Orbit 🛰️`,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
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
    const slug = slugify(label || 'step');
    const ts = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    const filePath = path.join(SCREENSHOT_DIR, `${ts}-${slug}.png`);
    try {
        await helper.screenshot(filePath);
        log('INFO', `📸 Screenshot: ${filePath}`);
    } catch (e) {
        log('WARN', `Screenshot failed: ${e.message}`);
    }
    return filePath;
}

/**
 * Execute JS in browser, return result value or description.
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
        return r.result && r.result.value !== undefined
            ? r.result.value
            : r.result.description || null;
    } catch(e) {
        return null;
    }
}

/**
 * Click the first element whose text content contains `text` (case-insensitive).
 * Uses element.click() via Runtime.evaluate — the ONLY way to click that works with React.
 * Also scrolls the element into view first to handle buttons that are off-screen.
 */
async function jsClickByText(helper, text) {
    return await js(helper, `
        (function() {
            var target = '${text.replace(/'/g, "\\'")}';
            var els = document.querySelectorAll('button, [role="button"], a, div[tabindex="0"], span');
            for (var i = 0; i < els.length; i++) {
                var t = els[i].textContent.trim();
                if (t.toLowerCase().includes(target.toLowerCase())) {
                    // Scroll into view before clicking
                    els[i].scrollIntoView({ behavior: 'instant', block: 'center' });
                    els[i].click();
                    return 'clicked: ' + t.substring(0, 80);
                }
            }
            return 'not found: ' + target;
        })()
    `);
}

/**
 * Get ALL buttons visible on page (for debugging).
 */
async function jsGetAllButtons(helper) {
    return await js(helper, `
        (function() {
            var els = document.querySelectorAll('button');
            var result = [];
            for (var i = 0; i < els.length; i++) {
                var t = els[i].textContent.trim();
                if (t) result.push(t.substring(0, 80));
            }
            return JSON.stringify(result);
        })()
    `);
}

/**
 * Wait for a dialog (role="dialog") to appear in the accessibility tree.
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

// ─── Field-filling functions ───────────────────────────────────────────────────

/**
 * Fill the metadata title field (placeholder="Add a title...").
 * Uses DOM.focus + Input.dispatchKeyEvent for character-by-character typing.
 */
async function fillMetadataTitle(helper, title) {
    const found = await js(helper, `
        (function() {
            var el = document.querySelector('[placeholder="Add a title..."]');
            if (!el) return 'not found';
            el.focus();
            return 'found';
        })()
    `);
    if (!found || !found.includes('found')) {
        log('WARN', 'Metadata title field not found');
        return false;
    }
    for (const char of title) {
        await helper.send('Input.dispatchKeyEvent', { type: 'keyDown', text: char });
        await new Promise(r => setTimeout(r, 20));
        await helper.send('Input.dispatchKeyEvent', { type: 'keyUp', text: char });
        await new Promise(r => setTimeout(r, 20));
    }
    return true;
}

/**
 * Expand "Email header / footer" section, then fill the email title
 * input (placeholder="Title") inside it.
 */
async function fillEmailTitle(helper, title) {
    // Expand the collapsible section
    const expanded = await js(helper, `
        (function() {
            var els = document.querySelectorAll('button, div[role="button"], div[tabindex="0"]');
            for (var i = 0; i < els.length; i++) {
                var t = els[i].textContent.trim();
                if (t.toLowerCase().includes('email header')) {
                    els[i].click();
                    return 'clicked: ' + t.substring(0, 80);
                }
            }
            return 'not found';
        })()
    `);
    log('INFO', `Email header expand: ${expanded}`);
    await new Promise(r => setTimeout(r, 2500));

    // Fill the Title input inside the expanded section
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
        await new Promise(r => setTimeout(r, 20));
        await helper.send('Input.dispatchKeyEvent', { type: 'keyUp', text: char });
        await new Promise(r => setTimeout(r, 20));
    }
    return true;
}

/**
 * Fill the subtitle/description field (placeholder="Write a short description...").
 */
async function fillSubtitle(helper, subtitle) {
    const found = await js(helper, `
        (function() {
            var el = document.querySelector('[placeholder="Write a short description..."]');
            if (!el) return 'not found';
            el.focus();
            return 'found';
        })()
    `);
    if (!found || !found.includes('found')) {
        log('WARN', 'Subtitle field not found');
        return false;
    }
    for (const char of subtitle) {
        await helper.send('Input.dispatchKeyEvent', { type: 'keyDown', text: char });
        await new Promise(r => setTimeout(r, 20));
        await helper.send('Input.dispatchKeyEvent', { type: 'keyUp', text: char });
        await new Promise(r => setTimeout(r, 20));
    }
    return true;
}

/**
 * Fill the ProseMirror body editor using innerHTML approach:
 * - Sets innerHTML with <p> tags
 * - Dispatches 'input' Event(bubbles:true) so React state updates
 * - NOT execCommand (deprecated and not React-compatible)
 */
async function fillBody(helper, bodyText) {
    const escaped = bodyText
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
        .replace(/`/g, '\\`')
        .replace(/\$/g, '\\$');

    const result = await js(helper, `
        (function() {
            var pm = document.querySelector('.ProseMirror');
            if (!pm) return 'ProseMirror not found';

            // Build paragraph HTML
            var lines = (\`${escaped}\`).split('\\n');
            var html = '';
            for (var i = 0; i < lines.length; i++) {
                var line = lines[i];
                if (line.trim() === '') {
                    html += '<p><br></p>';
                } else {
                    // Escape HTML in the line
                    var safe = line
                        .replace(/&/g, '&amp;')
                        .replace(/</g, '&lt;')
                        .replace(/>/g, '&gt;');
                    html += '<p>' + safe + '</p>';
                }
            }

            pm.innerHTML = html;

            // Dispatch React-compatible input event
            pm.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));

            return 'inserted ' + lines.length + ' lines, ' + pm.innerText.length + ' chars';
        })()
    `);
    log('INFO', `Body fill: ${result}`);
    return !result || !result.includes('not found');
}

// ─── Main automation ───────────────────────────────────────────────────────────
async function writeAndPublish() {
    const config = loadJson(CONFIG_PATH);
    if (!config) {
        log('ERROR', 'config.json not found');
        return { success: false };
    }

    const targetId = config.substack.browserTargetId;
    const helper = new BrowserHelper(targetId);

    log('INFO', `Connecting to browser (targetId=${targetId})`);
    try {
        await helper.connect();
    } catch (err) {
        log('ERROR', `Connection failed: ${err.message}`);
        return { success: false };
    }
    log('INFO', 'Connected');

    let published = false;
    let finalUrl = '';

    try {
        // ── Step 1: Navigate to editor ─────────────────────────────────────
        log('INFO', 'STEP 1: Navigating to editor...');
        await helper.navigate('https://orbit286020.substack.com/publish/post/');
        await new Promise(r => setTimeout(r, 8000));
        await takeScreenshot(helper, '01-editor-loaded');

        const startUrl = await helper.getUrl();
        log('INFO', `URL: ${startUrl}`);

        // ── Step 2: Fill metadata title ───────────────────────────────────
        log('INFO', 'STEP 2: Filling metadata title...');
        const t1 = Date.now();
        const titleOk = await fillMetadataTitle(helper, TEST_DATA.title);
        log('INFO', `Metadata title: ${titleOk ? 'OK' : 'FAILED'} (${Date.now()-t1}ms)`);
        await new Promise(r => setTimeout(r, 500));
        await takeScreenshot(helper, '02-title-filled');

        // ── Step 3: Fill subtitle/description ─────────────────────────────
        log('INFO', 'STEP 3: Filling subtitle...');
        const t2 = Date.now();
        const subOk = await fillSubtitle(helper, TEST_DATA.subtitle);
        log('INFO', `Subtitle: ${subOk ? 'OK' : 'FAILED'} (${Date.now()-t2}ms)`);
        await new Promise(r => setTimeout(r, 500));

        // ── Step 4: Fill email title (inside collapsible section) ──────────
        log('INFO', 'STEP 4: Filling email title...');
        const t3 = Date.now();
        const emailTitleOk = await fillEmailTitle(helper, TEST_DATA.emailTitle);
        log('INFO', `Email title: ${emailTitleOk ? 'OK' : 'FAILED'} (${Date.now()-t3}ms)`);
        await takeScreenshot(helper, '04-email-title-filled');

        // ── Step 5: Fill body ─────────────────────────────────────────────
        log('INFO', 'STEP 5: Filling body via innerHTML...');
        const t4 = Date.now();
        const bodyOk = await fillBody(helper, TEST_DATA.body);
        log('INFO', `Body: ${bodyOk ? 'OK' : 'FAILED'} (${Date.now()-t4}ms)`);
        await new Promise(r => setTimeout(r, 500));
        await takeScreenshot(helper, '05-body-filled');

        // ── Step 6: Click Continue ─────────────────────────────────────────
        log('INFO', 'STEP 6: Clicking Continue...');
        const contResult = await jsClickByText(helper, 'Continue');
        log('INFO', `Continue: ${contResult}`);
        await new Promise(r => setTimeout(r, 8000));
        await takeScreenshot(helper, '06-after-continue');

        const postUrl = await helper.getUrl();
        log('INFO', `Post URL after continue: ${postUrl}`);

        // ── Step 7: Click "Send to everyone now" ───────────────────────────
        log('INFO', 'STEP 7: Clicking "Send to everyone now"...');

        // Debug: log all buttons visible on page before clicking
        const allBtns = await jsGetAllButtons(helper);
        log('INFO', `All buttons visible: ${allBtns}`);

        const sendResult = await jsClickByText(helper, 'Send to everyone now');
        log('INFO', `Send to everyone: ${sendResult}`);

        if (sendResult && sendResult.includes('not found')) {
            log('WARN', '"Send to everyone now" not found — trying alternative text...');
            // Try shorter fragments in case text is split across elements
            const altResult = await js(helper, `
                (function() {
                    var btns = document.querySelectorAll('button');
                    for (var i = 0; i < btns.length; i++) {
                        var t = btns[i].textContent.trim();
                        if (t.toLowerCase().replace(/\\s+/g,' ').includes('send to everyone')) {
                            btns[i].scrollIntoView({ behavior: 'instant', block: 'center' });
                            btns[i].click();
                            return 'clicked alt: ' + t.substring(0, 80);
                        }
                    }
                    return 'not found';
                })()
            `);
            log('INFO', `Alt send click: ${altResult}`);
        }

        await new Promise(r => setTimeout(r, 2000));
        await takeScreenshot(helper, '07-after-send');

        // ── Step 8: Handle subscribe dialog ────────────────────────────────
        log('INFO', 'STEP 8: Checking for subscribe dialog...');
        const dialogFound = await waitForDialog(helper, 15000);
        await takeScreenshot(helper, '08-dialog-check');

        if (dialogFound) {
            log('INFO', 'Dialog detected — clicking "Publish without buttons"...');

            // Log what's in the dialog first
            const dialogInfo = await js(helper, `
                (function() {
                    var d = document.querySelector('[role="dialog"]');
                    if (!d) return 'no dialog';
                    var allBtns = d.querySelectorAll('button');
                    var result = [];
                    for (var i = 0; i < allBtns.length; i++) {
                        result.push({ text: allBtns[i].textContent.trim(), index: i });
                    }
                    // Also find by visible text in dialog children
                    var walk = document.createTreeWalker(d, NodeFilter.SHOW_TEXT, null, false);
                    var texts = [];
                    while (walk.nextNode()) {
                        var t = walk.currentNode.textContent.trim();
                        if (t) texts.push(t);
                    }
                    return JSON.stringify({ buttons: result, texts: texts });
                })()
            `);
            log('INFO', `Dialog info: ${dialogInfo}`);

            // Strategy: find the SECOND button in the dialog (index 1 = "Publish without buttons")
            // The first button (index 0) is "Add subscribe buttons" (primary)
            // The second button (index 1) is "Publish without buttons" (secondary/outlined)
            const clicked = await js(helper, `
                (function() {
                    var d = document.querySelector('[role="dialog"]');
                    if (!d) return 'no dialog';
                    var btns = d.querySelectorAll('button');
                    // The secondary button (outlined style) is the second one
                    // Try to find by the word 'without'
                    for (var i = 0; i < btns.length; i++) {
                        var t = btns[i].textContent.trim();
                        if (t.toLowerCase().includes('without')) {
                            btns[i].scrollIntoView({ behavior: 'instant', block: 'center' });
                            btns[i].click();
                            return 'clicked by text: ' + t;
                        }
                    }
                    // Fallback: click the SECOND button (index 1)
                    if (btns.length >= 2) {
                        btns[1].scrollIntoView({ behavior: 'instant', block: 'center' });
                        btns[1].click();
                        return 'clicked index 1: ' + btns[1].textContent.trim();
                    }
                    // Last resort: find any button that looks secondary (outlined)
                    for (var i = 0; i < btns.length; i++) {
                        var cls = btns[i].className || '';
                        if (cls.toLowerCase().includes('outlined') || cls.toLowerCase().includes('secondary')) {
                            btns[i].scrollIntoView({ behavior: 'instant', block: 'center' });
                            btns[i].click();
                            return 'clicked by class: ' + btns[i].textContent.trim();
                        }
                    }
                    return 'button not found in dialog';
                })()
            `);
            log('INFO', `Dialog click result: ${clicked}`);
            await new Promise(r => setTimeout(r, 8000));
        } else {
            log('INFO', 'No subscribe dialog appeared');
        }

        // ── Step 9: Verify published ─────────────────────────────────────
        await new Promise(r => setTimeout(r, 5000));
        finalUrl = await helper.getUrl();
        log('INFO', `Final URL: ${finalUrl}`);
        await takeScreenshot(helper, '09-final-state');

        if (
            !finalUrl.includes('/publish/post') &&
            !finalUrl.includes('/editor') &&
            !finalUrl.includes('/publish')
        ) {
            log('INFO', '✅ Publish SUCCESS — navigated away from editor');
            published = true;
        } else if (
            finalUrl.includes('share-center') ||
            finalUrl.includes('detail') ||
            finalUrl.includes('/posts/') ||
            finalUrl.includes('substack.com/p/')
        ) {
            log('INFO', '✅ Publish SUCCESS — on post detail page');
            published = true;
        } else {
            log('WARN', `Still on publish page: ${finalUrl}`);
        }

    } catch (err) {
        log('ERROR', `Exception: ${err.message}\n${err.stack}`);
        await takeScreenshot(helper, '10-exception');
    } finally {
        helper.close();
    }

    return { success: published, finalUrl };
}

// ─── main ─────────────────────────────────────────────────────────────────────
async function main() {
    log('INFO', '═══════════════════════════════════════════════');
    log('INFO', '  write-and-publish.js — Substack Auto-Publisher');
    log('INFO', '═══════════════════════════════════════════════');
    log('INFO', `Title:    ${TEST_DATA.title}`);
    log('INFO', `Subtitle: ${TEST_DATA.subtitle.slice(0, 60)}...`);
    log('INFO', `Email:    ${TEST_DATA.emailTitle}`);
    log('INFO', `Body:     ${TEST_DATA.body.length} chars`);

    const result = await writeAndPublish();

    log('INFO', '═══════════════════════════════════════════════');
    if (result.success) {
        log('INFO', '✅ RESULT: SUCCESS');
        log('INFO', `Published at: ${result.finalUrl}`);
    } else {
        log('ERROR', '❌ RESULT: FAILURE');
        log('ERROR', `Final URL: ${result.finalUrl}`);
    }
    log('INFO', '═══════════════════════════════════════════════');

    process.exit(result.success ? 0 : 1);
}

main().catch(err => {
    console.error('[write-and-publish] FATAL:', err.message);
    console.error(err.stack);
    process.exit(1);
});
