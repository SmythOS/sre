# Code Review against dev

Run a comprehensive code review comparing the current branch against origin/dev.

1. Execute: `git fetch origin dev && git diff $(git merge-base HEAD origin/dev) HEAD`
2. Analyze the diff following **all** Code Review Rules defined in CLAUDE.md:
   - Prettier formatting (4 spaces, single quotes, 150 char width)
   - File suffix and declaration naming conventions
   - Utils purity (no imports outside `/utils`)
   - Test coverage for bug fixes and new features
   - Strict typing (no unnecessary `any`)
   - No unnecessary new dependencies
   - DCO sign-off on commits (`git commit -s`)
3. Classify each finding by severity:
   - `[Critical]` — Bugs, broken logic, data loss risk, missing required tests
   - `[High]` — Naming violations, `any` usage, missing error handling
   - `[Medium]` — Formatting issues, minor convention deviations
   - `[Low]` — Suggestions, style preferences, minor improvements
4. Only report findings with confidence above 60%
5. Format each finding as: `[Severity]` — file:line — description — rule violated
6. End with a summary:
   - Overall assessment (approve / request changes)
   - What was done well
   - Count of findings by severity
