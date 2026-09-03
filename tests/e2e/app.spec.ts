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
  expect(Math.abs((bounds?.y ?? 0) + 22 - 440)).toBeLessThan(2);
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
