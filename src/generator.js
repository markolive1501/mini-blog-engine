const fs = require('node:fs');
const path = require('node:path');
const dayjs = require('dayjs');
const nunjucks = require('nunjucks');
const { loadPosts } = require('./utils/loadPosts');
const { buildTagIndex } = require('./utils/buildTagIndex');

const projectRoot = path.resolve(__dirname, '..');
const templateDir = path.join(__dirname, 'templates');
const contentDir = path.join(projectRoot, 'content', 'posts');
const outputDir = path.join(projectRoot, 'output');
const assetsDir = path.join(__dirname, 'assets');
const configPath = path.join(projectRoot, 'config.json');

const env = nunjucks.configure(templateDir, { autoescape: true, noCache: true });
env.addFilter('dump', (value) => JSON.stringify(value));
env.addFilter('lower', (value) => String(value).toLowerCase());

function readConfig(logger = console) {
  const defaults = {
    siteTitle: 'Untitled Blog',
    siteDescription: 'A tiny static blog generated from markdown.',
    tagline: 'Quiet essays, sharper notes, and a calmer corner of the web.',
    author: 'Anonymous',
    siteUrl: 'http://localhost:8080',
  };

  if (!fs.existsSync(configPath)) {
    logger.warn(`Config not found at ${configPath}; using defaults.`);
    return defaults;
  }

  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  return {
    siteTitle: config.siteTitle || defaults.siteTitle,
    siteDescription: config.siteDescription || defaults.siteDescription,
    tagline: config.tagline || defaults.tagline,
    siteUrl: config.siteUrl || defaults.siteUrl,
  };
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function writeFile(filePath, content) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, content, 'utf8');
}

function copyAsset(name, destination) {
  writeFile(destination, fs.readFileSync(path.join(assetsDir, name), 'utf8'));
}

function enrichPost(post, siteUrl) {
  const postUrl = `posts/${post.slug}/`;
  return {
    ...post,
    url: `./${postUrl}`,
    absoluteUrl: new URL(postUrl, `${siteUrl.replace(/\/$/, '')}/`).toString(),
    displayDate: dayjs(post.date).format('MMMM D, YYYY'),
    rssDate: dayjs(post.date).toDate().toUTCString(),
    searchTags: post.tags.join(' ').toLowerCase(),
    tags: post.tags.map((tag) => ({
      name: tag,
      url: `./tags/${tag}/`,
      postUrl: `../../tags/${tag}/`,
      tagUrlFromTagPage: `../${tag}/`,
    })),
  };
}

function renderBaseContext(config) {
  return {
    site: {
      title: config.siteTitle,
      description: config.siteDescription,
      tagline: config.tagline,
      author: config.author,
      url: config.siteUrl,
    },
    generatedAtDisplay: dayjs().format('YYYY-MM-DD HH:mm'),
  };
}

async function generateSite(logger = console) {
  const config = readConfig(logger);
  fs.rmSync(outputDir, { recursive: true, force: true });
  ensureDir(outputDir);

  const posts = loadPosts(contentDir, logger).map((post) => enrichPost(post, config.siteUrl));
  const tagIndex = buildTagIndex(posts);
  const baseContext = renderBaseContext(config);

  copyAsset('style.css', path.join(outputDir, 'css', 'style.css'));
  copyAsset('main.js', path.join(outputDir, 'js', 'main.js'));

  writeFile(path.join(outputDir, 'index.html'), env.render('index.njk', {
    ...baseContext,
    pageTitle: 'Home',
    homeUrl: './index.html',
    assetPrefix: './',
    posts,
    searchIndex: posts.map((post) => ({ title: post.title, tags: post.tags.map((tag) => tag.name), url: post.url })),
  }));

  for (const post of posts) {
    writeFile(path.join(outputDir, 'posts', post.slug, 'index.html'), env.render('post.njk', {
      ...baseContext,
      pageTitle: post.title,
      homeUrl: '../../index.html',
      assetPrefix: '../../',
      post: {
        ...post,
        tags: post.tags.map((tag) => ({ name: tag.name, url: `../../tags/${tag.name}/` })),
      },
    }));
  }

  for (const { tag, posts: tagPosts } of tagIndex) {
    writeFile(path.join(outputDir, 'tags', tag, 'index.html'), env.render('tag.njk', {
      ...baseContext,
      pageTitle: `Tag: ${tag}`,
      homeUrl: '../../index.html',
      assetPrefix: '../../',
      tag: { name: tag },
      posts: tagPosts.map((post) => ({
        ...post,
        url: `../../posts/${post.slug}/`,
        tags: post.tags.map((item) => ({ name: item.name, url: `../${item.name}/` })),
      })),
    }));
  }

  writeFile(path.join(outputDir, 'feed.xml'), env.render('feed.njk', {
    site: {
      title: config.siteTitle,
      description: config.siteDescription,
      url: config.siteUrl,
    },
    posts,
  }));

  const knowledgePosts = posts.filter((p) => p.tags.some((t) => t.name === 'knowledge'));
  writeFile(path.join(outputDir, 'knowledge', 'index.html'), env.render('knowledge.njk', {
    ...baseContext,
    pageTitle: 'Knowledge',
    homeUrl: '../index.html',
    assetPrefix: '../',
    posts: knowledgePosts,
  }));

  logger.log(`Generated site with ${posts.length} published post(s).`);
  return { posts, tagIndex };
}

function watchSite(logger = console) {
  logger.log('Watching for changes...');
  fs.watch(projectRoot, { recursive: true }, async (_eventType, filename) => {
    if (!filename || filename.startsWith('output')) {
      return;
    }

    try {
      await generateSite(logger);
    } catch (error) {
      logger.error(error.message);
    }
  });
}

module.exports = { generateSite, watchSite };
module.exports = { generateSite, watchSite };
