const { test, expect } = require('@playwright/test');

test('patch notes modal opens and closes', async ({ page }) => {
  await page.route('https://cdn.jsdelivr.net/**', route => route.abort());
  await page.goto('/');
  await page.getByRole('button', { name: 'パッチノート' }).click();
  await expect(page.locator('#patch-ov')).toHaveClass(/open/);
  await expect(page.locator('.patch-entry').first()).toBeVisible();
  await page.getByRole('button', { name: 'パッチノートを閉じる' }).click();
  await expect(page.locator('#patch-ov')).not.toHaveClass(/open/);
});

test('CPU game starts and accepts a batting input without page errors', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.route('https://cdn.jsdelivr.net/**', route => route.abort());
  await page.goto('/');
  await page.getByRole('button', { name: 'CPU戦' }).click();
  await page.getByRole('button', { name: '3回戦で遊ぶ' }).click();

  try {
    await page.waitForFunction(() => typeof G !== 'undefined' && G.phase === 'pitch' && batHuman(), null, { timeout: 20000 });
  } catch (error) {
    const state = await page.evaluate(() => typeof G === 'undefined' ? 'G missing' : ({ phase: G.phase, net: G.net, humanTeam: G.humanTeam, top: G.top, pitch: G.pitch, difficulty: typeof cfgCpuDifficulty === 'undefined' ? 'missing' : cfgCpuDifficulty })).catch(e => ({ evalError: e.message }));
    throw new Error(`${error.message}; pageErrors=${JSON.stringify(pageErrors)}; state=${JSON.stringify(state)}`);
  }
  await page.locator('#f').click({ position: { x: 240, y: 200 } });
  await page.waitForFunction(() => typeof G !== 'undefined' && G.phase !== 'pitch', null, { timeout: 5000 });
  await expect(page.locator('#msg')).not.toBeEmpty();
  expect(pageErrors).toEqual([]);
});

test('rules modal opens and closes', async ({ page }) => {
  await page.route('https://cdn.jsdelivr.net/**', route => route.abort());
  await page.goto('/');
  await expect(page.locator('#hint')).toHaveText('');
  await page.getByRole('button', { name: 'ルール説明' }).click();
  await expect(page.locator('#rules-ov')).toHaveClass(/open/);
  await expect(page.getByRole('heading', { name: '投球方法' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'バッティング方法' })).toBeVisible();
  await page.getByRole('button', { name: 'ルール説明を閉じる' }).click();
  await expect(page.locator('#rules-ov')).not.toHaveClass(/open/);
});

test('patch note badge stays hidden after opening and returns for an unread version', async ({ page }) => {
  await page.route('https://cdn.jsdelivr.net/**', route => route.abort());
  await page.goto('/');
  const badge = page.locator('#patch-notes-badge');
  await expect(badge).toBeVisible();
  await page.getByRole('button', { name: /パッチノート/ }).click();
  await expect(page.locator('#patch-ov')).toHaveClass(/open/);
  await expect(badge).toBeHidden();
  await page.reload();
  await expect(badge).toBeHidden();
  await page.evaluate(() => localStorage.setItem('yakyu-stadium-patch-notes-read-version', '1.0.14'));
  await page.reload();
  await expect(badge).toBeVisible();
});

test('practice detail updates on a swing but is preserved on a take', async ({ page }) => {
  await page.route('https://cdn.jsdelivr.net/**', route => route.abort());
  await page.goto('/');
  await page.evaluate(() => {
    window.later = () => {};
    window.updateHud = () => {};
    window.banner = () => {};
    window.setMsg = () => {};
    G.prac = pracStats();
    G.pitch = { type: 's', dur: 900, t0: performance.now(), t: 0, x: 110, y: 110, sg: 1 };
    G.cur = { x: 110, y: 110 };
    pracResult('1B', 0, { tier: 'solid', tier0: 'solid', angle: 0, dir: 'center', course: 'mid' });
  });
  const detail = page.locator('#hint');
  await expect(detail).toContainText('ヒット');
  const previous = await detail.textContent();
  await page.evaluate(() => pracResult('look', null, null));
  await expect(detail).toHaveText(previous);
});

test('practice batter side can be chosen on the practice screen', async ({ page }) => {
  await page.route('https://cdn.jsdelivr.net/**', route => route.abort());
  await page.goto('/');
  await page.getByRole('button', { name: '打撃練習' }).click();
  await page.locator('#prac-box [data-bs="left"]').click();
  await expect(page.locator('#prac-box [data-bs="left"]')).toHaveClass(/on/);
  // The choice is shared with the match setup screens
  await expect(page.locator('#setup-cpu [data-bs="left"]')).toHaveClass(/on/);
  await page.getByRole('button', { name: '練習スタート' }).click();
  await expect.poll(() => page.evaluate(() => G.batterSides[0])).toBe('left');
});
