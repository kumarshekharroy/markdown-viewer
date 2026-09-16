import { expect, test, type Page, type TestInfo } from '@playwright/test';

const APP_PATH = '/markdown-viewer/';

test('loads the reader and toggles editing', async ({ page }) => {
  await page.goto(APP_PATH);

  await expect(page.getByRole('heading', { name: 'Markdown Viewer Example' })).toBeVisible();
  await expect(page.locator('.markdown-body p code.inline-code')).toHaveText('example');
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1))
    .toBe(true);

  await page.getByRole('button', { name: 'Edit Markdown' }).click();
  await expect(page.locator('.cm-editor')).toBeVisible();
  await page.getByRole('button', { name: 'Done editing' }).click();
  await expect(page.getByRole('heading', { name: 'Markdown Viewer Example' })).toBeVisible();
});

test('contents navigation moves the editor to the selected heading', async ({ page }) => {
  await page.goto(APP_PATH);
  await page.getByRole('button', { name: 'Edit Markdown' }).click();
  await expect(page.locator('.cm-editor')).toBeVisible();

  if (isCompactProject(test.info())) {
    await page.getByRole('button', { name: 'Show table of contents' }).click();
  }
  await page.locator('.toc-list').getByRole('link', { name: 'Mermaid' }).click();

  await expect(page.locator('.cm-activeLine')).toContainText('## Mermaid');
  await expect(page).toHaveURL(/#mermaid$/);
  await expect(page.locator('.cm-editor')).toBeVisible();
  if (isCompactProject(test.info())) {
    await expect(page.locator('.toc-panel')).toHaveCount(0);
  }
});

test('new Markdown files open as focused, empty editors', async ({ page }) => {
  await page.goto(APP_PATH);
  await page.getByRole('button', { name: 'More actions' }).click();
  await page.locator('.menu-popover').getByRole('button', { name: 'New Markdown file' }).click();

  await expect(page.locator('.title-block strong')).toHaveText('Untitled');
  await expect(page.locator('.title-block strong')).toHaveAttribute('title', 'Untitled.md');
  await expect(page.locator('.cm-editor')).toBeVisible();
  await expect(page.locator('.cm-content')).toHaveText('');
  await expect(page.getByRole('button', { name: 'Done editing' })).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => document.activeElement?.closest('.cm-editor') !== null))
    .toBe(true);

  await page.keyboard.insertText('# Fresh note');
  await expect(page.locator('.cm-content')).toContainText('# Fresh note');
});

test('tabs preserve separate unsaved drafts through switching and reload', async ({ page }) => {
  await page.goto(APP_PATH);
  await page.getByRole('button', { name: 'New Markdown tab' }).click();
  await expect(page.locator('.cm-content')).toBeVisible();
  await page.keyboard.insertText('# First draft');
  await expect(page.getByRole('tab').nth(1)).toContainText('●');

  await page.getByRole('button', { name: 'New Markdown tab' }).click();
  await expect(page.locator('.cm-content')).toBeVisible();
  await page.keyboard.insertText('# Second draft');
  await expect(page.getByRole('tab').nth(2)).toContainText('●');

  await page.getByRole('tab').nth(1).click();
  await expect(page.locator('.cm-content')).toContainText('# First draft');
  await page.getByRole('tab').nth(2).click();
  await expect(page.locator('.cm-content')).toContainText('# Second draft');

  await page.waitForTimeout(900);
  await page.reload();
  await expect(page.getByRole('tab')).toHaveCount(3);
  await expect(page.getByRole('heading', { name: 'Second draft' })).toBeVisible();
  await page.getByRole('button', { name: 'Edit Markdown' }).click();
  await expect(page.locator('.cm-content')).toContainText('# Second draft');
  await page.getByRole('tab').nth(1).click();
  await expect(page.locator('.cm-content')).toContainText('# First draft');
});

