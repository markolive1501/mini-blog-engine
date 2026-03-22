/**
 * browser-helper.js
 * CDP (Chrome DevTools Protocol) helper for OpenClaw browser automation.
 * targetId: CF712D9456053DAE8F6EC1FEDDE93571
 *
 * CDP accessibility tree format:
 *   node.role       → { type: "role", value: "button" }
 *   node.name       → { type: "computedString", value: "Publish" }
 *   node.backendDOMNodeId → number (use for clicks / DOM.resolve)
 *
 * Helper methods normalize these into plain strings for ease of use.
 */

const http = require('http');

const CDP_HOST = '127.0.0.1';
const CDP_PORT = 18800;
const TARGET_ID = process.env.BROWSER_TARGET_ID || 'CF712D9456053DAE8F6EC1FEDDE93571';

/**
 * Extract plain string value from a CDP accessibility property object.
 * Handles: { type: "role", value: "button" } → "button"
 *          { type: "computedString", value: "Publish" } → "Publish"
 *          plain string → itself
 *          null/undefined → ''
 */
function axVal(prop) {
    if (!prop) return '';
    if (typeof prop === 'string') return prop;
    if (typeof prop.value === 'string') return prop.value;
    return '';
}

/**
 * Connect to the browser via WebSocket and return a helper object.
 */
class BrowserHelper {
    constructor(targetId) {
        this.targetId = targetId;
        this.ws = null;
        this.wsUrl = null;
        this.messageId = 0;
        this.pending = {};
        this.ready = false;
    }

    async connect() {
        const wsUrl = `ws://${CDP_HOST}:${CDP_PORT}/devtools/page/${this.targetId}`;
        this.wsUrl = wsUrl;

        let ws;
        try {
            ws = require('ws');
        } catch {
            throw new Error('The "ws" npm package is required. Run: npm install ws');
        }

        return new Promise((resolve, reject) => {
            this.ws = new ws(wsUrl);

            this.ws.on('open', () => {
                this.ready = true;
                resolve(this);
            });

            this.ws.on('message', (data) => {
                try {
                    const msg = JSON.parse(data.toString());
                    if (msg.id && this.pending[msg.id]) {
                        this.pending[msg.id](msg);
                        delete this.pending[msg.id];
                    }
                } catch (e) {
                    // Ignore non-JSON / event messages
                }
            });

            this.ws.on('error', (err) => {
                if (!this.ready) reject(err);
            });

            this.ws.on('close', () => {
                this.ready = false;
            });

            setTimeout(() => {
                if (!this.ready) reject(new Error('Connection timeout'));
            }, 10000);
        });
    }

    /**
     * Send a CDP command and wait for response.
     */
    async send(method, params = {}) {
        if (!this.ws || this.ws.readyState !== 1) {
            throw new Error('WebSocket not connected');
        }

        const id = ++this.messageId;
        const promise = new Promise((resolve, reject) => {
            this.pending[id] = (msg) => {
                if (msg.error) reject(new Error(msg.error.message || JSON.stringify(msg.error)));
                else resolve(msg.result);
            };
        });

        this.ws.send(JSON.stringify({ id, method, params }));
        return promise;
    }

    /**
     * Navigate to a URL and wait for load.
     */
    async navigate(url) {
        await this.send('Page.navigate', { url });
        await this.waitForLoad();
    }

    /**
     * Poll document.readyState until 'complete'.
     */
    async waitForLoad(timeoutMs = 20000) {
        const start = Date.now();
        while (Date.now() - start < timeoutMs) {
            try {
                const result = await this.send('Runtime.evaluate', {
                    expression: 'document.readyState',
                    returnByValue: true,
                });
                if (axVal(result.result) === 'complete') return;
            } catch {}
            await this._sleep(500);
        }
    }

    /**
     * Take a full accessibility tree snapshot.
     */
    async snapshot() {
        return await this.send('Accessibility.getFullAXTree', {});
    }

    /**
     * Recursively search accessibility tree for a node.
     * Returns normalized { role, name, nodeId } or null.
     */
    _findNode(nodes, role, name, nameIncludes) {
        if (!role) return null;
        const roleLower = role.toLowerCase();
        for (const node of nodes) {
            const roleVal = axVal(node.role);
            const nameVal = axVal(node.name);

            const roleMatch = roleVal.toLowerCase() === roleLower;
            const nameMatch = !name || (nameIncludes ? nameVal.toLowerCase().includes(name.toLowerCase()) : nameVal.toLowerCase() === name.toLowerCase());

            if (roleMatch && nameMatch) {
                return { role: roleVal, name: nameVal, nodeId: node.backendDOMNodeId };
            }
            if (node.childIds && node.childIds.length > 0 && node.children) {
                const found = this._findNode(node.children, role, name, nameIncludes);
                if (found) return found;
            }
        }
        return null;
    }

