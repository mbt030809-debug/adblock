// 영역 지정: 화면에서 네모 영역을 드래그 → 영역 안에 완전히 들어오는 요소를 한 번에 숨김
// 확장(src/content/picker.js)과 안드로이드 앱(assets)이 같이 쓴다.
// 사용: window.__adbRegionPick(function (selectors) { ...저장... })
(function () {
  'use strict';
  var TOL = 6;      // 영역 경계 허용 오차(px)
  var MAX = 50;     // 한 번에 숨길 최대 요소 수
  var SKIP = /^(HTML|HEAD|BODY|SCRIPT|STYLE|LINK|META|NOSCRIPT|BR|TITLE)$/;

  window.__adbRegionPick = function (save) {
    if (window.__adbRegionStop) { window.__adbRegionStop(); return; }

    var host = document.createElement('div');
    host.style.cssText = 'all:initial;position:fixed;inset:0;z-index:2147483647;pointer-events:none';
    var root = host.attachShadow({ mode: 'closed' });
    root.innerHTML =
      '<style>' +
      '.ov{position:fixed;inset:0;pointer-events:auto;touch-action:none;background:rgba(0,0,0,.18);cursor:crosshair}' +
      '.sel{position:fixed;border:2px dashed #f43f5e;background:#f43f5e33;display:none;pointer-events:none}' +
      '.hit{position:fixed;border:2px solid #f43f5e;background:#f43f5e22;pointer-events:none}' +
      '.bar{position:fixed;left:8px;right:8px;bottom:8px;background:#222;color:#fff;border-radius:10px;padding:8px 12px;' +
      'font:14px/1.4 sans-serif;pointer-events:auto;box-shadow:0 2px 10px #0008}' +
      '.r{display:flex;gap:6px;flex-wrap:wrap;margin-top:6px}' +
      'button{font:inherit;border:0;border-radius:6px;padding:8px 14px;background:#555;color:#fff}button.p{background:#f43f5e}' +
      '</style>' +
      '<div class="ov"></div><div class="sel"></div><div class="hits"></div>' +
      '<div class="bar"><div class="m">숨길 영역을 드래그해서 네모로 지정하세요</div>' +
      '<div class="r"><button class="p ok" style="display:none">숨기기</button>' +
      '<button class="again" style="display:none">다시 지정</button><button class="cancel">취소</button></div></div>';
    var ov = root.querySelector('.ov'), sel = root.querySelector('.sel'), hits = root.querySelector('.hits');
    var msg = root.querySelector('.m'), okB = root.querySelector('.ok'), againB = root.querySelector('.again');
    document.documentElement.appendChild(host);

    var x0 = 0, y0 = 0, drawing = false, found = [];

    function rectOf(a, b, c, d) {
      return { l: Math.min(a, c), t: Math.min(b, d), r: Math.max(a, c), b: Math.max(b, d) };
    }

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

    // 영역에 완전히 들어오는 요소 중 가장 바깥 것들. 없으면 영역 중심의 최상단 요소.
    function collect(r) {
      var out = [];
      var all = document.body ? document.body.querySelectorAll('*') : [];
      for (var i = 0; i < all.length; i++) {
        var el = all[i];
        if (SKIP.test(el.tagName)) continue;
        var b = el.getBoundingClientRect();
        if (b.width < 4 || b.height < 4) continue;
        if (b.left >= r.l - TOL && b.top >= r.t - TOL && b.right <= r.r + TOL && b.bottom <= r.b + TOL) out.push(el);
      }
      var set = new Set(out);
      out = out.filter(function (el) {
        for (var p = el.parentElement; p; p = p.parentElement) if (set.has(p)) return false;
        return true;
      });
      if (!out.length) {
        host.style.display = 'none';
        var stack = document.elementsFromPoint((r.l + r.r) / 2, (r.t + r.b) / 2);
        host.style.display = '';
        var area = innerWidth * innerHeight;
        for (var k = 0; k < stack.length; k++) {
          var e = stack[k];
          if (SKIP.test(e.tagName)) continue;
          var bb = e.getBoundingClientRect();
          if (bb.width * bb.height > area * 0.9) continue;
          out = [e];
          break;
        }
      }
      return out.slice(0, MAX);
    }

    function showHits() {
      hits.innerHTML = '';
      found.forEach(function (el) {
        var b = el.getBoundingClientRect();
        var d = document.createElement('div');
        d.className = 'hit';
        d.style.cssText = 'left:' + b.left + 'px;top:' + b.top + 'px;width:' + b.width + 'px;height:' + b.height + 'px';
        hits.appendChild(d);
      });
    }

    function reset() {
      found = [];
      hits.innerHTML = '';
      sel.style.display = 'none';
      ov.style.display = '';
      okB.style.display = againB.style.display = 'none';
      msg.textContent = '숨길 영역을 드래그해서 네모로 지정하세요';
    }

    ov.addEventListener('pointerdown', function (e) {
      drawing = true; x0 = e.clientX; y0 = e.clientY;
      try { ov.setPointerCapture(e.pointerId); } catch (err) {}
      e.preventDefault();
    });
    ov.addEventListener('pointermove', function (e) {
      if (!drawing) return;
      var r = rectOf(x0, y0, e.clientX, e.clientY);
      sel.style.cssText = 'display:block;left:' + r.l + 'px;top:' + r.t + 'px;width:' + (r.r - r.l) + 'px;height:' + (r.b - r.t) + 'px';
      e.preventDefault();
    });
    ov.addEventListener('pointerup', function (e) {
      if (!drawing) return;
      drawing = false;
      var r = rectOf(x0, y0, e.clientX, e.clientY);
      if (r.r - r.l < 12 || r.b - r.t < 12) { reset(); return; }
      found = collect(r);
      sel.style.display = 'none';
      if (!found.length) { msg.textContent = '영역에서 요소를 찾지 못했습니다. 다시 지정하세요'; againB.style.display = ''; return; }
      ov.style.display = 'none'; // 확인 단계에서는 페이지 스크롤 허용
      showHits();
      msg.textContent = found.length + '개 요소를 숨길까요?';
      okB.textContent = '숨기기 (' + found.length + ')';
      okB.style.display = againB.style.display = '';
    });

    function stop() {
      host.remove();
      window.__adbRegionStop = null;
    }
    window.__adbRegionStop = stop;
    root.querySelector('.cancel').onclick = stop;
    againB.onclick = reset;
    okB.onclick = function () {
      var sels = [];
      found.forEach(function (el) {
        var s = selectorOf(el);
        if (s && sels.indexOf(s) < 0) sels.push(s);
        el.style.setProperty('display', 'none', 'important');
      });
      stop();
      if (sels.length) save(sels);
    };
  };
})();
