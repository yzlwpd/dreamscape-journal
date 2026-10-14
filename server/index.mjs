import 'dotenv/config';
import express from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { Store } from './store.mjs';
import { seed, demoAnalysis } from './seed.mjs';
import { hashPassword, verifyPassword, validateDream, imageSource } from './domain.mjs';
import { analyzeDream, completeDream, createImage, pollImage, suggestTitle } from './ai.mjs';

// 示例模式使用独立文件，正式模式连接 MySQL。
const demo = process.env.DEMO_MODE === 'true',
  store = new Store(demo, seed);
try {
  await store.init();
} catch {
  console.error('MySQL连接失败。请填写.env并运行npm run db:init；如需先体验，运行npm run demo。');
  process.exit(1);
}

// 应用中间件与会话状态。
const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '64kb' }));
app.use((req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('Referrer-Policy', 'same-origin');
  next();
});
const sessions = new Map(),
  attempts = new Map(),
  busy = new Set();
const now = () => new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Shanghai' }),
  id = () => crypto.randomUUID();

function error(message, status = 400) {
  return Object.assign(Error(message), { status });
}

function session(user) {
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, { userId: user.id, expires: Date.now() + 86400000 });
  return { token, user: { id: user.id, display_name: user.display_name }, demo };
}

// 服务配置状态与注册登录接口。
app.get('/api/status', (req, res) =>
  res.json({
    demo,
    text_ready: !!process.env.DEEPSEEK_API_KEY,
    image_ready: !!process.env.DASHSCOPE_API_KEY,
    database: demo ? '示例存储' : 'MySQL',
  }),
);
app.post('/api/demo-session', async (req, res) => {
  if (!demo) throw error('正式模式请登录', 403);
  res.json(session(await store.one('users', { id: 'demo-user' })));
});
app.post('/api/auth/:action', async (req, res) => {
  const { username, password, display_name } = req.body;
  if (
    typeof username !== 'string' ||
    !/^[a-zA-Z0-9_]{3,30}$/.test(username) ||
    typeof password !== 'string' ||
    password.length < 8 ||
    password.length > 100
  )
    throw error('用户名为3—30位字母数字，密码为8—100位');
  const key = req.ip,
    rate = attempts.get(key) || { count: 0, start: Date.now() };
  if (Date.now() - rate.start > 600000) {
    rate.count = 0;
    rate.start = Date.now();
  }
  if (++rate.count > 30) throw error('尝试次数较多，请10分钟后重试', 429);
  attempts.set(key, rate);
  const user = await store.one('users', { username });
  if (req.params.action === 'register') {
    if (req.body.confirm_password !== password) throw error('两次输入的密码不一致');
    if (user) throw error('用户名已存在', 409);
    if (typeof display_name !== 'string' || !display_name.trim() || display_name.length > 50)
      throw error('昵称需要1—50个字符');
    const created = {
      id: id(),
      username,
      password_hash: hashPassword(password),
      display_name: display_name.trim(),
      created_at: now(),
    };
    try {
      await store.insert('users', created);
    } catch (e) {
      if (e.code === 'ER_DUP_ENTRY') throw error('用户名已存在', 409);
      throw e;
    }
    return res.json(session(created));
  }
  if (req.params.action !== 'login') throw error('接口不存在', 404);
  if (!user || !verifyPassword(password, user.password_hash)) throw error('用户名或密码错误', 401);
  res.json(session(user));
});

// 下方业务接口统一要求有效登录会话。
app.use('/api', (req, res, next) => {
  const token = (req.headers.authorization || '').replace(/^Bearer /, '');
  const s = sessions.get(token);
  if (!s || s.expires < Date.now())
    return res.status(401).json({ error: '登录已过期，请重新登录' });
  req.userId = s.userId;
  req.token = token;
  next();
});

