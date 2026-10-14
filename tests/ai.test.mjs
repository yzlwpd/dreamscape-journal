import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeDream, suggestTitle } from '../server/ai.mjs';

test('深度解读使用原文和现实背景，剔除虚构证据及文献，不复制醒后自评', async () => {
  const originalFetch = globalThis.fetch,
    originalKey = process.env.DEEPSEEK_API_KEY;
  process.env.DEEPSEEK_API_KEY = 'test-key-not-real';
  const dream = {
    original_text: '我在楼梯上奔跑，找不到出口，感到害怕。',
    life_context: '最近正在准备考试。',
    self_emotion: '平静',
    self_intensity: 1,
  };
  let calls = 0;
  globalThis.fetch = async (url, options) => {
    if (String(url).includes('europepmc'))
      return {
        ok: true,
        json: async () => ({
          resultList: {
            result: [
              {
                source: 'MED',
                id: 'test-reference',
                title: 'Synthetic test fixture',
                abstractText: 'A synthetic abstract for unit testing only.',
                pubYear: '2025',
                pubTypeList: { pubType: ['Journal Article'] },
              },
            ],
          },
        }),
      };
    const body = JSON.parse(options.body);
    calls++;
    if (calls === 1)
      return {
        ok: true,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify({ keywords: ['anxiety'] }) } }],
        }),
      };
    const input = JSON.parse(body.messages[1].content);
    assert.equal(input.life_context, dream.life_context);
    assert.equal(input.original, dream.original_text);
    assert.equal(input.waking_self_report.emotion, '平静');
    const raw = {
      summary: '测试结果',
      emotions: [
        { name: '恐惧', strength: 4, evidence: '感到害怕' },
        { name: '悲伤', strength: 3, evidence: '虚构内容' },
      ],
      interpretations: [
        { text: '可能的压力线索', reference_ids: ['MED:test-reference', 'FAKE:1'] },
      ],
      symbols: [
        {
          symbol: '奔跑',
          evidence: '奔跑',
          possible_meaning: '待核对的假设',
          alternative: '近期见闻',
          reference_ids: ['FAKE:1'],
        },
        { symbol: '坠落', evidence: '从高处坠落' },
      ],
      life_connections: [
        { text: '待核对的关联', context_evidence: '准备考试' },
        { text: '虚构生活', context_evidence: '刚刚失业' },
      ],
      suggestions: [{ title: '记录', action: '记录近期压力', reason: '测试' }],
    };
    return {
      ok: true,
      json: async () => ({ choices: [{ message: { content: JSON.stringify(raw) } }] }),
    };
  };
  try {
    const { result } = await analyzeDream(dream);
    assert.deepEqual(
      result.emotions.map((e) => e.name),
      ['恐惧'],
    );
    assert.equal(result.symbols.length, 1);
    assert.deepEqual(result.symbols[0].reference_ids, []);
    assert.equal(result.life_connections.length, 1);
    assert.deepEqual(result.interpretations[0].reference_ids, ['MED:test-reference']);
    assert.equal(result.life_context_snapshot, dream.life_context);
    assert.equal(result.suggestions.length, 1);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.DEEPSEEK_API_KEY;
    else process.env.DEEPSEEK_API_KEY = originalKey;
  }
});

test('AI命名必须返回有效标题', async () => {
  const originalFetch = globalThis.fetch,
    originalKey = process.env.DEEPSEEK_API_KEY;
  process.env.DEEPSEEK_API_KEY = 'test-key-not-real';
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({ choices: [{ message: { content: '{"title":"楼梯尽头的出口"}' } }] }),
  });
  try {
    assert.equal(await suggestTitle('我在楼梯上奔跑，找不到出口。'), '楼梯尽头的出口');
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.DEEPSEEK_API_KEY;
    else process.env.DEEPSEEK_API_KEY = originalKey;
  }
});
