import { hashPassword } from './domain.mjs';
const uid = 'demo-user';
const inputs = [
  [
    'd1',
    '海面上的一扇门',
    '2026-10-12',
    '平静',
    '我站在一片安静的海面上，月亮很大。远处有一扇发着暖光的门，石阶从水中慢慢升起。我想走过去，但并不着急，醒来后还有一点温柔的期待。',
    3,
    'moon',
  ],
  [
    'd2',
    '没有终点的楼梯',
    '2026-10-10',
    '焦虑',
    '我在旧教学楼里不断向上走，楼梯像没有尽头。手里拿着一张考试通知，时间快到了，却一直找不到教室。我感觉着急，醒来后心跳还有些快。',
    4,
    'stairs',
  ],
  [
    'd3',
    '会发光的森林',
    '2026-10-08',
    '好奇',
    '梦里我走进一片森林，树叶发着淡淡的光。小鹿从树后探出头，带我走过一座小桥。我觉得很好奇，也很安心，想看看桥的另一边。',
    3,
    'forest',
  ],
  [
    'd4',
    '雨中的最后一班车',
    '2026-10-06',
    '悲伤',
    '车站下着雨，我站在站台上，看见熟悉的人坐在远去的车里。想说的话没有说出口。站台灯是暖黄色的，我感觉有些难过，最后慢慢平静下来。',
    3,
    'rain',
  ],
];
const summaries = [
  '海面、月光和远处的门构成了一段安静的探索叙事。原文明确表达了温柔的期待。',
  '叙事中反复出现赶时间和寻找目标的情节，用户直接描述了着急的体验。',
  '发光的森林和小鹿带来探索感，原文同时表达了好奇与安心。',
  '离别场景与没有说出口的话并存，情绪从难过逐渐转向平静。',
];
export const seed = {
  users: [
    {
      id: uid,
      username: 'demo',
      password_hash: hashPassword('Dream2026!'),
      display_name: '梦境体验者',
      created_at: '2026-10-13 09:00:00',
    },
  ],
  dreams: [],
  analyses: [],
  analysis_references: [],
  generated_images: [],
};
inputs.forEach(([id, title, date, emotion, text, intensity, art], i) => {
  seed.dreams.push({
    id,
    user_id: uid,
    title,
    original_text: text,
    dream_date: date,
    self_emotion: emotion,
    self_intensity: intensity,
    completion_mode: 'none',
    completed_text: null,
    completion_confirmed: false,
    favorite: i === 0,
    created_at: date + ' 08:00:00',
    updated_at: date + ' 08:00:00',
  });
  seed.analyses.push({
    id: 'a' + i,
    dream_id: id,
    model_name: '预置示例',
    input_source: 'original',
    created_at: date + ' 08:01:00',
    result_json: {
      summary: summaries[i],
      themes:
        i === 0
          ? ['探索', '期待', '平静']
          : i === 1
            ? ['时间压力', '寻找目标']
            : i === 2
              ? ['探索', '自然', '安心']
              : ['离别', '表达', '情绪变化'],
      emotions: [{ name: emotion, strength: intensity, evidence: text.slice(-26) }],
      interpretations: [
        {
          text: '这段梦境可以作为回顾近期感受的起点。具体意义需要结合你自己的生活经历；单个意象并没有固定、唯一的解释。',
          reference_ids: [],
        },
      ],
      reflection_questions: [
        '最近是否有与你梦中感受相似的经历？',
        '这段梦里，哪一个细节对你最有意义？',
      ],
      image_prompt: text,
      limitations: '这是预置演示内容，不是实时模型分析。',
      retrieval_note: '示例体验未调用文献接口，未提供个体解读的文献证据。',
    },
  });
  seed.generated_images.push({
    id: 'i' + i,
    dream_id: id,
    analysis_id: 'a' + i,
    style: '超现实',
    prompt: text,
    source_version: 'original',
    task_id: null,
    status: 'SUCCEEDED',
    local_url: '/assets/' + art + '.webp',
    error_message: null,
    model_name: '项目视觉示例',
    created_at: date + ' 08:02:00',
  });
});

