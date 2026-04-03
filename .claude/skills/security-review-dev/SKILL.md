---
description: Run a security-focused review of changes on the current branch against origin/dev
disable-model-invocation: true
---

<!-- Why this exists instead of built-in /security-review:
  1. Pre-PR workflow — diffs against origin/dev before pushing, not PR-based.
  2. Zero confidence filtering — reports ALL findings (built-in filters at 80%).
  3. Broader coverage — includes ReDoS, prototype pollution, and project-specific
     checks (e.g. Vault subsystem bypasses) that the built-in excludes.
  4. Runs pnpm/npm audit as an explicit step. -->

Run a security-focused review of changes on the current branch against origin/dev.

## Setup

1. Run: `git fetch origin dev && git diff $(git merge-base HEAD origin/dev) HEAD`
2. Run: `pnpm audit --audit-level=moderate` to check for known vulnerabilities in dependencies.

## Security Checks

Analyze ONLY for security issues across these categories:
- Injection attacks (SQL, command, LDAP, XSS)
- Hardcoded secrets, API keys, or credentials
- Missing or bypassed auth/permission checks
- Sensitive data in logs or error messages (PII, tokens)
- Vault subsystem bypasses (direct env var reads for secrets)
- Insecure dependencies (flag newly added packages with known CVEs)
- Unsafe deserialization or eval usage
- SSRF (Server-Side Request Forgery) via user-controlled URLs
- Path traversal in file/storage operations
- Prototype pollution via unsafe object merging (deep merge, recursive assign)
- Regular expression denial of service (ReDoS)

## Reporting

Report ALL findings regardless of confidence level.

Format each finding as:
- **Severity**: Critical / High / Medium / Low
- **File**: path and line number
- **Issue**: what's wrong
- **Fix**: how to remediate

## Summary

End with:
1. Count of findings by severity
2. `pnpm audit` results summary
3. Overall security verdict: **Pass** / **Needs Remediation** / **Fail**
4. If Fail, list the blocking issues
