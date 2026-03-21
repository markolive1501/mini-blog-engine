const fs = require('node:fs');
const path = require('node:path');
const dayjs = require('dayjs');
const yaml = require('yaml');
const MarkdownIt = require('markdown-it');
const frontMatter = require('markdown-it-front-matter');
const { slugify } = require('./slugify');

const md = new MarkdownIt({ html: false, linkify: true, typographer: true });

function parseFrontmatter(raw, filePath) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) {
    throw new Error(`Invalid frontmatter in ${filePath}: missing YAML frontmatter block`);
  }

  try {
    return {
      data: yaml.parse(match[1]) || {},
      body: raw.slice(match[0].length),
    };
  } catch (error) {
    throw new Error(`Invalid frontmatter in ${filePath}: ${error.message}`);
  }
}

function parsePost(filePath, logger = console) {
  const absolutePath = path.resolve(filePath);
  const raw = fs.readFileSync(absolutePath, 'utf8');
  const { data, body } = parseFrontmatter(raw, absolutePath);

  let frontMatterContent = null;
  const probe = new MarkdownIt();
  probe.use(frontMatter, (content) => {
    frontMatterContent = content;
  });
  probe.render(raw);

  if (frontMatterContent === null) {
    throw new Error(`Invalid frontmatter in ${absolutePath}: unable to parse frontmatter`);
  }

  if (!data || typeof data !== 'object') {
    throw new Error(`Invalid frontmatter in ${absolutePath}: frontmatter must be an object`);
  }

  if (!data.title || typeof data.title !== 'string') {
    logger.warn(`Skipping ${absolutePath}: missing required frontmatter field "title"`);
    return null;
  }

  if (!data.date) {
    throw new Error(`Invalid frontmatter in ${absolutePath}: missing required field "date"`);
  }

  const parsedDate = dayjs(String(data.date));
  if (!parsedDate.isValid()) {
    throw new Error(`Invalid frontmatter in ${absolutePath}: invalid date "${data.date}"`);
  }

  const tags = Array.isArray(data.tags)
    ? data.tags.map((tag) => String(tag).trim()).filter(Boolean)
    : [];

  const slug = slugify(data.title);
  if (!slug) {
    throw new Error(`Invalid frontmatter in ${absolutePath}: title produced an empty slug`);
  }

  // Build a clean text excerpt for cards
  const rawExcerpt = data.description
    ? String(data.description).trim()
    : body
        .replace(/#{1,6}\s/g, '')        // strip headings
        .replace(/\*\*(.*?)\*\*/g, '$1') // strip bold
        .replace(/\*(.*?)\*/g, '$1')     // strip italic
        .replace(/\[(.*?)\]\(.*?\)/g, '$1') // strip links
        .replace(/`{1,3}[^`]*`{1,3}/g, '') // strip code
        .replace(/^>\s/gm, '')           // strip blockquotes
        .replace(/[#>*_`\-\[\]()] /g, ' ')
        .replace(/\s{2,}/g, ' ')
        .trim()
        .slice(0, 200);

  // Reading time: ~200 words per minute
  const wordCount = body.split(/\s+/).filter(Boolean).length;
  const readingTime = Math.max(1, Math.ceil(wordCount / 200));

  return {
    sourcePath: absolutePath,
    title: data.title,
    date: parsedDate.format('YYYY-MM-DD'),
    tags,
    body,
    html: md.render(body),
    sourceUrl: data.sourceUrl || null,
    draft: data.draft === true,
    slug,
    excerpt: rawExcerpt,
    readingTime,
  };
}

module.exports = { parsePost };