test('closing one dirty tab requires confirmation without affecting another', async ({ page }) => {
  await page.goto(APP_PATH);
  await page.getByRole('button', { name: 'New Markdown tab' }).click();
  await expect(page.locator('.cm-content')).toBeVisible();
  await page.keyboard.insertText('# Keep this');
  await page.getByRole('button', { name: 'New Markdown tab' }).click();
  await expect(page.locator('.cm-content')).toBeVisible();
  await page.keyboard.insertText('# Also keep this');

  page.once('dialog', async (dialog) => dialog.dismiss());
  await page.getByRole('button', { name: 'Close Untitled.md' }).click();
  await expect(page.getByRole('tab')).toHaveCount(3);

  page.once('dialog', async (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Close Untitled.md' }).click();
  await expect(page.getByRole('tab')).toHaveCount(2);
  await expect(page.locator('.cm-content')).toContainText('# Also keep this');
  await expect(page.getByRole('tab').last()).toContainText('●');
});

test('split view keeps a live preview and resizes with the keyboard', async ({ page }) => {
  await page.goto(APP_PATH);
  await page.getByRole('button', { name: 'Edit Markdown' }).click();
  await page.getByRole('button', { name: 'Show live preview beside editor' }).click();

  await expect(page.getByRole('region', { name: 'Live preview' })).toBeVisible();
  await expect(page.locator('.cm-editor')).toBeVisible();
  const divider = page.getByRole('separator', { name: 'Resize editor and preview' });
  await expect(divider).toHaveAttribute('aria-valuenow', '50');
  await divider.focus();
  await divider.press(isCompactProject(test.info()) ? 'ArrowDown' : 'ArrowRight');
  await expect(divider).toHaveAttribute('aria-valuenow', '55');

  await page.locator('.cm-content').click();
  await page.keyboard.press('ControlOrMeta+End');
  await page.keyboard.insertText('\n## Live heading');
  await expect(
    page
      .getByRole('region', { name: 'Live preview' })
      .getByRole('heading', { name: 'Live heading' })
  ).toBeVisible();

  await page.locator('.split-preview-pane').evaluate((pane) => {
    pane.scrollTop = 0;
  });
  await page.locator('.cm-scroller').evaluate((scroller) => {
    scroller.scrollTop = scroller.scrollHeight;
    scroller.dispatchEvent(new Event('scroll'));
  });
  await expect
    .poll(() => page.locator('.split-preview-pane').evaluate((pane) => pane.scrollTop))
    .toBeGreaterThan(0);
});

test('split scrolling aligns the same section in source and preview', async ({ page }) => {
  test.skip(isCompactProject(test.info()), 'desktop section alignment covers the horizontal split');
  await page.goto(APP_PATH);
  await page.getByRole('button', { name: 'Edit Markdown' }).click();
  await page.getByRole('button', { name: 'Show live preview beside editor' }).click();
  await page.locator('.toc-list').getByRole('link', { name: 'Code', exact: true }).click();
  const codeLine = page.locator('.cm-line').filter({ hasText: '## Code' }).first();
  await expect(codeLine).toBeVisible();
  await codeLine.evaluate((line) => {
    const scroller = line.closest('.cm-scroller') as HTMLElement;
    scroller.scrollTop +=
      line.getBoundingClientRect().top - scroller.getBoundingClientRect().top - 150;
    scroller.dispatchEvent(new Event('scroll'));
  });
  await expect
    .poll(async () =>
      page.evaluate(() => {
        const line = Array.from(document.querySelectorAll<HTMLElement>('.cm-line')).find((item) =>
          item.textContent?.includes('## Code')
        );
        const scroller = document.querySelector<HTMLElement>('.cm-scroller');
        const preview = document.querySelector<HTMLElement>('.split-preview-pane');
        const heading = preview?.querySelector<HTMLElement>('#code');
        const toolbar = document.querySelector<HTMLElement>('.format-toolbar');
        if (!line || !scroller || !preview || !heading || !toolbar) return Infinity;
        const editorY = line.getBoundingClientRect().top - scroller.getBoundingClientRect().top;
        const previewY = heading.getBoundingClientRect().top - preview.getBoundingClientRect().top;
        return Math.abs(previewY - editorY - toolbar.clientHeight);
      })
    )
    .toBeLessThan(32);
});

test('opening two folders with the same file path keeps their tabs distinct', async ({ page }) => {
  test.skip(isCompactProject(test.info()), 'desktop folder behavior covers tab identity');
  await page.goto(APP_PATH);
  const input = page.locator('input[type="file"][multiple]');
  for (const title of ['First folder', 'Second folder']) {
    await input.evaluate((element, heading) => {
      const transfer = new DataTransfer();
      const file = new File([`# ${heading}`], 'note.md', { type: 'text/markdown' });
      Object.defineProperty(file, 'webkitRelativePath', {
        configurable: true,
        value: 'workspace/note.md'
      });
      transfer.items.add(file);
      (element as HTMLInputElement).files = transfer.files;
      element.dispatchEvent(new Event('change', { bubbles: true }));
    }, title);
    await expect(page.getByRole('heading', { name: title })).toBeVisible();
  }
  await expect(page.getByRole('tab')).toHaveCount(3);
  await page.getByRole('tab').nth(1).click();
  await expect(page.getByRole('heading', { name: 'First folder' })).toBeVisible();
  await page.getByRole('tab').nth(2).click();
  await expect(page.getByRole('heading', { name: 'Second folder' })).toBeVisible();
});

test('one search and replace panel works in preview and editor', async ({ page }) => {
  test.skip(isCompactProject(test.info()), 'desktop search panel covers the shared controls');
  await page.goto(APP_PATH);
  await page.getByRole('button', { name: 'Find in document' }).click();
  await page.getByPlaceholder('Search this document').fill('Markdown');
  await page.getByRole('button', { name: 'Replace', exact: true }).click();
  await page.getByPlaceholder('Replace with').fill('MD');
  await page.getByRole('button', { name: 'Replace all' }).click();
  await expect(page.getByRole('heading', { name: 'MD Viewer Example' })).toBeVisible();

  await page.getByRole('button', { name: 'Edit Markdown' }).click();
  await page.getByRole('button', { name: 'Search and replace' }).click();
  await page.getByPlaceholder('Search this document').fill('MD');
  await page.getByPlaceholder('Replace with').fill('Markdown');
  await page.getByRole('button', { name: 'Replace all' }).click();
  await expect(page.locator('.cm-content')).toContainText('Markdown Viewer Example');
});

test('new documents stay outside an open folder until that folder is reopened', async ({
  page
}) => {
  test.skip(isCompactProject(test.info()), 'desktop folder tree behavior covers the shared state');
  await page.goto(APP_PATH);

  await page.locator('input[type="file"][multiple]').evaluate((input) => {
    const transfer = new DataTransfer();
    const file = new File(['# Existing note'], 'notes.md', { type: 'text/markdown' });
    Object.defineProperty(file, 'webkitRelativePath', {
      configurable: true,
      value: 'workspace/notes.md'
    });
    transfer.items.add(file);
    (input as HTMLInputElement).files = transfer.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });

  const folderTree = page.getByRole('navigation', { name: 'Folder Markdown files' });
  await expect(folderTree.getByRole('button', { name: 'notes', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'New Markdown file' }).click();

  await expect(page.locator('.title-block strong')).toHaveText('Untitled');
  await expect(folderTree.getByRole('button', { name: /Untitled/i })).toHaveCount(0);
  await expect(folderTree.getByRole('button', { name: 'notes', exact: true })).toBeVisible();

  await page.waitForTimeout(450);
  await page.reload();
  await expect(page.locator('.title-block strong')).toHaveText('Untitled');
  await expect(folderTree.getByRole('button', { name: /Untitled/i })).toHaveCount(0);
  await expect(folderTree.getByRole('button', { name: 'notes', exact: true })).toBeVisible();
});

test('file actions stay fixed while long folder contents scroll', async ({ page }) => {
  await page.goto(APP_PATH);

  await page.locator('input[type="file"][multiple]').evaluate((input) => {
    const transfer = new DataTransfer();
    for (let index = 1; index <= 45; index += 1) {
      const name = `note-${String(index).padStart(2, '0')}.md`;
      const file = new File([`# Note ${index}`], name, { type: 'text/markdown' });
      Object.defineProperty(file, 'webkitRelativePath', {
        configurable: true,
        value: `workspace/${name}`
      });
      transfer.items.add(file);
    }
    (input as HTMLInputElement).files = transfer.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });

  const panel = page.locator('.file-panel');
  const scrollArea = page.locator('.file-panel__scroll');
  const newButton = panel.getByRole('button', { name: 'New Markdown file' });
  const openButton = panel.getByRole('button', { name: 'Open folder' });
  const headerTop = await panel
    .locator('.panel-header')
    .evaluate((header) => header.getBoundingClientRect().top);

  await expect
    .poll(() => scrollArea.evaluate((element) => element.scrollHeight - element.clientHeight))
    .toBeGreaterThan(0);
  await page.waitForTimeout(100);
  await scrollArea.evaluate((element) => element.scrollTo(0, element.scrollHeight));
  await expect.poll(() => scrollArea.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  await expect(newButton).toBeVisible();
  await expect(openButton).toBeVisible();
  await expect.poll(() => panel.evaluate((element) => element.scrollTop)).toBe(0);
  await expect
    .poll(() =>
      panel.locator('.panel-header').evaluate((header) => header.getBoundingClientRect().top)
    )
    .toBe(headerTop);
});

test('switching folder files preserves Edit mode', async ({ page }) => {
  test.skip(
    isCompactProject(test.info()),
    'desktop folder switching covers the shared mode behavior'
  );
  await page.goto(APP_PATH);

  await page.locator('input[type="file"][multiple]').evaluate((input) => {
    const transfer = new DataTransfer();
    for (const [name, content] of [
      ['alpha.md', '# Alpha\n\nFirst document.'],
      ['beta.md', '# Beta\n\nSecond document.']
    ]) {
      const file = new File([content], name, { type: 'text/markdown' });
      Object.defineProperty(file, 'webkitRelativePath', {
        configurable: true,
        value: `workspace/${name}`
      });
      transfer.items.add(file);
    }
    (input as HTMLInputElement).files = transfer.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });

  await expect(page.getByRole('heading', { name: 'Alpha' })).toBeVisible();
  await page.getByRole('button', { name: 'Edit Markdown' }).click();
  await page
    .getByRole('navigation', { name: 'Folder Markdown files' })
    .getByRole('button', { name: 'beta', exact: true })
    .click();

  await expect(page.locator('.cm-editor')).toBeVisible();
  await expect(page.locator('.cm-content')).toContainText('# Beta');
  await expect(page.getByRole('button', { name: 'Done editing' })).toBeVisible();
});

test('compact header keeps branding, filename, and upload control aligned', async ({ page }) => {
  test.skip(
    !isCompactProject(test.info()),
    'compact header styling is covered on tablet and mobile'
  );
  await page.goto(APP_PATH);

  await expect(page.locator('.brand-icon')).toBeVisible();
  await expect(page.locator('.app-name')).toHaveText('Markdown Viewer');
  await expect(page.locator('.title-block strong')).toHaveText('Markdown Viewer Example');
  const viewport = page.viewportSize();
  if (viewport && viewport.width <= 520) {
    await expect
      .poll(() =>
        page.locator('.header-open-button').evaluate((button) => {
          const buttonBox = button.getBoundingClientRect();
          const iconBox = button.querySelector('svg')?.getBoundingClientRect();
          if (!iconBox) return Number.POSITIVE_INFINITY;
          const buttonCenter = buttonBox.left + buttonBox.width / 2;
          const iconCenter = iconBox.left + iconBox.width / 2;
          return Math.abs(buttonCenter - iconCenter);
        })
      )
      .toBeLessThan(1);

    await page.getByRole('button', { name: 'Edit Markdown' }).click();
    await expect
      .poll(() =>
        page.evaluate(() => {
          const title = document.querySelector('.header-title-area')?.getBoundingClientRect();
          const actions = document.querySelector('.header-actions')?.getBoundingClientRect();
          return title && actions ? actions.top - title.bottom : -1;
        })
      )
      .toBeGreaterThan(0);
    await page.getByRole('button', { name: 'Show live preview beside editor' }).click();
    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)
      )
      .toBe(true);
  }
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1))
    .toBe(true);
});

