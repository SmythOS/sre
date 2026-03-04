---
description: Run a code review of changes on the current branch against origin/dev
disable-model-invocation: true
---

<!-- Why this exists instead of built-in /review:
  1. Pre-PR workflow — diffs against origin/dev before pushing, not PR-based.
  2. Project-specific setup steps (test commands, audit, ignore lists).
  3. Enforces project-specific CLAUDE.md rules with custom confidence thresholds. -->

Run a code review of changes on the current branch against origin/dev.

## Setup

1. Run: `git fetch origin dev && git diff $(git merge-base HEAD origin/dev) HEAD`

## Review Against CLAUDE.md Rules

Analyze the diff following **all** Code Review Rules defined in CLAUDE.md:
- Prettier formatting (4 spaces, single quotes, 150 char width)
- File suffix and declaration naming conventions
- Utils purity (no imports outside `/utils`)
- Test coverage for bug fixes and new features
- Strict typing (no unnecessary `any`)
- No unnecessary new dependencies
- DCO sign-off on commits (`git commit -s`)

Only report findings with confidence above 60%.

## Output Format

For each issue found, report:
- **Severity**: Critical / High / Medium / Low
- **File**: path and line number
- **Rule**: which rule or checklist item was violated
- **Issue**: what's wrong
- **Fix**: how to remediate

## Summary

End with:
1. Total issues by severity
2. Overall verdict: **Approve** or **Request Changes**
3. If Request Changes, list the blocking issues that must be fixed
