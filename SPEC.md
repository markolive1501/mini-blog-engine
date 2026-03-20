# SPEC.md — Mini Blog Engine

**Project:** mini-blog-engine  
**Version:** 1.0  
**Date:** 2026-03-20

---

## Overview

A static site generator that reads a folder of markdown files and outputs a complete, self-contained HTML blog with index, post pages, tag pages, and RSS feed. No server required.

---

## Stack

- **Runtime:** Node.js
- **Markdown parser:** `markdown-it` (with `markdown-it-front-matter` for frontmatter)
- **Date handling:** `dayjs` (lightweight)
- **Output:** Pure static HTML/CSS/JS — no runtime dependencies in browser
- **CLI:** `node generate.js` from project root

---

## File Structure

```
mini-blog-engine/
├── generate.js          # Main entry point / CLI
├── src/
│   ├── generator.js     # Core site generation logic
│   └── templates/
│       ├── base.njk     # Base HTML wrapper (head, nav, footer)
│       ├── index.njk    # Homepage template
│       ├── post.njk     # Individual post template
│       ├── tag.njk      # Tag listing page template
│       └── feed.njk     # RSS feed template
├── content/
│   └── posts/           # Input: .md files with frontmatter
├── output/              # Output: generated static site
│   ├── index.html
│   ├── posts/
│   │   └── {slug}/
│   │       └── index.html
│   ├── tags/
│   │   └── {tag}/
│   │       └── index.html
│   ├── feed.xml
│   ├── css/
│   │   └── style.css
│   └── js/
│       └── main.js
└── package.json
```

---

## Features

### Feature 1: Markdown Parsing with Frontmatter

**Description:** Each `.md` file in `content/posts/` is parsed for YAML frontmatter (title, date, tags) and markdown body content.

**Frontmatter schema:**
```yaml
---
title: "Post Title"
date: 2026-03-20
tags: [javascript, web]
---
## Markdown body here
```

**Acceptance Criteria:**
- [ ] A valid `.md` file with frontmatter produces a parsed object with `title` (string), `date` (YYYY-MM-DD string), `tags` (string array), and `body` (markdown string)
- [ ] A `.md` file missing `title` frontmatter logs a warning and is skipped
- [ ] A `.md` file with `draft: true` in frontmatter is excluded from all output (index, tags, RSS)
- [ ] A `.md` file with invalid frontmatter throws a descriptive error identifying the file

**Test Strategy:** Run generator with sample posts including valid, missing-title, and draft-marked files; inspect parsed output.

---

### Feature 2: Homepage / Index Page

**Description:** Generates `output/index.html` listing all published posts, newest first, with title, date, and tag badges.

**Acceptance Criteria:**
- [ ] `output/index.html` exists after a clean generation run
- [ ] Posts appear in descending date order (newest first)
- [ ] Each post entry shows: title (as link to post URL), date (human-readable), and tag badges
- [ ] Draft posts do not appear on the index
- [ ] If zero posts exist, index shows a friendly empty state message

**Test Strategy:** Generate site with 3+ posts of varying dates; verify order in `output/index.html`.

---

### Feature 3: Individual Post Pages (Pretty URLs)

**Description:** Each published post generates a static HTML page at `output/posts/{slug}/index.html`.

**Slug generation:**
- Convert title to lowercase
- Replace spaces with hyphens
- Remove non-alphanumeric characters except hyphens
- Strip leading/trailing hyphens

**Acceptance Criteria:**
- [ ] Post with title "Hello World" generates file at `output/posts/hello-world/index.html`
- [ ] Post page renders: title (as `<h1>`), formatted date, tag badges (linking to tag pages), and full markdown body converted to HTML
- [ ] Post page includes a back-link to the homepage
- [ ] Navigation bar is present on post page
- [ ] Post pages linked from the index page resolve correctly

**Test Strategy:** Generate with known post titles; verify file path and content of rendered HTML.

---

### Feature 4: Tag Pages

**Description:** Each unique tag generates a static HTML page at `output/tags/{tag}/index.html` listing all posts with that tag.

**Acceptance Criteria:**
- [ ] Tag "javascript" generates `output/tags/javascript/index.html`
- [ ] Tag pages list all posts (newest first) containing that tag
- [ ] Each entry shows: title (link), date, and other tags
- [ ] Tag pages are linked from tag badges on posts and on the homepage (if applicable)
- [ ] Tag page shows the tag name as `<h1>` (e.g., "Posts tagged: javascript")
- [ ] Empty tag (no posts) produces no tag page

**Test Strategy:** Generate with posts having overlapping tags; verify each tag page lists the correct posts.

---

### Feature 5: RSS Feed

**Description:** Generates a valid RSS 2.0 feed at `output/feed.xml` containing all published posts.

**Acceptance Criteria:**
- [ ] `output/feed.xml` is a valid RSS 2.0 XML document (validates against RSS spec)
- [ ] Feed includes all published posts (not drafts), newest first
- [ ] Each item has: `<title>`, `<link>` (absolute URL), `<pubDate>`, `<guid>` (post URL slug), and `<description>` (post excerpt or full content)
- [ ] Feed header has `<title>` (blog title), `<link>`, and `<description>`
- [ ] Post URLs in feed are absolute (not relative)

**Test Strategy:** Generate feed and validate XML structure; verify draft posts are absent.

---

### Feature 6: Static Assets (CSS + JS)

**Description:** Copies or embeds CSS and JS into the output, ensuring the site is fully self-contained.

**Acceptance Criteria:**
- [ ] `output/css/style.css` exists and is linked from all HTML pages
- [ ] `output/js/main.js` exists and is linked from all HTML pages
- [ ] All generated pages include the navigation bar
- [ ] All generated pages include a footer with generation timestamp

**Test Strategy:** Inspect generated HTML pages for `<link>` and `<script>` tags pointing to correct paths.

---

### Feature 7: Dark/Light Mode Toggle

**Description:** The site supports toggling between light and dark themes, with preference persisted to `localStorage`.

**Acceptance Criteria:**
- [ ] A theme toggle button/chevron appears in the navigation bar
- [ ] Clicking the toggle switches between light and dark theme
- [ ] Theme preference is saved to `localStorage` and restored on page reload
- [ ] CSS uses CSS custom properties (variables) for all theme colours, requiring only a `.dark` class on `<html>` or `<body>`
- [ ] Default theme is light if no preference is stored

**Test Strategy:** Toggle theme, reload page, verify theme persists. Inspect CSS variables for both themes.

---

### Feature 8: Client-Side Search

**Description:** A search input on the homepage filters the post list in real-time as the user types, with no server required.

**Acceptance Criteria:**
- [ ] A search input field is visible on the homepage
- [ ] Typing in the search box filters the displayed post list to those whose title or tags contain the search string (case-insensitive)
- [ ] Clearing the search box restores the full post list
- [ ] If no posts match, a "No posts found" message is displayed
- [ ] Search is entirely client-side (no network requests)

**Test Strategy:** Type partial titles and tag names; verify filtering works correctly; clear and verify restoration.

---

## Out of Scope

- Server-side rendering or dynamic routing
- Comment systems
- Analytics
- CMS or admin interface
- Image processing or asset pipeline
- Multi-author support
- Pagination (all posts listed on index)
- Custom permalink configuration (slug generation is automatic)
- Incremental builds (full rebuild every run)

---

## Constraints

- Output must work when opened directly from the filesystem (`file://`) in a modern browser
- No external CDN dependencies in output HTML (all assets are local)
- Generated HTML must not require any build-time or runtime server
- All HTML generated with a static template engine (Nunjucks via `nunjucks` npm package)