test('persists sidebar and contents visibility preferences', async ({ page }) => {
  test.skip(
    isCompactProject(test.info()),
    'desktop column persistence is covered in the desktop project'
  );
  await page.goto(APP_PATH);

  await expect(page.locator('.file-panel')).toBeVisible();
  await expect(page.locator('.toc-panel')).toBeVisible();
  await expect
    .poll(() => page.locator('.file-panel').evaluate((panel) => getComputedStyle(panel).position))
    .toBe('sticky');

  await page.getByRole('button', { name: 'Hide file sidebar' }).click();
  await page.getByRole('button', { name: 'Hide table of contents' }).click();
  await expect(page.locator('.file-panel')).toHaveCount(0);
  await expect(page.locator('.toc-panel')).toHaveCount(0);

  await page.reload();
  await expect(page.locator('.file-panel')).toHaveCount(0);
  await expect(page.locator('.toc-panel')).toHaveCount(0);

  await page.getByRole('button', { name: 'Show file sidebar' }).click();
  await page.getByRole('button', { name: 'Show table of contents' }).click();
  await expect(page.locator('.file-panel')).toBeVisible();
  await expect(page.locator('.toc-panel')).toBeVisible();
});

test('opens file and contents panels as drawers on compact screens', async ({ page }) => {
  test.skip(
    !isCompactProject(test.info()),
    'compact drawer behavior is covered in tablet/mobile projects'
  );
  await page.goto(APP_PATH);

  await expect(page.locator('.file-panel')).toHaveCount(0);
  await page.getByRole('button', { name: 'Show file sidebar' }).click();
  await expect(page.locator('.file-panel')).toBeVisible();
  await expect
    .poll(() => page.locator('.file-panel').evaluate((panel) => getComputedStyle(panel).position))
    .toBe('fixed');
  await page.getByRole('button', { name: 'Close Files' }).click();
  await expect(page.locator('.file-panel')).toHaveCount(0);

  await expect(page.locator('.toc-panel')).toHaveCount(0);
  await page.getByRole('button', { name: 'Show table of contents' }).click();
  await expect(page.locator('.toc-panel')).toBeVisible();
  await page.getByRole('button', { name: 'Close Contents' }).click();
  await expect(page.locator('.toc-panel')).toHaveCount(0);
});

