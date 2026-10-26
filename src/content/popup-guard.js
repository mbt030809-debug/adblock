// 메인 월드: 팝업 차단 + 수동 열기 바
(() => {
  if (window.__adbGuard) return;
  window.__adbGuard = true;

  let block = true; // 설정 도착 전에는 차단
  const nativeOpen = window.open;
  const nativeClick = HTMLAnchorElement.prototype.click;
  const isTop = window === window.top;
  const queue = [];

  document.addEventListener('__adb_cfg', (e) => {
    try { block = !!JSON.parse(e.detail).block; } catch (_) {}
  });

  // 사용자가 직접 누른 버튼/링크 직후의 open 은 허용 (로그인 팝업 등)
  let lastClick = 0;
  addEventListener('click', (e) => {
    if (!e.isTrusted) return;
    const t = e.target instanceof Element ? e.target.closest('button,input,[role=button],a[href]') : null;
    if (t) lastClick = Date.now();
  }, true);
  const userInitiated = () => Date.now() - lastClick < 1000;

  function report(url) {
    if (isTop) add(url);
    else try { top.postMessage({ __adb: 1, url }, '*'); } catch (_) {}
  }

  window.open = function (url, ...rest) {
    if (!block || userInitiated()) return nativeOpen.call(this, url, ...rest);
    report(String(url || ''));
    return null;
  };

  // 화면에 붙지 않은 <a> 를 click() 하는 광고 패턴
  HTMLAnchorElement.prototype.click = function () {
    if (block && !this.isConnected && this.target && this.target !== '_self') {
      report(this.href);
      return;
    }
    return nativeClick.apply(this, arguments);
  };

  if (!isTop) return;
  addEventListener('message', (e) => {
    if (e.data && e.data.__adb === 1 && typeof e.data.url === 'string') add(e.data.url);
  });

  // ---- 수동 열기 UI (top frame) ----
  let host, list, title;
  function ensureUI() {
    if (host && host.isConnected) return;
    host = document.createElement('div');
    host.style.cssText = 'all:initial;position:fixed;left:0;right:0;bottom:0;z-index:2147483647';
    const root = host.attachShadow({ mode: 'closed' });
    root.innerHTML = `
      <style>
        .bar{font:14px/1.4 sans-serif;background:#222;color:#fff;margin:8px;border-radius:10px;padding:8px 12px;box-shadow:0 2px 10px #0008}
        .row{display:flex;gap:8px;align-items:center;margin-top:6px}
        .u{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;opacity:.8;font-size:12px}
        button{font:inherit;border:0;border-radius:6px;padding:6px 12px;background:#3b82f6;color:#fff}
        button.x{background:#555}
        .h{display:flex;justify-content:space-between;align-items:center}
      </style>
      <div class="bar"><div class="h"><b></b><button class="x">닫기</button></div><div class="l"></div></div>`;
    title = root.querySelector('b');
    list = root.querySelector('.l');
    root.querySelector('.x').onclick = () => { queue.length = 0; host.remove(); };
    (document.documentElement).appendChild(host);
  }
  function add(url) {
    if (queue.some((u) => u === url)) return;
    queue.push(url);
    ensureUI();
    title.textContent = `팝업 ${queue.length}개 차단됨`;
    const row = document.createElement('div');
    row.className = 'row';
    const u = document.createElement('span');
    u.className = 'u';
    u.textContent = url || '(빈 주소)';
    const b = document.createElement('button');
    b.textContent = '열기';
    b.onclick = () => {
      if (url) nativeOpen.call(window, url, '_blank');
      row.remove();
      queue.splice(queue.indexOf(url), 1);
      title.textContent = `팝업 ${queue.length}개 차단됨`;
      if (!queue.length) host.remove();
    };
    row.append(u, b);
    list.appendChild(row);
  }
})();
