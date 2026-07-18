export const exampleDocument = `---
title: Markdown Viewer Example
author: Local browser session
tags:
  - markdown
  - private
---

# Markdown Viewer Example

Markdown Viewer is a read-first Markdown viewer with just enough editing power for quick corrections. Open a file, drop a folder, paste Markdown, or load public Markdown from a URL when the browser allows it. Inline snippets like \`example\` stay in the sentence instead of turning into blocks.

> Your documents stay in this browser. Markdown Viewer does not upload files, phone home, or require an account.

## What it renders

- GitHub Flavored Markdown
- Tables, task lists, and footnotes
- Math, Mermaid diagrams, images, and fenced code blocks
- Heading anchors and a generated table of contents
- YAML front matter in the document information panel

## Task list

- [x] Read a local Markdown file
- [x] Make a tiny edit
- [ ] Save it back directly when the browser grants permission

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
| Draft recovery | IndexedDB | Local to this browser |
| Preferences | Browser storage | Theme, width, font size |
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

Markdown Viewer keeps private Markdown files local by design.[^privacy]

[^privacy]: Public URL loading uses the browser's normal fetch behavior, so CORS and network errors are surfaced instead of bypassed.
`;
