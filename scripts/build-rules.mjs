// lists/*.txt → rules/ads.json (declarativeNetRequest 정적 규칙)
import { readFileSync, writeFileSync } from 'node:fs';

const read = (f) =>
  readFileSync(new URL(`../lists/${f}`, import.meta.url), 'utf8')
    .split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));

const types = ['script', 'sub_frame', 'image', 'xmlhttprequest', 'ping', 'media', 'other'];
const rules = [];
let id = 1;
for (const d of read('domains.txt'))
  rules.push({ id: id++, priority: 1, action: { type: 'block' }, condition: { requestDomains: [d], resourceTypes: types } });
for (const u of read('url-filters.txt'))
  rules.push({ id: id++, priority: 1, action: { type: 'block' }, condition: { urlFilter: u, resourceTypes: types } });

writeFileSync(new URL('../rules/ads.json', import.meta.url), JSON.stringify(rules, null, 2) + '\n');
console.log(`rules: ${rules.length}`);
