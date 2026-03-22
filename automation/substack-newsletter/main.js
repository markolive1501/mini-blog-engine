/**
 * main.js
 * Orchestrator for the Substack newsletter automation pipeline.
 * Usage: node main.js
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, 'config.json');
const STATE_PATH = path.join(__dirname, 'state.json');
const LOG_DIR = path.join(__dirname, 'logs');

function loadJson(filePath) {
    if (!fs.existsSync(filePath)) return null;
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch {
        return null;
    }
}

function saveJson(filePath, data) {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

function log(level, msg) {
    const ts = new Date().toISOString();
    const line = `[${ts}] [${level}] ${msg}`;
    console.error(line);
    const logFile = path.join(LOG_DIR, `${new Date().toISOString().slice(0, 10)}.log`);
    fs.appendFileSync(logFile, line + '\n');
}

/**
 * Run a node script and capture stdout.
 */
function runNode(scriptName, args = []) {
    return new Promise((resolve, reject) => {
        const scriptPath = path.join(__dirname, scriptName);
        const proc = spawn('node', [scriptPath, ...args], {
            cwd: __dirname,
            shell: true,
        });

        let stdout = '';
        let stderr = '';

        proc.stdout.on('data', (data) => { stdout += data.toString(); });
        proc.stderr.on('data', (data) => { stderr += data.toString(); });

        proc.on('close', (code) => {
            resolve({ code, stdout, stderr });
        });
        proc.on('error', (err) => {
            reject(err);
        });
    });
}