    /**
     * Find element by role + exact accessible name.
     */
    async findElement(role, name) {
        const tree = await this.snapshot();
        return this._findNode(tree.nodes || [], role, name, false);
    }

    /**
     * Find element by role + partial name match.
     */
    async findElementContains(role, name) {
        const tree = await this.snapshot();
        return this._findNode(tree.nodes || [], role, name, true);
    }

    /**
     * Find any element whose accessible name contains text (case-insensitive).
     */
    async findByText(text) {
        const tree = await this.snapshot();
        return this._findNode(tree.nodes || [], null, text, true);
    }

    /**
     * Click an element by backendDOMNodeId using DOM mouse dispatch.
     */
    async click(nodeId) {
        try {
            // Try DOM.requestNode → getContentQuads → mouse click
            const resolved = await this.send('DOM.requestNode', { backendNodeId: nodeId });
            const objectId = resolved.object?.objectId || resolved.objectId;

            if (objectId) {
                const quads = await this.send('DOM.getContentQuads', { objectId });
                if (quads && quads.quads && quads.quads.length > 0) {
                    const quad = quads.quads[0];
                    const x = (quad[0] + quad[2] + quad[4] + quad[6]) / 4;
                    const y = (quad[1] + quad[3] + quad[5] + quad[7]) / 4;
                    await this._mouseClick(x, y);
                    return;
                }
            }
        } catch {}

        // Fallback: JS element.click()
        await this.send('Runtime.evaluate', {
            expression: `(function() {
                var all = document.querySelectorAll('*');
                for (var i = 0; i < all.length; i++) {
                    try {
                        var ax = all[i];
                        if (ax['__axElem'] && ax['__axElem']['backendDOMNodeId'] === ${nodeId}) {
                            ax.click();
                            return 'clicked';
                        }
                    } catch(e) {}
                }
                return 'not found';
            })()`,
            returnByValue: true,
        });
    }

