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

test('opens preferences and updates reading controls', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto(APP_PATH);

  await page.getByRole('button', { name: 'More actions' }).click();
  await expect(page.getByRole('button', { name: 'Preferences' })).toBeVisible();
  await page.mouse.click(16, 220);
  await expect(page.getByRole('button', { name: 'Preferences' })).toHaveCount(0);

  await page.getByRole('button', { name: 'More actions' }).click();
  await page.getByRole('button', { name: 'Preferences' }).click();

  await expect(page.getByRole('heading', { name: 'Reading Preferences' })).toBeVisible();
  await expect(page.getByLabel('Color theme')).toBeVisible();
  await expect(page.getByLabel('Content width')).toHaveValue('1280');
  await page.getByLabel('Color theme').selectOption('sky');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'sky');
  await page.getByLabel('Reading font').selectOption('mono');
  await expect(page.locator('.markdown-body')).toHaveClass(/markdown-body--mono/);
  await page.getByRole('button', { name: 'Close dialog' }).click();

  await page.getByRole('button', { name: /Sky theme override/i }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.getByRole('button', { name: /Theme follows system/i }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'sky');
});

test('editing shows unsaved state and restores approximate scroll', async ({ page }) => {
  await page.goto(APP_PATH);

  const stage = page.locator('.document-stage');
  await stage.evaluate((element) => element.scrollTo(0, 500));

  await page.getByRole('button', { name: 'Edit Markdown' }).click();
  await expect(page.locator('.cm-editor')).toBeVisible();
  await expect
    .poll(() => page.locator('.cm-scroller').evaluate((element) => element.scrollTop))
    .toBeGreaterThan(0);

  await page.locator('.cm-content').click();
  await page.keyboard.type('\n\nUnsaved edit smoke test.');
  await expect(page.locator('.edge-toggle--left.is-dirty')).toBeVisible();

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

test('theme controls support light and dark mode', async ({ page }) => {
  test.skip(
    isCompactProject(test.info()),
    'desktop theme control is covered in the desktop project'
  );
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto(APP_PATH);

  await page.getByRole('button', { name: /Theme follows system/i }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

  await page.getByRole('button', { name: 'More actions' }).click();
  await page.getByRole('button', { name: 'Preferences' }).click();
  await expect(page.getByRole('heading', { name: 'Reading Preferences' })).toBeVisible();
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