test('keeps advanced appearance settings together and makes the header toggle predictable', async ({
  page
}) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto(APP_PATH);

  await expect(page.locator('html')).toHaveAttribute('data-theme', 'paper');
  await page.getByRole('button', { name: 'Switch to dark mode' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'slate');
  await expect(page.locator('html')).toHaveAttribute('data-appearance', 'dark');
  await page.getByRole('button', { name: 'Switch to light mode' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'paper');

  await page.getByRole('button', { name: 'More actions' }).click();
  await page.getByRole('button', { name: 'Preferences', exact: true }).click();
  const settings = page.getByRole('dialog', { name: 'Settings' });
  await expect(settings).toBeVisible();
  await expect(settings.getByRole('radio')).toHaveCount(19);
  await settings.getByRole('radio', { name: /Midnight/ }).check();
  await expect(settings).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'midnight');
  await settings.getByRole('radio', { name: /Mono/ }).check();
  await expect(page.locator('.markdown-body')).toHaveClass(/markdown-body--mono/);
  await expect(settings.getByLabel('Maximum content width')).toHaveValue('1280');
  await settings.getByLabel('Maximum content width').press('End');
  await expect(settings.getByLabel('Maximum content width')).toHaveValue('1300');
  await expect
    .poll(() => page.locator('.markdown-body').evaluate((article) => article.style.width))
    .toBe('100%');
  await settings.getByLabel('Page zoom').press('End');
  await expect
    .poll(() =>
      page.evaluate(() => {
        const stage = document.querySelector<HTMLElement>('.document-stage');
        const article = document.querySelector<HTMLElement>('.markdown-body');
        if (!stage || !article) return Number.POSITIVE_INFINITY;
        const style = getComputedStyle(stage);
        const available =
          stage.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
        return Math.abs(article.getBoundingClientRect().width - available);
      })
    )
    .toBeLessThan(4);
  await settings.getByRole('radio', { name: /Sky/ }).check();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'sky');
  await expect(page.locator('html')).toHaveAttribute('data-appearance', 'light');
  await settings.getByRole('radio', { name: /Follow system/ }).check();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'paper');
  await page.getByRole('button', { name: 'Close dialog' }).click();
});

