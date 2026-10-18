# Markdown Viewer by LunarPing

Read and edit Markdown on the web, macOS, and Windows. Markdown Viewer combines a document reader with a lightweight editor, live preview, and local file handling. Documents are processed on your device without an account or an upload service.

**[Open the web app](https://md.lunarping.com/)**

The web and native desktop apps share the same React and TypeScript codebase. Vite builds the frontend, and Tauri v2 provides the desktop window and native file dialogs.

## Features

- Render tables, task lists, footnotes, math, Mermaid diagrams, images, and highlighted code.
- Edit Markdown with a resizable split view and synchronized preview scrolling.
- Navigate with a table of contents and search or replace text in the document.
- Keep multiple tabs, reorder them, and restore drafts and reading positions.
- Adjust themes, fonts, zoom, contrast, content width, and sidebar layout.
- Open local files, paste Markdown, create a new document, or fetch a public Markdown URL.
- Browse local folders in supported browsers, including their Markdown files and image assets.

## Ways to use it

| Version                 | Getting started                                                               | File handling                                                                                                         |
| ----------------------- | ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Website                 | Open [md.lunarping.com](https://md.lunarping.com/).                           | Open local files and folders. Save in place when the browser supports it, or download an updated copy.                |
| Installed web app (PWA) | Install the website through a supported browser.                              | Uses the browser's file permissions. Supported Chrome and Edge installations can register Markdown file associations. |
| Native desktop app      | Download a macOS or Windows installer from a successful desktop workflow run. | Uses native **Open**, **Save**, and **Save As** dialogs for individual Markdown files.                                |

### Browser and installed web app

Use **Open** to select a document, **Edit Markdown** to edit it, and **Save** or **Save As** to keep your changes. When direct saving is unavailable, the browser downloads a copy and leaves the original file unchanged.

In Chrome or Edge, install the site using the browser's app installation option. Where file handling is supported, allow it and choose Markdown Viewer by LunarPing as the default application for Markdown files. File associations depend on the browser and operating system. They belong to the installed web app; the native Tauri app currently opens files through its **Open** button.

The website caches resources for offline reuse. Opening a public URL or loading remote images still requires network access. Resources that have not been cached may also need an initial online visit.

### Native desktop app

To download an installer from this repository:

1. Open **Actions → Desktop Build** and select a successful run.
2. Scroll to **Artifacts** and download the artifact for your platform.
3. Extract the downloaded ZIP to access the installer.

| Platform                       | Artifact                          | Installer                                                           |
| ------------------------------ | --------------------------------- | ------------------------------------------------------------------- |
| macOS, Apple Silicon and Intel | `markdown-viewer-macos-universal` | `.dmg`; open it and drag **Markdown Viewer** into **Applications**. |
| Windows, x64                   | `markdown-viewer-windows-x64`     | `.exe`; run the NSIS installer.                                     |

The [Desktop Build workflow](.github/workflows/desktop-build.yml) is configured to build both installers on every push to any branch. It also supports manual runs through **Run workflow**. After both uploads succeed, cleanup keeps the newest complete installer pair: **two artifacts total**, one for macOS and one for Windows, across all branches. Older desktop artifacts from this workflow are removed; other workflows' artifacts are left alone. In-progress builds may temporarily have additional artifacts, and a failed build does not replace the retained pair.

Uploads request GitHub's maximum retention: **90 days for public repositories** or **400 days for private repositories**. GitHub applies any lower repository or organization cap. For the longest permitted retention, set the retention limit under **Settings → Actions → General** to the maximum your repository allows. Retention is an age limit, so retained installers still expire if no replacement build is produced. See [GitHub's retention settings](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/enabling-features-for-your-repository/managing-github-actions-settings-for-a-repository).

Builds and downloads use GitHub Actions; there is no automatic updater or GitHub Releases publishing step.

An installed desktop app does not require Node.js, Rust, or developer tools. Windows requires the WebView2 runtime; the installer may download it if it is missing, so the first installation can need internet access.

These builds use no trusted publisher certificates or notarization. macOS uses a free ad hoc signature and may require approval through **System Settings → Privacy & Security → Open Anyway** after an attempted launch. Windows may show an unknown-publisher or SmartScreen prompt. Only approve a build you trust. No paid developer account is required. See the [Tauri signing documentation](https://v2.tauri.app/distribute/sign/macos/) and [Windows installer documentation](https://v2.tauri.app/distribute/windows-installer/) for platform details.

GitHub-hosted builds and artifact storage are subject to your repository's [GitHub Actions allowances](https://docs.github.com/en/billing/concepts/product-billing/github-actions).

## Opening and saving documents

In the native app, **Save** updates a file opened during the current session. A new document asks for a destination. **Save As** writes to the selected destination, and later saves use that new path. Canceling a picker leaves the document open, and failed writes keep its unsaved status. Closing a native window with unsaved tabs asks for confirmation.

After a desktop restart, the app restores document content and drafts, but native file permissions must be granted again. The first save of a restored document therefore asks for a destination. Reopen the original file through **Open** to grant access, or select its path in the save dialog.

The website and native app have separate storage for drafts, preferences, and workspace state. They can run at the same time. If both edit the same file on disk, the last save overwrites that file; changes are not automatically merged.

### Current limits

- Supported extensions are `.md`, `.markdown`, `.mdown`, and `.txt`.
- Files must be UTF-8 text and no larger than 8 MB. Opening an empty file currently shows an error; use **New Markdown file** to start a blank document.
- Native filesystem integration currently covers individual files. Native folder traversal and Finder/Explorer double-click file associations are not implemented.
- Browser folder access, saving in place, and PWA file associations depend on browser support and permission settings.
- Local images and links between Markdown files are resolved through the browser folder workspace. Opening a single file in the native app does not grant access to its neighboring files or images.
- Draft recovery and window-close confirmation do not replace saving files before force-quitting the application or shutting down the computer.

## Privacy and storage

Local documents are read and rendered on your device. The app has no accounts, analytics, tracking, or backend receiving document uploads.

Workspace storage includes open tabs, recent files, drafts, preferences, folder state, and reading positions. **Clear local data** removes stored application data for the version you are using; it does not delete your saved files on disk.

Loading a public Markdown URL makes a request directly to that server, which must permit cross-origin access. Remote images and other externally referenced resources can also make network requests to their hosts.

## Development

### Prerequisites

Use **Node.js 22** and npm to match the project's CI environment. Run commands from the repository root.

Web development only needs Node.js and npm. Desktop development also requires a stable Rust toolchain and the native tools listed in the [Tauri v2 prerequisites](https://v2.tauri.app/start/prerequisites/):

| Platform | Desktop build requirements                                                                                        |
| -------- | ----------------------------------------------------------------------------------------------------------------- |
| macOS    | Xcode Command Line Tools and Rust installed through [rustup](https://rustup.rs/).                                 |
| Windows  | Visual Studio Build Tools with **Desktop development with C++**, the WebView2 runtime, and Rust's MSVC toolchain. |

On macOS, install the command line tools if they are missing:

```bash
xcode-select --install
```

On Windows, Rust can be installed from PowerShell:

```powershell
winget install --id Rustlang.Rustup
```

Restart the terminal after installing Rust. On Windows, select the MSVC toolchain:

```powershell
rustup default stable-msvc
```

Check the desktop toolchain before starting:

```bash
rustc --version
cargo --version
```

### Run the web app

```bash
npm ci
npm run dev
```

Vite normally serves the website at `http://127.0.0.1:5173`. Use the address printed in the terminal if that port is occupied.

Build and preview the production website:

```bash
npm run build
npm run preview
```

The web build is written to `dist/` and serves from `/`. It can be hosted as static files without a backend.

### Run the desktop app

After installing the desktop prerequisites and npm dependencies:

```bash
npm run desktop:dev
```

Tauri starts a dedicated Vite server at `http://127.0.0.1:1420`, compiles the Rust wrapper, and opens the desktop window. The first native build downloads Rust dependencies and takes longer than subsequent builds. If port 1420 is occupied, stop the other process before starting Tauri.

The website and desktop app can run in separate terminals. Desktop development uses `vite.desktop.config.ts`, which reuses the web configuration and excludes Rust output from its watcher. Desktop frontend builds go to `dist-desktop/`; website builds continue to use `dist/`.

`npm run dev:desktop` starts only the desktop Vite server. Use `npm run desktop:dev` to launch the full native app.

### Build desktop installers

Build each installer on its corresponding operating system. Tauri automatically builds the frontend before compiling and packaging the native app.

On macOS, build for the current Mac's architecture:

```bash
npm run tauri -- build --bundles dmg
```

For a universal macOS app that supports Apple Silicon and Intel:

```bash
rustup target add aarch64-apple-darwin x86_64-apple-darwin
npm run tauri -- build --target universal-apple-darwin --bundles dmg
```

On Windows, build an `.exe` installer:

```powershell
npm run tauri -- build --bundles nsis
```

Local builds without an explicit target write installers beneath `src-tauri/target/release/bundle/`, in `dmg/` or `nsis/`. Passing `--target` adds a target directory, such as `src-tauri/target/universal-apple-darwin/release/bundle/dmg/`. The desktop workflow uses explicit targets for both platforms.

To build only the desktop frontend, without generating an installer:

```bash
npm run build:desktop
```

Commit both `package-lock.json` and `src-tauri/Cargo.lock` when dependencies change. Generated frontend builds, native binaries, and installers are ignored by Git.

### Checks

Install the Playwright browsers before running browser tests:

```bash
npx playwright install
```

Run the project checks:

```bash
npm run format
npm run lint
npm run test
npm run build
npm run test:e2e
```

Linux environments may need `npx playwright install --with-deps` to install browser system libraries, as used in CI.

For desktop changes, also check the frontend and Rust wrapper, then test a native installer on the target platform:

```bash
npm run build:desktop
cargo check --manifest-path src-tauri/Cargo.toml
```

Verify Open, editing, Save, Save As, canceled dialogs, write failures, workspace restoration, and the unsaved-close prompt. Unit tests mock native APIs; a passing frontend test suite alone does not verify OS dialogs or installer behavior.

## Project layout

```text
src/                                  Shared React UI, editor, rendering, and persistence
src/lib/desktopFiles.ts                Native Markdown open/save operations
public/                               Website assets, PWA manifest, and service worker
vite.config.ts                        Web frontend configuration
vite.desktop.config.ts                Desktop Vite configuration
src-tauri/                            Tauri app, Rust dependencies, permissions, and icons
.github/workflows/ci.yml               Web lint, tests, build, and browser checks
.github/workflows/desktop-build.yml    macOS and Windows installer builds
```

Native calls are guarded with Tauri's `isTauri()` check and loaded only in the desktop runtime. The browser keeps its existing file-picker and download behavior. Service worker registration runs only in the web app; the desktop app loads its bundled frontend.

## Web deployment

The production website is hosted at [md.lunarping.com](https://md.lunarping.com/). To deploy a checkout to Cloudflare Pages, connect the repository and use:

| Setting                | Value           |
| ---------------------- | --------------- |
| Framework preset       | React (Vite)    |
| Production branch      | `main`          |
| Build command          | `npm run build` |
| Build output directory | `dist`          |
| Root directory         | Repository root |

Configure a custom domain in the Cloudflare Pages project if needed. The files `public/_headers` and `public/_redirects` are copied into the build and applied by Cloudflare Pages.

The [CI workflow](.github/workflows/ci.yml) runs web checks on pushes to `main` and on pull requests. Cloudflare's Git integration handles website deployment. The desktop workflow runs independently and uploads installers as Actions artifacts.

The optional [legacy redirect workflow](.github/workflows/legacy-redirect.yml) publishes `legacy-redirect/` to the former GitHub Pages site. It is manually triggered and is separate from the website and desktop builds.

Browser storage and installed web app registrations are scoped to each origin. When moving to another domain, save or export unsaved documents first and reinstall the PWA if needed.
