const $ = (id) => document.getElementById(id);
const DEFAULTS = {
  enabled: true, youtube: true, popups: true, cosmetic: true,
  paused: [], popupAllow: [], userRules: {}, userDomains: []
};
const norm = (h) => h.replace(/^www\./, '');

(async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  let host = '';
  try { host = norm(new URL(tab.url).hostname); } catch (_) {}
  $('host').textContent = host;
  const web = /^https?:/.test(tab && tab.url || '');
  if (!web) { $('pick').disabled = $('paused').disabled = $('popupAllow').disabled = true; }

  let s = await chrome.storage.local.get(DEFAULTS);
  const save = (patch) => { Object.assign(s, patch); return chrome.storage.local.set(patch); };

  ['enabled', 'youtube', 'popups', 'cosmetic'].forEach((k) => {
    $(k).checked = s[k];
    $(k).onchange = () => save({ [k]: $(k).checked });
  });
  ['paused', 'popupAllow'].forEach((k) => {
    $(k).checked = s[k].includes(host);
    $(k).onchange = () => {
      const set = new Set(s[k]);
      $(k).checked ? set.add(host) : set.delete(host);
      save({ [k]: [...set] });
    };
  });

  $('pick').onclick = async () => {
    await chrome.scripting.executeScript({ target: { tabId: tab.id, allFrames: false }, files: ['src/content/picker.js'] });
    window.close();
  };

  function renderRules() {
    const list = s.userRules[host] || [];
    $('rules').innerHTML = list.length ? '' : '<span class="muted">없음</span>';
    list.forEach((sel, i) => {
      const d = document.createElement('div');
      d.className = 'rule';
      const t = document.createElement('span'); t.textContent = sel;
      const b = document.createElement('button'); b.className = 's'; b.textContent = '삭제';
      b.onclick = async () => {
        const userRules = { ...s.userRules, [host]: list.filter((_, j) => j !== i) };
        if (!userRules[host].length) delete userRules[host];
        await save({ userRules });
        renderRules();
      };
      d.append(t, b);
      $('rules').appendChild(d);
    });
  }
  function renderDoms() {
    $('doms').innerHTML = '';
    s.userDomains.forEach((dm, i) => {
      const d = document.createElement('div');
      d.className = 'rule';
      const t = document.createElement('span'); t.textContent = dm;
      const b = document.createElement('button'); b.className = 's'; b.textContent = '삭제';
      b.onclick = async () => { await save({ userDomains: s.userDomains.filter((_, j) => j !== i) }); renderDoms(); };
      d.append(t, b);
      $('doms').appendChild(d);
    });
  }
  $('dom').onkeydown = async (e) => {
    if (e.key !== 'Enter') return;
    const v = $('dom').value.trim().toLowerCase().replace(/^https?:\/\//, '').split('/')[0];
    if (!v || s.userDomains.includes(v)) return;
    await save({ userDomains: [...s.userDomains, v] });
    $('dom').value = '';
    renderDoms();
  };
  renderRules();
  renderDoms();
})();
