# Security Review against dev

Run a security-focused review of changes against origin/dev.

1. Execute: `git fetch origin dev && git diff $(git merge-base HEAD origin/dev) HEAD`
2. Analyze the diff **only** for security issues:
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
3. Run `pnpm audit --audit-level=moderate` and report any new vulnerabilities introduced by the diff
4. Report **all** findings regardless of confidence level
5. Format each finding as: `[Critical|High|Medium|Low]` — file:line — description
6. If no issues found, confirm the changes pass security review
