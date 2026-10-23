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
