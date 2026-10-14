<script setup>
import { ref, computed } from 'vue';
import {
  Moon,
  Sparkles,
  ArrowUpRight,
  Quote,
  BookOpen,
  Layers,
  CalendarDays,
} from 'lucide-vue-next';
import {
  emotionOrder,
  emotionPalette,
  dreamEmotions,
  filterDreams,
  emotionFrequency,
  recurringThemes,
} from './insights.js';

// 只读取已保存的分析结果，点击记录时通知父页面打开详情。
const props = defineProps({ dreams: { type: Array, default: () => [] }, demo: Boolean });
const emit = defineEmits(['open']);
const period = ref('all'),
  chosenId = ref(''),
  chosenEmotion = ref(''),
  themeName = ref('');
const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Shanghai' });

// 时间范围、当前梦境和跨梦境统计。
const visible = computed(() => filterDreams(props.dreams, period.value, today));
const analyzed = computed(() => visible.value.filter((d) => d.analysis));
const focused = computed(
  () =>
    visible.value.find((d) => d.id === chosenId.value) ||
    analyzed.value[0] ||
    visible.value[0] ||
    null,
);
const entries = computed(() => dreamEmotions(focused.value));
const activeEmotion = computed(
  () =>
    entries.value.find((e) => e.name === chosenEmotion.value) ||
    [...entries.value].sort((a, b) => b.strength - a.strength)[0] ||
    null,
);
const frequency = computed(() => emotionFrequency(analyzed.value));
const leaders = computed(() => {
  const maximum = Math.max(...frequency.value.map((e) => e.count), 0);
  return maximum
    ? frequency.value
        .filter((e) => e.count === maximum)
        .map((e) => e.name)
        .join(' · ')
    : '等待分析';
});
const repeated = computed(() => recurringThemes(analyzed.value));
const selectedTheme = computed(
  () => repeated.value.find((t) => t.name === themeName.value) || repeated.value[0] || null,
);
const history = computed(() => analyzed.value.slice(0, 12).reverse());
const scenes = computed(() => focused.value?.analysis?.result_json?.scene_emotions || []);

// 情绪节点的位置固定，大小不表示百分比。
const nodes = [
  { x: 75, y: 90 },
  { x: 225, y: 45 },
  { x: 375, y: 90 },
  { x: 375, y: 235 },
  { x: 225, y: 280 },
  { x: 75, y: 235 },
];

function emotion(name, d = focused.value) {
  return dreamEmotions(d).find((e) => e.name === name);
}