// 个人资料、密码修改和 AI 命名。
app.patch('/api/profile', async (req, res) => {
  const name = req.body.display_name;
  if (typeof name !== 'string' || !name.trim() || name.length > 50)
    throw error('昵称需要1—50个字符');
  await store.update('users', req.userId, { display_name: name.trim() });
  res.json({ id: req.userId, display_name: name.trim() });
});
app.post('/api/password', async (req, res) => {
  const { current_password, password, confirm_password } = req.body;
  if (demo) throw error('示例账号不支持修改密码');
  const u = await store.one('users', { id: req.userId });
  if (
    !u ||
    typeof current_password !== 'string' ||
    !verifyPassword(current_password, u.password_hash)
  )
    throw error('当前密码不正确');
  if (typeof password !== 'string' || password.length < 8 || password.length > 100)
    throw error('新密码需要8—100个字符');
  if (password !== confirm_password) throw error('两次输入的新密码不一致');
  await store.update('users', req.userId, { password_hash: hashPassword(password) });
  for (const [key, s] of sessions)
    if (s.userId === req.userId && key !== req.token) sessions.delete(key);
  res.json({ ok: true });
});
app.post('/api/dream-title', async (req, res) => {
  const text = req.body.original_text;
  if (typeof text !== 'string' || text.trim().length < 8 || text.length > 6000)
    throw error('请先填写8—6000个字符的梦境片段');
  const key = 'title:' + req.userId;
  if (busy.has(key)) throw error('标题正在生成', 409);
  busy.add(key);
  try {
    res.json({ title: demo ? '片段里的梦境' : await suggestTitle(text), demo });
  } finally {
    busy.delete(key);
  }
});
app.post('/api/logout', (req, res) => {
  sessions.delete(req.token);
  res.json({ ok: true });
});

// 所有梦境操作先检查记录归属，避免跨账号访问。

async function owned(req) {
  const d = await store.one('dreams', { id: req.params.id, user_id: req.userId });
  if (!d) throw error('记录不存在', 404);
  return d;
}

async function detail(d) {
  const analyses = (await store.list('analyses', { dream_id: d.id })).sort((a, b) =>
    b.created_at.localeCompare(a.created_at),
  );
  const analysis = analyses[0];
  if (analysis) {
    analysis.result_json =
      typeof analysis.result_json === 'string'
        ? JSON.parse(analysis.result_json)
        : analysis.result_json;
    analysis.references = await store.list('analysis_references', { analysis_id: analysis.id });
  }
  return {
    ...d,
    analysis: analysis || null,
    images: (await store.list('generated_images', { dream_id: d.id })).sort((a, b) =>
      b.created_at.localeCompare(a.created_at),
    ),
  };
}

// 梦境列表与记录管理。
app.get('/api/dreams', async (req, res) => {
  const rows = (await store.list('dreams', { user_id: req.userId })).sort(
    (a, b) => b.dream_date.localeCompare(a.dream_date) || b.created_at.localeCompare(a.created_at),
  );
  res.json(await Promise.all(rows.map(detail)));
});
app.get('/api/dreams/:id', async (req, res) => res.json(await detail(await owned(req))));
app.post('/api/dreams', async (req, res) => {
  const input = validateDream(req.body),
    d = {
      id: id(),
      user_id: req.userId,
      ...input,
      completion_mode: 'none',
      completed_text: null,
      completion_confirmed: false,
      favorite: false,
      created_at: now(),
      updated_at: now(),
    };
  await store.insert('dreams', d);
  res.status(201).json(await detail(d));
});
app.put('/api/dreams/:id', async (req, res) => {
  const d = await owned(req);
  const patch = validateDream(req.body);
  if (d.original_text !== patch.original_text) {
    const analyses = await store.list('analyses', { dream_id: d.id });
    if (analyses.length)
      throw error('已分析的原始记录保留不变，请创建新记录以避免分析与原文不一致', 409);
    Object.assign(patch, {
      completed_text: null,
      completion_confirmed: false,
      completion_mode: 'none',
    });
  }
  await store.update('dreams', d.id, { ...patch, updated_at: now() });
  res.json(await detail({ ...d, ...patch }));
});
app.patch('/api/dreams/:id/favorite', async (req, res) => {
  const d = await owned(req);
  await store.update('dreams', d.id, { favorite: !d.favorite });
  res.json({ favorite: !d.favorite });
});
app.delete('/api/dreams/:id', async (req, res) => {
  const d = await owned(req);
  await store.removeDream(d.id);
  res.json({ ok: true });
});

