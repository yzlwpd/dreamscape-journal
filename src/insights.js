export const emotionOrder = ['平静', '喜悦', '好奇', '焦虑', '悲伤', '恐惧'];
export const emotionPalette = {
  平静: '#397d72',
  喜悦: '#ae791d',
  好奇: '#7e6aa6',
  焦虑: '#b67443',
  悲伤: '#587fa4',
  恐惧: '#ac5d78',
};

export function dreamEmotions(dream) {
  const values = dream?.analysis?.result_json?.emotions || [];
  return emotionOrder.flatMap((name) => {
    const candidates = values.filter((e) => e.name === name && Number.isFinite(Number(e.strength)));
    if (!candidates.length) return [];
    return [
      {
        ...candidates.reduce((a, b) => (Number(a.strength) >= Number(b.strength) ? a : b)),
        strength: Math.max(
          1,
          Math.min(
            5,
            Math.round(
              Number(
                candidates.reduce((a, b) => (Number(a.strength) >= Number(b.strength) ? a : b))
                  .strength,
              ),
            ),
          ),
        ),
      },
    ];
  });
}

export function filterDreams(dreams, days, today) {
  const ordered = [...dreams].sort(
    (a, b) =>
      b.dream_date.localeCompare(a.dream_date) ||
      String(b.created_at || '').localeCompare(String(a.created_at || '')),
  );
  if (days === 'all') return ordered;
  const end = Date.parse(today + 'T00:00:00Z'),
    start = end - (Number(days) - 1) * 86400000;
  return ordered.filter((d) => {
    const date = Date.parse(d.dream_date + 'T00:00:00Z');
    return date >= start && date <= end;
  });
}

export function emotionFrequency(dreams) {
  return emotionOrder.map((name) => ({
    name,
    count: dreams.filter((d) => dreamEmotions(d).some((e) => e.name === name)).length,
  }));
}

export function recurringThemes(dreams) {
  const map = new Map();
  for (const d of dreams) {
    const themes = d.analysis?.result_json?.themes || [];
    for (const raw of new Set(themes.map(String))) {
      const theme = raw.trim();
      if (!theme) continue;
      const group = map.get(theme) || { name: theme, dreams: [] };
      group.dreams.push(d);
      map.set(theme, group);
    }
  }
  return [...map.values()]
    .filter((t) => t.dreams.length > 1)
    .sort((a, b) => b.dreams.length - a.dreams.length || a.name.localeCompare(b.name, 'zh-CN'));
}
