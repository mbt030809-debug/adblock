// 설정 공유 (content script 공용)
var ADB = (() => {
  const DEFAULTS = {
    enabled: true,
    youtube: true,
    popups: true,
    cosmetic: true,
    paused: [], // 이 사이트에서 차단 일시중지
    popupAllow: [], // 이 사이트에서 팝업 허용
    userRules: {}, // { host: [selector, ...] }
    userDomains: [] // 사용자 차단 도메인
  };
  const host = (h = location.hostname) => h.replace(/^www\./, '');
  const load = () => chrome.storage.local.get(DEFAULTS);
  const active = (s) => s.enabled && !s.paused.includes(host());
  return { DEFAULTS, host, load, active };
})();