test('keeps quick reading controls visible and persists their values', async ({ page }) => {
  await page.goto(APP_PATH);

  const controls = page.getByRole('toolbar', { name: 'Reading controls' });
  await expect(controls).toBeVisible();
  await page.getByRole('button', { name: /^Increase font size/i }).click();
  await page.getByRole('button', { name: /^Zoom in/i }).click();
  await page.getByRole('button', { name: /^Increase font weight/i }).click();
  await page.getByRole('button', { name: 'Enable high contrast' }).click();

  await expect(page.locator('.markdown-body')).toHaveCSS('font-size', '19px');
  await expect(page.locator('.markdown-body')).toHaveCSS('font-weight', '500');
  await expect(page.locator('html')).toHaveAttribute('data-contrast', 'high');
  await expect
    .poll(() => page.locator('.markdown-body').evaluate((article) => article.style.zoom))
    .toBe('1.1');

  await page.reload();
  await expect(page.getByRole('toolbar', { name: 'Reading controls' })).toBeVisible();
  await expect(page.locator('.markdown-body')).toHaveCSS('font-size', '19px');
  await expect(page.locator('.markdown-body')).toHaveCSS('font-weight', '500');
  await expect(page.locator('html')).toHaveAttribute('data-contrast', 'high');
  await expect
    .poll(() => page.locator('.markdown-body').evaluate((article) => article.style.zoom))
    .toBe('1.1');
});