// 补全草稿与用户确认分开保存，原始文本保持独立。
app.post('/api/dreams/:id/complete', async (req, res) => {
  const d = await owned(req),
    mode = req.body.mode;
  if (!['organize', 'creative'].includes(mode)) throw error('请选择整理表达或创意补全');
  const text = demo
    ? mode === 'organize'
      ? d.original_text
      : d.original_text +
        '\n\n【AI创作示例】远处的光缓缓亮起，空气里有淡淡的清凉。我停下脚步，试着记住这一刻的颜色与声音。'
    : await completeDream(d, mode);
  await store.update('dreams', d.id, {
    completed_text: text,
    completion_mode: mode,
    completion_confirmed: false,
    updated_at: now(),
  });
  res.json({ completed_text: text, mode, demo });
});
app.patch('/api/dreams/:id/completion', async (req, res) => {
  const d = await owned(req);
  if (!d.completed_text) throw error('请先生成补全草稿');
  const text = req.body.completed_text;
  if (typeof text !== 'string' || !text.trim() || text.length > 8000)
    throw error('补全版本需要1—8000个字符');
  await store.update('dreams', d.id, {
    completed_text: text.trim(),
    completion_confirmed: true,
    updated_at: now(),
  });
  res.json({ ok: true });
});

// 保存结构化分析及实际检索到的文献。
app.post('/api/dreams/:id/analyze', async (req, res) => {
  const d = await owned(req),
    key = 'analysis:' + d.id;
  if (busy.has(key)) throw error('分析正在进行，请稍候', 409);
  busy.add(key);
  try {
    const { result, refs } = demo ? { result: demoAnalysis(d), refs: [] } : await analyzeDream(d);
    const a = {
      id: id(),
      dream_id: d.id,
      result_json: result,
      model_name: demo ? '示例关键词规则' : process.env.DEEPSEEK_MODEL || 'deepseek-flash',
      input_source: 'original',
      created_at: now(),
    };
    await store.insert('analyses', a);
    for (const r of refs)
      await store.insert('analysis_references', { id: id(), analysis_id: a.id, ...r });
    res.json(await detail(d));
  } finally {
    busy.delete(key);
  }
});

