<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import EmotionInsights from './EmotionInsights.vue';
import { emotionPalette } from './insights.js';
import {
  Moon,
  LayoutDashboard,
  BookOpen,
  Image,
  ChartNoAxesCombined,
  Settings,
  Plus,
  ArrowUpRight,
  ArrowLeft,
  ChevronRight,
  Search,
  Heart,
  Sparkles,
  Feather,
  Download,
  Trash2,
  X,
  Check,
  LoaderCircle,
  LogOut,
  Eye,
  EyeOff,
  CalendarDays,
  Quote,
  ExternalLink,
  RefreshCw,
  Menu,
} from 'lucide-vue-next';

// 导航、登录状态和梦境表单。
const nav = [
  ['overview', '我的梦境', LayoutDashboard],
  ['journal', '梦境日记', BookOpen],
  ['gallery', '梦境画廊', Image],
  ['insights', '情绪洞察', ChartNoAxesCombined],
  ['settings', '个人设置', Settings],
];
const page = ref('overview'),
  dreams = ref([]),
  selected = ref(null),
  status = ref({}),
  token = ref(localStorage.getItem('dream-token') || ''),
  user = ref(JSON.parse(localStorage.getItem('dream-user') || 'null')),
  loading = ref(true),
  message = ref(''),
  busy = ref(''),
  search = ref(''),
  filter = ref('全部'),
  modal = ref(false),
  editing = ref(null),
  completionOption = ref('none'),
  tab = ref('analysis'),
  sidebarOpen = ref(false),
  auth = ref({
    username: '',
    password: '',
    confirm_password: '',
    display_name: '',
    register: false,
  }),
  authError = ref('');
const form = ref({
    title: '',
    original_text: '',
    dream_date: new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Shanghai' }),
    self_emotion: '平静',
    self_intensity: 3,
    life_context: '',
  }),
  style = ref('超现实'),
  source = ref('original'),
  completionMode = ref('creative'),
  completionDraft = ref('');
const showPassword = ref(false),
  showConfirm = ref(false),
  profileName = ref(user.value?.display_name || ''),
  passwordForm = ref({ current_password: '', password: '', confirm_password: '' });

// 创作偏好按账号保存在当前浏览器。
const preferences = ref({ completion: 'none', style: '超现实' });

function loadPreferences() {
  try {
    preferences.value = {
      completion: 'none',
      style: '超现实',
      ...JSON.parse(localStorage.getItem('dream-preferences-' + user.value?.id) || '{}'),
    };
  } catch {
    preferences.value = { completion: 'none', style: '超现实' };
  }
  style.value = preferences.value.style;
}

function savePreferences() {
  localStorage.setItem('dream-preferences-' + user.value.id, JSON.stringify(preferences.value));
  style.value = preferences.value.style;
  toast('已保存当前浏览器的创作偏好');
}

async function saveProfile() {
  busy.value = 'profile';
  try {
    user.value = await api('/profile', 'PATCH', { display_name: profileName.value });
    localStorage.setItem('dream-user', JSON.stringify(user.value));
    toast('昵称已更新');
  } catch (e) {
    toast(e.message);
  } finally {
    busy.value = '';
  }
}

async function changePassword() {
  busy.value = 'password';
  try {
    await api('/password', 'POST', passwordForm.value);
    passwordForm.value = { current_password: '', password: '', confirm_password: '' };
    toast('密码已更新，其他登录会话已退出');
  } catch (e) {
    toast(e.message);
  } finally {
    busy.value = '';
  }
}

function exportData() {
  const blob = new Blob(
    [
      JSON.stringify(
        { exported_at: new Date().toISOString(), user: user.value, dreams: dreams.value },
        null,
        2,
      ),
    ],
    { type: 'application/json' },
  );
  const url = URL.createObjectURL(blob),
    a = document.createElement('a');
  a.href = url;
  a.download = '梦境映像-个人记录.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast('已导出梦境、分析和文献信息；图片文件请单独下载');
}

async function refreshStatus() {
  try {
    status.value = await api('/status');
    toast('服务状态已刷新，密钥有效性仍需实际调用验证');
  } catch (e) {
    toast(e.message);
  }
}

async function generateTitle() {
  busy.value = 'title';
  try {
    form.value.title = (
      await api('/dream-title', 'POST', { original_text: form.value.original_text })
    ).title;
    toast(status.value.demo ? '已填入示例标题' : 'AI标题已生成，可以继续修改');
  } catch (e) {
    toast(e.message);
  } finally {
    busy.value = '';
  }
}
let toastTimer, pollTimer;
const emotions = ['平静', '喜悦', '好奇', '焦虑', '悲伤', '恐惧'];
const colors = emotionPalette;

// 页面展示数据由已有记录计算，不在这里发起 AI 请求。
const title = computed(() => nav.find((n) => n[0] === page.value)?.[1] || '梦境详情');
const filtered = computed(() =>
  dreams.value.filter(
    (d) =>
      (!search.value || d.title.includes(search.value) || d.original_text.includes(search.value)) &&
      (filter.value === '全部' ||
        (filter.value === '已收藏' && d.favorite) ||
        d.self_emotion === filter.value),
  ),
);
const allImages = computed(() =>
  dreams.value.flatMap((d) =>
    d.images.filter((i) => i.status === 'SUCCEEDED').map((i) => ({ ...i, dream: d })),
  ),
);
const stats = computed(() => ({
  dreams: dreams.value.length,
  images: allImages.value.length,
  analyses: dreams.value.filter((d) => d.analysis).length,
  favorites: dreams.value.filter((d) => d.favorite).length,
}));
const analyzedDreams = computed(() => dreams.value.filter((d) => d.analysis));
const distribution = computed(() =>
  emotions.map((name) => ({
    name,
    count: analyzedDreams.value.filter((d) =>
      d.analysis.result_json.emotions.some((e) => e.name === name),
    ).length,
    color: colors[name],
  })),
);
const topEmotion = computed(() => [...distribution.value].sort((a, b) => b.count - a.count)[0]);

