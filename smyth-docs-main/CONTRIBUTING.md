---
title: Contributing Guide
description: How to contribute to the SmythOS docs project.
keywords: [contribute, open source, smythos docs, how to help]
---

# Contributing to SmythOS Documentation

Thank you for helping make SmythOS documentation better!  
We welcome all contributsions: whether you’re fixing a typo, adding a new guide, or sharing feedback, every contribution counts.

<Spacer size="md" />

## Ways to Contribute

- Fix typos, unclear language, or broken formatting
- Add new examples, visuals, or code snippets
- Create or suggest new pages and guides
- Report outdated information or bugs in the docs
- Improve structure, navigation, or accessibility

<Spacer size="md" />

## Getting Started

1. **Fork the repo** on GitHub and clone it locally  
   `gh repo clone SmythOS/smyth-docs`
2. **Install dependencies**  
   `npm install`
3. **Start the local dev server**  
   `npm run start`

<Spacer size="md" />

## Writing & Style Guidelines

- Follow the [Style Guide](./DOCS_STYLE_GUIDE)
- Use `.mdx` for all docs pages
- Always include frontmatter at the top:
```mdx
  ---
  title: Page Title  
  description: Short summary  
  keywords: [keyword1, keyword2]  
  sidebar_position: 1  
  ---
```
- Break content into clear sections
- Use InfoCallout, TipCallout, or WarningCallout where helpful
- Keep code samples working, and always use `<codeblock>` for code
- Keep language consistent with existing docs

<Spacer size="md" />

## Submitting Your Changes

1. **Create a new branch**  
   `git checkout -b update-page-title`
2. **Make your edits**
3. **Commit with a clear message**  
   `git commit -m "docs: improved Data Pool page structure"`
4. **Push and open a pull request** to `main` on GitHub, describing what you changed

<Spacer size="md" />

## Review Process

- All pull requests are reviewed by a maintainer (currently Umar)
- We check for clarity, technical accuracy, and a user-focused style
- You may get feedback or requests for changes before merging
- PRs are usually reviewed within 1–3 days

<Spacer size="md" />

## Need Help?

- Ask in our [Discord community](https://discord.gg/smythos)
- - For bug reports or feature requests, [open an issue on GitHub](https://github.com/SmythOS/smyth-docs/issues).

<Spacer size="md" />

Thanks again for making SmythOS docs better!