test('dock sidebar controls work in reading and editing, and reset preserves the theme', async ({
  page
}) => {
  await page.goto(APP_PATH);
  await page.getByRole('button', { name: 'More actions' }).click();
  await page.getByRole('button', { name: 'Preferences', exact: true }).click();
  await page
    .getByRole('dialog', { name: 'Settings' })
    .getByRole('radio', { name: /Forest/ })
    .check();
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await page.getByRole('button', { name: /^Increase font size/ }).click();
  await page.getByRole('button', { name: /^Zoom in/ }).click();
  await page.getByRole('button', { name: 'Enable high contrast' }).click();
  await page.getByRole('button', { name: 'Reset dock controls' }).click();
  await expect(page.locator('.markdown-body')).toHaveCSS('font-size', '18px');
  await expect(page.locator('.markdown-body')).toHaveCSS('font-weight', '400');
  await expect(page.locator('html')).toHaveAttribute('data-contrast', 'normal');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'forest');

  const dock = page.getByRole('toolbar', { name: 'Reading controls' });
  const left = dock.getByRole('button').first();
  const right = dock.getByRole('button').last();
  await expect(left).toHaveAccessibleName(/file sidebar/);
  await expect(right).toHaveAccessibleName(/table of contents/);
  await left.click();
  await expect(page.locator('.file-panel')).toHaveCount(isCompactProject(test.info()) ? 1 : 0);
  if (isCompactProject(test.info())) await left.click();
  await page.getByRole('button', { name: 'Edit Markdown' }).click();
  const layout = page.getByRole('toolbar', { name: 'Sidebar controls' });
  await layout.getByRole('button', { name: 'Show file sidebar' }).click();
  await expect(page.locator('.file-panel')).toBeVisible();
});

test('edge controls appear near the pointer without disturbing the document', async ({ page }) => {
  test.skip(isCompactProject(test.info()), 'mouse-only edge affordances are tested on desktop');
  await page.goto(APP_PATH);
  const edge = page.locator('.edge-toggle--left');
  await page.mouse.move(650, 350);
  await expect(edge).toHaveCSS('opacity', '0');
  await page.mouse.move(285, 440);
  await expect(edge).toHaveCSS('opacity', '1');
  const bounds = await edge.boundingBox();
  expect(bounds).not.toBeNull();
  expect(Math.abs((bounds?.y ?? 0) + (bounds?.height ?? 0) / 2 - 440)).toBeLessThan(2);
  const workspaceTop = await page
    .locator('.workspace')
    .evaluate((workspace) => workspace.getBoundingClientRect().top);
  await page.mouse.move(285, workspaceTop + 2);
  await expect
    .poll(async () => (await edge.boundingBox())?.y ?? 0)
    .toBeGreaterThanOrEqual(workspaceTop + 23);
  await page.mouse.move(285, page.viewportSize()!.height - 2);
  await expect
    .poll(async () => {
      const box = await edge.boundingBox();
      return box ? page.viewportSize()!.height - box.y - box.height : 0;
    })
    .toBeGreaterThanOrEqual(31);
  await edge.click();
  await expect(page.locator('.file-panel')).toHaveCount(0);
  await page.mouse.move(3, 540);
  await expect(edge).toHaveCSS('opacity', '1');
  await edge.click();
  await expect(page.locator('.file-panel')).toBeVisible();
  await page.mouse.move(650, 350);
  await expect(edge).toHaveCSS('opacity', '0');
  await page.keyboard.press('Tab');
  await edge.focus();
  await expect(edge).toHaveCSS('opacity', '1');
});

test('UI updates retain rendered code, diagrams and footnote anchors', async ({ page }) => {
  await page.goto(APP_PATH);
  await page.locator('.mermaid-block svg').waitFor({ state: 'attached' });
  const code = await page.locator('.code-block code').elementHandle();
  const diagram = await page.locator('.mermaid-block svg').elementHandle();
  await page.getByRole('button', { name: /^Increase font size/ }).click();
  await page.getByRole('button', { name: /^Increase font weight/ }).click();
  await page.getByRole('button', { name: /^(Hide|Show) file sidebar$/ }).click();
  expect(await code?.evaluate((element) => element.isConnected)).toBe(true);
  expect(await diagram?.evaluate((element) => element.isConnected)).toBe(true);
  for (const selector of ['a[data-footnote-ref]', 'a[data-footnote-backref]']) {
    expect(
      await page.locator(selector).evaluate((link) => {
        const href = link.getAttribute('href') ?? '';
        return href.startsWith('#') && document.getElementById(href.slice(1)) !== null;
      })
    ).toBe(true);
  }
});

