import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
const base = 'http://127.0.0.1:4174',
  file = 'data/test-' + process.pid + '.json';
let proc, token;

async function call(route, method = 'GET', body, auth = token) {
  const res = await fetch(base + '/api' + route, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(auth ? { Authorization: 'Bearer ' + auth } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: res.status, body: await res.json() };
}
test.before(async () => {
  proc = spawn(process.execPath, ['server/demo.mjs'], {
    env: { ...process.env, PORT: '4174', DEMO_DATA_FILE: file },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let ready = false;
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(base + '/api/status')).ok) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  assert.ok(ready, '测试服务器启动成功');
  token = (await call('/demo-session', 'POST', {})).body.token;
});
test.after(async () => {
  if (proc) {
    const closed = new Promise((resolve) => proc.once('exit', resolve));
    proc.kill();
    await closed;
  }
  await fs.unlink(file).catch(() => {});
});
test('未登录无法读取日记', async () =>
  assert.equal((await call('/dreams', 'GET', null, '')).status, 401));
test('新用户不能读取或操作其他用户的梦境和图片', async () => {
  const user = await call('/auth/register', 'POST', {
    username: 'isolation_user',
    password: 'Example123!',
    confirm_password: 'Example123!',
    display_name: '隔离测试',
  });
  assert.equal(user.status, 200);
  const other = user.body.token;
  assert.equal((await call('/dreams/d1', 'GET', null, other)).status, 404);
  assert.equal((await call('/images/i0', 'GET', null, other)).status, 404);
  assert.equal((await call('/dreams/d1', 'DELETE', null, other)).status, 404);
  assert.equal((await call('/dreams', 'GET', null, other)).body.length, 0);
});
test('完整日记流程：创建、补全、确认、分析、收藏、生图与级联删除', async () => {
  const input = {
    title: '流程测试',
    original_text: '我在安静的森林中走过小桥，感觉很好奇。',
    dream_date: '2026-10-13',
    self_emotion: '好奇',
    self_intensity: 3,
  };
  const created = await call('/dreams', 'POST', input);
  assert.equal(created.status, 201);
  const id = created.body.id;
  const completion = await call('/dreams/' + id + '/complete', 'POST', { mode: 'creative' });
  assert.equal(completion.status, 200);
  assert.equal(
    (await call('/dreams/' + id + '/images', 'POST', { style: '超现实', source: 'completed' }))
      .status,
    400,
  );
  assert.equal(
    (
      await call('/dreams/' + id + '/completion', 'PATCH', {
        completed_text: completion.body.completed_text,
      })
    ).status,
    200,
  );
  const analyzed = await call('/dreams/' + id + '/analyze', 'POST', {});
  assert.equal(analyzed.body.original_text, input.original_text);
  assert.equal(analyzed.body.analysis.input_source, 'original');
  assert.equal((await call('/dreams/' + id + '/favorite', 'PATCH', {})).body.favorite, true);
  const image = await call('/dreams/' + id + '/images', 'POST', {
    style: '超现实',
    source: 'completed',
  });
  assert.equal(image.status, 201);
  assert.equal(image.body.model_name, '预置视觉示例');
  assert.equal((await call('/dreams/' + id, 'DELETE')).status, 200);
  assert.equal((await call('/images/' + image.body.id)).status, 404);
});
test('无效输入和无效补全模式返回可读错误', async () => {
  assert.equal((await call('/dreams', 'POST', { title: '' })).status, 400);
  assert.equal((await call('/dreams/d1/complete', 'POST', { mode: 'recover-memory' })).status, 400);
});
test('原文已有分析时拒绝改写，防止旧分析对应新文本', async () => {
  const d = (await call('/dreams/d1')).body;
  assert.equal(
    (await call('/dreams/d1', 'PUT', { ...d, original_text: '这是完全不同的原始记录。' })).status,
    409,
  );
});

test('确认密码不一致时拒绝注册', async () => {
  assert.equal(
    (
      await call('/auth/register', 'POST', {
        username: 'mismatch_user',
        password: 'Example123!',
        confirm_password: 'different!',
        display_name: '测试',
      })
    ).status,
    400,
  );
});
test('个人昵称保存，AI标题和现实背景可用，拒绝超长背景', async () => {
  assert.equal(
    (await call('/profile', 'PATCH', { display_name: '新昵称' })).body.display_name,
    '新昵称',
  );
  assert.equal(
    (
      await call('/dream-title', 'POST', {
        original_text: '我梦见在楼梯上不断奔跑，却找不到出口。',
      })
    ).status,
    200,
  );
  const d = {
    title: '背景测试',
    original_text: '我在楼梯上奔跑，感觉着急。',
    dream_date: '2026-10-14',
    self_emotion: '平静',
    self_intensity: 1,
    life_context: '最近正在准备考试。',
  };
  const saved = await call('/dreams', 'POST', d);
  assert.equal(saved.body.life_context, d.life_context);
  const a = await call('/dreams/' + saved.body.id + '/analyze', 'POST', {});
  assert.equal(a.body.analysis.result_json.emotions[0].name, '焦虑');
  assert.equal(a.body.analysis.result_json.life_context_snapshot, d.life_context);
  assert.equal(
    (await call('/dreams', 'POST', { ...d, life_context: 'a'.repeat(2001) })).status,
    400,
  );
  await call('/dreams/' + saved.body.id, 'DELETE');
});
