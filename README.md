# Markdown Viewer

Markdown Viewer is a private, browser-based reader and lightweight editor for local Markdown documents. Open notes, documentation, READMEs, and project folders in a focused reading environment without uploading your files.

[Open Markdown Viewer](https://shekharroy.com/markdown-viewer/)

## Features

### Open and organize documents

- Open individual `.md`, `.markdown`, `.mdown`, and `.txt` files.
- Browse supported documents in a local folder using a collapsible file tree.
- Create new Markdown documents or paste Markdown directly from the clipboard.
- Load public Markdown files from HTTPS URLs when the source permits cross-origin access.
- Reopen recent files and restore the previous workspace, folder state, and reading position.

### Read comfortably

- Render GitHub Flavored Markdown, tables, task lists, footnotes, images, mathematical notation, Mermaid diagrams, and syntax-highlighted code.
- Navigate long documents with a generated table of contents and in-document search.
- Choose from light and dark themes, multiple font styles, adjustable text size and weight, zoom controls, high contrast, and full-width layouts.
- Use responsive file and contents panels across desktop, tablet, and mobile screen sizes.

### Make quick edits

- Switch between reading and editing without losing your position.
- Save changes directly to the original file when the browser grants write access.
- Download an updated copy when direct file access is unavailable.
- Recover unsaved drafts stored in the same browser.

### Use it as a desktop app

Markdown Viewer can be installed as an offline-capable Progressive Web App (PWA). On supported desktop browsers, installed copies can open Markdown files directly from the operating system.

To enable desktop file opening:

1. Open Markdown Viewer in Google Chrome or Microsoft Edge on a desktop computer.
2. Install the app using the browser's install option.
3. Allow file handling if the browser requests permission.
4. Select Markdown Viewer as the default application for the desired Markdown file types in your operating system settings.

If an existing installation does not recognize the new file associations, close and reopen the app, check for an update in the browser's app settings, or reinstall it.

> Desktop file associations require the PWA File Handling API, which is currently available in Chromium-based desktop browsers. Other browsers can still open files through the app's **Open** command or drag and drop.

## Privacy and local data

Local documents are processed on your device and are not uploaded to an application server. Markdown Viewer does not require an account and does not include analytics or tracking scripts.

To restore your workspace between sessions, the app stores the current document, recent-file information, drafts, preferences, folder state, and reading positions in your browser. Use **Clear local data** from the app menu to remove this information.

Your browser controls access to local files. It may request permission before reopening a file or saving changes to the original. When write access is unavailable, Markdown Viewer creates a downloadable copy instead.

## Supported files and limitations

- Local documents must be UTF-8 encoded and no larger than 8 MB.
- Public URLs must use HTTPS, return readable text, and permit browser access through CORS.
- Direct saving, directory access, and desktop file associations depend on browser support and user-granted permissions.
- The app must be loaded online once before its offline resources are available.

## Development

### Run locally

```bash
npm install
npm run dev
```

Open the local URL printed by Vite.

### Run quality checks

```bash
npm run lint
npm run test
npm run build
npm run test:e2e
```

If Playwright browsers are not installed, run:

```bash
npx playwright install
```

### Build and publish

The production build is configured for `https://shekharroy.com/markdown-viewer/`.

```bash
npm run build
```

Publish the generated `dist/` directory with GitHub Pages, or use the included GitHub Actions workflow in `.github/workflows/pages.yml`.
