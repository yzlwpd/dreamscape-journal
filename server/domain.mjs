import { scryptSync, randomBytes, timingSafeEqual } from 'node:crypto';
export const emotionNames = ['平静', '喜悦', '好奇', '焦虑', '悲伤', '恐惧'];

// 场景引文必须按原文顺序出现，情绪证据必须属于对应场景。

export function validateSceneEmotions(raw, original) {
  if (!Array.isArray(raw) || typeof original !== 'string') return [];
  const result = [];
  let cursor = 0;
  for (const item of raw.slice(0, 6)) {
    if (
      !item ||
      typeof item.evidence !== 'string' ||
      !item.evidence.trim() ||
      item.evidence.length > 1000
    )
      continue;
    const index = original.indexOf(item.evidence, cursor);
    if (index < 0) continue;
    const emotions = (Array.isArray(item.emotions) ? item.emotions : [])
      .filter(
        (e) =>
          e &&
          emotionNames.includes(e.name) &&
          typeof e.evidence === 'string' &&
          e.evidence.trim() &&
          item.evidence.includes(e.evidence),
      )
      .map((e) => ({
        name: e.name,
        strength: Math.max(1, Math.min(5, Math.round(Number(e.strength)) || 1)),
        evidence: e.evidence.slice(0, 600),
      }));
    if (!emotions.length) continue;
    result.push({
      label: String(item.label || '梦境片段').slice(0, 80),
      evidence: item.evidence,
      emotions: emotions
        .filter((e, i, a) => a.findIndex((x) => x.name === e.name) === i)
        .slice(0, 6),
    });
    cursor = index + item.evidence.length;
  }
  return result;
}

// 密码使用随机盐派生后保存；校验时比较派生结果。

export function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  return salt + ':' + scryptSync(password, salt, 64).toString('hex');
}

export function verifyPassword(password, hash) {
  try {
    const [salt, key] = hash.split(':');
    const a = Buffer.from(key, 'hex'),
      b = scryptSync(password, salt, 64);
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

// 校验表单并返回允许写入数据库的字段。

export function validateDream(body) {
  if (typeof body.title !== 'string' || !body.title.trim() || body.title.length > 120)
    throw Error('标题需要1—120个字符');
  if (
    typeof body.original_text !== 'string' ||
    body.original_text.trim().length < 8 ||
    body.original_text.length > 6000
  )
    throw Error('请记录8—6000个字符的梦境片段');
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(body.dream_date || '') ||
    Number.isNaN(Date.parse(body.dream_date)) ||
    new Date(body.dream_date).toISOString().slice(0, 10) !== body.dream_date
  )
    throw Error('请选择有效日期');
  if (!emotionNames.includes(body.self_emotion)) throw Error('请选择有效的醒后感受');
  if (
    !Number.isInteger(Number(body.self_intensity)) ||
    Number(body.self_intensity) < 1 ||
    Number(body.self_intensity) > 5
  )
    throw Error('情绪强度需要在1—5之间');
  if (
    body.life_context != null &&
    (typeof body.life_context !== 'string' || body.life_context.length > 2000)
  )
    throw Error('现实背景最多2000个字符');
  return {
    life_context: (body.life_context || '').trim(),
    title: body.title.trim(),
    original_text: body.original_text.trim(),
    dream_date: body.dream_date,
    self_emotion: body.self_emotion,
    self_intensity: Number(body.self_intensity),
  };
}

// 约束模型输出结构，剔除不属于本次检索的引用编号。

export function validateAnalysis(raw, refs) {
  if (
    !raw ||
    typeof raw !== 'object' ||
    !Array.isArray(raw.emotions) ||
    !Array.isArray(raw.interpretations)
  )
    throw Error('模型返回的分析格式不完整，请重试');
  const allowed = new Set(refs.map((r) => r.source_id));
  const text = (v, max = 1500) => String(v || '').slice(0, max);
  const citations = (v) => (Array.isArray(v) ? v.filter((id) => allowed.has(id)) : []);
  const items = (v, limit) => (Array.isArray(v) ? v.slice(0, limit) : []);
  const emotions = raw.emotions
    .filter((e) => emotionNames.includes(e.name) && typeof e.evidence === 'string')
    .map((e) => ({
      name: e.name,
      strength: Math.max(1, Math.min(5, Math.round(Number(e.strength)) || 1)),
      evidence: e.evidence.slice(0, 600),
    }));
  if (!emotions.length) throw Error('模型未返回有效情绪');
  return {
    symbols: items(raw.symbols, 6).map((x) => ({
      symbol: text(x.symbol, 100),
      evidence: text(x.evidence, 600),
      possible_meaning: text(x.possible_meaning),
      alternative: text(x.alternative),
      reference_ids: citations(x.reference_ids),
    })),
    life_connections: items(raw.life_connections, 4).map((x) => ({
      text: text(x.text),
      context_evidence: text(x.context_evidence, 600),
      reference_ids: citations(x.reference_ids),
    })),
    suggestions: items(raw.suggestions, 5).map((x) => ({
      title: text(x.title, 100),
      action: text(x.action),
      reason: text(x.reason),
      reference_ids: citations(x.reference_ids),
    })),
    self_comparison: text(raw.self_comparison, 1000),
    summary: String(raw.summary || '').slice(0, 1500),
    themes: Array.isArray(raw.themes) ? raw.themes.map(String).slice(0, 8) : [],
    emotions,
    interpretations: raw.interpretations
      .map((x) => ({
        text: String(x.text || '').slice(0, 1500),
        reference_ids: Array.isArray(x.reference_ids)
          ? x.reference_ids.filter((id) => allowed.has(id))
          : [],
      }))
      .slice(0, 5),
    reflection_questions: Array.isArray(raw.reflection_questions)
      ? raw.reflection_questions.map(String).slice(0, 4)
      : [],
    image_prompt: String(raw.image_prompt || '').slice(0, 1800),
    limitations: '情绪强度为模型对文本的估计，并非心理量表分数；解读供个人反思参考。',
  };
}

// 未确认的补全草稿不能作为生图来源。

export function imageSource(dream, source) {
  if (source === 'completed') {
    if (!dream.completion_confirmed || !dream.completed_text) throw Error('请先预览并确认补全版本');
    return dream.completed_text;
  }
  if (source !== 'original') throw Error('请选择原始或已确认的补全版本');
  return dream.original_text;
}
