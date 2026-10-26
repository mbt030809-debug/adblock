// 요소 직접 지정: 탭/클릭한 요소를 숨김 규칙으로 저장 (popup 에서 on-demand 주입)
(() => {
  if (window.__adbPicker) { window.__adbPicker.stop(); return; }

  const host = document.createElement('div');
  host.style.cssText = 'all:initial;position:fixed;inset:0;z-index:2147483647;pointer-events:none';
  const root = host.attachShadow({ mode: 'closed' });
  root.innerHTML = `
    <style>
      .box{position:fixed;border:2px solid #f43f5e;background:#f43f5e33;pointer-events:none;display:none}
      .bar{position:fixed;left:8px;right:8px;bottom:8px;background:#222;color:#fff;border-radius:10px;padding:8px 12px;
           font:14px/1.4 sans-serif;pointer-events:auto;box-shadow:0 2px 10px #0008}
      .s{font:12px monospace;opacity:.8;word-break:break-all;margin:4px 0}
      .r{display:flex;gap:6px;flex-wrap:wrap}
      button{font:inherit;border:0;border-radius:6px;padding:6px 12px;background:#555;color:#fff}
      button.p{background:#f43f5e}
    </style>
    <div class="box"></div>
    <div class="bar">
      <div class="m">숨길 요소를 탭하세요</div>
      <div class="s"></div>
      <div class="r">
        <button class="up">상위 ▲</button><button class="p save">숨기기</button><button class="cancel">취소</button>
      </div>
    </div>`;
  const box = root.querySelector('.box');
  const msg = root.querySelector('.m');
  const selText = root.querySelector('.s');
  document.documentElement.appendChild(host);

  let cur = null;

  function selectorOf(el) {
    const uniq = (s) => { try { return document.querySelectorAll(s).length === 1; } catch (_) { return false; } };
    const parts = [];
    let n = el;
    while (n && n.nodeType === 1 && n !== document.documentElement) {
      let p = n.tagName.toLowerCase();
      if (n.id && !/\d{4,}/.test(n.id)) {
        p = '#' + CSS.escape(n.id);
        parts.unshift(p);
        if (uniq(parts.join(' > '))) break;
        n = n.parentElement;
        continue;
      }
      const cls = [...n.classList].filter((c) => !/\d{3,}|^(js|is|has)-/.test(c)).slice(0, 2);
      if (cls.length) p += cls.map((c) => '.' + CSS.escape(c)).join('');
      const sib = n.parentElement && [...n.parentElement.children].filter((x) => x.tagName === n.tagName);
      if (sib && sib.length > 1 && !uniq(p)) p += `:nth-of-type(${sib.indexOf(n) + 1})`;
      parts.unshift(p);
      if (uniq(parts.join(' > '))) break;
      n = n.parentElement;
    }
    return parts.join(' > ');
  }

  function highlight(el) {
    const r = el.getBoundingClientRect();
    Object.assign(box.style, { display: 'block', left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' });
  }

  function show(el) {
    cur = el;
    highlight(el);
    selText.textContent = selectorOf(el);
    msg.textContent = '이 요소를 숨길까요?';
  }

  const inUI = (e) => e.composedPath().includes(host);
  const onClick = (e) => {
    if (inUI(e)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    show(e.target);
  };
  const onOver = (e) => { if (!cur && !inUI(e)) highlight(e.target); };
  const block = (e) => { if (!inUI(e)) { e.preventDefault(); e.stopImmediatePropagation(); } };

  ['click', 'auxclick', 'submit'].forEach((t) => document.addEventListener(t, t === 'click' ? onClick : block, true));
  document.addEventListener('mouseover', onOver, true);

  function stop() {
    ['click', 'auxclick', 'submit'].forEach((t) => document.removeEventListener(t, t === 'click' ? onClick : block, true));
    document.removeEventListener('mouseover', onOver, true);
    host.remove();
    delete window.__adbPicker;
  }
  window.__adbPicker = { stop };

  root.querySelector('.cancel').onclick = stop;
  root.querySelector('.up').onclick = () => { if (cur && cur.parentElement && cur.parentElement !== document.body) show(cur.parentElement); };
  root.querySelector('.save').onclick = async () => {
    if (!cur) return;
    const sel = selectorOf(cur);
    const h = location.hostname.replace(/^www\./, '');
    const { userRules = {} } = await chrome.storage.local.get('userRules');
    const list = userRules[h] || [];
    if (!list.includes(sel)) list.push(sel);
    userRules[h] = list;
    await chrome.storage.local.set({ userRules });
    stop();
  };
})();
