import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const out = path.resolve('test-results/screenshots');
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({
  ...(process.env.BROWSER_EXECUTABLE_PATH
    ? { executablePath: process.env.BROWSER_EXECUTABLE_PATH }
    : {}),
  headless: true,
});
const page = await browser.newPage({
  viewport: { width: 1440, height: 1080 },
  deviceScaleFactor: 1,
});
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(process.env.DREAM_BROWSER_URL || 'http://127.0.0.1:4173');
await page.getByRole('heading', { name: '留住醒来前的世界。' }).waitFor();
await page.waitForTimeout(800);
await page.screenshot({ path: path.join(out, '01-overview.png'), fullPage: true });
for (const [label, file] of [
  ['梦境日记', '02-journal'],
  ['梦境画廊', '03-gallery'],
  ['情绪洞察', '04-insights'],
  ['个人设置', '05-settings'],
]) {
  await page
    .locator('nav')
    .getByRole('button', { name: new RegExp('^' + label) })
    .click();
  await page.waitForTimeout(250);
  await page.screenshot({ path: path.join(out, file + '.png'), fullPage: true });
}
await page
  .locator('nav')
  .getByRole('button', { name: /^梦境日记/ })
  .click();
await page.getByRole('button', { name: '海面上的一扇门', exact: true }).click();
await page.screenshot({ path: path.join(out, '06-analysis.png'), fullPage: true });
await page.getByRole('button', { name: '原始记录与补全', exact: true }).click();
await page.screenshot({ path: path.join(out, '07-original.png'), fullPage: true });
await page.getByRole('button', { name: '梦境视觉创作', exact: true }).click();
await page.screenshot({ path: path.join(out, '08-visual.png'), fullPage: true });
await page.getByRole('button', { name: '记录梦境', exact: true }).click();
await page.screenshot({ path: path.join(out, '09-create-modal.png'), fullPage: true });
await page.getByPlaceholder('自己取名，或留空让AI根据片段命名').fill('浏览器流程验证');
await page
  .getByPlaceholder('地点、人物、颜色、声音，或只是某一种感受。不必完整，从你记得的部分开始。')
  .fill('我在安静的森林中走过一座桥，感觉好奇而安心。');
await page.locator('.completion-choice select').selectOption('creative');
await page
  .getByPlaceholder(
    '例如：最近在准备考试、工作任务紧张，或与某个人有未说出口的话。仅填写你愿意提供的背景。',
  )
  .fill('最近准备考试。');
await page.getByRole('button', { name: '保存梦境', exact: true }).click();
await page.getByRole('heading', { name: '浏览器流程验证', exact: true }).waitFor();
await page.getByRole('button', { name: '确认这个版本', exact: true }).waitFor();
await page.screenshot({ path: path.join(out, '10-completion.png'), fullPage: true });
await page.getByRole('button', { name: '确认这个版本', exact: true }).click();
await page.getByRole('button', { name: 'AI解读与文献', exact: true }).click();
await page.getByRole('button', { name: '开始AI深度解读', exact: true }).click();
await page.getByRole('heading', { name: '综合解读与研究依据', exact: true }).waitFor();
await page.screenshot({ path: path.join(out, '12-rich-analysis.png'), fullPage: true });
await page.getByRole('heading', { name: '可以尝试的行动', exact: true }).waitFor();
page.once('dialog', (d) => d.accept());
await page.getByRole('button', { name: '删除梦境', exact: true }).click();
await page.waitForTimeout(400);
await page.setViewportSize({ width: 390, height: 844 });
await page.getByRole('button', { name: '打开导航' }).click();
await page.locator('nav').getByRole('button', { name: '我的梦境', exact: true }).click();
await page.waitForTimeout(600);
await page.screenshot({ path: path.join(out, '11-mobile.png'), fullPage: true });
assert.equal(
  await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
  false,
  '手机页面无横向溢出',
);
const broken = await page
  .locator('img')
  .evaluateAll((imgs) => imgs.filter((i) => !i.complete || !i.naturalWidth).map((i) => i.src));
assert.deepEqual(broken, [], '图片加载成功');
assert.deepEqual(errors, [], '无浏览器脚本错误');
await page.setViewportSize({ width: 1440, height: 1080 });
await page.getByRole('button', { name: '退出登录', exact: true }).click();
await page.getByRole('button', { name: '还没有账号？创建一个', exact: true }).click();
await page.getByLabel('昵称', { exact: true }).fill('注册测试');
await page.getByLabel('用户名', { exact: true }).fill('browser_' + Date.now());
await page.getByLabel('密码', { exact: true }).fill('BrowserTest123!');
await page.getByLabel('确认密码', { exact: true }).fill('WrongPassword123');
await page.getByRole('button', { name: '显示密码', exact: true }).click();
assert.equal(await page.getByLabel('密码', { exact: true }).getAttribute('type'), 'text');
await page.getByRole('button', { name: '创建账号', exact: true }).click();
await page.getByText('两次输入的密码不一致', { exact: true }).waitFor();
await page.getByLabel('确认密码', { exact: true }).fill('BrowserTest123!');
await page.screenshot({ path: path.join(out, '13-register.png'), fullPage: true });
await page.getByRole('button', { name: '创建账号', exact: true }).click();
await page.getByRole('heading', { name: '留住醒来前的世界。' }).waitFor();
await page.locator('nav').getByRole('button', { name: '个人设置', exact: true }).click();
await page.getByLabel('昵称', { exact: true }).fill('修改后的昵称');
await page.getByRole('button', { name: '保存昵称', exact: true }).click();
await page.waitForFunction(() =>
  document.querySelector('.profile')?.textContent.includes('修改后的昵称'),
);
const dl = page.waitForEvent('download');
await page.getByRole('button', { name: '导出个人记录（JSON）', exact: true }).click();
await dl;
await page.getByRole('button', { name: '记录梦境', exact: true }).click();
await page
  .getByPlaceholder('地点、人物、颜色、声音，或只是某一种感受。不必完整，从你记得的部分开始。')
  .fill('我在安静的海边看见月光，感觉好奇。');
await page.getByRole('button', { name: 'AI取名', exact: true }).click();
await page.waitForFunction(() => !!document.querySelector('.title-input input')?.value);
await fs.writeFile(
  path.join(out, 'browser-results.json'),
  JSON.stringify(
    {
      passed: true,
      checks: [
        '确认密码与密码可见',
        '昵称修改',
        'JSON导出',
        'AI命名',
        '现实背景',
        '丰富分析模块',
        '五个主要页面',
        '梦境创建',
        '可选补全',
        '用户确认',
        '原文分析',
        '删除',
        '390px手机布局',
        '无脚本错误',
        '图片加载',
      ],
      errors,
    },
    null,
    2,
  ),
);
await browser.close();
console.log('Browser workflow and responsive checks passed.');
