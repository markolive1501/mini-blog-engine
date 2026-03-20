const fs = require('node:fs');
const path = require('node:path');
const dayjs = require('dayjs');
const { parsePost } = require('./parsePost');

function loadPosts(contentDir, logger = console) {
  const absoluteDir = path.resolve(contentDir);
  if (!fs.existsSync(absoluteDir)) {
    return [];
  }

  const posts = fs.readdirSync(absoluteDir)
    .filter((entry) => entry.endsWith('.md'))
    .map((entry) => parsePost(path.join(absoluteDir, entry), logger))
    .filter(Boolean)
    .filter((post) => !post.draft)
    .sort((a, b) => dayjs(b.date).valueOf() - dayjs(a.date).valueOf());

  const seen = new Map();
  for (const post of posts) {
    if (seen.has(post.slug)) {
      throw new Error(`Slug conflict detected for "${post.slug}": ${seen.get(post.slug)} and ${post.title}`);
    }
    seen.set(post.slug, post.title);
  }

  return posts;
}

module.exports = { loadPosts };