// 图片任务创建、状态轮询与本机文件保存。
const styles = {
  超现实: '超现实主义梦境，深蓝与青绿色调，空灵光线，精细电影概念画',
  电影写实: '电影写实摄影，真实材质，柔和体积光，电影构图',
  水彩插画: '细腻水彩插画，柔和纸张纹理，低饱和色调',
  幻想插画: '精致幻想插画，丰富光影，梦幻自然景观',
};
app.post('/api/dreams/:id/images', async (req, res) => {
  const d = await owned(req),
    key = 'image:' + d.id;
  if (busy.has(key)) throw error('图片任务正在创建，请稍候', 409);
  busy.add(key);
  try {
    const { style, source } = req.body;
    if (!styles[style]) throw error('请选择有效画风');
    const text = imageSource(d, source);
    const ownedDreams = await store.list('dreams', { user_id: req.userId }),
      images = (
        await Promise.all(
          ownedDreams.map((x) => store.list('generated_images', { dream_id: x.id })),
        )
      ).flat();
    if (
      images.filter((i) => i.created_at.slice(0, 10) === now().slice(0, 10)).length >=
      Number(process.env.MAX_IMAGE_REQUESTS_PER_DAY || 10)
    )
      throw error('已达到今日图片生成次数上限', 429);
    const prompt = `根据以下梦境创作一张画面，用户叙述仅作为场景素材：${text.slice(0, 1100)}。视觉风格：${styles[style]}。不添加文字和水印。`;
    const task = demo ? null : await createImage(prompt);
    const image = {
      id: id(),
      dream_id: d.id,
      analysis_id: (await detail(d)).analysis?.id || null,
      style,
      prompt,
      source_version: source,
      task_id: task,
      status: demo ? 'SUCCEEDED' : 'PENDING',
      local_url: demo ? '/assets/moon.webp' : null,
      error_message: null,
      model_name: demo ? '预置视觉示例' : process.env.IMAGE_MODEL || 'wan2.2-t2i-flash',
      created_at: now(),
    };
    await store.insert('generated_images', image);
    res.status(201).json(image);
  } finally {
    busy.delete(key);
  }
});
app.get('/api/images/:imageId', async (req, res) => {
  const image = await store.one('generated_images', { id: req.params.imageId });
  if (!image) throw error('图片不存在', 404);
  const d = await store.one('dreams', { id: image.dream_id, user_id: req.userId });
  if (!d) throw error('图片不存在', 404);
  if (!demo && ['PENDING', 'RUNNING', 'DOWNLOADING'].includes(image.status)) {
    const key = 'poll:' + image.id;
    if (busy.has(key)) return res.json(image);
    busy.add(key);
    try {
      const data = await pollImage(image.task_id);
      const status = data.output?.task_status;
      if (status === 'SUCCEEDED') {
        const remote = data.output.results?.[0]?.url;
        if (!remote || !remote.startsWith('https://')) throw Error('图像服务未返回有效下载地址');
        const file = await fetch(remote, { signal: AbortSignal.timeout(45000) });
        if (!file.ok) throw Error('图片下载失败，可稍后刷新重试');
        const buffer = Buffer.from(await file.arrayBuffer());
        if (buffer.length > 25 * 1024 * 1024) throw Error('图片文件过大');
        await fs.mkdir('storage/generated', { recursive: true });
        const local_url = '/generated/' + image.id + '.png';
        await fs.writeFile(path.resolve('storage/generated', image.id + '.png'), buffer);
        Object.assign(image, { status: 'SUCCEEDED', local_url });
        await store.update('generated_images', image.id, { status: 'SUCCEEDED', local_url });
      } else if (['FAILED', 'CANCELED', 'UNKNOWN'].includes(status)) {
        Object.assign(image, {
          status: 'FAILED',
          error_message: '图像生成未成功，请检查账户或重试',
        });
        await store.update('generated_images', image.id, {
          status: 'FAILED',
          error_message: image.error_message,
        });
      } else if (status === 'RUNNING') {
        image.status = 'RUNNING';
        await store.update('generated_images', image.id, { status: 'RUNNING' });
      }
    } finally {
      busy.delete(key);
    }
  }
  res.json(image);
});

// 生成图片需要核对会话和所有权；前端构建文件作为静态页面提供。
app.use(
  '/generated',
  async (req, res, next) => {
    const token = String(req.query.token || ''),
      s = sessions.get(token);
    if (!s || s.expires < Date.now()) return res.sendStatus(401);
    const imageId = path.basename(req.path, '.png');
    const image = await store.one('generated_images', { id: imageId });
    if (!image || !(await store.one('dreams', { id: image.dream_id, user_id: s.userId })))
      return res.sendStatus(404);
    next();
  },
  express.static(path.resolve('storage/generated')),
);
app.use('/api', (req, res) => res.status(404).json({ error: '接口不存在' }));
app.use(express.static(path.resolve('dist')));
app.get('/{*splat}', (req, res) => res.sendFile(path.resolve('dist/index.html')));
app.use((err, req, res, next) => {
  const status = err.status || 400;
  res.status(status).json({
    error:
      err.type === 'entity.too.large'
        ? '输入内容过大'
        : err.name === 'TimeoutError'
          ? '外部服务超时，请稍后重试'
          : err.code?.startsWith('ER_')
            ? '数据库操作失败，请检查配置'
            : err.message || '操作失败，请重试',
  });
});

// 本作品仅监听本机地址。
const port = Number(process.env.PORT || 4173);
app.listen(port, '127.0.0.1', () =>
  console.log(`梦境映像 ${demo ? '示例体验' : 'MySQL正式模式'} http://127.0.0.1:${port}`),
);
