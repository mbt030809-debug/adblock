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

  // ---------- 요소 직접 지정 (top frame) ----------
  if (TOP) {
    window.__adbPick = function () {
      if (window.__adbPicking) { window.__adbPicking(); return; }
      var host = document.createElement('div');
      host.style.cssText = 'all:initial;position:fixed;inset:0;z-index:2147483647;pointer-events:none';
      var root = host.attachShadow({ mode: 'closed' });
      root.innerHTML =
        '<style>.box{position:fixed;border:2px solid #f43f5e;background:#f43f5e33;pointer-events:none;display:none}' +
        '.bar{position:fixed;left:8px;right:8px;bottom:8px;background:#222;color:#fff;border-radius:10px;padding:8px 12px;' +
        'font:14px/1.4 sans-serif;pointer-events:auto;box-shadow:0 2px 10px #0008}' +
        '.s{font:12px monospace;opacity:.8;word-break:break-all;margin:4px 0}.r{display:flex;gap:6px;flex-wrap:wrap}' +
        'button{font:inherit;border:0;border-radius:6px;padding:8px 14px;background:#555;color:#fff}button.p{background:#f43f5e}</style>' +
        '<div class="box"></div><div class="bar"><div class="m">숨길 요소를 탭하세요</div><div class="s"></div>' +
        '<div class="r"><button class="up">상위 ▲</button><button class="p save">숨기기</button><button class="cancel">취소</button></div></div>';
      var box = root.querySelector('.box'), msg = root.querySelector('.m'), selText = root.querySelector('.s');
      document.documentElement.appendChild(host);
      var cur = null;

      function selectorOf(el) {
        function uniq(s) { try { return document.querySelectorAll(s).length === 1; } catch (e) { return false; } }
        var parts = [], n = el;
        while (n && n.nodeType === 1 && n !== document.documentElement) {
          var p = n.tagName.toLowerCase();
          if (n.id && !/\d{4,}/.test(n.id)) {
            parts.unshift('#' + CSS.escape(n.id));
            if (uniq(parts.join(' > '))) break;
            n = n.parentElement;
            continue;
          }
          var cls = Array.prototype.filter.call(n.classList, function (c) { return !/\d{3,}|^(js|is|has)-/.test(c); }).slice(0, 2);
          if (cls.length) p += cls.map(function (c) { return '.' + CSS.escape(c); }).join('');
          var sib = n.parentElement && Array.prototype.filter.call(n.parentElement.children, function (x) { return x.tagName === n.tagName; });
          if (sib && sib.length > 1 && !uniq(p)) p += ':nth-of-type(' + (sib.indexOf(n) + 1) + ')';
          parts.unshift(p);
          if (uniq(parts.join(' > '))) break;
          n = n.parentElement;
        }
        return parts.join(' > ');
      }
      function highlight(el) {
        var r = el.getBoundingClientRect();
        box.style.cssText = 'display:block;left:' + r.left + 'px;top:' + r.top + 'px;width:' + r.width + 'px;height:' + r.height + 'px';
      }
      function show(el) { cur = el; highlight(el); selText.textContent = selectorOf(el); msg.textContent = '이 요소를 숨길까요?'; }
      function inUI(e) { return e.composedPath().indexOf(host) >= 0; }
      function onClick(e) { if (inUI(e)) return; e.preventDefault(); e.stopImmediatePropagation(); show(e.target); }
      function blockEv(e) { if (!inUI(e)) { e.preventDefault(); e.stopImmediatePropagation(); } }
      document.addEventListener('click', onClick, true);
      document.addEventListener('auxclick', blockEv, true);
      document.addEventListener('submit', blockEv, true);
      function stop() {
        document.removeEventListener('click', onClick, true);
        document.removeEventListener('auxclick', blockEv, true);
        document.removeEventListener('submit', blockEv, true);
        host.remove();
        window.__adbPicking = null;
      }
      window.__adbPicking = stop;
      root.querySelector('.cancel').onclick = stop;
      root.querySelector('.up').onclick = function () {
        if (cur && cur.parentElement && cur.parentElement !== document.body) show(cur.parentElement);
      };
      root.querySelector('.save').onclick = function () {
        if (!cur) return;
        var sel = selectorOf(cur);
        cur.style.setProperty('display', 'none', 'important');
        if (userRules.indexOf(sel) < 0) userRules.push(sel);
        bridge('saveRule', sel);
        stop();
      };
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