const sceneSamples = [
  [
    {
      label: '月光海面',
      evidence: '我站在一片安静的海面上，月亮很大。',
      emotions: [{ name: '平静', strength: 2, evidence: '安静的海面' }],
    },
    {
      label: '暖光的门',
      evidence: '远处有一扇发着暖光的门，石阶从水中慢慢升起。',
      emotions: [{ name: '好奇', strength: 3, evidence: '石阶从水中慢慢升起' }],
    },
    {
      label: '慢慢靠近',
      evidence: '我想走过去，但并不着急',
      emotions: [{ name: '平静', strength: 3, evidence: '并不着急' }],
    },
  ],
  [
    {
      label: '反复向上',
      evidence: '我在旧教学楼里不断向上走，楼梯像没有尽头。',
      emotions: [{ name: '焦虑', strength: 3, evidence: '楼梯像没有尽头' }],
    },
    {
      label: '寻找教室',
      evidence: '手里拿着一张考试通知，时间快到了，却一直找不到教室。',
      emotions: [{ name: '焦虑', strength: 4, evidence: '一直找不到教室' }],
    },
  ],
  [
    {
      label: '发光森林',
      evidence: '梦里我走进一片森林，树叶发着淡淡的光。',
      emotions: [{ name: '好奇', strength: 2, evidence: '树叶发着淡淡的光' }],
    },
    {
      label: '跟随小鹿',
      evidence: '小鹿从树后探出头，带我走过一座小桥。',
      emotions: [{ name: '好奇', strength: 3, evidence: '带我走过一座小桥' }],
    },
    {
      label: '桥的另一边',
      evidence: '我觉得很好奇，也很安心，想看看桥的另一边。',
      emotions: [
        { name: '好奇', strength: 3, evidence: '很好奇' },
        { name: '平静', strength: 3, evidence: '很安心' },
      ],
    },
  ],
  [
    {
      label: '雨中车站',
      evidence: '车站下着雨，我站在站台上，看见熟悉的人坐在远去的车里。',
      emotions: [{ name: '悲伤', strength: 2, evidence: '熟悉的人坐在远去的车里' }],
    },
    {
      label: '没有说出口',
      evidence: '想说的话没有说出口。',
      emotions: [{ name: '悲伤', strength: 3, evidence: '想说的话没有说出口' }],
    },
    {
      label: '慢慢平静',
      evidence: '站台灯是暖黄色的，我感觉有些难过，最后慢慢平静下来。',
      emotions: [
        { name: '悲伤', strength: 3, evidence: '有些难过' },
        { name: '平静', strength: 2, evidence: '慢慢平静下来' },
      ],
    },
  ],
];
seed.analyses.forEach((a, i) => {
  a.result_json.scene_emotions = sceneSamples[i];
  if (i === 0) a.result_json.emotions.push({ name: '好奇', strength: 3, evidence: '我想走过去' });
  if (i === 2) a.result_json.emotions.push({ name: '平静', strength: 3, evidence: '很安心' });
  if (i === 3) a.result_json.emotions.push({ name: '平静', strength: 2, evidence: '慢慢平静下来' });
});

export function demoAnalysis(dream) {
  const terms = [
    ['焦虑', ['着急', '考试', '赶', '找不到']],
    ['喜悦', ['开心', '快乐', '笑']],
    ['恐惧', ['害怕', '追赶', '恐怖']],
    ['悲伤', ['难过', '离开', '离别']],
    ['好奇', ['好奇', '探索']],
    ['平静', ['安心', '平静', '安静']],
  ];
  const hits = terms
    .map(([name, words]) => ({ name, word: words.find((w) => dream.original_text.includes(w)) }))
    .filter((x) => x.word);
  const sceneEvidence = dream.original_text.slice(0, 1000);
  return {
    scene_emotions: [
      {
        label: '记录中的片段 · 示例',
        evidence: sceneEvidence,
        emotions: (hits.length
          ? hits
          : [{ name: dream.self_emotion, word: sceneEvidence.slice(0, 12) }]
        )
          .filter((h) => sceneEvidence.includes(h.word))
          .map((h) => ({ name: h.name, strength: 3, evidence: h.word })),
      },
    ],
    summary: '根据记录中的情绪词整理这段梦境。示例模式使用关键词规则，真实AI分析需配置密钥。',
    themes: ['梦境记录', '个人反思'],
    emotions: (hits.length
      ? hits
      : [{ name: dream.self_emotion, word: dream.original_text.slice(0, 12) }]
    ).map((h) => ({ name: h.name, strength: 3, evidence: h.word })),
    interpretations: [
      {
        text: '可以结合醒后的感受回顾这段梦境。示例模式不提供心理学文献支持的个体解读。',
        reference_ids: [],
      },
    ],
    symbols: [
      {
        symbol: '片段中的场景',
        evidence: dream.original_text.slice(0, 20),
        possible_meaning: '示例展示：正式模式会结合具体情节讨论多种理解方向。',
        alternative: '画面也可能来自近期见闻，不一定有特殊寓意。',
        reference_ids: [],
      },
    ],
    life_context_snapshot: dream.life_context || '',
    life_connections: dream.life_context
      ? [
          {
            text: '示例展示：真实AI会核对这段背景与梦境的联系。',
            context_evidence: dream.life_context,
            reference_ids: [],
          },
        ]
      : [],
    self_comparison: '梦中情绪来自文本规则，与醒后自评分别记录。',
    suggestions: [
      {
        title: '记录关键细节',
        action: '写下醒来后最清晰的一个场景，以及它让你想到的近期经历。',
        reason: '这是演示建议，正式分析会针对梦境内容生成。',
        reference_ids: [],
      },
    ],
    reflection_questions: ['醒来后最清晰的感受是什么？', '你最想保留梦境中的哪个画面？'],
    image_prompt: dream.original_text,
    limitations: '示例模式关键词结果，并非真实大模型分析。',
    retrieval_note: '示例体验未调用文献检索。',
  };
}
