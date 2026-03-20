# PLAN.md — Mini Blog Engine

**Project:** mini-blog-engine  
**Date:** 2026-03-20

---

## Build Order

Static site generators are inherently linear — templates need to exist before content can be rendered into them. The build order reflects this dependency chain.

### Phase 1: Project Scaffold
**Goal:** Clean project structure with package.json, config, and directory skeleton.

| # | Task | Spec Ref | Status |
|---|------|----------|--------|
| 1 | Initialize `package.json` with all dependencies | Stack | ⬜ |
| 2 | Create directory structure (`src/`, `content/posts/`, `output/`) | File Structure | ⬜ |
| 3 | Add sample markdown posts with frontmatter for testing | (test fixtures) | ⬜ |

**Why first:** All downstream work depends on the project running. Without dependencies and directory structure, nothing else can be validated.

---

### Phase 2: Core Parsing Engine
**Goal:** Read markdown files, extract frontmatter, produce clean data objects.

| # | Task | Spec Ref | Status |
|---|------|----------|--------|
| 1 | Write `src/utils/slugify.js` — title-to-slug conversion | Feature 3 | ⬜ |
| 2 | Write `src/utils/parsePost.js` — frontmatter + markdown parsing | Feature 1 | ⬜ |
| 3 | Write `src/utils/loadPosts.js` — scan content folder, return sorted post array | Feature 1 | ⬜ |
| 4 | Write `src/utils/buildTagIndex.js` — map tag → post slugs | Feature 4 | ⬜ |
| 5 | Add test: parse valid, missing-title, and draft posts | Feature 1 | ⬜ |

**Why second:** All rendering depends on clean post data. Getting parsing right first means template work can proceed with real data shapes.

---

### Phase 3: Templates
**Goal:** Nunjucks templates for all page types.

| # | Task | Spec Ref | Status |
|---|------|----------|--------|
| 1 | Write `src/templates/base.njk` — `<head>`, nav, footer, CSS/JS links | Feature 6 | ⬜ |
| 2 | Write `src/templates/index.njk` — homepage post list with search markup | Features 2, 8 | ⬜ |
| 3 | Write `src/templates/post.njk` — individual post layout | Feature 3 | ⬜ |
| 4 | Write `src/templates/tag.njk` — tag listing page | Feature 4 | ⬜ |
| 5 | Write `src/templates/feed.njk` — RSS 2.0 XML template | Feature 5 | ⬜ |
| 6 | Write `output/css/style.css` — minimal, readable, responsive with CSS variables for theming | Features 6, 7 | ⬜ |
| 7 | Write `output/js/main.js` — theme toggle + client-side search | Features 7, 8 | ⬜ |

**Why third:** Templates are the primary output artefact. They must exist before the generator script can use them.

---

### Phase 4: Generator Script
**Goal:** `generate.js` CLI that ties parsing + templates → complete static site.

| # | Task | Spec Ref | Status |
|---|------|----------|--------|
| 1 | Write `src/generator.js` — clear output dir, load posts, generate all pages | Features 2–6 | ⬜ |
| 2 | Wire up `generate.js` CLI entry point | (integration) | ⬜ |
| 3 | Add generation of `output/css/style.css` and `output/js/main.js` | Feature 6 | ⬜ |
| 4 | Verify clean build: empty output, run generate, inspect all expected files present | All features | ⬜ |

**Why fourth:** The generator is the main deliverable. By this point all components exist and can be unit-tested in isolation.

---

### Phase 5: RSS Feed
**Goal:** Valid RSS 2.0 feed for all published posts.

| # | Task | Spec Ref | Status |
|---|------|----------|--------|
| 1 | Configure absolute post URLs for RSS (base URL configurable) | Feature 5 | ⬜ |
| 2 | Render feed via `feed.njk` template | Feature 5 | ⬜ |
| 3 | Validate generated `feed.xml` is well-formed XML | Feature 5 | ⬜ |

**Why fifth:** RSS depends on post data and templates (done in Phases 2–3). Low risk, straightforward generation.

---

### Phase 6: Theme Toggle + Search
**Goal:** Client-side interactivity in output JS.

| # | Task | Spec Ref | Status |
|---|------|----------|--------|
| 1 | Implement dark/light mode toggle with `localStorage` persistence | Feature 7 | ⬜ |
| 2 | Implement client-side post filtering by title/tag | Feature 8 | ⬜ |
| 3 | Verify both features work from `file://` protocol | Features 7, 8 | ⬜ |

**Why sixth:** These are pure client-side features — they require the generated HTML/CSS/JS to be complete first. Order matters: static HTML must be done before JS tries to query it.

---

### Phase 7: Edge Cases + Polish
**Goal:** Handle all stated edge cases and validate against spec.

| # | Task | Spec Ref | Status |
|---|------|----------|--------|
| 1 | Empty content directory — index shows empty state | Feature 2 | ⬜ |
| 2 | Posts with no tags — no broken tag links | Feature 4 | ⬜ |
| 3 | Verify draft posts are absent from index, tag pages, and RSS | Feature 1 | ⬜ |
| 4 | Verify pretty URLs work (no `.html` in internal links) | Feature 3 | ⬜ |
| 5 | Add `package.json` scripts: `generate`, `dev` (watch + regenerate) | (DX) | ⬜ |

**Why last:** This is the validation pass. Everything should work in combination by now.

---

## Phase Summary

| Phase | Name | Key Deliverable |
|-------|------|----------------|
| 1 | Scaffold | `package.json`, directories, sample posts |
| 2 | Parsing | `loadPosts()`, `parsePost()`, `slugify()`, tag index |
| 3 | Templates | All 5 `.njk` templates, CSS, JS scaffold |
| 4 | Generator | `generate.js` producing full `output/` |
| 5 | RSS | `feed.xml` validated |
| 6 | Interactivity | Theme toggle + search working |
| 7 | Polish | Edge cases, clean build verification |

---

## Implementation Notes

- **Base URL for RSS:** The generator reads a `siteUrl` from `config.json` at the project root. If absent, RSS links fall back to relative paths (still valid for self-hosted use).
- **Slug uniqueness:** If two posts produce the same slug, the generator throws an error listing the conflicting titles — no silent overwriting.
- **CSS architecture:** Single `style.css` using `:root` variables for light theme and `html.dark` overrides for dark theme. No separate dark stylesheet needed.
- **Search:** `main.js` maintains an in-memory array of `{title, tags, url}` for all posts, populated from a `window.__POSTS__` JSON variable injected by the index template. No file reads needed.
