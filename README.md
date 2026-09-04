# Markdown Viewer

Markdown Viewer is a simple, private way to read Markdown files in your browser. It is made for opening notes, docs, READMEs, project folders, and small edits without uploading anything.

The app lives at:

```text
https://shekharroy.com/markdown-viewer/
```

## What You Can Do

- Open a Markdown file from your computer.
- Create a blank Markdown file and start writing immediately in Edit mode. New documents stay outside an open folder tree until the saved folder is reopened.
- Open a folder and move through a collapsible Markdown file tree from the sidebar.
- Paste Markdown or load a public Markdown URL.
- Read GitHub-style Markdown with tables, task lists, footnotes, math, Mermaid diagrams, images, and highlighted code.
- Search inside the document and jump through matches.
- Make quick edits and save or download the updated file.
- Keep Edit mode active while moving between files, and use the table of contents to jump through either the reader or editor.
- Switch between a previewable gallery of light and dark reading themes.
- Use the header for a simple Paper/Slate light–dark toggle while system appearance remains the default.
- Choose fonts visually and opt into a true full-width reading layout from the reorganized Settings panel.
- Keep font-size, zoom, font-weight, and high-contrast controls within easy reach while reading.
- Open either sidebar from the ends of the reading dock, or reveal its contextual edge control with the pointer.
- Reset the reading dock without changing the selected theme, file, or draft.
- Restore the open document, folder expansion, preferences, and per-file scroll position after a reload.
- Keep recent files and recover unsaved drafts in the same browser.

## Privacy

Markdown Viewer runs in your browser. Local files are not uploaded, and the app does not use accounts, analytics, tracking scripts, or a backend server.

The current document and folder tree are stored in this browser so the workspace can be restored after a reload. This local workspace data can be removed with **Clear local data**.

Some browser features, like reopening a recent local file or saving directly back to the original file, may ask for permission. If the browser does not support direct saving, the app falls back to downloading the updated Markdown file.

## Run It Locally

Install dependencies:

```bash
npm install
```

Start the app:

```bash
npm run dev
```

Then open the local URL shown in the terminal.

## Check Before Publishing

```bash
npm run lint
npm run test
npm run build
npm run test:e2e
```

If Playwright is missing browsers on a fresh machine, install them once:

```bash
npx playwright install
```

## Publish

The production build is set up for this path:

```text
https://shekharroy.com/markdown-viewer/
```

Build the app:

```bash
npm run build
```

Publish the `dist/` folder with GitHub Pages, or use the included GitHub Actions workflow in `.github/workflows/pages.yml`.

The app already includes basic SEO files and metadata: page title, description, canonical URL, Open Graph tags, Twitter card tags, structured data, `robots.txt`, and `sitemap.xml`.