async function main() {
    const startTime = new Date();
    log('INFO', '========================================');
    log('INFO', `Starting Substack publish run at ${startTime.toISOString()}`);

    // Load config
    const config = loadJson(CONFIG_PATH);
    if (!config) {
        log('ERROR', 'config.json not found — aborting');
        process.exit(1);
    }

    // Load or init state
    let state = loadJson(STATE_PATH);
    if (!state) {
        log('INFO', 'state.json not found — creating initial state');
        state = {
            lastPublishedUrl: null,
            lastPublishedAt: null,
            publishedUrls: [],
            lastRunAt: null,
            runHistory: [],
        };
    }

    // ── Step 1: Check RSS for new posts ─────────────────────────────────────
    log('INFO', 'Step 1: Checking RSS feed for new posts...');
    let checkResult;
    try {
        checkResult = await runNode('check-rss.js');
        // stderr has our log messages, stdout has JSON
        if (checkResult.code !== 0) {
            log('ERROR', `check-rss.js failed: ${checkResult.stderr}`);
            process.exit(1);
        }
    } catch (err) {
        log('ERROR', `Failed to run check-rss.js: ${err.message}`);
        process.exit(1);
    }

    let newPosts = [];
    try {
        newPosts = JSON.parse(checkResult.stdout.trim() || '[]');
    } catch {
        log('ERROR', 'Failed to parse check-rss.js output');
        log('ERROR', 'stdout: ' + checkResult.stdout);
        process.exit(1);
    }

    log('INFO', `Found ${newPosts.length} new post(s) to publish`);

    if (newPosts.length === 0) {
        log('INFO', 'No new posts — run complete');
        state.lastRunAt = new Date().toISOString();
        saveJson(STATE_PATH, state);
        process.exit(0);
    }

    // ── Step 2: Fetch content + publish each post ────────────────────────────
    let publishedCount = 0;
    let errorCount = 0;
    const errors = [];

    for (const post of newPosts) {
        log('INFO', `----------------------------------------`);
        log('INFO', `Processing: "${post.title}" (${post.url})`);

        // Check duplicate (belt-and-suspenders)
        if (state.publishedUrls.includes(post.url)) {
            log('INFO', `Already published (in state) — skipping: ${post.url}`);
            continue;
        }

        // ── Fetch content ────────────────────────────────────────────────────
        log('INFO', `Fetching content for: ${post.url}`);
        let emailBody = '';
        let fetchResult;
        try {
            fetchResult = await runNode('fetch-content.js', [post.url]);
            if (fetchResult.code !== 0) {
                log('ERROR', `fetch-content.js failed: ${fetchResult.stderr}`);
                errors.push({ post: post.title, url: post.url, error: 'fetch failed' });
                errorCount++;
                continue;
            }
            emailBody = fetchResult.stdout.trim();
            if (!emailBody) {
                log('ERROR', 'fetch-content returned empty body');
                errors.push({ post: post.title, url: post.url, error: 'empty body' });
                errorCount++;
                continue;
            }
        } catch (err) {
            log('ERROR', `Failed to run fetch-content.js: ${err.message}`);
            errors.push({ post: post.title, url: post.url, error: err.message });
            errorCount++;
            continue;
        }

        // Write email body and metadata to temp file for publish-post (avoids CLI arg splitting on spaces)
        const bodyFile = path.join(__dirname, `.temp-email-body-${Date.now()}.json`);
        fs.writeFileSync(bodyFile, JSON.stringify({ title: post.title, url: post.url, body: emailBody }), 'utf8');

        // ── Publish to Substack ─────────────────────────────────────────────
        log('INFO', `Publishing to Substack: "${post.title}"`);
        let publishResult;
        let published = false;

        for (let attempt = 1; attempt <= (config.automation.retryAttempts || 1) + 1; attempt++) {
            if (attempt > 1) {
                log('INFO', `Retry attempt ${attempt} after ${config.automation.retryDelaySeconds || 30}s delay...`);
                await new Promise(r => setTimeout(r, (config.automation.retryDelaySeconds || 30) * 1000));
            }

            try {
                publishResult = await runNode('publish-post.js', [bodyFile]);

                if (publishResult.code === 0) {
                    published = true;
                    break;
                } else {
                    log('ERROR', `publish-post.js attempt ${attempt} failed: ${publishResult.stderr}`);
                }
            } catch (err) {
                log('ERROR', `publish-post.js attempt ${attempt} threw: ${err.message}`);
            }
        }

        // Clean up temp file
        try { fs.unlinkSync(bodyFile); } catch {}

        if (published) {
            log('INFO', `SUCCESS: Published "${post.title}"`);
            state.publishedUrls.push(post.url);
            state.lastPublishedUrl = post.url;
            state.lastPublishedAt = new Date().toISOString();
            publishedCount++;
        } else {
            log('ERROR', `FAILED after all retries: "${post.title}"`);
            errors.push({ post: post.title, url: post.url, error: 'publish failed' });
            errorCount++;
        }
    }

    // ── Step 3: Update state ────────────────────────────────────────────────
    state.lastRunAt = new Date().toISOString();

    // Trim runHistory to max entries
    const maxHistory = config.automation?.maxRunHistory || 100;
    state.runHistory.push({
        runAt: new Date().toISOString(),
        postsFound: newPosts.length,
        postsPublished: publishedCount,
        errors: errors,
    });
    if (state.runHistory.length > maxHistory) {
        state.runHistory = state.runHistory.slice(-maxHistory);
    }

    saveJson(STATE_PATH, state);
    log('INFO', `State saved to ${STATE_PATH}`);

    // ── Summary ─────────────────────────────────────────────────────────────
    const duration = ((Date.now() - startTime.getTime()) / 1000).toFixed(1);
    log('INFO', '========================================');
    log('INFO', `Run complete in ${duration}s. Published ${publishedCount}/${newPosts.length} posts.`);
    if (errorCount > 0) {
        log('ERROR', `${errorCount} post(s) failed — see errors above.`);
    }
    log('INFO', `Next run: check RSS feed periodically or wait for cron schedule.`);

    process.exit(errorCount > 0 ? 1 : 0);
}

main().catch(err => {
    console.error('[main] FATAL:', err.message);
    console.error(err.stack);
    process.exit(1);
});
