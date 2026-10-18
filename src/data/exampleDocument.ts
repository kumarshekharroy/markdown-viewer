export const exampleDocument = `---
title: Markdown Viewer Example
author: Local session
tags:
  - markdown
  - private
---

# Markdown Viewer Example

Markdown Viewer by LunarPing is a read-first Markdown viewer with just enough editing power for quick corrections. Open or drop a Markdown file, paste Markdown, or load public Markdown from a URL. Inline snippets like \`example\` stay in the sentence instead of turning into blocks.

> Your local documents stay on your device. Markdown Viewer by LunarPing does not upload files, phone home, or require an account.

## What it renders

- GitHub Flavored Markdown
- Tables, task lists, and footnotes
- Math, Mermaid diagrams, images, and fenced code blocks
- Heading anchors and a generated table of contents
- YAML front matter in the document information panel

## Task list

- [x] Read a local Markdown file
- [x] Make a tiny edit
- [ ] Save changes to a local file after granting file access

## Code

\`\`\`ts
type ReaderMode = 'reading' | 'editing';

export function describeMode(mode: ReaderMode) {
  return \`Markdown Viewer is currently in \${mode} mode.\`;
}
\`\`\`

## Table

| Capability | Where data lives | Notes |
| --- | --- | --- |
| Draft recovery | Device storage | Unsaved work stays local |
| Preferences | Local settings | Theme, width, font size |
| Folder assets | Object URLs | Revoked when replaced |

| Long capability label | Long location label | Long notes label |
| --- | --- | --- |
| Wide-table overflow handling | The current document column | This row intentionally contains a long-unbroken-token-for-responsive-table-scrolling-checks so wide tables scroll inside their own frame. |

## Math

Inline math works, such as $E = mc^2$.

$$
\\int_0^1 x^2\\,dx = \\frac{1}{3}
$$

## Mermaid

\`\`\`mermaid
flowchart LR
    A[Open Markdown] --> B[Read comfortably]
    B --> C{Need a fix?}
    C -->|Yes| D[Edit Markdown]
    C -->|No| E[Print, copy, or close]
\`\`\`

## Footnote

Markdown Viewer by LunarPing keeps private Markdown files local by design.[^privacy]

[^privacy]: Public URL loading follows standard network and CORS rules. Remote images may contact their hosts, and network errors are reported without a proxy.
`;
