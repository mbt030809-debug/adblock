// 유튜브: 남은 광고 자동 스킵 + 광고 UI 숨김
(() => {
  const HIDE = [
    '#masthead-ad',
    '#player-ads',
    'ytd-ad-slot-renderer',
    'ytd-in-feed-ad-layout-renderer',
    'ytd-display-ad-renderer',
    'ytd-promoted-sparkles-web-renderer',
    'ytd-promoted-video-renderer',
    'ytd-banner-promo-renderer',
    'ytd-statement-banner-renderer',
    'ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-ads"]',
    '.ytp-ad-overlay-container',
    '.ytp-ad-image-overlay',
    '.video-ads',
    '.ytp-ad-module',
    'ytm-promoted-sparkles-web-renderer',
    'ytm-companion-ad-renderer',
    '.ad-showing .ytp-ad-player-overlay'
  ];
  const SKIP = [
    '.ytp-skip-ad-button',
    '.ytp-ad-skip-button',
    '.ytp-ad-skip-button-modern',
    '.ytp-ad-skip-button-container button',
    '.ytp-ad-overlay-close-button'
  ];

  const style = document.createElement('style');
  document.documentElement.appendChild(style);

  let enabled = false;
  let saved = null; // 광고 전 재생 상태

  function tick() {
    if (!enabled) return;
    const player = document.querySelector('#movie_player, .html5-video-player');
    const video = document.querySelector('video.html5-main-video, video');
    if (!player || !video) return;
    const ad = player.classList.contains('ad-showing') || player.classList.contains('ad-interrupting');
    if (ad) {
      if (!saved) saved = { muted: video.muted, rate: video.playbackRate };
      SKIP.forEach((q) => document.querySelectorAll(q).forEach((b) => b.click()));
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
  }

  function apply(s) {
    enabled = ADB.active(s) && s.youtube;
    style.textContent = enabled ? HIDE.join(',\n') + ' { display: none !important; }' : '';
  }

  ADB.load().then(apply);
  chrome.storage.onChanged.addListener(() => ADB.load().then(apply));
  setInterval(tick, 300);
})();
