// 배너/요소 숨김: 기본 선택자 + 사용자 지정 선택자
(() => {
  const GENERIC = [
    'ins.adsbygoogle',
    'iframe[src*="doubleclick.net"]',
    'iframe[src*="googlesyndication.com"]',
    'iframe[id^="google_ads_iframe"]',
    'div[id^="google_ads_iframe"]',
    '[id^="div-gpt-ad"]',
    '[data-ad-slot]',
    '[data-google-query-id]',
    '.adsbox',
    '.ad-banner',
    '.ad-container',
    '.banner-ad',
    '.advertisement',
    '[class*="taboola"]',
    '[id*="taboola"]',
    '[class*="outbrain"]'
  ];

  const style = document.createElement('style');
  style.id = '__adb_style';
  const mount = () => {
    if (!style.isConnected) (document.head || document.documentElement).appendChild(style);
  };

  function apply(s) {
    const on = ADB.active(s) && s.cosmetic;
    const sel = on ? [...GENERIC, ...(s.userRules[ADB.host()] || [])] : [];
    style.textContent = sel.length ? sel.join(',\n') + ' { display: none !important; }' : '';
    mount();
    // 메인 월드(popup-guard)에 설정 전달 (문자열만 전달 가능)
    const popups = ADB.active(s) && s.popups && !s.popupAllow.includes(ADB.host());
    document.dispatchEvent(new CustomEvent('__adb_cfg', { detail: JSON.stringify({ block: popups }) }));
  }

  mount();
  ADB.load().then(apply);
  chrome.storage.onChanged.addListener(() => ADB.load().then(apply));
  // head 가 교체되는 사이트 대비
  new MutationObserver(mount).observe(document, { childList: true, subtree: true });
})();
