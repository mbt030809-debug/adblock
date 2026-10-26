// 영역 지정 결과를 저장 (popup 에서 shared/region-picker.js 와 함께 on-demand 주입)
window.__adbRegionPick(async (selectors) => {
  const h = location.hostname.replace(/^www\./, '');
  const { userRules = {} } = await chrome.storage.local.get('userRules');
  const list = userRules[h] || [];
  selectors.forEach((s) => { if (!list.includes(s)) list.push(s); });
  userRules[h] = list;
  await chrome.storage.local.set({ userRules });
});
