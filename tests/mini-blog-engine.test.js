const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { parsePost } = require('../src/utils/parsePost');
const { loadPosts } = require('../src/utils/loadPosts');
const { buildTagIndex } = require('../src/utils/buildTagIndex');
const { slugify } = require('../src/utils/slugify');
const { generateSite } = require('../src/generator');

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'mini-blog-engine-'));
}

function writeFile(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}

test('slugify creates pretty slugs', () => {
  assert.equal(slugify('Hello World!!!'), 'hello-world');
  assert.equal(slugify('  JavaScript & Web  '), 'javascript-web');
});

test('parsePost returns structured post data for valid markdown', () => {
  const dir = makeTempDir();
  const filePath = path.join(dir, 'valid.md');
  writeFile(filePath, `---\ntitle: "Post Title"\ndate: 2026-03-20\ntags: [javascript, web]\n---\n## Markdown body here\n`);

  const post = parsePost(filePath, console);
  assert.equal(post.title, 'Post Title');
  assert.equal(post.date, '2026-03-20');
  assert.deepEqual(post.tags, ['javascript', 'web']);
  assert.match(post.body, /Markdown body here/);
  assert.match(post.html, /<h2>Markdown body here<\/h2>/);
});

test('parsePost warns and skips when title is missing', () => {
  const dir = makeTempDir();
  const filePath = path.join(dir, 'missing-title.md');
  writeFile(filePath, `---\ndate: 2026-03-20\ntags: [web]\n---\nBody\n`);

  const warnings = [];
  const post = parsePost(filePath, { warn: (message) => warnings.push(message) });

  assert.equal(post, null);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /missing required frontmatter field "title"/);
});

test('parsePost keeps draft posts marked for exclusion', () => {
  const dir = makeTempDir();
  const filePath = path.join(dir, 'draft.md');
  writeFile(filePath, `---\ntitle: "Draft"\ndate: 2026-03-20\ntags: [internal]\ndraft: true\n---\nBody\n`);

  const post = parsePost(filePath, console);
  assert.equal(post.draft, true);
});

test('parsePost throws descriptive error for invalid frontmatter', () => {
  const dir = makeTempDir();
  const filePath = path.join(dir, 'broken.md');
  writeFile(filePath, `---\ntitle: [oops\ndate: 2026-03-20\n---\nBody\n`);

  assert.throws(() => parsePost(filePath, console), /Invalid frontmatter .*broken\.md/);
});

test('loadPosts filters drafts, sorts newest first, and detects slug conflicts', () => {
  const dir = makeTempDir();
  writeFile(path.join(dir, 'one.md'), `---\ntitle: "Hello World"\ndate: 2026-03-18\ntags: [web]\n---\nOne\n`);
  writeFile(path.join(dir, 'two.md'), `---\ntitle: "Second Post"\ndate: 2026-03-20\ntags: [javascript]\n---\nTwo\n`);
  writeFile(path.join(dir, 'draft.md'), `---\ntitle: "Draft"\ndate: 2026-03-19\ntags: [hidden]\ndraft: true\n---\nHidden\n`);

  const posts = loadPosts(dir, console);
  assert.deepEqual(posts.map((post) => post.title), ['Second Post', 'Hello World']);

  writeFile(path.join(dir, 'dupe.md'), `---\ntitle: "Hello World"\ndate: 2026-03-21\ntags: [web]\n---\nThree\n`);
  assert.throws(() => loadPosts(dir, console), /Slug conflict detected/);
});

test('buildTagIndex groups posts by tag', () => {
  const posts = [
    { title: 'A', tags: ['javascript', 'web'] },
    { title: 'B', tags: ['web'] },
  ];

  const tagIndex = buildTagIndex(posts);
  assert.deepEqual(tagIndex.map((entry) => entry.tag), ['javascript', 'web']);
  assert.deepEqual(tagIndex[1].posts.map((post) => post.title), ['A', 'B']);
});

test('generateSite creates index, posts, tags, feed, and static assets', async () => {
  await generateSite(console);

  const root = path.resolve(__dirname, '..');
  const indexHtml = fs.readFileSync(path.join(root, 'output', 'index.html'), 'utf8');
  const postHtml = fs.readFileSync(path.join(root, 'output', 'posts', 'hello-world', 'index.html'), 'utf8');
  const tagHtml = fs.readFileSync(path.join(root, 'output', 'tags', 'javascript', 'index.html'), 'utf8');
  const feedXml = fs.readFileSync(path.join(root, 'output', 'feed.xml'), 'utf8');
  const css = fs.readFileSync(path.join(root, 'output', 'css', 'style.css'), 'utf8');
  const js = fs.readFileSync(path.join(root, 'output', 'js', 'main.js'), 'utf8');

  assert.match(indexHtml, /Hello World[\s\S]*Writing Tools/s);
  assert.doesNotMatch(indexHtml, /Draft Note/);
  assert.match(indexHtml, /id="search-input"/);
  assert.match(indexHtml, /window\.__POSTS__/);
  assert.match(indexHtml, /href="\.\/posts\/hello-world\/"/);
  assert.match(indexHtml, /href="\.\/tags\/javascript\/"/);
  assert.match(indexHtml, /data-tags="javascript web"/);

  assert.match(postHtml, /<h1>Hello World<\/h1>/);
  assert.match(postHtml, /Back to home/);
  assert.match(postHtml, /href="\.\.\/\.\.\/tags\/javascript\/"/);
  assert.match(postHtml, /<nav class="nav">/);
  assert.match(postHtml, /<h2>Welcome<\/h2>/);

  assert.match(tagHtml, /<h1>Posts tagged: javascript<\/h1>/);
  assert.match(tagHtml, /Hello World/);
  assert.match(tagHtml, /href="\.\.\/\.\.\/posts\/hello-world\/"/);

  assert.match(feedXml, /<rss version="2.0">/);
  assert.match(feedXml, /<title>Untitled Blog<\/title>/);
  assert.match(feedXml, /<link>http:\/\/localhost:8080\/posts\/hello-world\/<\/link>/);
  assert.match(feedXml, /<!\[CDATA\[<h2>Welcome<\/h2>/);
  assert.doesNotMatch(feedXml, /Draft Note/);

  assert.match(css, /:root/);
  assert.match(css, /html\.dark/);
  assert.match(js, /localStorage/);
  assert.match(js, /no-posts-found/);
});

test('generateSite shows empty state when zero posts exist', async () => {
  const root = path.resolve(__dirname, '..');
  const postsDir = path.join(root, 'content', 'posts');
  const backupDir = path.join(root, 'content', 'posts-backup-test');
  fs.renameSync(postsDir, backupDir);
  fs.mkdirSync(postsDir, { recursive: true });

  try {
    await generateSite(console);
    const indexHtml = fs.readFileSync(path.join(root, 'output', 'index.html'), 'utf8');
    assert.match(indexHtml, /No posts yet — add some markdown files to get started\./);
    assert.ok(!fs.existsSync(path.join(root, 'output', 'tags', 'javascript', 'index.html')));
  } finally {
    fs.rmSync(postsDir, { recursive: true, force: true });
    fs.renameSync(backupDir, postsDir);
    await generateSite(console);
  }
});
