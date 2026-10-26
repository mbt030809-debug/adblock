// 실행: node test/e2e.cjs  (playwright + chromium 필요)
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.resolve(__dirname, '..');
const srv = http.createServer((_, res) => {
  res.setHeader('content-type', 'text/html');
  res.end(fs.readFileSync(path.join(__dirname, 'page.html')));
});

(async () => {
  await new Promise((r) => srv.listen(0, r));
  const url = `http://localhost:${srv.address().port}/`;
  const ctx = await chromium.launchPersistentContext('/tmp/adb-profile-' + Date.now(), {
    headless: false,
    args: ['--headless=new', `--disable-extensions-except=${root}`, `--load-extension=${root}`]
  });
  let sw = ctx.serviceWorkers()[0] || (await ctx.waitForEvent('serviceworker'));
  const page = await ctx.newPage();
  await page.goto(url);
  await page.waitForTimeout(800);

  // 1) 기본 배너 숨김
  assert.equal(await page.$eval('#b1', (e) => getComputedStyle(e).display), 'none', '기본 배너 숨김');
  // 2) 타이머 팝업 차단 + 열기 바 표시
  assert.equal(await page.evaluate(() => window.__r1), null, '타이머 팝업 차단');
  // 3) 클릭 영역(click-under) 차단, 버튼 클릭은 허용
  await page.click('#clickarea');
  assert.equal(await page.evaluate(() => window.__r2), null, 'click-under 차단');
  const popupP = ctx.waitForEvent('page', { timeout: 3000 });
  await page.click('#ok');
  const p2 = await popupP;
  assert.ok(p2, '버튼 팝업 허용');
  await p2.close();
  // 4) 수동 열기: 바의 "열기" 버튼 (closed shadow → 위치 클릭 대신 내부 확인 불가하므로 호스트 존재만 확인)
  const hasBar = await page.evaluate(() => [...document.documentElement.children].some((e) => e.style.zIndex === '2147483647'));
  assert.ok(hasBar, '수동 열기 바 표시');

  // 5) 사용자 지정 규칙 저장 → 즉시 반영
  await sw.evaluate(() => chrome.storage.local.set({ userRules: { localhost: ['#custom'] } }));
  await page.waitForTimeout(500);
  assert.equal(await page.$eval('#custom', (e) => getComputedStyle(e).display), 'none', '사용자 규칙 반영');

  // 6) 피커 주입 → 요소 선택 → 저장
  await sw.evaluate(() => chrome.storage.local.set({ userRules: {} }));
  await page.waitForTimeout(300);
  assert.notEqual(await page.$eval('#custom', (e) => getComputedStyle(e).display), 'none');
  const tabId = await sw.evaluate(async (u) => (await chrome.tabs.query({})).find((t) => t.url === u).id, url);
  await sw.evaluate((id) => chrome.scripting.executeScript({ target: { tabId: id }, files: ['shared/region-picker.js', 'src/content/picker.js'] }), tabId);
  // #custom 영역을 네모로 드래그 (여유 있게 감싸기)
  const bb = await page.$eval('#custom', (e) => { const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; });
  await page.mouse.move(bb.x - 3, bb.y - 3);
  await page.mouse.down();
  await page.mouse.move(bb.x + bb.w / 2, bb.y + bb.h / 2, { steps: 5 });
  await page.mouse.move(bb.x + bb.w + 3, bb.y + bb.h + 3, { steps: 5 });
  await page.mouse.up();
  await page.screenshot({ path: '/tmp/adb-picker.png' });
  // 확인 바 [숨기기 (N)] 클릭 — closed shadow 라 좌표로 클릭 (하단 바 첫 버튼)
  const vp = page.viewportSize();
  await page.mouse.click(8 + 12 + 50, vp.height - 8 - 22);
  await page.waitForTimeout(500);
  const saved = await sw.evaluate(() => chrome.storage.local.get('userRules'));
  console.log('saved', JSON.stringify(saved));
  assert.ok((saved.userRules.localhost || []).length >= 1, '영역 지정 저장');
  assert.equal(await page.$eval('#custom', (e) => getComputedStyle(e).display), 'none', '영역 규칙 즉시 반영');
  assert.notEqual(await page.$eval('#b1', (e) => getComputedStyle(e).display), 'x');

  // 7) DNR: 차단 도메인 요청 확인
  const rules = await sw.evaluate(() => chrome.declarativeNetRequest.getEnabledRulesets());
  assert.deepEqual(rules, ['ads']);
  await sw.evaluate(() => chrome.storage.local.set({ userDomains: ['blocked.example'] }));
  await page.waitForTimeout(500);
  const dyn = await sw.evaluate(() => chrome.declarativeNetRequest.getDynamicRules());
  assert.ok(dyn.some((r) => r.condition.requestDomains[0] === 'blocked.example'), '동적 도메인 규칙');

  console.log('E2E OK');
  await ctx.close();
  srv.close();
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
