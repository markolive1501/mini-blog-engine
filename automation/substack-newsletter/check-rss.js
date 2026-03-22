/**
 * check-rss.js
 * Fetch RSS feed, compare against state.json, return list of new posts.
 * Usage: node check-rss.js
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const CONFIG_PATH = path.join(__dirname, 'config.json');
const STATE_PATH = path.join(__dirname, 'state.json');

function loadJson(filePath) {
    if (!fs.existsSync(filePath)) return null;
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch {
        return null;
    }
}

function httpsGet(url) {
    return new Promise((resolve, reject) => {
        const req = https.get(url, { headers: { 'User-Agent': 'SubstackNewsletterBot/1.0' } }, (res) => {
            if (res.statusCode !== 200) {
                reject(new Error(`HTTP ${res.statusCode} for ${url}`));
                return;
            }
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(data));
        });
        req.on('error', reject);
        req.setTimeout(15000, () => {
            req.destroy();
            reject(new Error(`Timeout fetching ${url}`));
        });
    });
}

function parseRSS(xml) {
    const items = [];
    // Match <item>...</item> blocks
    const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
    let match;
    while ((match = itemRegex.exec(xml)) !== null) {
        const itemXml = match[1];
        
        const getTag = (tag) => {
            // Handle <tag><![CDATA[...]]></tag> and plain <tag>...</tag>
            const m = itemXml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
            if (!m) return '';
            let val = m[1];
            // Strip CDATA
            val = val.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, '$1');
            // Strip HTML tags
            val = val.replace(/<[^>]+>/g, ' ').trim();
            return val;
        };

        const getTagRaw = (tag) => {
            const m = itemXml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
            if (!m) return '';
            let val = m[1];
            val = val.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, '$1');
            return val.trim();
        };

        const title = getTag('title');
        const link = getTagRaw('link');
        const pubDate = getTagRaw('pubDate');
        const description = getTag('description');

        if (title && link) {
            items.push({ title, url: link, publishedAt: pubDate || null, description });
        }
    }
    return items;
}

function parseDate(dateStr) {
    if (!dateStr) return new Date(0);
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? new Date(0) : d;
}

async function main() {
    const config = loadJson(CONFIG_PATH);
    if (!config) {
        console.error('[check-rss] ERROR: config.json not found');
        process.exit(1);
    }

    const rssUrl = config.blog.rssUrl;
    const state = loadJson(STATE_PATH) || { publishedUrls: [] };
    const publishedUrls = new Set(state.publishedUrls || []);

    console.error(`[check-rss] Fetching RSS: ${rssUrl}`);
    let xml;
    try {
        xml = await httpsGet(rssUrl);
    } catch (err) {
        console.error(`[check-rss] ERROR: Failed to fetch RSS: ${err.message}`);
        process.exit(1);
    }

    const items = parseRSS(xml);
    console.error(`[check-rss] Found ${items.length} total posts in RSS`);

    // Filter out already published
    const newItems = items.filter(item => !publishedUrls.has(item.url));
    console.error(`[check-rss] ${newItems.length} new posts (not yet published)`);

    // Sort by pubDate ascending (oldest first)
    newItems.sort((a, b) => parseDate(a.publishedAt) - parseDate(b.publishedAt));

    // Output as JSON to stdout
    console.log(JSON.stringify(newItems, null, 2));
}

main().catch(err => {
    console.error('[check-rss] FATAL:', err.message);
    process.exit(1);
});
