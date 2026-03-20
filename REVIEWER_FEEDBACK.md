# Reviewer Feedback — Round 1 (Post-Approval Browser Test)

**Date:** 2026-03-20  
**Trigger:** Orbit browser verification (manual)  
**Verdict:** REVISION REQUIRED

## Bug Found — Post-Approval

### Tag Badge Path Bug on Tag Pages
**Severity:** Medium  
**Spec ref:** Feature 4, Tag Pages, Criterion 4

**What was expected:**  
Tag badges on tag page post listings should link to the correct tag URL. E.g. from `/tags/writing/`, clicking a "writing" badge should navigate to `/tags/writing/`.

**What was found:**  
Tag badges on tag pages resolve to wrong paths. The "writing" badge on `/tags/writing/` links to `../writing/` which resolves to `/javascript/` (the previous segment). This is because relative paths from the tag page context are incorrect.

**What must be fixed:**  
Tag badge URLs on tag pages must use paths rooted from site base, not relative paths. Either:
- Use absolute paths like `/tags/{tag}/` from site root
- Or use `./{tag}/` which resolves correctly from `/tags/{tag}/`

---

## Feedback Summary
- Total issues found: 1
- Passing criteria from Round 1 approval: 26/27 (tag badge URL criterion failed)

## What the Coder Must Do Before Round 2
1. Fix tag badge href generation in the tag page template (`src/templates/tag.njk`)
2. Verify the fix by regenerating and checking `/tags/writing/` in browser
3. Confirm all other tag pages work correctly after the fix