function focus(d, name = '') {
  chosenId.value = d.id;
  chosenEmotion.value = name;
  document
    .querySelector('.emotion-portrait')
    ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function go(d) {
  emit('open', d);
}
</script>

<template>
  <div class="emotional-insights">
    <section class="insight-intro"
      ><div
        ><span class="eyebrow">A MAP OF YOUR INNER NIGHT</span><h1>情绪洞察</h1
        ><p>看见一个梦里的不同感受，也回看它们怎样出现在你的记录中。</p></div
      ><div class="period-switch" role="group" aria-label="选择洞察时间范围"
        ><button
          v-for="[value, label] in [
            ['7', '近7天'],
            ['30', '近30天'],
            ['all', '全部记录'],
          ]"
          :class="{ active: period === value }"
          @click="period = value"
          >{{ label }}</button
        ></div
      ></section
    >
    <section class="insight-metrics"
      ><article
        ><span class="metric-icon"><BookOpen :size="20" /></span
        ><div
          ><small>已分析梦境</small
          ><strong
            >{{ analyzed.length }}<em> / {{ visible.length }} 篇</em></strong
          ></div
        ></article
      ><article
        ><span class="metric-icon"><Layers :size="20" /></span
        ><div
          ><small>经常出现的情绪 · 按篇数</small
          ><strong class="metric-text">{{ leaders }}</strong></div
        ></article
      ><article
        ><span class="metric-icon"><Sparkles :size="20" /></span
        ><div
          ><small>最新已分析梦境的情绪组合</small
          ><strong class="metric-text">{{
            dreamEmotions(analyzed[0])
              .map((e) => e.name)
              .join(' · ') || '暂无分析'
          }}</strong></div
        ></article
      ></section
    >
    <div v-if="!visible.length" class="paper insight-empty"
      ><Moon :size="34" /><h2>这里还没有梦境足迹</h2
      ><p>这个时间范围内没有记录。可以切换范围，或先记下一个梦。</p></div
    >
    <template v-else>
      <div class="portrait-layout">
        <section class="paper emotion-portrait"
          ><div class="section-heading"
            ><div><span class="eyebrow">ONE DREAM, MANY FEELINGS</span><h2>单篇情绪画像</h2></div
            ><span class="quiet-tag">{{ demo ? '示例分析' : 'AI原文分析' }}</span></div
          ><label class="dream-selector"
            >选择一个梦<select
              :value="focused?.id"
              aria-label="选择情绪画像梦境"
              @change="
                chosenId = $event.target.value;
                chosenEmotion = '';
              "
              ><option value="" disabled>默认显示最近已分析梦境</option
              ><option v-for="d in visible" :key="d.id" :value="d.id"
                >{{ d.dream_date }} · {{ d.title }}{{ d.analysis ? '' : ' · 尚未分析' }}</option
              ></select
            ></label
          >
          <template v-if="focused?.analysis"
            ><svg
              class="emotion-constellation"
              viewBox="0 0 450 345"
              role="group"
              aria-label="六种梦中情绪画像，点击情绪查看原文证据"
            >
              <circle
                cx="225"
                cy="163"
                r="104"
                fill="none"
                stroke="#dfe7dc"
                stroke-dasharray="3 9"
              />
              <circle cx="225" cy="163" r="67" fill="#f0f4eb" />
              <g transform="translate(213,132)" style="color: #5c8270"><Moon :size="24" /></g>
              <!-- prettier-ignore -->
              <text x="225" y="183" text-anchor="middle" class="orbit-center">{{ entries.length }} 种情绪线索</text>
              <g
                v-for="(name, i) in emotionOrder"
                :key="name"
                :transform="`translate(${nodes[i].x},${nodes[i].y})`"
                :class="[
                  'emotion-node',
                  { present: !!emotion(name), selected: activeEmotion?.name === name },
                ]"
                :role="emotion(name) ? 'button' : undefined"
                :tabindex="emotion(name) ? 0 : undefined"
                :aria-label="
                  emotion(name)
                    ? `${name}，强度${emotion(name).strength}级，查看依据`
                    : `${name}，未识别`
                "
                :aria-pressed="emotion(name) ? activeEmotion?.name === name : undefined"
                @click="emotion(name) && (chosenEmotion = name)"
                @keydown.enter.prevent="emotion(name) && (chosenEmotion = name)"
                @keydown.space.prevent="emotion(name) && (chosenEmotion = name)"
              >
                <circle
                  r="43"
                  :fill="emotion(name) ? emotionPalette[name] + '16' : '#f3f4ef'"
                  :stroke="activeEmotion?.name === name ? emotionPalette[name] : '#e1e7dc'"
                  :stroke-width="activeEmotion?.name === name ? 2 : 1"
                />
                <text
                  y="-4"
                  text-anchor="middle"
                  :fill="emotion(name) ? emotionPalette[name] : '#9ca797'"
                  class="orbit-name"
                >
                  {{ name }}
                </text>
                <text y="14" text-anchor="middle" fill="#84937c" class="orbit-level">
                  {{ emotion(name) ? emotion(name).strength + ' / 5' : '未识别' }}
                </text>
                <circle
                  v-for="n in 5"
                  :cx="-16 + (n - 1) * 8"
                  cy="26"
                  r="2.3"
                  :fill="
                    emotion(name) && n <= emotion(name).strength ? emotionPalette[name] : '#dce3d6'
                  "
                />
              </g>
            </svg>
            <div
              v-if="activeEmotion"
              class="emotion-evidence"
              :style="{ '--emotion-color': emotionPalette[activeEmotion.name] }"
              ><div
                ><Quote :size="17" /><strong>{{ activeEmotion.name }}的原文依据</strong
                ><span>{{ activeEmotion.strength }} / 5</span></div
              ><blockquote>“{{ activeEmotion.evidence }}”</blockquote></div
            ><p class="fine-print"
              >点击有颜色的情绪查看依据。五级强度是模型估计，不是情绪占比。</p
            > </template
          ><div v-else class="insight-empty"
            ><Sparkles :size="30" /><p>这个梦还没有分析。先打开梦境，让AI从原始片段中寻找情绪。</p
            ><button class="secondary" @click="go(focused)"
              >打开梦境分析 <ArrowUpRight :size="16" /></button
          ></div>
        </section>
        <aside class="portrait-side"
          ><section class="paper waking-contrast"
            ><span class="eyebrow">FROM DREAM TO WAKING</span><h2>梦中与醒后</h2
            ><div class="contrast-panel"
              ><small>梦中 · AI从原文识别</small
              ><div class="emotion-chip-list"
                ><span
                  v-for="e in entries"
                  :style="{
                    color: emotionPalette[e.name],
                    background: emotionPalette[e.name] + '12',
                  }"
                  >{{ e.name }} <b>{{ e.strength }}/5</b></span
                ><span v-if="!entries.length" class="muted">尚未分析</span></div
              ></div
            ><div class="contrast-divider">醒来，是另一个观察角度</div
            ><div class="contrast-panel waking"
              ><small>醒后 · 你的自评</small
              ><strong :style="{ color: emotionPalette[focused.self_emotion] }"
                >{{ focused.self_emotion }} <span>{{ focused.self_intensity }} / 5</span></strong
              ></div
            ><p v-if="focused.analysis?.result_json.self_comparison" class="comparison-copy">{{
              focused.analysis.result_json.self_comparison
            }}</p
            ><p v-else class="fine-print"
              >两种感受来自不同情境，可以不同；这里不把差异当作分析准确率。</p
            ></section
          ><section class="paper focused-dream"
            ><CalendarDays :size="17" /><small>{{ focused.dream_date }}</small
            ><h3>{{ focused.title }}</h3
            ><p>{{ focused.original_text }}</p
            ><button class="text-button" @click="go(focused)"
              >查看完整解读与文献 <ArrowUpRight :size="16" /></button></section
        ></aside>
      </div>
      <section class="paper scene-section"
        ><div class="section-heading"
          ><div
            ><span class="eyebrow">FEELINGS WITHIN THE STORY</span><h2>这个梦里的情绪变化</h2></div
          ><span class="quiet-tag">按原文场景顺序</span></div
        ><p class="muted">场景由AI划分，每一步都保留原文依据，不代表真实时间长度。</p
        ><div v-if="scenes.length" class="scene-timeline"
          ><article v-for="(scene, i) in scenes" :key="i"
            ><span class="scene-number">{{ String(i + 1).padStart(2, '0') }}</span
            ><h3>{{ scene.label }}</h3
            ><div class="emotion-chip-list"
              ><span
                v-for="e in scene.emotions"
                :style="{
                  color: emotionPalette[e.name],
                  background: emotionPalette[e.name] + '12',
                }"
                :title="e.evidence"
                >{{ e.name }} {{ e.strength }}/5</span
              ></div
            ><blockquote>“{{ scene.evidence }}”</blockquote></article
          ></div
        ><div v-else class="scene-empty"
          ><Sparkles :size="20" /><p>{{
            focused.analysis
              ? '这份分析还没有经过校验的场景情绪数据。打开梦境后点击“重新分析”获取。'
              : '先分析这个梦，再查看有原文依据的场景变化。'
          }}</p
          ><button class="text-button" @click="go(focused)"
            >打开梦境 <ArrowUpRight :size="15" /></button></div
      ></section>
      <section class="paper emotion-history"
        ><div class="section-heading"
          ><div><span class="eyebrow">TRACES ACROSS YOUR DREAMS</span><h2>梦境情绪轨迹</h2></div
          ><span class="quiet-tag">最近 {{ history.length }} 篇已分析梦境</span></div
        ><p class="muted">每行是一种情绪，每列是一篇梦。深浅和数字表示五级强度，空格表示未识别。</p
        ><div v-if="history.length" class="history-scroll"
          ><div
            class="history-matrix"
            :style="{ gridTemplateColumns: `76px repeat(${history.length}, minmax(78px,1fr))` }"
            ><div class="matrix-corner">情绪 / 梦境</div
            ><button
              v-for="d in history"
              :key="'date' + d.id"
              class="matrix-date"
              :class="{ active: focused.id === d.id }"
              :title="d.title"
              @click="focus(d)"
              ><small>{{ d.dream_date.slice(5) }}</small
              ><span>{{ d.title }}</span></button
            ><template v-for="name in emotionOrder" :key="name"
              ><div class="matrix-label" :style="{ color: emotionPalette[name] }"
                ><i :style="{ background: emotionPalette[name] }"></i>{{ name }}</div
              ><button
                v-for="d in history"
                :key="name + d.id"
                class="matrix-cell"
                :disabled="!emotion(name, d)"
                :aria-label="`${d.title}：${name}${emotion(name, d) ? '，强度' + emotion(name, d).strength + '级，查看依据' : '，未识别'}`"
                :title="emotion(name, d)?.evidence || '未识别'"
                @click="focus(d, name)"
                ><span
                  v-if="emotion(name, d)"
                  :style="{
                    background:
                      emotionPalette[name] +
                      (['', '26', '40', '66', '99', 'dd'][emotion(name, d).strength] || '66'),
                    color: emotion(name, d).strength >= 4 ? '#fff' : emotionPalette[name],
                  }"
                  >{{ emotion(name, d).strength }}</span
                ><i v-else></i></button></template></div></div
        ><div v-else class="insight-empty">当前范围内没有已分析梦境。</div
        ><p v-if="history.length" class="fine-print"
          >点击格子切换上方画像。不同日期的同一天多篇记录分别展示，不合并或补造缺失数据。</p
        ></section
      >
      <div class="insight-bottom"
        ><section class="paper frequency-section"
          ><h2>情绪出现频次</h2><p class="muted">按已分析梦境篇数统计，同一篇可包含多种情绪。</p
          ><div v-for="e in frequency" :key="e.name" class="frequency-row"
            ><span :style="{ color: emotionPalette[e.name] }">{{ e.name }}</span
            ><div
              ><i
                :style="{
                  width: (e.count / Math.max(analyzed.length, 1)) * 100 + '%',
                  background: emotionPalette[e.name],
                }"
              ></i></div
            ><strong>{{ e.count }}<small>篇</small></strong></div
          ></section
        ><section class="paper recurring-section"
          ><h2>反复出现的主题</h2><p class="muted">来自AI分析中的主题标签，至少出现在两篇梦境中。</p
          ><div v-if="repeated.length" class="theme-selector"
            ><button
              v-for="theme in repeated.slice(0, 8)"
              :key="theme.name"
              :class="{ active: selectedTheme?.name === theme.name }"
              @click="themeName = theme.name"
              >{{ theme.name }} <span>{{ theme.dreams.length }}篇</span></button
            ></div
          ><div v-if="selectedTheme" class="theme-dreams"
            ><button v-for="d in selectedTheme.dreams" :key="d.id" @click="go(d)"
              ><span
                >{{ d.title }}<small>{{ d.dream_date }}</small></span
              ><ArrowUpRight :size="16" /></button></div
          ><div v-else class="scene-empty"
            ><Layers :size="24" /><p
              >暂时没有重复主题。继续记录和分析后，才能看见跨梦境的联系。</p
            ></div
          ></section
        ></div
      >
      <p class="insight-footnote"
        >{{
          demo ? '当前展示示例分析。' : '以上展示已保存的AI分析。'
        }}洞察页不会自动发起AI调用；场景和情绪来自原始片段，补全内容不作为依据。</p
      >
    </template>
  </div>