function toast(text) {
  message.value = text;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (message.value = ''), 4500);
}

// 统一处理 API 请求、会话和错误提示。

async function api(url, method = 'GET', body) {
  const r = await fetch('/api' + url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token.value ? { Authorization: 'Bearer ' + token.value } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const d = await r.json();
  if (!r.ok) {
    if (r.status === 401 && user.value) {
      token.value = '';
      user.value = null;
      localStorage.removeItem('dream-token');
      localStorage.removeItem('dream-user');
    }
    throw Error(d.error || '操作失败');
  }
  return d;
}

function setSession(data) {
  token.value = data.token;
  user.value = data.user;
  localStorage.setItem('dream-token', data.token);
  localStorage.setItem('dream-user', JSON.stringify(data.user));
  profileName.value = data.user.display_name;
  loadPreferences();
}

async function refresh() {
  dreams.value = await api('/dreams');
  if (selected.value) selected.value = dreams.value.find((d) => d.id === selected.value.id) || null;
}

async function initialize() {
  loading.value = true;
  try {
    status.value = await api('/status');
    if (!token.value && status.value.demo) setSession(await api('/demo-session', 'POST', {}));
    if (token.value) {
      loadPreferences();
      await refresh();
    }
  } catch (e) {
    toast(e.message);
  } finally {
    loading.value = false;
  }
}

async function login() {
  authError.value = '';
  if (auth.value.register && auth.value.password !== auth.value.confirm_password) {
    authError.value = '两次输入的密码不一致';
    return;
  }
  busy.value = 'auth';
  try {
    setSession(
      await api('/auth/' + (auth.value.register ? 'register' : 'login'), 'POST', auth.value),
    );
    await refresh();
  } catch (e) {
    authError.value = e.message;
  } finally {
    busy.value = '';
  }
}

async function logout() {
  try {
    await api('/logout', 'POST', {});
  } catch {}
  token.value = '';
  user.value = null;
  localStorage.removeItem('dream-token');
  localStorage.removeItem('dream-user');
  dreams.value = [];
  selected.value = null;
  page.value = 'overview';
}

// 页面切换与梦境记录操作。

function navigate(name) {
  page.value = name;
  selected.value = null;
  sidebarOpen.value = false;
  search.value = '';
  filter.value = '全部';
  clearInterval(pollTimer);
}

function openDream(d) {
  selected.value = d;
  completionDraft.value = d.completed_text || '';
  page.value = 'detail';
  tab.value = 'analysis';
  source.value = 'original';
  style.value = preferences.value.style;
  clearInterval(pollTimer);
  if (d.images.some((i) => ['PENDING', 'RUNNING'].includes(i.status))) startPolling();
}

function newDream() {
  editing.value = null;
  form.value = {
    title: '',
    original_text: '',
    dream_date: new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Shanghai' }),
    self_emotion: '平静',
    self_intensity: 3,
    life_context: '',
  };
  completionOption.value = editing.value ? 'none' : preferences.value.completion;
  modal.value = true;
}

function editDream() {
  editing.value = selected.value.id;
  form.value = {
    title: selected.value.title,
    original_text: selected.value.original_text,
    dream_date: selected.value.dream_date,
    self_emotion: selected.value.self_emotion,
    self_intensity: selected.value.self_intensity,
    life_context: selected.value.life_context || '',
  };
  completionOption.value = editing.value ? 'none' : preferences.value.completion;
  modal.value = true;
}

async function saveDream() {
  busy.value = 'save';
  try {
    if (!form.value.title.trim())
      form.value.title = (
        await api('/dream-title', 'POST', { original_text: form.value.original_text })
      ).title;
    const d = await api(
      editing.value ? '/dreams/' + editing.value : '/dreams',
      editing.value ? 'PUT' : 'POST',
      form.value,
    );
    modal.value = false;
    await refresh();
    openDream(d);
    toast('梦境已保存');
    if (!editing.value && completionOption.value !== 'none') {
      completionMode.value = completionOption.value;
      await generateCompletion();
    }
  } catch (e) {
    toast(e.message);
  } finally {
    busy.value = '';
  }
}

async function favorite(d) {
  try {
    await api('/dreams/' + d.id + '/favorite', 'PATCH', {});
    await refresh();
  } catch (e) {
    toast(e.message);
  }
}

async function remove() {
  if (!confirm('删除这条梦境及其分析、文献和图片记录？')) return;
  try {
    await api('/dreams/' + selected.value.id, 'DELETE');
    navigate('journal');
    await refresh();
    toast('梦境已删除');
  } catch (e) {
    toast(e.message);
  }
}

// AI 分析、补全与生图均由用户主动触发。

async function analyze() {
  busy.value = 'analysis';
  try {
    await api('/dreams/' + selected.value.id + '/analyze', 'POST', {});
    await refresh();
    toast(status.value.demo ? '示例分析已完成' : '梦境分析已完成');
  } catch (e) {
    toast(e.message);
  } finally {
    busy.value = '';
  }
}

async function generateCompletion() {
  busy.value = 'completion';
  try {
    const d = await api('/dreams/' + selected.value.id + '/complete', 'POST', {
      mode: completionMode.value,
    });
    await refresh();
    completionDraft.value = d.completed_text;
    tab.value = 'original';
    toast('草稿已生成，请预览并确认');
  } catch (e) {
    toast(e.message);
  } finally {
    busy.value = '';
  }
}

async function confirmCompletion() {
  busy.value = 'confirm';
  try {
    await api('/dreams/' + selected.value.id + '/completion', 'PATCH', {
      completed_text: completionDraft.value,
    });
    await refresh();
    toast('补全版本已确认，可用于图像创作');
  } catch (e) {
    toast(e.message);
  } finally {
    busy.value = '';
  }
}

async function generate() {
  busy.value = 'image';
  try {
    await api('/dreams/' + selected.value.id + '/images', 'POST', {
      style: style.value,
      source: source.value,
    });
    await refresh();
    toast(status.value.demo ? '已展示预置视觉示例' : '图片任务已提交');
    if (!status.value.demo) startPolling();
  } catch (e) {
    toast(e.message);
  } finally {
    busy.value = '';
  }
}

// 只轮询尚未完成的图片任务，离开页面时清理定时器。

function startPolling() {
  clearInterval(pollTimer);
  pollTimer = setInterval(async () => {
    if (!selected.value) return;
    const pending = selected.value.images.filter((i) => ['PENDING', 'RUNNING'].includes(i.status));
    if (!pending.length) return clearInterval(pollTimer);
    try {
      for (const i of pending) await api('/images/' + i.id);
      await refresh();
    } catch (e) {
      toast(e.message);
    }
  }, 5000);
}

function imgUrl(image) {
  return image.local_url?.startsWith('/generated/')
    ? image.local_url + '?token=' + encodeURIComponent(token.value)
    : image.local_url;
}

async function download(image) {
  try {
    const r = await fetch(imgUrl(image));
    if (!r.ok) throw Error('图片下载失败');
    const blob = await r.blob(),
      url = URL.createObjectURL(blob),
      a = document.createElement('a');
    a.href = url;
    a.download = '梦境映像-' + image.id + '.png';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (e) {
    toast(e.message);
  }
}

function dateLabel(d) {
  return d.slice(5).replace('-', ' / ');
}

function cover(d) {
  return d.images.find((i) => i.status === 'SUCCEEDED')?.local_url || '/assets/moon.webp';
}

function coverUrl(d) {
  const i = d.images.find((i) => i.status === 'SUCCEEDED');
  return i ? imgUrl(i) : '/assets/moon.webp';
}

function cited(refId) {
  return selected.value.analysis.references.find((r) => r.source_id === refId);
}
onMounted(initialize);
onUnmounted(() => {
  clearInterval(pollTimer);
  clearTimeout(toastTimer);
});
</script>

<template>
  <div v-if="loading" class="loading-screen"><Moon :size="32" /><p>正在打开你的梦境世界…</p></div>
  <div v-else-if="!user" class="auth-screen"
    ><div class="auth-art"
      ><div class="auth-brand"><Moon /> 梦境映像</div><h1>有些世界，<br />只在梦里相遇。</h1
      ><p>记下片刻，留住情绪，重新看见你的梦。</p></div
    ><form class="auth-form" @submit.prevent="login"
      ><span class="eyebrow">DREAMSCAPE JOURNAL</span
      ><h2>{{ auth.register ? '开始记录你的梦' : '欢迎回到梦境映像' }}</h2
      ><p>你的梦境日记，属于你自己的空间。</p
      ><label v-if="auth.register"
        >昵称<input
          v-model="auth.display_name"
          required
          maxlength="50"
          autocomplete="nickname" /></label
      ><label
        >用户名<input
          v-model="auth.username"
          required
          pattern="[a-zA-Z0-9_]{3,30}"
          placeholder="3—30位字母、数字或下划线"
          autocomplete="username" /></label
      ><label
        >密码<span class="password-field"
          ><input
            v-model="auth.password"
            required
            :type="showPassword ? 'text' : 'password'"
            minlength="8"
            maxlength="100"
            placeholder="至少8个字符"
            :autocomplete="auth.register ? 'new-password' : 'current-password'" /><button
            type="button"
            class="icon-button password-eye"
            :aria-label="showPassword ? '隐藏密码' : '显示密码'"
            :aria-pressed="showPassword"
            @click="showPassword = !showPassword"
            ><EyeOff v-if="showPassword" :size="18" /><Eye
              v-else
              :size="18" /></button></span></label
      ><label v-if="auth.register"
        >确认密码<span class="password-field"
          ><input
            v-model="auth.confirm_password"
            required
            :type="showConfirm ? 'text' : 'password'"
            minlength="8"
            maxlength="100"
            placeholder="再次输入密码"
            autocomplete="new-password" /><button
            type="button"
            class="icon-button password-eye"
            :aria-label="showConfirm ? '隐藏确认密码' : '显示确认密码'"
            :aria-pressed="showConfirm"
            @click="showConfirm = !showConfirm"
            ><EyeOff v-if="showConfirm" :size="18" /><Eye
              v-else
              :size="18" /></button></span></label
      ><p v-if="authError" class="error">{{ authError }}</p
      ><button class="primary" :disabled="!!busy"
        ><LoaderCircle v-if="busy" class="spin" :size="17" />{{
          auth.register ? '创建账号' : '登录'
        }}</button
      ><button
        type="button"
        class="text-button"
        @click="
          auth.register = !auth.register;
          authError = '';
          showPassword = false;
          showConfirm = false;
        "
        >{{ auth.register ? '已有账号？返回登录' : '还没有账号？创建一个' }}</button
      ></form
    ></div
  >
  <div v-else class="app-shell">
    <aside :class="['sidebar', { opened: sidebarOpen }]"
      ><a class="brand" href="#" @click.prevent="navigate('overview')"
        ><span class="brand-icon"><Moon :size="23" /></span
        ><span>梦境映像<small>DREAMSCAPE</small></span></a
      ><div class="side-label">你的梦境空间</div
      ><nav
        ><button
          v-for="[key, label, Icon] in nav"
          :key="key"
          :class="{ active: page === key || (page === 'detail' && key === 'journal') }"
          @click="navigate(key)"
          ><component :is="Icon" :size="19" /><span>{{ label }}</span
          ><span v-if="key === 'journal'" class="nav-count">{{ dreams.length }}</span></button
        ></nav
      ><div class="sidebar-note"
        ><Feather :size="22" /><p>醒来后的一小段记录，<br />也是与自己的一次对话。</p
        ><span>KEEP A LITTLE OF THE NIGHT</span></div
      ><div class="profile"
        ><span class="avatar">{{ user.display_name.slice(0, 1) }}</span
        ><div
          >{{ user.display_name
          }}<small>{{ status.demo ? '示例体验空间' : '个人梦境空间' }}</small></div
        ><button class="icon-button" aria-label="退出登录" @click="logout"
          ><LogOut :size="17" /></button></div
    ></aside>
    <main
      ><header class="topbar"
        ><div
          ><button
            class="icon-button mobile-menu"
            aria-label="打开导航"
            @click="sidebarOpen = !sidebarOpen"
            ><Menu /></button
          ><span class="breadcrumb"
            >我的空间 <ChevronRight :size="13" /> <strong>{{ title }}</strong></span
          ></div
        ><div class="top-actions"
          ><span v-if="status.demo" class="demo-pill">示例体验</span
          ><span class="today">{{
            new Date().toLocaleDateString('zh-CN', {
              month: 'long',
              day: 'numeric',
              weekday: 'long',
            })
          }}</span
          ><button class="primary compact" @click="newDream"
            ><Plus :size="17" />记录梦境</button
          ></div
        ></header
      >
      <div class="page-content">
        <template v-if="page === 'overview'">
          <div class="page-heading"
            ><div
              ><span class="eyebrow">A MOMENT BEFORE THE DAY</span
              ><h1>留住醒来前的世界<span class="heading-dot">。</span></h1
              ><p>从一个片段开始，让梦里的画面与感受有迹可循。</p></div
            ><span class="small-moon"><Moon :size="28" /></span
          ></div>
          <section class="hero"
            ><div class="hero-copy"
              ><span class="hero-tag"><span></span>让每一个梦，都有一处归所</span
              ><h2>梦里的门，<br />通往怎样的自己？</h2
              ><p>记录零散片段，探索情绪线索，<br />把只存在于梦中的风景变成画面。</p
              ><button class="cream-button" @click="newDream"
                ><Feather :size="18" />记下昨夜的梦<ArrowUpRight :size="17" /></button></div
            ><div class="hero-caption"
              ><span>THE WORLD WITHIN</span><small>梦境视觉示例 · 月光与海面</small></div
            ></section
          >
          <section class="stats-row"
            ><div
              ><span class="stat-icon"><BookOpen :size="20" /></span
              ><div
                ><small>已记录梦境</small><strong>{{ stats.dreams }}<em>篇</em></strong></div
              ></div
            ><div
              ><span class="stat-icon"><Sparkles :size="20" /></span
              ><div
                ><small>已有分析</small><strong>{{ stats.analyses }}<em>篇</em></strong></div
              ></div
            ><div
              ><span class="stat-icon"><Image :size="20" /></span
              ><div
                ><small>梦境画面</small><strong>{{ stats.images }}<em>张</em></strong></div
              ></div
            ><div
              ><span class="stat-icon"><Heart :size="20" /></span
              ><div
                ><small>珍藏的梦</small><strong>{{ stats.favorites }}<em>篇</em></strong></div
              ></div
            ></section
          >
          <div class="overview-bottom"
            ><section
              ><div class="section-heading"
                ><h2>最近的梦境 <small>RECENT DREAMS</small></h2
                ><button class="text-button" @click="navigate('journal')"
                  >全部日记 <ArrowUpRight :size="16" /></button></div
              ><div class="recent-list"
                ><button
                  v-for="d in dreams.slice(0, 3)"
                  :key="d.id"
                  class="recent-item"
                  @click="openDream(d)"
                  ><img :src="coverUrl(d)" alt="梦境视觉示例" /><div
                    ><span class="record-date"
                      >{{ dateLabel(d.dream_date) }}
                      <span
                        class="emotion-dot"
                        :style="{ background: colors[d.self_emotion] }"
                      ></span
                      >{{ d.self_emotion }}</span
                    ><h3>{{ d.title }}</h3
                    ><p>{{ d.original_text }}</p></div
                  ><ArrowUpRight :size="19" /></button
                ><div v-if="!dreams.length" class="empty"
                  >还没有梦境记录。记下第一个片段吧。</div
                ></div
              ></section
            ><section class="emotion-card"
              ><div class="section-heading"
                ><h2>AI识别的梦中情绪</h2><ChartNoAxesCombined :size="18" /></div
              ><p class="muted">来自已分析梦境的原文线索，可包含多种情绪</p
              ><div class="mini-bars"
                ><div v-for="e in distribution" :key="e.name"
                  ><span
                    class="bar"
                    :style="{
                      height: Math.max(6, (e.count / Math.max(stats.analyses, 1)) * 130) + 'px',
                      background: e.color,
                    }"
                  ></span
                  ><small>{{ e.name }}</small></div
                ></div
              ><div class="emotion-footer"
                ><span>出现最多</span
                ><strong>{{ stats.analyses ? topEmotion.name : '等待AI分析' }}</strong
                ><button class="icon-button" aria-label="查看情绪洞察" @click="navigate('insights')"
                  ><ArrowUpRight :size="18" /></button></div></section
          ></div>
        </template>
        <template v-else-if="page === 'journal'">
          <div class="page-heading"
            ><div
              ><span class="eyebrow">FRAGMENTS OF THE NIGHT</span><h1>梦境日记</h1
              ><p>一些清晰，一些模糊。每个片段都值得被记下。</p></div
            ><button class="secondary" @click="newDream"><Plus :size="17" />新建日记</button></div
          ><div class="toolbar"
            ><div class="filters"
              ><button
                v-for="f in ['全部', '已收藏', ...emotions]"
                :class="{ active: filter === f }"
                @click="filter = f"
                >{{ f }}</button
              ></div
            ><label class="search"
              ><Search :size="17" /><input
                v-model="search"
                placeholder="寻找一个梦境…"
                aria-label="搜索梦境" /></label></div
          ><div class="dream-grid"
            ><article v-for="d in filtered" :key="d.id" class="dream-card"
              ><button class="card-image" @click="openDream(d)"
                ><img :src="coverUrl(d)" :alt="d.title + '的视觉画面'" /><span
                  class="image-label"
                  >{{ d.images.length ? '梦境画面' : '待创作画面' }}</span
                ></button
              ><button
                class="favorite"
                :class="{ saved: d.favorite }"
                :aria-label="d.favorite ? '取消收藏' : '收藏梦境'"
                @click="favorite(d)"
                ><Heart :size="18" :fill="d.favorite ? 'currentColor' : 'none'" /></button
              ><div class="card-body"
                ><span class="record-date"
                  >{{ d.dream_date
                  }}<span class="emotion-tag" :style="{ color: colors[d.self_emotion] }">{{
                    d.self_emotion
                  }}</span></span
                ><button class="card-title" @click="openDream(d)">{{ d.title }}</button
                ><p>{{ d.original_text }}</p
                ><div class="card-footer"
                  ><span>{{ d.analysis ? '已有分析' : '等待探索' }}</span
                  ><button class="text-button" @click="openDream(d)"
                    >打开梦境 <ArrowUpRight :size="15" /></button></div></div></article></div
          ><div v-if="!filtered.length" class="empty">没有符合条件的梦境记录。</div>
        </template>
        <template v-else-if="page === 'detail' && selected">
          <button class="back-button" @click="navigate('journal')"
            ><ArrowLeft :size="16" />返回梦境日记</button
          ><div class="page-heading detail-heading"
            ><div
              ><span class="eyebrow">{{ selected.dream_date }} · DREAM JOURNAL</span
              ><h1>{{ selected.title }}</h1
              ><p
                >醒后感受：{{ selected.self_emotion }} · 自评强度 {{ selected.self_intensity }} /
                5</p
              ></div
            ><div class="detail-actions"
              ><button class="secondary" @click="editDream"><Feather :size="16" />编辑</button
              ><button
                class="icon-button"
                :aria-label="selected.favorite ? '取消收藏' : '收藏梦境'"
                @click="favorite(selected)"
                ><Heart :size="21" :fill="selected.favorite ? 'currentColor' : 'none'" /></button
              ><button class="icon-button danger" aria-label="删除梦境" @click="remove"
                ><Trash2 :size="19" /></button></div
          ></div>
          <div class="detail-banner"
            ><img :src="coverUrl(selected)" :alt="selected.title" /><span>{{
              selected.images.find((i) => i.status === 'SUCCEEDED')?.model_name === '项目视觉示例'
                ? '预置梦境视觉示例'
                : '梦境视觉创作'
            }}</span></div
          ><div class="tabs"
            ><button
              v-for="[key, label, Icon] in [
                ['analysis', 'AI解读与文献', Sparkles],
                ['original', '原始记录与补全', BookOpen],
                ['visual', '梦境视觉创作', Image],
              ]"
              :class="{ active: tab === key }"
              @click="tab = key"
              ><component :is="Icon" :size="17" />{{ label }}</button
            ></div
          >
          <div v-if="tab === 'analysis'" class="detail-columns"
            ><section class="paper"
              ><div class="section-heading"
                ><h2>梦境里的情绪线索</h2
                ><button class="secondary compact" :disabled="!!busy" @click="analyze"
                  ><LoaderCircle v-if="busy === 'analysis'" class="spin" :size="16" /><Sparkles
                    v-else
                    :size="16"
                  />{{ selected.analysis ? '重新分析' : '开始AI深度解读' }}</button
                ></div
              ><p class="muted"
                >分析依据：原始梦境、你提供的现实背景与实际检索的研究摘要。醒后自评单独比较。</p
              ><template v-if="selected.analysis"
                ><p class="analysis-summary">{{ selected.analysis.result_json.summary }}</p
                ><div class="theme-tags"
                  ><span v-for="t in selected.analysis.result_json.themes">{{ t }}</span></div
                ><div v-for="e in selected.analysis.result_json.emotions" class="emotion-result"
                  ><div
                    ><strong :style="{ color: colors[e.name] }">{{ e.name }}</strong
                    ><span>文本情绪强度 {{ e.strength }} / 5</span></div
                  ><div class="strength-track"
                    ><span
                      :style="{ width: e.strength * 20 + '%', background: colors[e.name] }"
                    ></span></div
                  ><blockquote><Quote :size="15" />{{ e.evidence }}</blockquote></div
                ><div v-if="selected.analysis.result_json.self_comparison" class="analysis-note"
                  ><strong>梦中情绪与醒后感受</strong
                  ><p>{{ selected.analysis.result_json.self_comparison }}</p></div
                ><h3 class="subheading">梦境意象 · 多种理解方向</h3
                ><article v-for="s in selected.analysis.result_json.symbols" class="symbol-card"
                  ><h4>{{ s.symbol }}</h4
                  ><blockquote>“{{ s.evidence }}”</blockquote><p>{{ s.possible_meaning }}</p
                  ><p class="muted">另一种可能：{{ s.alternative }}</p
                  ><a
                    v-for="rid in s.reference_ids"
                    :href="cited(rid)?.url"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="citation"
                    >研究依据：{{ cited(rid)?.title }}</a
                  ><small v-if="!s.reference_ids.length" class="field-hint"
                    >探索性假设，未建立该意象含义的文献证据。</small
                  ></article
                ><p v-if="!selected.analysis.result_json.symbols?.length" class="muted"
                  >本次结果没有单独的意象分析，可以点击重新分析获取新版解读。</p
                ><h3 class="subheading">综合解读与研究依据</h3
                ><div
                  v-for="(item, i) in selected.analysis.result_json.interpretations"
                  class="interpretation"
                  ><span class="number">0{{ i + 1 }}</span
                  ><div
                    ><p>{{ item.text }}</p
                    ><a
                      v-for="rid in item.reference_ids"
                      v-if="item.reference_ids?.length"
                      :href="cited(rid)?.url"
                      target="_blank"
                      rel="noopener noreferrer"
                      >{{ cited(rid)?.title }} <ExternalLink :size="12" /></a></div></div
                ><h3 class="subheading">与现实生活的可能联系</h3
                ><article
                  v-for="c in selected.analysis.result_json.life_connections"
                  class="symbol-card"
                  ><blockquote>你提供的背景：“{{ c.context_evidence }}”</blockquote
                  ><p>{{ c.text }}</p
                  ><a
                    v-for="rid in c.reference_ids"
                    :href="cited(rid)?.url"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="citation"
                    >{{ cited(rid)?.title }}</a
                  ></article
                ><p v-if="!selected.analysis.result_json.life_connections?.length" class="muted"
                  >尚未形成可核对的生活关联。可通过“编辑”补充近期生活背景，再重新分析。</p
                ><h3 class="subheading">可以尝试的行动</h3
                ><article
                  v-for="(s, i) in selected.analysis.result_json.suggestions"
                  class="advice-card"
                  ><span class="number">0{{ i + 1 }}</span
                  ><div
                    ><h4>{{ s.title }}</h4
                    ><p>{{ s.action }}</p
                    ><small>{{ s.reason }}</small
                    ><a
                      v-for="rid in s.reference_ids"
                      :href="cited(rid)?.url"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="citation"
                      >{{ cited(rid)?.title }}</a
                    ></div
                  ></article
                ><p
                  v-if="
                    (selected.life_context || '') !==
                    (selected.analysis.result_json.life_context_snapshot || '')
                  "
                  class="analysis-note"
                  >现实背景已修改，请重新分析以更新关联和建议。</p
                ><p class="fine-print"
                  >{{
                    selected.analysis.result_json.limitations
                  }}
                  潜在愿望与担忧仅是待核对的理解方向，不能确定你的潜意识。</p
                ></template
              ><div v-else class="empty"
                ><Sparkles :size="26" /><p>从原始片段中探索情绪，并查看相关研究。</p></div
              ></section
            ><aside class="detail-side"
              ><section class="paper"
                ><h2>留给自己的问题</h2><p class="muted">你对梦境的理解，也很重要。</p
                ><p
                  v-for="(q, i) in selected.analysis?.result_json.reflection_questions"
                  class="reflection"
                  ><span>0{{ i + 1 }}</span
                  >{{ q }}</p
                ><p v-if="!selected.analysis" class="fine-print"
                  >完成分析后，这里会出现反思问题。</p
                ></section
              ><section class="paper references"
                ><h2>心理学文献依据</h2><p class="muted">研究支持一般观点，个人含义仍需探索。</p
                ><article v-for="r in selected.analysis?.references" class="reference-item"
                  ><a :href="r.url" target="_blank" rel="noopener noreferrer"
                    ><span>{{ r.publication_year }} · {{ r.source_id }}</span
                    ><strong>{{ r.title }}</strong
                    ><small>{{ r.authors }}</small
                    ><small v-if="r.doi">DOI：{{ r.doi }}</small
                    ><ExternalLink :size="14" /></a
                  ><details
                    ><summary>查看研究摘要</summary><p>{{ r.abstract_text }}</p></details
                  ></article
                ><p v-if="!selected.analysis?.references.length" class="fine-print">{{
                  selected.analysis?.result_json.retrieval_note || '分析后展示实际检索到的文献。'
                }}</p
                ><p v-if="selected.analysis" class="model-caption"
                  >本次分析：{{ selected.analysis.model_name }}</p
                ></section
              ></aside
            ></div
          >
          <div v-else-if="tab === 'original'" class="detail-columns"
            ><section class="paper"
              ><div class="section-heading"
                ><h2>我记得的片段</h2><span class="quiet-tag">原始记录</span></div
              ><p class="original-text">{{ selected.original_text }}</p
              ><div v-if="selected.life_context" class="analysis-note"
                ><strong>近期生活背景 · 用户提供</strong><p>{{ selected.life_context }}</p></div
              ><div class="original-meta"
                ><CalendarDays :size="16" />{{ selected.dream_date
                }}<span>{{ selected.original_text.length }}字</span></div
              ></section
            ><section class="paper completion"
              ><h2>让片段慢慢连接起来</h2
              ><p class="muted">AI可以整理表达或创意补写；补全不能恢复遗忘的真实记忆。</p
              ><div class="choice-row"
                ><label
                  ><input type="radio" v-model="completionMode" value="organize" />整理表达</label
                ><label
                  ><input type="radio" v-model="completionMode" value="creative" />创意补全</label
                ></div
              ><button class="secondary" :disabled="!!busy" @click="generateCompletion"
                ><LoaderCircle v-if="busy === 'completion'" class="spin" :size="17" /><Sparkles
                  v-else
                  :size="17"
                />{{ selected.completed_text ? '重新生成草稿' : '生成补全草稿' }}</button
              ><template v-if="selected.completed_text"
                ><div class="completion-label"
                  ><span class="quiet-tag">{{
                    selected.completion_mode === 'organize' ? '整理版本' : 'AI创作草稿'
                  }}</span
                  ><span v-if="selected.completion_confirmed" class="confirmed"
                    ><Check :size="14" />已确认</span
                  ></div
                ><textarea
                  v-model="completionDraft"
                  rows="9"
                  maxlength="8000"
                  aria-label="编辑补全版本"
                ></textarea
                ><button class="primary" :disabled="!!busy" @click="confirmCompletion"
                  ><Check :size="17" />确认这个版本</button
                ><p class="fine-print"
                  >原始记录继续保留。确认后可用此版本生成图片，情绪分析仍依据原文。</p
                ></template
              ></section
            ></div
          >
          <section v-else class="paper"
            ><div class="section-heading"
              ><div
                ><h2>把梦中的风景带出来</h2
                ><p class="muted">选择画风与文本版本，创作一张属于这个梦的画面。</p></div
              ></div
            ><div class="image-controls"
              ><label
                >视觉风格<select v-model="style"
                  ><option v-for="s in ['超现实', '电影写实', '水彩插画', '幻想插画']">{{
                    s
                  }}</option></select
                ></label
              ><label
                >画面依据<select v-model="source"
                  ><option value="original">原始梦境片段</option
                  ><option value="completed" :disabled="!selected.completion_confirmed"
                    >已确认的补全版本</option
                  ></select
                ></label
              ><button class="primary" :disabled="!!busy" @click="generate"
                ><LoaderCircle v-if="busy === 'image'" class="spin" :size="17" /><Sparkles
                  v-else
                  :size="17"
                />{{ status.demo ? '查看视觉示例' : '生成梦境画面' }}</button
              ></div
            ><p v-if="status.demo" class="fine-print"
              >示例体验展示预置图片，不调用生图服务，也不产生API费用。</p
            ><div class="visual-grid"
              ><article v-for="i in selected.images" :key="i.id"
                ><img
                  v-if="i.status === 'SUCCEEDED'"
                  :src="imgUrl(i)"
                  :alt="selected.title + ' · ' + i.style"
                /><div v-else class="image-pending"
                  ><LoaderCircle v-if="i.status !== 'FAILED'" class="spin" /><p>{{
                    i.status === 'FAILED' ? i.error_message : '正在绘制梦境，请稍候…'
                  }}</p></div
                ><div
                  ><span
                    >{{ i.style }} ·
                    {{ i.source_version === 'original' ? '原始片段' : '补全版本' }}</span
                  ><button
                    v-if="i.status === 'SUCCEEDED'"
                    class="icon-button"
                    aria-label="下载图片"
                    @click="download(i)"
                    ><Download :size="17" /></button></div
                ><small>{{ i.model_name }}</small></article
              ></div
            ><div v-if="!selected.images.length" class="empty"
              >还没有画面，选择一种画风开始创作吧。</div
            ></section
          >
        </template>
        <template v-else-if="page === 'gallery'"
          ><div class="page-heading"
            ><div
              ><span class="eyebrow">LANDSCAPES FROM WITHIN</span><h1>梦境画廊</h1
              ><p>那些无法带出梦的风景，在这里有了形状。</p></div
            ><span class="gallery-total">{{ allImages.length }} 幅画面</span></div
          ><div class="gallery-grid"
            ><article v-for="i in allImages" :key="i.id"
              ><button
                @click="
                  openDream(i.dream);
                  tab = 'visual';
                "
                ><img :src="imgUrl(i)" :alt="i.dream.title" /><span class="gallery-overlay"
                  ><small>{{ i.style }}</small
                  ><strong>{{ i.dream.title }}</strong
                  ><span>{{ i.dream.dream_date }}<ArrowUpRight :size="20" /></span></span></button
              ><div class="gallery-info"
                ><span>{{ i.model_name }}</span
                ><button class="icon-button" aria-label="下载图片" @click="download(i)"
                  ><Download :size="17" /></button></div></article></div
          ><div v-if="!allImages.length" class="empty"
            >从一篇梦境日记开始，创作你的第一幅画面。</div
          ></template
        >
        <EmotionInsights
          v-else-if="page === 'insights'"
          :dreams="dreams"
          :demo="status.demo"
          @open="openDream"
        />
        <template v-else-if="page === 'settings'"
          ><div class="page-heading"
            ><div
              ><span class="eyebrow">YOUR SPACE, YOUR CHOICES</span><h1>个人设置</h1
              ><p>管理账号、创作偏好和自己的梦境记录。</p></div
            ></div
          ><div class="settings-grid"
            ><form class="paper" @submit.prevent="saveProfile"
              ><h2>个人资料</h2
              ><label>昵称<input v-model="profileName" required maxlength="50" /></label
              ><button class="primary" :disabled="!!busy">保存昵称</button></form
            ><form class="paper" @submit.prevent="savePreferences"
              ><h2>默认创作偏好</h2
              ><label
                >梦境补全<select v-model="preferences.completion"
                  ><option value="none">保留原始片段，不自动补全</option
                  ><option value="organize">整理表达</option
                  ><option value="creative">创意补全</option></select
                ></label
              ><label
                >图片画风<select v-model="preferences.style"
                  ><option v-for="s in ['超现实', '电影写实', '水彩插画', '幻想插画']">{{
                    s
                  }}</option></select
                ></label
              ><button class="primary">保存偏好</button
              ><p class="fine-print">按账号保存在当前浏览器，每次创作时仍可调整。</p></form
            ><form class="paper" @submit.prevent="changePassword"
              ><h2>修改登录密码</h2
              ><label
                >当前密码<input
                  v-model="passwordForm.current_password"
                  type="password"
                  required
                  autocomplete="current-password" /></label
              ><label
                >新密码<input
                  v-model="passwordForm.password"
                  type="password"
                  required
                  minlength="8"
                  maxlength="100"
                  autocomplete="new-password" /></label
              ><label
                >确认新密码<input
                  v-model="passwordForm.confirm_password"
                  type="password"
                  required
                  minlength="8"
                  maxlength="100"
                  autocomplete="new-password" /></label
              ><button class="primary" :disabled="!!busy || status.demo">更新密码</button
              ><p v-if="status.demo" class="fine-print">示例账号不开放密码修改。</p></form
            ><section class="paper"
              ><h2>我的数据</h2
              ><p>已记录 {{ stats.dreams }} 篇梦境，完成 {{ stats.analyses }} 篇分析。</p
              ><button class="secondary" @click="exportData"
                ><Download :size="17" />导出个人记录（JSON）</button
              ><p class="fine-print"
                >包含梦境、现实背景、分析及文献，不含登录密码或API密钥。图片文件请在画廊单独下载；导出的个人内容请自行妥善保存。</p
              ><button class="text-button" @click="logout"
                ><LogOut :size="16" />退出当前登录</button
              ></section
            ><section class="paper"
              ><div class="section-heading"
                ><h2>服务连接</h2
                ><button class="icon-button" aria-label="刷新服务状态" @click="refreshStatus"
                  ><RefreshCw :size="17" /></button></div
              ><div class="service-row"
                ><div><strong>AI命名、补全与深度解读</strong><small>DeepSeek</small></div
                ><span :class="['connection', { ready: status.text_ready }]">{{
                  status.text_ready ? '密钥已配置' : '待配置'
                }}</span></div
              ><div class="service-row"
                ><div><strong>梦境图片生成</strong><small>通义万相</small></div
                ><span :class="['connection', { ready: status.image_ready }]">{{
                  status.image_ready ? '密钥已配置' : '待配置'
                }}</span></div
              ><div class="service-row"
                ><div
                  ><strong>数据保存</strong><small>{{ status.database }}</small></div
                ><span class="connection ready">已连接</span></div
              ><p class="fine-print"
                >密钥配置不代表额度和权限可用，首次实际调用才能验证。密钥在本机.env中保存，网页不展示密钥。</p
              ><p v-if="status.demo" class="fine-print"
                >示例模式使用预置或规则内容，不调用真实AI。</p
              ></section
            ><section class="paper"
              ><h2>解读依据</h2
              ><p
                >AI分析原始片段，从情节中寻找情绪与意象，结合你主动提供的现实背景形成待核对的假设。</p
              ><p
                >详细结果与心理学文献在每篇梦境的“AI解读与文献”中；跨梦境的情绪对照在“情绪洞察”。</p
              ><p class="fine-print"
                >AI补全不作为真实记忆或心理分析证据。每次正式AI操作可能产生平台调用费用。</p
              ></section
            ></div
          ></template
        >
        <footer
          >梦境映像 <span>记录 · 探索 · 看见</span
          ><small>愿你在醒来后，也能留住一点夜色。</small></footer
        >
      </div></main
    ></div
  >
  <Transition name="toast"
    ><div v-if="message" class="toast" role="status">{{ message }}</div></Transition
  >
  <div v-if="modal" class="modal-backdrop" @click.self="modal = false"
    ><form class="modal" @submit.prevent="saveDream"
      ><div class="modal-heading"
        ><div
          ><span class="eyebrow">WRITE DOWN A DREAM</span
          ><h2>{{ editing ? '编辑梦境记录' : '昨夜，你梦见了什么？' }}</h2></div
        ><button type="button" class="icon-button" aria-label="关闭" @click="modal = false"
          ><X /></button></div
      ><label
        >给这个梦起个名字 · 可选<div class="title-input"
          ><input
            v-model="form.title"
            maxlength="120"
            placeholder="自己取名，或留空让AI根据片段命名"
          /><button
            type="button"
            class="secondary compact"
            :disabled="!!busy || form.original_text.trim().length < 8"
            @click="generateTitle"
            ><Sparkles :size="16" />{{ busy === 'title' ? '生成中…' : 'AI取名' }}</button
          ></div
        ><small class="field-hint"
          >先填写梦境片段再点击AI取名；留空保存也会生成标题。正式模式会调用DeepSeek。</small
        ></label
      ><div class="form-row"
        ><label>梦境日期<input v-model="form.dream_date" required type="date" /></label
        ><label
          >醒后的感受<select v-model="form.self_emotion"
            ><option v-for="e in emotions">{{ e }}</option></select
          ></label
        ></div
      ><label
        >你还记得的片段<textarea
          v-model="form.original_text"
          required
          minlength="8"
          maxlength="6000"
          rows="5"
          :readonly="!!editing && !!selected?.analysis"
          placeholder="地点、人物、颜色、声音，或只是某一种感受。不必完整，从你记得的部分开始。"
        ></textarea
        ><small class="field-hint"
          >{{ form.original_text.length }} / 6000
          {{ editing && selected?.analysis ? '· 已有分析，原始内容保留不变' : '' }}</small
        ></label
      ><label
        >近期现实生活背景 · 可选<textarea
          v-model="form.life_context"
          maxlength="2000"
          rows="3"
          placeholder="例如：最近在准备考试、工作任务紧张，或与某个人有未说出口的话。仅填写你愿意提供的背景。"
        ></textarea
        ><small class="field-hint"
          >AI会用它核对梦境与生活的可能关联。可以留空，不会自动编造你的经历。</small
        ></label
      ><label
        >醒后感受的强度 <span class="range-value">{{ form.self_intensity }} / 5</span
        ><input type="range" min="1" max="5" v-model.number="form.self_intensity" /><span
          class="range-labels"
          ><small>轻微</small><small>强烈</small></span
        ></label
      ><div v-if="!editing" class="completion-choice"
        ><div><Sparkles :size="18" /><strong>需要AI帮你连接片段吗？</strong></div
        ><select v-model="completionOption"
          ><option value="none">不用，保留原始片段</option
          ><option value="organize">整理表达，不增加新情节</option
          ><option value="creative">创意补全，生成可编辑草稿</option></select
        ><p>补全是创作辅助，不是恢复真实记忆；你可以预览后决定是否采用。</p></div
      ><div class="modal-footer"
        ><button type="button" class="secondary" @click="modal = false">取消</button
        ><button class="primary" :disabled="!!busy"
          ><LoaderCircle v-if="busy === 'save'" class="spin" :size="17" /><Feather
            v-else
            :size="17"
          />保存梦境</button
        ></div
      ></form
    ></div
  >
</template>
