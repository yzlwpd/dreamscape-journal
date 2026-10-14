import test from 'node:test';
import assert from 'node:assert/strict';
import { dreamEmotions, filterDreams, emotionFrequency, recurringThemes } from '../src/insights.js';
import { validateSceneEmotions } from '../server/domain.mjs';
const dream = (id, date, emotions, themes = []) => ({
  id,
  dream_date: date,
  self_emotion: '喜悦',
  analysis: { result_json: { emotions, themes } },
});
test('情绪按梦境计数，重复标签不增加篇数，自评不代替AI结果', () => {
  const a = dream('a', '2026-10-14', [
    { name: '恐惧', strength: 4, evidence: '害怕' },
    { name: '恐惧', strength: 3, evidence: '发抖' },
    { name: '平静', strength: 2, evidence: '安静' },
  ]);
  assert.equal(dreamEmotions(a).length, 2);
  assert.equal(dreamEmotions(a).find((e) => e.name === '恐惧').strength, 4);
  const counts = emotionFrequency([a]);
  assert.equal(counts.find((e) => e.name === '恐惧').count, 1);
  assert.equal(counts.find((e) => e.name === '喜悦').count, 0);
  assert.deepEqual(dreamEmotions({ self_emotion: '喜悦' }), []);
});
test('时间筛选包含边界，同日多篇记录保留，未来日期不混入最近范围', () => {
  const ds = ['2026-10-07', '2026-10-08', '2026-10-14', '2026-10-14', '2026-10-15'].map((date, i) =>
    dream(String(i), date, []),
  );
  assert.equal(filterDreams(ds, '7', '2026-10-14').length, 3);
  assert.equal(filterDreams(ds, 'all', '2026-10-14').length, 5);
});
test('重复主题至少属于两篇不同梦境，单篇重复词不伪造规律', () => {
  const ds = [
    dream('a', '2026-10-13', [], ['探索', '探索', '考试']),
    dream('b', '2026-10-14', [], ['探索']),
  ];
  const themes = recurringThemes(ds);
  assert.equal(themes.length, 1);
  assert.equal(themes[0].name, '探索');
  assert.equal(themes[0].dreams.length, 2);
});
test('场景引文必须按原文顺序且不重叠，情绪证据必须属于该场景', () => {
  const original = '我奔跑时害怕。后来到了安静的海边。';
  const raw = [
    {
      label: '奔跑',
      evidence: '我奔跑时害怕。',
      emotions: [
        { name: '恐惧', strength: 4, evidence: '害怕' },
        { name: '悲伤', strength: 3, evidence: '哭泣' },
      ],
    },
    {
      label: '虚构',
      evidence: '我从悬崖坠落',
      emotions: [{ name: '恐惧', strength: 5, evidence: '坠落' }],
    },
    {
      label: '海边',
      evidence: '后来到了安静的海边。',
      emotions: [{ name: '平静', strength: 2, evidence: '安静' }],
    },
    {
      label: '逆序',
      evidence: '我奔跑时害怕。',
      emotions: [{ name: '恐惧', strength: 4, evidence: '害怕' }],
    },
  ];
  const scenes = validateSceneEmotions(raw, original);
  assert.equal(scenes.length, 2);
  assert.equal(scenes[0].emotions.length, 1);
  assert.equal(scenes[1].label, '海边');
  assert.deepEqual(validateSceneEmotions(null, original), []);
});
