// 설정 → 네트워크 규칙 동기화
const DEFAULTS = { enabled: true, paused: [], userDomains: [] };
const PAUSE_BASE = 1000;
const USER_BASE = 2000;

async function sync() {
  const s = await chrome.storage.local.get(DEFAULTS);
  await chrome.declarativeNetRequest.updateEnabledRulesets(
    s.enabled ? { enableRulesetIds: ['ads'] } : { disableRulesetIds: ['ads'] }
  );

  const add = [];
  s.paused.forEach((h, i) =>
    add.push({
      id: PAUSE_BASE + i,
      priority: 100,
      action: { type: 'allowAllRequests' },
      condition: { requestDomains: [h], resourceTypes: ['main_frame', 'sub_frame'] }
    })
  );
  if (s.enabled) {
    s.userDomains.forEach((d, i) =>
      add.push({
        id: USER_BASE + i,
        priority: 1,
        action: { type: 'block' },
        condition: { requestDomains: [d] }
      })
    );
  }
  const old = await chrome.declarativeNetRequest.getDynamicRules();
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: old.map((r) => r.id),
    addRules: add
  });
}

chrome.runtime.onInstalled.addListener(sync);
chrome.runtime.onStartup.addListener(sync);
chrome.storage.onChanged.addListener((c) => {
  if (c.enabled || c.paused || c.userDomains) sync();
});