    /**
     * Click at absolute coordinates.
     */
    async _mouseClick(x, y) {
        await this.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: 'none', clickCount: 0 });
        await this._sleep(50);
        await this.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
        await this._sleep(50);
        await this.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
    }

    /**
     * Type text character-by-character (for single-line fields like title).
     */
    async type(text) {
        for (const char of String(text)) {
            await this.send('Input.dispatchKeyEvent', { type: 'keyDown', text: char });
            await this._sleep(10);
            await this.send('Input.dispatchKeyEvent', { type: 'keyUp', text: char });
            await this._sleep(10);
        }
    }

    /**
     * Paste text into the focused element via document.execCommand.
     */
    async paste(text) {
        const escaped = text
            .replace(/\\/g, '\\\\')
            .replace(/`/g, '\\`')
            .replace(/\$/g, '\\$');

        const result = await this.send('Runtime.evaluate', {
            expression: `
                (function() {
                    var el = document.activeElement;
                    if (!el) return 'no active element';
                    el.focus();
                    try {
                        var ok = document.execCommand('paste', false, null);
                        return 'execCommand paste: ' + ok;
                    } catch(e) {
                        return 'error: ' + e.message;
                    }
                })()
            `,
            returnByValue: true,
        });
        return axVal(result.result);
    }

    /**
     * Directly set text content of a contentEditable element.
     * Finds the element by aria role=generic + contenteditable, or by aria-label.
     */
    async setContentEditableText(text) {
        const escaped = text
            .replace(/\\/g, '\\\\')
            .replace(/`/g, '\\`')
            .replace(/\$/g, '\\$')
            .replace(/\n/g, '\\n');

        const result = await this.send('Runtime.evaluate', {
            expression: `
                (function() {
                    // Find Substack's richtext editor
                    var editor = document.querySelector('[data-sentry-element="RichTextEditor"]');
                    if (!editor) {
                        var els = document.querySelectorAll('[contenteditable="true"]');
                        for (var i = 0; i < els.length; i++) {
                            if (els[i].getAttribute('contenteditable') === 'true' &&
                                els[i].className && els[i].className.includes('ProseMirror')) {
                                editor = els[i];
                                break;
                            }
                        }
                    }
                    if (!editor) {
                        // Fallback: find the focused contenteditable
                        var focused = document.activeElement;
                        if (focused && (focused.isContentEditable || focused.getAttribute('contenteditable') === 'true')) {
                            editor = focused;
                        }
                    }
                    if (!editor) return 'editor not found';

                    // Clear and set content
                    editor.focus();
                    // Select all and replace
                    var range = document.createRange();
                    range.selectNodeContents(editor);
                    var sel = window.getSelection();
                    sel.removeAllRanges();
                    sel.addRange(range);

                    var lines = (\`${escaped}\`).split('\\n');
                    var fragment = document.createDocumentFragment();
                    for (var i = 0; i < lines.length; i++) {
                        if (i > 0) fragment.appendChild(document.createElement('br'));
                        if (lines[i]) fragment.appendChild(document.createTextNode(lines[i]));
                    }

                    document.execCommand('selectAll', false, null);
                    document.execCommand('insertHTML', false, fragment.innerHTML);
                    return 'ok: ' + lines.length + ' lines';
                })()
            `,
            returnByValue: true,
        });
        return axVal(result.result);
    }

    /**
     * Set the value of an input or textarea by backendDOMNodeId.
     */
    async setInputValue(nodeId, text) {
        try {
            const resolved = await this.send('DOM.requestNode', { backendNodeId: nodeId });
            const objectId = resolved.object?.objectId || resolved.objectId;

            if (objectId) {
                await this.send('DOM.focus', { objectId });
                await this._sleep(100);

                // Select all in the input
                await this.send('Runtime.evaluate', {
                    expression: `
                        (function() {
                            var node = window[Symbol.for('__axElem')];
                            // Try JS path
                        })()
                    `,
                    returnByValue: true,
                });

                // Use Input.dispatchKeyEvent to type (clear first)
                await this.send('Input.dispatchKeyEvent', { type: 'keyDown', modifiers: 3, key: 'a' }); // Ctrl+A
                await this._sleep(50);
                await this.send('Input.dispatchKeyEvent', { type: 'keyUp', modifiers: 3, key: 'a' });
                await this._sleep(50);
                await this.send('Input.dispatchKeyEvent', { type: 'keyDown', modifiers: 0, key: 'Delete' });
                await this._sleep(50);
                await this.send('Input.dispatchKeyEvent', { type: 'keyUp', modifiers: 0, key: 'Delete' });
                await this._sleep(50);

                // Type new text
                for (const char of String(text)) {
                    await this.send('Input.dispatchKeyEvent', { type: 'keyDown', text: char });
                    await this._sleep(10);
                    await this.send('Input.dispatchKeyEvent', { type: 'keyUp', text: char });
                    await this._sleep(10);
                }
                return 'typed';
            }
        } catch (e) {}

        // Fallback: use Runtime.evaluate to set value
        const result = await this.send('Runtime.evaluate', {
            expression: `
                (function() {
                    var all = document.querySelectorAll('input, textarea, [contenteditable]');
                    for (var i = 0; i < all.length; i++) {
                        try {
                            if (all[i]['__axElem'] && all[i]['__axElem']['backendDOMNodeId'] === ${nodeId}) {
                                all[i].focus();
                                all[i].value = \`${text.replace(/`/g, '\\`').replace(/\$/g, '\\$')}\`;
                                all[i].dispatchEvent(new Event('input', { bubbles: true }));
                                all[i].dispatchEvent(new Event('change', { bubbles: true }));
                                return 'set';
                            }
                        } catch(e) {}
                    }
                    return 'not found';
                })()
            `,
            returnByValue: true,
        });
        return axVal(result.result);
    }

    /**
     * Take a screenshot and save to file.
     */
    async screenshot(savePath) {
        const result = await this.send('Page.captureScreenshot', { format: 'png', quality: 80 });
        const fs = require('fs');
        const buf = Buffer.from(result.data, 'base64');
        fs.writeFileSync(savePath, buf);
        return savePath;
    }

    /**
     * Get current URL.
     */
    async getUrl() {
        const result = await this.send('Runtime.evaluate', {
            expression: 'window.location.href',
            returnByValue: true,
        });
        return axVal(result.result);
    }

    _sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async wait(ms) {
        return this._sleep(ms);
    }

    close() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }
}

module.exports = { BrowserHelper, TARGET_ID, CDP_HOST, CDP_PORT };

// CLI test
if (require.main === module) {
    const cmd = process.argv[2];
    const helper = new BrowserHelper(TARGET_ID);

    (async () => {
        try {
            await helper.connect();
            console.log('[browser-helper] Connected to', helper.wsUrl);

            if (cmd === 'url') {
                console.log('[browser-helper] URL:', await helper.getUrl());
            } else if (cmd === 'snapshot') {
                const s = await helper.snapshot();
                console.log(JSON.stringify(s, null, 2));
            } else if (cmd === 'find') {
                const el = await helper.findElement(process.argv[3], process.argv[4] || '');
                console.log('[browser-helper] Found:', JSON.stringify(el));
            } else if (cmd === 'findtext') {
                const el = await helper.findByText(process.argv[3]);
                console.log('[browser-helper] Found:', JSON.stringify(el));
            } else if (cmd === 'screenshot') {
                const p = process.argv[3] || 'screenshot.png';
                await helper.screenshot(p);
                console.log('[browser-helper] Saved:', p);
            }

            helper.close();
        } catch (err) {
            console.error('[browser-helper] Error:', err.message);
            process.exit(1);
        }
    })();
}
