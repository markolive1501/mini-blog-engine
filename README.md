# Mini Blog Engine

A clean static blog generator — turn a folder of markdown files into a hosted blog in seconds.

## Features
- Markdown + YAML frontmatter parsing
- Auto-generated homepage, post pages, tag pages, RSS feed
- Dark/light mode toggle
- Client-side search
- Draft support
- Pretty URLs
- Zero database — pure static HTML

## Setup
```bash
npm install
```

## Create a post
Add a `.md` file to `content/posts/`:
```markdown
---
title: My First Post
date: 2026-03-20
tags: [writing, tech]
---
Your content here...
```

## Generate the site
```bash
node generate.js
```

Then open `docs/index.html` in your browser, or deploy the `docs/` folder to any static host.

## Configure
Edit `config.json` to set your site name, description, and URL.

## Deploy to GitHub Pages
1. Push to a GitHub repo
2. Enable Pages from the `docs/` folder on branch `master`
3. Your blog is live
