import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
const out = path.resolve('test-results/screenshots'),
  base = process.env.DREAM_BROWSER_URL || 'http://127.0.0.1:4180';
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({
  ...(process.env.BROWSER_EXECUTABLE_PATH
    ? { executablePath: process.env.BROWSER_EXECUTABLE_PATH }
    : {}),
  headless: true,
});
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1080 } });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(base);
  await page.getByRole('heading', { name: '留住醒来前的世界。' }).waitFor();
  await page.screenshot({ path: path.join(out, '01-overview.png'), fullPage: true });
  await page.locator('nav').getByRole('button', { name: '情绪洞察', exact: true }).click();
  await page.getByRole('heading', { name: '单篇情绪画像', exact: true }).waitFor();
  assert.equal(await page.locator('.scene-timeline article').count(), 3);
  await page.getByRole('button', { name: '好奇，强度3级，查看依据', exact: true }).click();
  await page.locator('.emotion-evidence').getByText('好奇的原文依据', { exact: true }).waitFor();
  await page.getByLabel('选择情绪画像梦境', { exact: true }).selectOption('d4');
  assert.equal(await page.locator('.scene-timeline article').count(), 3);
  await page
    .locator('.focused-dream')
    .getByRole('heading', { name: '雨中的最后一班车', exact: true })
    .waitFor();
  await page.locator('.matrix-cell').getByText('2', { exact: true }).first().click();
  await page.waitForTimeout(600);
  await page.getByRole('button', { name: '近7天', exact: true }).click();
  assert.equal(await page.locator('.matrix-date').count(), 3);
  await page.getByRole('button', { name: '全部记录', exact: true }).click();
  assert.equal(await page.locator('.matrix-date').count(), 4);
  await page.getByLabel('选择情绪画像梦境', { exact: true }).selectOption('d1');
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: path.join(out, '14-insights-redesign.png'), fullPage: true });
  await page.screenshot({ path: path.join(out, '04-insights.png') });
  await page
    .locator('.theme-dreams')
    .getByRole('button', { name: /会发光的森林/ })
    .click();
  await page.getByRole('heading', { name: '会发光的森林', exact: true }).waitFor();
  await page.locator('nav').getByRole('button', { name: '情绪洞察', exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(400);
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: path.join(out, '15-insights-mobile.png'), fullPage: true });
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
    false,
    '情绪页手机无横向溢出，历史轨迹在自身容器滚动',
  );
  const token = await page.evaluate(() => localStorage.getItem('dream-token'));
  const data = await (
    await fetch(base + '/api/dreams', { headers: { Authorization: 'Bearer ' + token } })
  ).json();
  await page.route('**/api/dreams', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify([{ ...data[0], analysis: null }]),
    }),
  );
  await page.reload();
  await page.getByRole('button', { name: '打开导航', exact: true }).click();
  await page.locator('nav').getByRole('button', { name: '情绪洞察', exact: true }).click();
  await page
    .getByText('这个梦还没有分析。先打开梦境，让AI从原始片段中寻找情绪。', { exact: true })
    .waitFor();
  assert.equal(await page.locator('.emotion-node').count(), 0, '未分析数据不从自评生成AI画像');
  await page.unroute('**/api/dreams');
  await page.route('**/api/dreams', (route) =>
    route.fulfill({ contentType: 'application/json', body: '[]' }),
  );
  await page.reload();
  await page.getByRole('button', { name: '打开导航', exact: true }).click();
  await page.locator('nav').getByRole('button', { name: '情绪洞察', exact: true }).click();
  await page.getByRole('heading', { name: '这里还没有梦境足迹', exact: true }).waitFor();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  assert.deepEqual(errors, []);
  await fs.writeFile(
    path.join(out, 'insights-browser-results.json'),
    JSON.stringify(
      {
        passed: true,
        checks: [
          '情绪画像点击证据',
          '选择梦境',
          '场景顺序',
          '矩阵交互',
          '时间筛选',
          '重复主题跳转',
          '390px手机布局',
          '未分析及空数据状态',
          '无脚本错误',
        ],
        errors,
      },
      null,
      2,
    ),
  );
  console.log('Redesigned emotion insights browser checks passed.');
} finally {
  await browser.close();
}
