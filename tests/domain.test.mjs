import test from 'node:test';
import assert from 'node:assert/strict';
import {
  hashPassword,
  verifyPassword,
  validateDream,
  imageSource,
  validateAnalysis,
} from '../server/domain.mjs';
const valid = {
  title: '月光',
  original_text: '我在安静的海边看见一扇门',
  dream_date: '2026-10-13',
  self_emotion: '平静',
  self_intensity: 3,
};
test('密码以不同随机盐存储，错误密码不能通过验证', () => {
  const a = hashPassword('Example123'),
    b = hashPassword('Example123');
  assert.notEqual(a, b);
  assert.equal(verifyPassword('Example123', a), true);
  assert.equal(verifyPassword('wrong', a), false);
});
test('梦境日期、长度、情绪与强度边界严格校验', () => {
  assert.equal(validateDream(valid).self_intensity, 3);
  for (const patch of [
    { dream_date: '2026-02-30' },
    { self_intensity: 6 },
    { original_text: '太短' },
    { self_emotion: '随意输入' },
  ])
    assert.throws(() => validateDream({ ...valid, ...patch }));
});
test('补全文本未经确认不能用于生图，原始文本始终可用', () => {
  const d = { ...valid, completed_text: '新增创作', completion_confirmed: false };
  assert.throws(() => imageSource(d, 'completed'));
  assert.equal(imageSource(d, 'original'), valid.original_text);
  assert.equal(imageSource({ ...d, completion_confirmed: true }, 'completed'), '新增创作');
});
test('模型编造的文献编号从引用结果中剔除', () => {
  const result = validateAnalysis(
    {
      summary: '示例',
      emotions: [{ name: '平静', strength: 99, evidence: '安静' }],
      interpretations: [{ text: '可能解释', reference_ids: ['MED:1', 'FAKE:2'] }],
    },
    [{ source_id: 'MED:1' }],
  );
  assert.deepEqual(result.interpretations[0].reference_ids, ['MED:1']);
  assert.equal(result.emotions[0].strength, 5);
});
