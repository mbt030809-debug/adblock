// 메인 월드: 유튜브 플레이어 응답에서 광고 정보를 제거
(() => {
  if (window.__adbYt) return;
  window.__adbYt = true;

  const AD_KEYS = ['adPlacements', 'playerAds', 'adSlots', 'adBreakHeartbeatParams'];

  function clean(o) {
    if (!o || typeof o !== 'object') return o;
    for (const k of AD_KEYS) {
      if (k in o) {
        if (Array.isArray(o[k])) o[k] = [];
        else delete o[k];
      }
    }
    if (o.playerResponse) clean(o.playerResponse);
    if (o.response) clean(o.response);
    return o;
  }

  const nativeParse = JSON.parse;
  JSON.parse = function () {
    return clean(nativeParse.apply(this, arguments));
  };

  const nativeJson = Response.prototype.json;
  Response.prototype.json = function () {
    return nativeJson.apply(this, arguments).then(clean);
  };

  // 초기 페이지에 박혀 있는 ytInitialPlayerResponse
  let initial;
  try {
    Object.defineProperty(window, 'ytInitialPlayerResponse', {
      configurable: true,
      get: () => initial,
      set: (v) => { initial = clean(v); }
    });
  } catch (_) {}
})();
