# Contributing to SmythOS

Welcome, and thank you for your interest in contributing to **SmythOS**!

There are many ways to contribute to the project beyond writing code. This guide will help you get started.

---

## 📚 Questions & Support

If you have questions about SmythOS:

-   Please visit our developer documentation: [https://smythos.github.io/sre/](https://smythos.github.io/sre/)
-   Join our community on Discord: [https://discord.gg/smythos](https://discord.gg/smythos)

---

## Quick Start

In order to contribute to SmythOS codebase, follow these steps:

1. Fork the repository

```bash
git clone https://github.com/SmythOS/sre.git
cd sre
```

2. Install the dependencies

```bash
pnpm install
```

3. Configure sre environment.
   Smyth Runtime Environment (SRE) expects a directory called .smyth to exist in the root of the project or in the user's home directory.
   (check [SRE Configuration](https://smythos.github.io/sre/core/documents/05-configuration.html) for more details)

```bash
mkdir -p .smyth
#or
mkdir -p ~/.smyth
```

And by default the SRE expects this folder to contains a vault.json file with this structure:

```bash
touch .smyth/vault.json
#or
touch ~/.smyth/vault.json
```

```json
{
    "default": {
        "echo": "",
        "openai": "<your openai api key>",
        "anthropic": "<your anthropic api key>",
        "googleai": "<your google ai api key>",
        "groq": "<your groq api key>",
        "togetherai": "<your together ai api key>",
        "xai": "<your xai api key>",
        "perplexity": "<your perplexity api key>"
    }
}
```

You don't need to provide all the keys, only the ones you need in your tests.

## 3. Build the project

```bash
pnpm build
```

## 4. Run the tests

```bash
pnpm test
```

## 5. Run the examples

The project comes with a set of examples that you can run to see the SRE in action.

for this, go to the examples directory and run the following command:

```bash
pnpm start <path_to_example.ts>
```

The project also comes with a pre-configured vscode debug launch file for the examples.
The debugger will allow you to follow breakpoints in the examples and in SRE and SDK codes.

In order to use the debugger :

-   Select "Debug Current Example" from the vscode debug menu.
-   Open any example .ts file
-   Then hit F5 to start the debugger

---

## 💬 Providing Feedback

We welcome all kinds of feedback! Whether you have suggestions, bug reports, or general thoughts, feel free to share them via:

-   GitHub Issues: [https://github.com/SmythOS/sre/issues](https://github.com/SmythOS/sre/issues)
-   [Discord](https://discord.gg/smythos)

---

## 🐛 Reporting Issues

If you encounter a bug or want to request a new feature, please open an issue in our GitHub repository:

👉 [https://github.com/SmythOS/sre/issues](https://github.com/SmythOS/sre/issues)

### 🔍 Before You Report

-   **Search existing issues** to avoid duplicates.
-   Add details or reactions to existing issues if applicable.
-   If you're reporting a bug:
    -   Provide steps to reproduce the issue.
    -   Include logs, error messages, screenshots, or code snippets when relevant.
-   If you're reporting a security vulnerability:
    -   Avoid posting an issue in the GitHub repo to avoid exploits
    -   Email `security@smythos.com` directly, instead.

### 📝 A Good Bug Report Includes:

-   Operating system and environment details
-   Reproducible steps
-   Expected vs actual behavior
-   Screenshots, logs, or error output
-   Minimal code snippet if applicable

---

## 🔧 Creating Pull Requests

We love contributions from the community! Here's how to get started:

1. **Fork** the repository.
2. Create a new branch for your changes.
3. Make your changes and commit with clear messages.
4. Submit a pull request (PR) with a meaningful description.

📚 If you're new to open source contributions, follow the GitHub guide:  
[Contributing to a Project on GitHub](https://docs.github.com/en/get-started/exploring-projects-on-github/contributing-to-a-project)

---

## 📜 Developer Certificate of Origin (DCO)

SmythOS uses the [Developer Certificate of Origin 1.1](https://developercertificate.org/) to ensure that every
contribution is made with clear provenance and permission.

-   **What you do:** add the `-s` flag to each `git commit`
    ```bash
    git commit -s -m "Fix: correct off-by-one in vector index"
    ```

---

## 🧑‍💻 Developer Notes

-   All contributions must follow the **fork → branch → pull request** workflow.
-   If you're unsure where to start, check the [issues page](https://github.com/SmythOS/sre/issues).
    -   Look for issues labeled **`good-first-contrib`** – they're beginner-friendly and ideal starting points!
-   Ensure your changes are well-tested and follow the project’s coding standards.
-   Be sure to run any linting or formatting tools used by the project before submitting a PR.

---

## ✅ Final Checklist Before Submitting

-   [ ] Searched for existing issues
-   [ ] Reproduced and isolated the problem (for bugs)
-   [ ] Wrote clear and concise commit messages
-   [ ] Ensured your code passes all tests and checks
-   [ ] Documented any new behavior or configuration
-   [ ] I'm signing off all commits (git commit -s)

---

## 🛡️ Reporting Security Vulnerabilities

Please report security vulnerabilities **privately** via email to:

📧 `security@smythos.com`

> Do **not** report security issues in public GitHub Issues.

---

## 🙏 Thank You

Your contributions—big or small—make SmythOS better.  
We appreciate your time, effort, and support in helping the project grow!
