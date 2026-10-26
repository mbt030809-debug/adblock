// WebView 문서 시작 시점에 주입: 배너 숨김 / 팝업 차단 / 유튜브 광고 / 요소 지정
// window.__ADB_CFG 는 앱이 앞에 붙여 줌. 네이티브 연동은 AdbBridge.
(function () {
  'use strict';
  var C = window.__ADB_CFG;
  if (!C || window.__adbLoaded) return;
  window.__adbLoaded = true;

  var H = location.hostname.replace(/^www\./, '');
  var TOP = window === window.top;
  var off = !C.enabled || C.paused.indexOf(H) >= 0;
  var userRules = (C.userRules && C.userRules[H]) || [];
  function bridge(fn, a) { try { window.AdbBridge[fn](a); } catch (e) {} }

  // ---------- 배너 숨김 ----------
  var GENERIC = [
    'ins.adsbygoogle', 'iframe[src*="doubleclick.net"]', 'iframe[src*="googlesyndication.com"]',
    'iframe[id^="google_ads_iframe"]', 'div[id^="google_ads_iframe"]', '[id^="div-gpt-ad"]',
    '[data-ad-slot]', '[data-google-query-id]', '.adsbox', '.ad-banner', '.ad-container',
    '.banner-ad', '.advertisement', '[class*="taboola"]', '[id*="taboola"]', '[class*="outbrain"]'
  ];
  var st = document.createElement('style');
  function mount() {
    var p = document.head || document.documentElement;
    if (p && !st.isConnected) p.appendChild(st);
  }
  function applyCss() {
    var sel = (off || !C.cosmetic) ? [] : GENERIC.concat(userRules);
    st.textContent = sel.length ? sel.join(',\n') + ' { display: none !important; }' : '';
    mount();
  }
  try {
    applyCss();
    var mo = new MutationObserver(mount);
    mo.observe(document, { childList: true, subtree: true });
    document.addEventListener('DOMContentLoaded', function () { mount(); mo.disconnect(); });
  } catch (e) {}

  // ---------- 영역 지정 (top frame) ----------
  if (TOP) {
    window.__adbPick = function () {
      if (!window.__adbRegionPick) return;
      window.__adbRegionPick(function (sels) {
        sels.forEach(function (s) { if (userRules.indexOf(s) < 0) userRules.push(s); });
        bridge('saveRules', JSON.stringify(sels));
      });
    };
  }

  if (off) return;

  // ---------- 팝업 차단 ----------
  if (C.popups && C.popupAllow.indexOf(H) < 0) {
    var nativeOpen = window.open;
    var nativeClick = HTMLAnchorElement.prototype.click;
    var lastClick = 0;
    addEventListener('click', function (e) {
      if (!e.isTrusted || !(e.target instanceof Element)) return;
      if (e.target.closest('button,input,[role=button],a[href]')) lastClick = Date.now();
    }, true);
    window.open = function (url) {
      if (Date.now() - lastClick < 1000) return nativeOpen.apply(this, arguments);
      bridge('blocked', String(url || ''));
      return null;
    };
    HTMLAnchorElement.prototype.click = function () {
      if (!this.isConnected && this.target && this.target !== '_self') { bridge('blocked', this.href); return; }
      return nativeClick.apply(this, arguments);
    };
  }

  // ---------- 유튜브 ----------
  if (C.youtube && /(^|\.)youtube(-nocookie)?\.com$/.test(location.hostname)) {
    var AD_KEYS = ['adPlacements', 'playerAds', 'adSlots', 'adBreakHeartbeatParams'];
    var clean = function (o) {
      if (!o || typeof o !== 'object') return o;
      AD_KEYS.forEach(function (k) {
        if (k in o) { if (Array.isArray(o[k])) o[k] = []; else delete o[k]; }
      });
      if (o.playerResponse) clean(o.playerResponse);
      if (o.response) clean(o.response);
      return o;
    };
    var nativeParse = JSON.parse;
    JSON.parse = function () { return clean(nativeParse.apply(this, arguments)); };
    var nativeJson = Response.prototype.json;
    Response.prototype.json = function () { return nativeJson.apply(this, arguments).then(clean); };
    var initial;
    try {
      Object.defineProperty(window, 'ytInitialPlayerResponse', {
        configurable: true,
        get: function () { return initial; },
        set: function (v) { initial = clean(v); }
      });
    } catch (e) {}

    var ytStyle = document.createElement('style');
    ytStyle.textContent = [
      '#masthead-ad', '#player-ads', 'ytd-ad-slot-renderer', 'ytd-in-feed-ad-layout-renderer', 'ytd-display-ad-renderer',
      'ytd-promoted-sparkles-web-renderer', 'ytd-promoted-video-renderer', 'ytd-banner-promo-renderer',
      'ytd-statement-banner-renderer', 'ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-ads"]',
      '.ytp-ad-overlay-container', '.ytp-ad-image-overlay', '.video-ads', '.ytp-ad-module',
      'ytm-promoted-sparkles-web-renderer', 'ytm-companion-ad-renderer', 'ad-slot-renderer', 'ytm-ad-slot-renderer'
    ].join(',\n') + ' { display: none !important; }';
    (function mountYt() {
      var p = document.head || document.documentElement;
      if (p) p.appendChild(ytStyle); else setTimeout(mountYt, 10);
    })();

    var SKIP = ['.ytp-skip-ad-button', '.ytp-ad-skip-button', '.ytp-ad-skip-button-modern',
      '.ytp-ad-skip-button-container button', '.ytp-ad-overlay-close-button'];
    var saved = null;
    setInterval(function () {
      var player = document.querySelector('#movie_player, .html5-video-player');
      var video = document.querySelector('video.html5-main-video, video');
      if (!player || !video) return;
      var ad = player.classList.contains('ad-showing') || player.classList.contains('ad-interrupting');
      if (ad) {
        if (!saved) saved = { muted: video.muted, rate: video.playbackRate };
        SKIP.forEach(function (q) { document.querySelectorAll(q).forEach(function (b) { b.click(); }); });
        video.muted = true;
        video.playbackRate = 16;
        if (isFinite(video.duration) && video.duration > 0 && video.currentTime < video.duration - 0.2) {
          video.currentTime = video.duration - 0.1;
        }
      } else if (saved) {
        video.muted = saved.muted;
        video.playbackRate = saved.rate;
        saved = null;
      }
    }, 300);
  }
})();
