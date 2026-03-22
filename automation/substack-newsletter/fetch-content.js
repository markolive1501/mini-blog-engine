/**
 * fetch-content.js
 * Fetch a post URL, extract title + first 2 paragraphs as excerpt.
 * Usage: node fetch-content.js <post-url>
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const CONFIG_PATH = path.join(__dirname, 'config.json');

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

/**
 * Extract the article title and main content from HTML.
 * Returns { title, excerpt }
 */
function extractContent(html, fallbackTitle) {
    // Extract title
    let title = fallbackTitle || '';
    const titleMatch = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    if (titleMatch) {
        title = titleMatch[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, '$1').replace(/<[^>]+>/g, '').trim();
    }
    if (!title) {
        const titleTagMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
        if (titleTagMatch) {
            title = titleTagMatch[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, '$1').replace(/<[^>]+>/g, '').trim();
        }
    }

    // Extract article body - look for common article containers
    let articleHtml = '';
    
    // Try various article container selectors
    const articlePatterns = [
        /<article[^>]*>([\s\S]*?)<\/article>/i,
        /<div[^>]*class="[^"]*(?:post|article|content)[^"]*"[^>]*>([\s\S]*?)<div[^>]*class="[^"]*(?:footer|sidebar|nav|related)[^"]*"/i,
        /<div[^>]*class="[^"]*post-body[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
        /<div[^>]*class="[^"]*entry-content[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
        /<main[^>]*>([\s\S]*?)<\/main>/i,
    ];

    for (const pattern of articlePatterns) {
        const m = html.match(pattern);
        if (m && m[1].length > 100) {
            articleHtml = m[1];
            break;
        }
    }

    // Fallback: grab everything after <body> if no article found
    if (!articleHtml) {
        const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
        if (bodyMatch) articleHtml = bodyMatch[1];
    }

    // Remove unwanted elements
    articleHtml = articleHtml
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
        .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
        .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/<[^>]+class="[^"]*(?:nav|menu|sidebar|comment|related|share|ad)[^"]*"[^>]*>[\s\S]*?<\/[^>]+>/gi, '');

    // Convert HTML to plain text and extract paragraphs
    let text = articleHtml
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n')
        .replace(/<\/h[1-6]>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/<[^>]+>/g, '')
        .replace(/\n\s*\n/g, '\n')
        .trim();

    // Split into paragraphs and get first 2 non-empty paragraphs
    const paragraphs = text.split(/\n+/).map(p => p.trim()).filter(p => p.length > 50);
    const firstTwo = paragraphs.slice(0, 2);
    
    // Build excerpt
    let excerpt = firstTwo.join('\n\n');
    if (excerpt.length > 800) {
        excerpt = excerpt.substring(0, 797) + '...';
    } else if (!excerpt) {
        excerpt = text.substring(0, 500);
    }

    return { title, excerpt };
}

function formatEmailBody(title, excerpt, postUrl) {
    return `${title}

${excerpt}

Read more at: ${postUrl}`;
}

async function main() {
    const postUrl = process.argv[2];
    if (!postUrl) {
        console.error('[fetch-content] Usage: node fetch-content.js <post-url>');
        process.exit(1);
    }

    console.error(`[fetch-content] Fetching: ${postUrl}`);

    let html;
    try {
        html = await httpsGet(postUrl);
    } catch (err) {
        console.error(`[fetch-content] ERROR: Failed to fetch: ${err.message}`);
        process.exit(1);
    }

    const { title, excerpt } = extractContent(html, null);
    const emailBody = formatEmailBody(title, excerpt, postUrl);

    // Output just the email body to stdout
    console.log(emailBody);
}

main().catch(err => {
    console.error('[fetch-content] FATAL:', err.message);
    process.exit(1);
});