</template>

<style scoped>
.insight-intro {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 20px;
  margin-bottom: 25px;
}
.insight-intro h1 {
  font: 600 30px/1.5 var(--serif);
  letter-spacing: 2px;
  margin: 10px 0;
  color: #30483f;
}
.insight-intro p {
  font-size: 12px;
  color: #768774;
  line-height: 1.9;
  margin: 0;
}
.period-switch {
  display: flex;
  gap: 4px;
  padding: 5px;
  border: 1px solid #e0e6db;
  background: #eef2e8;
  border-radius: 9px;
  flex-shrink: 0;
}
.period-switch button {
  background: none;
  color: #7b8b75;
  border-radius: 6px;
  font-size: 11px;
  padding: 10px 13px;
}
.period-switch button.active {
  background: #fff;
  color: #32695b;
  box-shadow: 0 2px 5px #30483210;
}
.insight-metrics {
  display: grid;
  grid-template-columns: 1fr 1.2fr 1.2fr;
  gap: 17px;
  margin-bottom: 24px;
}
.insight-metrics article {
  border: 1px solid #e1e7da;
  background: #fbfcf7;
  padding: 21px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  gap: 15px;
  min-width: 0;
}
.metric-icon {
  color: #738f70;
  background: #eef2e5;
  border-radius: 10px;
  width: 43px;
  height: 43px;
  display: grid;
  place-items: center;
  flex-shrink: 0;
}
.insight-metrics small {
  font-size: 10px;
  color: #849278;
}
.insight-metrics strong {
  display: block;
  margin-top: 9px;
  font:
    27px Georgia,
    serif;
  color: #3d6052;
}
.insight-metrics strong.metric-text {
  font: 16px/1.8 var(--serif);
  overflow-wrap: anywhere;
}
.insight-metrics em {
  font: 11px sans-serif;
  font-style: normal;
  color: #8a957e;
}
.portrait-layout {
  display: grid;
  grid-template-columns: 1.2fr 1fr;
  gap: 24px;
}
.emotion-portrait .section-heading h2,
.scene-section h2,
.emotion-history h2 {
  margin-top: 9px;
}
.dream-selector {
  font-size: 11px;
  color: #7b8b72;
  display: block;
  margin-top: 22px;
}
.dream-selector select {
  margin-top: 8px;
  font-size: 12px;
  background: #fafcf6;
}
.emotion-constellation {
  display: block;
  width: 100%;
  max-width: 480px;
  margin: 10px auto 0;
  overflow: visible;
}
.emotion-node.present {
  cursor: pointer;
}
.emotion-node:focus {
  outline: none;
}
.emotion-node:focus circle:first-child {
  stroke-width: 3;
}
.emotion-node circle:first-child {
  transition:
    fill 0.2s,
    stroke 0.2s;
}
.emotion-node.present:hover circle:first-child {
  stroke-width: 2;
}
.orbit-name {
  font-size: 15px;
  font-weight: 500;
}
.orbit-level {
  font-size: 10px;
}
.orbit-center {
  font: 13px var(--serif);
  fill: #6e8568;
}
.emotion-evidence {
  border-left: 3px solid var(--emotion-color);
  border-radius: 4px;
  padding: 14px 16px;
  background: #f3f6ee;
  margin-top: 5px;
}
.emotion-evidence > div {
  display: flex;
  align-items: center;
  gap: 9px;
  font-size: 11px;
  color: var(--emotion-color);
}
.emotion-evidence span {
  margin-left: auto;
  color: #839278;
}
.emotion-evidence blockquote {
  margin: 12px 0 0;
  font-size: 13px;
  line-height: 1.9;
  color: #586f56;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.portrait-side {
  display: flex;
  flex-direction: column;
  gap: 20px;
}
.waking-contrast h2 {
  margin-top: 12px;
}
.contrast-panel {
  background: #f0f4ea;
  border: 1px solid #e2e8d9;
  border-radius: 9px;
  padding: 18px;
  margin-top: 20px;
}
.contrast-panel > small {
  font-size: 10px;
  color: #849675;
}
.emotion-chip-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}
.emotion-chip-list > span {
  border-radius: 6px;
  padding: 7px 10px;
  font-size: 11px;
  line-height: 1.4;
}
.emotion-chip-list b {
  font-size: 9px;
  font-weight: 400;
  margin-left: 5px;
}
.contrast-divider {
  text-align: center;
  font-size: 10px;
  color: #97a18b;
  padding-top: 16px;
}
.contrast-panel.waking {
  margin-top: 16px;
  background: #faf6ec;
  border-color: #e9e3d5;
}
.contrast-panel strong {
  display: block;
  margin-top: 12px;
  font: 22px var(--serif);
}
.contrast-panel strong span {
  font: 12px sans-serif;
  margin-left: 10px;
  color: #948b76;
}
.comparison-copy {
  font-size: 12px;
  color: #6a7f61;
  line-height: 1.9;
  margin: 18px 0 0;
}
.focused-dream {
  position: relative;
  flex: 1;
}
.focused-dream > svg {
  color: #879b7b;
  vertical-align: middle;
  margin-right: 8px;
}
.focused-dream > small {
  font-size: 10px;
  color: #8a997e;
}
.focused-dream h3 {
  font: 19px/1.6 var(--serif);
  color: #3e5b49;
  margin: 14px 0 10px;
}
.focused-dream p {
  font-size: 12px;
  line-height: 2;
  color: #7e8d74;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.focused-dream .text-button {
  margin-top: 8px;
}
.scene-section,
.emotion-history {
  margin-top: 24px;
}
.scene-section > .muted,
.emotion-history > .muted {
  margin: 16px 0 20px;
}
.scene-timeline {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 16px;
}
.scene-timeline article {
  border: 1px solid #e1e8da;
  background: linear-gradient(140deg, #fbfcf6, #f0f5e9);
  border-radius: 10px;
  padding: 19px;
  position: relative;
}
.scene-number {
  font:
    21px Georgia,
    serif;
  color: #a9b594;
}
.scene-timeline h3 {
  font: 16px/1.7 var(--serif);
  color: #4f6c4c;
  margin: 13px 0 9px;
}
.scene-timeline blockquote {
  margin: 16px 0 0;
  font-size: 11px;
  line-height: 1.9;
  color: #7d8d73;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.scene-empty {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 18px 0;
  color: #869879;
  font-size: 12px;
  line-height: 1.9;
}
.scene-empty p {
  flex: 1;
  margin: 0;
}
.scene-empty .text-button {
  flex-shrink: 0;
}
.history-scroll {
  overflow: auto;
}
.history-matrix {
  display: grid;
  min-width: max-content;
  gap: 5px;
  align-items: center;
}
.matrix-corner {
  font-size: 10px;
  color: #8b9c7f;
  line-height: 1.6;
}
.matrix-date {
  background: #f4f6ee;
  color: #6d8261;
  padding: 10px 7px;
  border-radius: 5px;
  min-width: 0;
  max-width: 125px;
  justify-self: stretch;
  border: 1px solid transparent;
}
.matrix-date.active {
  border-color: #9eb69b;
  background: #eaf0e3;
}
.matrix-date small {
  display: block;
  font-size: 10px;
  margin-bottom: 5px;
}
.matrix-date span {
  display: block;
  font-size: 10px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.matrix-label {
  font-size: 11px;
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 44px;
}
.matrix-label i {
  width: 5px;
  height: 5px;
  border-radius: 50%;
}
.matrix-cell {
  height: 45px;
  display: grid;
  place-items: center;
  background: #f7f8f3;
  border-radius: 5px;
}
.matrix-cell:disabled {
  cursor: default;
  opacity: 1;
}
.matrix-cell > span {
  width: 32px;
  height: 32px;
  display: grid;
  place-items: center;
  font-size: 12px;
  border-radius: 50%;
  transition: transform 0.15s;
}
.matrix-cell:hover:not(:disabled) > span {
  transform: scale(1.13);
}
.matrix-cell > i {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: #e0e6d9;
}
.insight-bottom {
  display: grid;
  grid-template-columns: 1fr 1.2fr;
  gap: 24px;
  margin-top: 24px;
}
.frequency-section > .muted,
.recurring-section > .muted {
  margin-bottom: 23px;
}
.frequency-row {
  display: flex;
  align-items: center;
  gap: 15px;
  margin: 17px 0;
  font-size: 11px;
}
.frequency-row > span {
  width: 30px;
}
.frequency-row > div {
  flex: 1;
  height: 7px;
  border-radius: 5px;
  background: #edf1e5;
  overflow: hidden;
}
.frequency-row i {
  display: block;
  height: 100%;
  border-radius: 5px;
}
.frequency-row strong {
  width: 28px;
  color: #60765b;
  font-size: 13px;
  font-weight: 400;
}
.frequency-row strong small {
  font-size: 9px;
  margin-left: 4px;
}
.theme-selector {
  display: flex;
  gap: 9px;
  flex-wrap: wrap;
}
.theme-selector button {
  background: #f0f3e9;
  border: 1px solid #e2e7da;
  color: #768a6a;
  padding: 9px 12px;
  border-radius: 7px;
  font-size: 11px;
}
.theme-selector button.active {
  background: #e0ebd8;
  border-color: #aac3a2;
  color: #3f6d4d;
}
.theme-selector span {
  font-size: 9px;
  margin-left: 5px;
}
.theme-dreams {
  margin-top: 17px;
}
.theme-dreams button {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  text-align: left;
  padding: 13px 0;
  background: none;
  border-bottom: 1px solid #e6ebdf;
  color: #5b7952;
  font-size: 12px;
  gap: 12px;
}
.theme-dreams small {
  display: block;
  font-size: 9px;
  margin-top: 6px;
  color: #8f9d82;
}
.insight-footnote {
  font-size: 10px;
  color: #8d9b83;
  margin: 22px 0;
  line-height: 1.9;
}
.insight-empty {
  padding: 35px 20px;
  text-align: center;
  color: #839877;
  line-height: 2;
}
.insight-empty h2 {
  margin: 15px 0;
}
.insight-empty p {
  font-size: 12px;
}
.emotion-portrait .fine-print {
  margin-bottom: 0;
}
@media (max-width: 1050px) {
  .insight-metrics {
    gap: 10px;
  }
  .insight-metrics article {
    padding: 17px 13px;
    gap: 10px;
  }
  .metric-icon {
    width: 34px;
    height: 34px;
  }
  .portrait-layout {
    grid-template-columns: 1fr 1fr;
    gap: 18px;
  }
  .insight-intro {
    align-items: flex-start;
    flex-direction: column;
  }
}
@media (max-width: 700px) {
  .portrait-layout,
  .insight-bottom {
    grid-template-columns: 1fr;
  }
  .insight-metrics {
    grid-template-columns: 1fr;
  }
  .insight-metrics article {
    padding: 16px 18px;
  }
  .insight-metrics article > div {
    display: flex;
    flex: 1;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
  }
  .insight-metrics strong {
    margin: 0;
    font-size: 23px;
  }
  .insight-metrics strong.metric-text {
    font-size: 14px;
  }
  .insight-metrics small {
    font-size: 10px;
  }
  .portrait-side {
    gap: 18px;
  }
  .scene-timeline {
    grid-template-columns: 1fr;
  }
  .scene-empty {
    flex-wrap: wrap;
  }
  .scene-empty .text-button {
    margin-left: 32px;
  }
  .emotion-constellation {
    margin-top: 14px;
  }
  .insight-intro h1 {
    font-size: 25px;
  }
  .emotion-portrait .section-heading,
  .scene-section .section-heading,
  .emotion-history .section-heading {
    align-items: flex-start;
    flex-wrap: wrap;
  }
  .emotion-history .quiet-tag {
    font-size: 9px;
  }
  .insight-bottom {
    gap: 18px;
  }
  .period-switch {
    width: 100%;
  }
  .period-switch button {
    flex: 1;
  }
  .history-scroll {
    max-width: 100%;
  }
}
</style>
