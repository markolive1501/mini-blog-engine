# Coder Report — mini-blog-engine
**Round:** round 2
**Date:** 2026-03-20 21:12

## What Was Built
| Feature | Spec Ref | Implemented | Tested |
|---------|----------|-------------|--------|
| Markdown parsing with frontmatter validation, draft exclusion, and warnings | Feature 1 | ✅ | ✅ |
| Homepage / index page with newest-first listing and empty state | Feature 2 | ✅ | ✅ |
| Individual post pages with pretty URLs | Feature 3 | ✅ | ✅ |
| Tag pages with newest-first post listings | Feature 4 | ✅ | ✅ |
| RSS 2.0 feed with absolute URLs | Feature 5 | ✅ | ✅ |
| Static asset generation for CSS + JS | Feature 6 | ✅ | ✅ |
| Dark/light mode toggle with localStorage persistence | Feature 7 | ✅ | ✅ |
| Client-side homepage search by title and tags | Feature 8 | ✅ | ✅ |

## Deviations from Plan
- CSS and JS source files were authored in `src/assets/` and copied into `output/` during generation. This preserves the required generated output structure while keeping source assets editable.
- `config.json` was added to support the planner-approved runtime config values (`siteTitle`, `siteDescription`, `siteUrl`) used by templates and RSS.

## Test Results
- Total tests: 9
- Passed: 9
- Failed: 0
- Skipped: 0

## Issues Unable to Resolve
- None.

## Round 2 Fix
- Fixed the tag badge href generation in `src/templates/tag.njk` so tag page badges now link from the site root (`/tags/{tag}/`) instead of using a broken relative path.
- Regenerated the site with `node generate.js`.
- Verified on `/tags/writing/` that the `writing` badge resolves to `/tags/writing/` (not `/javascript/`).

## Open Items
- Blog metadata currently uses defaults from `config.json` (`Untitled Blog`, default description, `http://localhost:8080`). Marko can customise these without code changes.

## Ready for Reviewer: YES
