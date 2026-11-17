// Measures the answer shield on fixed Turkish drafts, live on NEAR AI's
// private inference. For each draft and model: the flags, what the writer
// would send if they generalized every flag, and the code check.
//
//   NEARAI_API_KEY=... npm run shield:eval            (both models)
//   MODELS=z-ai/glm-5.3-flash npm run shield:eval
//
// SPDX-License-Identifier: MIT

import fs from 'node:fs';
import { createShield } from '../src/shield.js';
import { applyDecisions, checkFinal, type Decision } from '../src/shield-core.js';

const apiKey = process.env['NEARAI_API_KEY'];
if (!apiKey) {
  console.error('Set NEARAI_API_KEY. Nothing was sent.');
  process.exit(2);
}
const MODELS = (process.env['MODELS'] ?? 'z-ai/glm-5.3-flash,Qwen/Qwen3.8-27B').split(',');

const DRAFTS: { id: string; text: string; mustGo: string[] }[] = [
  { id: 'insult', text: 'Bu müdür tam bir salak, her toplantıda bizi rezil ediyor, bıktım artık aq', mustGo: ['salak', 'aq'] },
  {
    id: 'identity',
    text: "Geçen salı sprint toplantısında Mehmet tasarımımı herkesin önünde rezil etti, artık fikir söylemiyorum. Zaten ekipteki tek UX'çi benim.",
    mustGo: ['Geçen salı', 'Mehmet', "tek UX'çi"],
  },
  { id: 'style', text: 'valla kanka bence yönetim hiç dinlemiyo yaa... her seferinde aynı şey 🙄🙄', mustGo: ['kanka', '🙄'] },
  { id: 'clean', text: 'Terfi kriterleri açık değil, kimin neden terfi aldığını anlamıyoruz.', mustGo: [] },
  {
    id: 'harsh',
    text: 'Bu yönetim tamamen beceriksiz. Bütçe yanlış kullanılıyor ve kimse hesap vermiyor. Böyle giderse yılsonuna kadar ekibin yarısı istifa eder.',
    mustGo: [],
  },
  {
    id: 'nurse',
    text: '3. kattaki yoğun bakımda gece nöbetlerinde tek hemşire 12 hastaya bakıyor. Geçen hafta perşembe gecesi bir hastanın ilacı 2 saat gecikti, sorumlu hemşire bendim ve kimseye söyleyemedim.',
    mustGo: ['3. kat', 'perşembe', 'sorumlu hemşire bendim'],
  },
  {
    id: 'university',
    text: 'Bölüm başkanı yüksek lisans öğrencilerini kendi projelerinde ücretsiz çalıştırıyor, itiraz eden tezini uzatıyor. Ben ikinci yılımdayım ve danışmanım da o.',
    mustGo: ['ikinci yılımdayım'],
  },
  {
    id: 'mixed',
    text: 'Ya açıkçası ben Ankara ofisindeki tek kadın mühendis olarak toplantılarda sözümün sürekli kesildiğini hissediyorum, özellikle Ali Bey yapıyor bunu. Çok sinir bozucu ama söylesem başım belaya girer.',
    mustGo: ['Ankara', 'tek kadın', 'Ali Bey'],
  },
];

type Row = Record<string, unknown>;
const rows: Row[] = [];

for (const model of MODELS) {
  const shield = createShield({ apiKey, model });
  for (const d of DRAFTS) {
    const row: Row = { model, id: d.id };
    try {
      const { value: flags, receipt: r1 } = await shield.inspect(d.text);
      const decisions: Decision[] = flags.map(() => 'generalize');
      const applied = applyDecisions(d.text, flags, decisions);
      const { value: plain, receipt: r2 } = await shield.normalize(applied, []);
      let final = plain;
      let check = checkFinal(final, flags, decisions);
      // A normalizer that put a generalized span back loses: send the
      // generalized text without the style pass instead.
      if (!check.ok) {
        final = applied;
        check = checkFinal(final, flags, decisions);
      }
      const missed = d.mustGo.filter((m) => final.toLocaleLowerCase().includes(m.toLocaleLowerCase()));
      Object.assign(row, {
        seconds: r1.seconds + r2.seconds,
        verified: `${r1.verified}/${r2.verified}`,
        flags: flags.map((f) => `[${f.type}] "${f.text}" -> "${f.suggestion}"`),
        final,
        codeCheck: check.ok ? 'ok' : `leaked ${check.leaked.map((f) => f.text).join(', ')}`,
        missed,
      });
      console.log(`\n=== ${model} | ${d.id} | ${row['seconds']}s | ${row['verified']}`);
      console.log(`DRAFT: ${d.text}`);
      for (const f of flags) console.log(`  [${f.type}] "${f.text}" -> "${f.suggestion}"  (${f.why})`);
      console.log(`FINAL: ${final}`);
      console.log(`check: ${row['codeCheck']}${missed.length ? `  MISSED: ${missed.join(', ')}` : ''}`);
    } catch (e) {
      row['error'] = (e as Error).message;
      console.log(`\n=== ${model} | ${d.id} | ERROR ${(e as Error).message}`);
    }
    rows.push(row);
  }
}

fs.mkdirSync('reports', { recursive: true });
const out = `reports/shield-eval-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
fs.writeFileSync(out, JSON.stringify(rows, null, 2));
console.log(`\nsaved ${out}`);