test('dock stays within a narrow viewport', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto(APP_PATH);
  const dock = page.getByRole('toolbar', { name: 'Reading controls' });
  await expect(dock).toBeVisible();
  const bounds = await dock.boundingBox();
  expect(bounds?.x).toBeGreaterThanOrEqual(0);
  expect((bounds?.x ?? 0) + (bounds?.width ?? 0)).toBeLessThanOrEqual(320);
  await expect(dock.getByRole('button').last()).toBeInViewport();
});

test('restores the last reader scroll position after reload', async ({ page }) => {
  await page.goto(APP_PATH);
  await expect(page.locator('.app')).toHaveAttribute('aria-busy', 'false');

  const stage = page.locator('.document-stage');
  await stage.evaluate((element) => element.scrollTo(0, 520));
  await expect
    .poll(() =>
      page.evaluate(() => {
        const positions = JSON.parse(
          localStorage.getItem('markdown-viewer-scroll-positions') ?? '{}'
        ) as Record<string, number>;
        return positions['example-document'] ?? 0;
      })
    )
    .toBeGreaterThan(400);

  await page.reload();
  await expect.poll(() => stage.evaluate((element) => element.scrollTop)).toBeGreaterThan(400);
});

test('restores the selected file and collapsed folder tree after reload', async ({ page }) => {
  test.skip(isCompactProject(test.info()), 'desktop folder tree persistence is covered here');
  await page.goto(APP_PATH);

  await page.locator('input[type="file"][multiple]').evaluate((input) => {
    const transfer = new DataTransfer();
    const guide = new File(['# Persisted guide\n\nFolder state.'], 'guide.md', {
      type: 'text/markdown'
    });
    Object.defineProperty(guide, 'webkitRelativePath', {
      configurable: true,
      value: 'workspace/guides/guide.md'
    });
    const notes = new File(['# Notes'], 'notes.md', { type: 'text/markdown' });
    Object.defineProperty(notes, 'webkitRelativePath', {
      configurable: true,
      value: 'workspace/notes.md'
    });
    transfer.items.add(guide);
    transfer.items.add(notes);
    (input as HTMLInputElement).files = transfer.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });

  await expect(page.getByRole('heading', { name: 'Persisted guide' })).toBeVisible();
  await page.getByRole('button', { name: 'Collapse guides' }).click();
  await expect(
    page.getByRole('navigation', { name: 'Folder Markdown files' }).getByRole('button', {
      name: 'guide.md',
      exact: true
    })
  ).toHaveCount(0);
  await page.waitForTimeout(650);

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Persisted guide' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Expand guides' })).toBeVisible();
  await expect(
    page.getByRole('navigation', { name: 'Folder Markdown files' }).getByRole('button', {
      name: 'guide.md',
      exact: true
    })
  ).toHaveCount(0);
});

