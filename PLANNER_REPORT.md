# Planner Report — Mini Blog Engine

**Round:** initial  
**Date:** 2026-03-20

---

## Decisions Made

### Stack: Node.js + markdown-it + Nunjucks
**Why:** `markdown-it` is the most widely-used markdown parser for Node with excellent frontmatter plugin support. `Nunjucks` is a battle-tested Python-inspired templating engine available via npm, and its `extends`/`block` system makes base layout inheritance clean. `marked` was considered but `markdown-it` has better plugin ecosystem for frontmatter. Python was considered per the request's flexibility clause, but Node's npm ecosystem and `nunjucks` availability make it equally capable for markdown parsing while sharing the same language as the runtime.

### Slug generation is automatic, not configurable
**Why:** The spec explicitly says "pretty URLs (e.g. `/posts/my-post-title/`)" and "slug generation is automatic." Adding configurable permalinks would be gold-plating. The automatic slugify function is deterministic and collision-checked.

### RSS requires a `siteUrl` in `config.json`
**Why:** RSS requires absolute URLs in `<link>` elements. Without a configured base URL, the feed would contain relative URLs which are invalid in RSS. The fallback (relative paths) is acceptable for development but the generator will warn if `siteUrl` is missing when generating the feed.

### `html.dark` class for dark mode
**Why:** Adding `.dark` class to `<html>` (rather than `<body>`) is the modern standard and avoids flash-of-unstyled-content issues. CSS custom properties (variables) on `:root` are overridden under `html.dark`, meaning a single stylesheet handles both themes with no duplicate rules.

### Draft posts are excluded everywhere
**Why:** "Posts marked draft don't appear in output" is stated under Nice to Have. The spec treats this as a must-have because silently including drafts in any output stream (index, RSS, tags) would be harmful. The behaviour is gated by a single `draft: true` frontmatter flag.

### Client-side search uses `window.__POSTS__`
**Why:** To keep search purely client-side with no network requests, the index template injects a JSON array of `{title, tags, url}` into the page. This is generated once at build time and is trivial to implement with Nunjucks. No `main.js` file-reads are needed.

---

## Open Questions

- **Site title / blog name:** The REQUEST.md never specifies what the blog should be called (used in `<title>`, RSS feed header, and nav). **Who must answer:** Marko.
- **Blog description / tagline:** For RSS `<description>` and meta description. **Who must answer:** Marko.
- **Author name:** For RSS `<author>` element per post. **Who must answer:** Marko.
- **Default `siteUrl`:** For absolute RSS links. Defaults to `http://localhost:8080` if not set, but Marko should configure this for real deployment. **Who must answer:** Marko.
- **Logo / favicon:** No mention in request. Out of scope for v1, but noted.

---

## Clarifications Needed Before Coder Starts

1. **Blog name / site title** — used in nav, index page `<title>`, RSS feed `<title>`. Please provide a name or say "untitled blog" and I will use that.
2. **Blog description** — used in RSS `<description>` and meta tags.
3. **`siteUrl` for RSS** — the base URL for absolute links in the RSS feed (e.g. `https://myblog.com`). If not provided, the generator will warn and use `http://localhost:8080` as a fallback.

> **Note to Coder:** The spec is otherwise complete. The three items above are runtime config values that the generator should read from `config.json`. If not provided, the Coder should use sensible defaults and let the generator warn. The build can proceed without them.

---

## Spec Quality Checklist

- [x] Every feature has ≥2 acceptance criteria — **8 features, 27 criteria total**
- [x] Every criterion is objectively verifiable (no "works", no "functional" without specifics)
- [x] Every feature has a test strategy
- [x] No feature says "works" or "functional" without specifics
- [x] Out-of-scope items are explicitly listed (server, CMS, analytics, pagination, multi-author, image pipeline, incremental builds, custom permalinks)
- [x] Stack is specified (Node.js, markdown-it, Nunjucks, dayjs)
- [x] File structure is specified
- [x] Build order is justified (linear dependency of templates on content, generator on templates)

---

## Ready for Coder: YES

The spec is complete and unambiguous for all features. The three open questions (blog name, description, siteUrl) are non-blocking — the Coder can proceed with placeholder/default values and emit warnings. All acceptance criteria are specific and verifiable. The build order in PLAN.md reflects true dependencies and is ready to execute.
