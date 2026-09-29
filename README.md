# Markdown Viewer by LunarPing

Markdown Viewer by LunarPing is a small, private Markdown reader that runs in the browser. It is useful for reading notes, READMEs, and documentation without opening a full code editor or uploading files to a service.

Try it here: [md.lunarping.com](https://md.lunarping.com/)

## What it does

- Opens individual Markdown files or an entire local folder
- Renders tables, task lists, footnotes, math, Mermaid diagrams, images, and highlighted code
- Includes a table of contents and shared Markdown search and replace in the reader and editor
- Lets you make quick edits and save them back to the original file when the browser allows it
- Offers resizable side-by-side editing and live preview with synchronized scrolling
- Remembers open tabs, each tab's unsaved changes and draft, reading position, and theme
- Lets you drag open tabs into a new order (or use Alt+Shift+Left/Right while a tab is focused)
- Works offline after the first visit

You can also paste Markdown, start a new document, or open a public Markdown file from a URL.

## Opening files from the desktop

The site can be installed as a desktop app from Chrome or Edge. After installation, allow file handling and choose Markdown Viewer by LunarPing as the default app for `.md`, `.markdown`, `.mdown`, or `.txt` files. Double-clicking one of those files will then open it in Markdown Viewer by LunarPing.

If you installed the app before file handling was added, update or reinstall it so the operating system can pick up the new file associations.

Desktop file associations currently require a Chromium-based browser. In other browsers, files can still be opened with the **Open** button or by dragging them into the app.

## Privacy

Local files stay on your device. There is no account, analytics, tracking, or application server receiving your documents.

The app does keep some information in browser storage so it can restore your workspace. This includes open tabs, recent files, drafts, preferences, folder state, and reading positions. You can remove it at any time with **Clear local data**.

Opening a public URL is different: the browser fetches that URL directly, and the server must allow cross-origin requests.

## A few limits

- Supported extensions are `.md`, `.markdown`, `.mdown`, and `.txt`.
- Files must be UTF-8 text and no larger than 8 MB.
- Saving in place, opening folders, and desktop file handling depend on browser support and permission settings. If direct saving is unavailable, the app downloads an updated copy instead.

## Development

```bash
npm install
npm run dev
```

Before publishing a change:

```bash
npm run lint
npm run test
npm run build
npm run test:e2e
```

Install the Playwright browsers first if needed:

```bash
npx playwright install
```

The production build serves from `/`:

```bash
npm run build
```

## Cloudflare Pages deployment

Connect this GitHub repository to a Cloudflare Pages project with `main` as the production branch. Use these settings:

| Setting                | Value           |
| ---------------------- | --------------- |
| Framework preset       | React (Vite)    |
| Build command          | `npm run build` |
| Build output directory | `dist`          |
| Root directory         | Repository root |

In **Workers & Pages → your project → Custom domains**, add `md.lunarping.com`. If `lunarping.com` is already a Cloudflare zone in the same account, Cloudflare adds the CNAME record during setup. Otherwise, add a CNAME for `md` pointing to the project's `*.pages.dev` hostname at the domain's DNS provider. Associate the hostname in Pages before adding the DNS record.

The `public/_headers` and `public/_redirects` files are copied to `dist/` and applied by Cloudflare Pages. The GitHub Actions `CI` workflow checks code changes; deployment is handled by Cloudflare's Git integration.

After the new domain is live, run the **Redirect legacy GitHub Pages** workflow manually from GitHub Actions. It replaces the old project site at `https://shekharroy.com/markdown-viewer/` with a redirect page pointing to the new domain. If the old hostname is routed through a service that supports HTTP redirects, configure a permanent `301` redirect there as well.

Browser storage and installed app registrations are scoped to each origin. Before retiring the old site, export any unsaved drafts and reopen them on the new domain; reinstall the app if desktop file handling is used.
