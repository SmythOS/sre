---
title: Documentation Style Guide
description: Write clear, user-focused docs for the SmythOS Runtime Environment.
---

# SmythOS Documentation Style Guide

Help users succeed by writing docs that are clear, direct, and genuinely helpful.

<Spacer size="md" />

## Writing Principles

- Use a **conversational, professional tone**. Write to the reader af if directly communicating with them.
- Prefer **short sentences and paragraphs** (1–3 sentences each).
- Use **active voice** for clarity.
- Keep explanations beginner-friendly. If you use technical terms, define them.
- Avoid filler, marketing language, and unnecessary complexity.

<Spacer size="md" />

## Formatting & Structure

- **Frontmatter:** Every page must start with frontmatter for `title`, `description`, `keywords`, and `sidebar_position`.
- **Headings:** Use clear headings and break content into logical sections.
- **Spacing:** Insert `<Spacer size="md" />` between main sections for readability.
- **Bullets & Tables:** Use bullet points or tables for lists, options, and comparisons.
- **Links:** Use descriptive [internal links](/docs/page-path). Avoid “click here.”
- **Callouts:** Use InfoCallout, TipCallout, or WarningCallout only when it adds clarity or highlights action.
- **No emojis** or informal icons.
- **Code:** Ensure every snippet is accurate and runnable.

<Spacer size="md" />

## Voice & Terminology

- Write in second person (“you can…”), and focus on real user needs.
- Use consistent names for product features, such as:
  - `Studio`
  - `Spaces`
  - `Data Pool`
- Match your `title` to the sidebar label for each page.

<Spacer size="md" />

## Example
```mdx
<InfoCallout title="Why this matters">
Callouts should clarify, not repeat the main text. Use them to highlight key points, warnings, or helpful context.
</InfoCallout>

```ts
import { Agent } from '@smythos/sdk';

const agent = new Agent({ name: 'DemoAgent', model: 'gpt-4' });
```

<Spacer size="md" />

**Write for users, keep it clean, and always look for ways to improve.**
```