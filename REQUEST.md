# Request — Mini Blog Engine

**Submitted:** 2026-03-20  
**Submitted by:** Marko

## What I Want
A static site generator that takes a folder of markdown files and outputs a clean, runnable HTML blog.

## Core Features
- Reads `.md` files from a designated input folder
- Generates a full HTML blog: index page, individual post pages, tags pages, RSS feed
- Clean, minimal design — readable, professional
- Each post has: title, date, tags, content
- Index page lists all posts, newest first
- Tag pages group posts by tag
- RSS feed for all posts
- Pretty URLs (e.g. `/posts/my-post-title/`)

## Output
- A static `output/` folder containing `index.html`, `posts/`, `tags/`, and `feed.xml`
- Can be opened directly in a browser or hosted on any static host
- No server required — pure HTML/CSS/JS

## Suggested Stack
- Node.js (or Python — your choice based on what makes most sense for markdown parsing)
- Use a proper markdown parser (e.g. `marked`, `remark`, or `markdown-it`)
- Handle frontmatter (title, date, tags) from each `.md` file

## Nice to Have
- Dark/light mode toggle
- Search (client-side)
- Post draft system (posts marked draft don't appear in output)

## Personal Preference
- Clean, minimal aesthetic — not flashy
- Easy to customise the template later
