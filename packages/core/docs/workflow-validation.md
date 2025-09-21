### Workflow Validation

SRE validates an agent's workflow graph before execution to catch structural issues early.

What is validated
- Graph integrity
  - All referenced component IDs exist
  - No duplicate component IDs
  - No circular dependencies (cycles) unless allowlisted
  - Dead/unreachable components detection (from entry nodes such as `APIEndpoint` or nodes with no incoming edges)
- Input mapping
  - Required inputs must be mapped (based on per-component inputs; optional or defaulted inputs are exempt)
  - Connections must target valid output/input names or indices
  - Index/name normalization is checked (bounds and existence)
- Execution order
  - Produces a topological order when acyclic; stored on `agent.planInfo.topologicalOrder`

How issues are reported
- Each issue contains:
  - `code`: stable identifier
  - `message`: human-friendly description
  - `severity`: `error` or `warning`
  - `componentIds`: impacted component IDs
  - `hint`: remediation guidance
  - `cyclePath` when a cycle is found

Severity and allowlist
- Cycles are errors by default.
- Components named `Async` and `Await` are allowlisted to downgrade cycle severity to warnings when a cycle only contains allowlisted names.

Integration (always-on)
- Validation runs automatically at the start of `Agent.process(...)` before any execution steps.
- If there are errors, the call aborts with an aggregated message.
- If there are only warnings, execution proceeds and warnings are logged.

Limitations & best practices
- Input requirements are inferred from component inputs and their `optional`/`default` flags. If a component does not declare inputs, only structural checks apply.
- Prefer explicit input declarations in component schemas to improve validation accuracy.
- Avoid cycles unless intentionally handled by asynchronous components.