test('editing shows unsaved state and restores approximate scroll', async ({ page }) => {
  await page.goto(APP_PATH);
  await expect(page.locator('.app')).toHaveAttribute('aria-busy', 'false');

  const stage = page.locator('.document-stage');
  await stage.evaluate((element) => element.scrollTo(0, 500));

  await page.getByRole('button', { name: 'Edit Markdown' }).click();
  await expect(page.locator('.cm-editor')).toBeVisible();
  await expect
    .poll(() => page.locator('.cm-scroller').evaluate((element) => element.scrollTop))
    .toBeGreaterThan(0);

  await page.locator('.cm-content').click();
  await page.keyboard.type('\n\nUnsaved edit smoke test.');
  await expect(page.locator('.reading-control--sidebar.is-dirty')).toBeVisible();

  await page.getByRole('button', { name: 'Done editing' }).click();
  await expect(page.getByRole('heading', { name: 'Markdown Viewer Example' })).toBeVisible();
  await expect.poll(() => stage.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
});

test('contents links and document search move through the reader', async ({ page }) => {
  test.skip(isCompactProject(test.info()), 'desktop reader navigation is covered here');
  await page.goto(APP_PATH);

  const stage = page.locator('.document-stage');
  await page.locator('.toc-list').getByRole('link', { name: 'Mermaid' }).click();
  await expect.poll(() => stage.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  await expect(page).toHaveURL(/#mermaid$/);

  await page.getByRole('button', { name: 'Find in document' }).click();
  await page.getByPlaceholder('Search this document').fill('Footnote');
  await page.getByRole('button', { name: 'Next match' }).click();
  await expect
    .poll(() => page.evaluate(() => window.getSelection()?.toString() ?? ''))
    .toMatch(/footnote/i);
  await expect.poll(() => stage.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);

  await page.getByPlaceholder('Search this document').fill('mode');
  await expect
    .poll(() =>
      page.evaluate(() => {
        const registry = (
          CSS as unknown as {
            highlights?: { get(name: string): { size: number } | undefined };
          }
        ).highlights;
        return registry?.get('markdown-search-match')?.size ?? 0;
      })
    )
    .toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Next match' }).click();
  await expect
    .poll(() => page.evaluate(() => window.getSelection()?.toString() ?? ''))
    .toMatch(/mode/i);
});

test('renders inline code, fenced code, and responsive tables distinctly', async ({ page }) => {
  await page.goto(APP_PATH);
  await replaceDocumentInEditor(
    page,
    [
      '# Markdown rendering smoke',
      '',
      'Inline `example` code should stay inside this sentence.',
      '',
      '```ts',
      'const value = 42;',
      '  console.log(value);',
      '```',
      '',
      '| Left | Center | Right |',
      '| :--- | :---: | ---: |',
      '| Alpha | Beta | 123 |',
      '',
      '| Long heading | Another heading |',
      '| --- | --- |',
      '| long-unbroken-token-for-table-overflow-checks-long-unbroken-token-for-table-overflow-checks | Value |'
    ].join('\n')
  );

  const inlineCode = page.locator('.markdown-body p code.inline-code');
  await expect(inlineCode).toHaveText('example');
  await expect(page.locator('.code-block')).toHaveCount(1);
  await expect(page.locator('.code-block pre')).toContainText('  console.log(value);');
  await expect(page.locator('.code-block .hljs-keyword').first()).toBeVisible();
  await expect(page.locator('.code-block .hljs-title').first()).toBeVisible();
  await expect(page.locator('.code-block').getByRole('button', { name: /Copy/ })).toBeVisible();

  const narrowTable = page.locator('.table-scroll').first();
  const article = page.locator('.markdown-body');
  await expect(narrowTable).toBeVisible();
  await expect
    .poll(async () => {
      const [tableBox, articleBox] = await Promise.all([
        narrowTable.boundingBox(),
        article.boundingBox()
      ]);
      return tableBox && articleBox ? tableBox.width < articleBox.width - 16 : false;
    })
    .toBe(true);

  const alignment = await narrowTable
    .locator('tbody td')
    .evaluateAll((cells) => cells.map((cell) => getComputedStyle(cell).textAlign));
  expect(alignment).toEqual(['left', 'center', 'right']);

  const wideTable = page.locator('.table-scroll').nth(1);
  await expect
    .poll(() => wideTable.evaluate((table) => table.scrollWidth > table.clientWidth))
    .toBe(true);
});

test('edit mode expands as side panels are hidden', async ({ page }) => {
  test.skip(
    isCompactProject(test.info()),
    'desktop edit width expansion is covered in the desktop project'
  );
  await page.goto(APP_PATH);

  await page.getByRole('button', { name: 'Edit Markdown' }).click();
  const widthWithPanels = await page
    .locator('.editor-shell')
    .evaluate((editor) => editor.getBoundingClientRect().width);

  await page.getByRole('button', { name: 'Hide file sidebar' }).click();
  await page.getByRole('button', { name: 'Hide table of contents' }).click();
  const widthWithoutPanels = await page
    .locator('.editor-shell')
    .evaluate((editor) => editor.getBoundingClientRect().width);

  expect(widthWithoutPanels).toBeGreaterThan(widthWithPanels + 320);
});

function isCompactProject(testInfo: TestInfo): boolean {
  return testInfo.project.name.includes('mobile') || testInfo.project.name.includes('tablet');
}

async function replaceDocumentInEditor(page: Page, markdown: string) {
  await page.getByRole('button', { name: 'Edit Markdown' }).click();
  await page.locator('.cm-content').click();
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A');
  await page.keyboard.press('Backspace');
  await page.keyboard.insertText(markdown);
  await page.getByRole('button', { name: 'Done editing' }).click();
}
