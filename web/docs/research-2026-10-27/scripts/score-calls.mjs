// Score dated strategist S&P 500 tactical calls against Cboe SPX closes.
// Usage: node score-calls.mjs /tmp/mo-research/data/SPX_History.csv
import fs from 'node:fs';
const csv = process.argv[2] || '/tmp/mo-research/data/SPX_History.csv';
const rows = fs.readFileSync(csv, 'utf8').trim().split(/\r?\n/).slice(1).map(l => {
  const [d, c] = l.split(','); const [m, dd, y] = d.split('/');
  return { d: `${y}-${m}-${dd}`, c: +c };
});
const D = rows.map(r => r.d), C = rows.map(r => r.c), N = D.length;
const firstAfter = s => D.findIndex(d => d > s);          // first trading day strictly after s
const onOrAfter = s => D.findIndex(d => d >= s);
const lastOnOrBefore = s => { let i = -1; for (let k = 0; k < N && D[k] <= s; k++) i = k; return i; };

// [id, date, group, dir, hz, opts]  hz: 'Nd' trading days | 'YYYY-MM-DD' end | null (=21d)
// opts: m=month-only date, glob=global equities (SPX proxy), dup=id of original, start=override entry date, note
const G = { MS: 'MS / Wilson', BH: 'BofA Hartnett/B&B/FMS', BS: 'BofA Subramanian', GS: 'GS 策略（Kostin/AA/MG/Menon）', RB: 'Scott Rubner', JP: 'JPM（Kolanovic/Lakos-Bujas/團隊）', TL: 'Fundstrat / Tom Lee', CI: 'Citi', ND: 'NDR / Clissold', PA: 'Paulsen', HA: 'Campbell Harvey' };
const calls = [
 [1,'2018-07-31','MS','down',null],[2,'2018-10-29','MS','down',null],[3,'2021-09-20','MS','down',null],[4,'2021-10-18','MS','unclear'],
 [5,'2022-10-24','MS','up',null],[6,'2022-12-05','MS','down',null],[7,'2023-01-30','MS','down','2023-05-31',{note:'path call'}],[8,'2023-02-27','MS','down','2023-03-31'],
 [9,'2024-07-08','MS','down','2024-11-04'],[10,'2024-08-05','MS','down','21d'],[11,'2025-03-17','MS','up',null],[12,'2025-04-14','MS','unclear'],
 [13,'2025-10-20','MS','down','21d'],[14,'2026-03-09','MS','down','2026-04-03'],[15,'2026-03-16','MS','up',null],[16,'2026-07-22','MS','unclear'],
 [17,'2018-01-26','BH','down','2018-03-29'],[18,'2018-02-09','BH','down',null],[19,'2019-01-04','BH','up',null],[20,'2019-08-30','BH','up',null,{glob:1}],
 [21,'2020-03-17','BH','up',null],[22,'2020-12-16','BH','down','2021-03-31',{glob:1}],[23,'2021-06-15','BH','down',null,{glob:1}],[24,'2021-12-14','BH','up',null,{glob:1}],
 [25,'2022-03-25','BH','unclear'],[26,'2022-04-14','BH','up','63d'],[27,'2022-05-19','BH','unclear'],[28,'2023-08-15','BH','down',null],
 [29,'2023-10-19','BH','up','20d'],[30,'2024-10-15','BH','down',null,{glob:1}],[31,'2025-02-20','BH','down','20d'],[32,'2025-12-19','BH','down',null],
 [33,'2026-05-22','BH','down',null],[34,'2026-07-14','BH','down',null,{glob:1}],
 [35,'2018-10-29','GS','up','2018-12-31'],[36,'2020-05-11','GS','down','63d'],[37,'2020-12-08','GS','down','21d'],[38,'2022-09-27','GS','down','63d',{glob:1}],
 [39,'2022-10-11','GS','down','2022-12-30'],[40,'2025-03-28','GS','down','21d'],[41,'2025-09-29','GS','up','63d',{glob:1}],[42,'2026-10-12','GS','up','63d',{glob:1}],
 [43,'2020-06-13','JP','up',null],[44,'2022-01-10','JP','up',null],[45,'2023-01-18','JP','down','2023-03-31'],[46,'2023-05-23','JP','down',null,{glob:1}],[47,'2024-03-28','JP','unclear'],
 [48,'2019-12-06','TL','up','2019-12-31'],[49,'2020-01-27','TL','down','21d',{note:'withdrawn 2020-02-07'}],[50,'2020-02-07','TL','neutral'],[51,'2022-12-05','TL','up','2022-12-30'],
 [52,'2023-11-27','TL','up','2023-12-29'],[53,'2024-09-09','TL','neutral'],[54,'2024-12-15','TL','up','2024-12-31'],[55,'2025-09-05','TL','up','2025-09-30'],
 [56,'2025-10-02','TL','up','2025-12-31'],[57,'2026-03-01','TL','up','2026-03-31'],
 [58,'2018-09-05','CI','down',null],[59,'2021-02-17','CI','neutral'],[60,'2024-03-29','CI','unclear'],[61,'2026-06-12','CI','unclear'],
 [62,'2022-10','JP','up',null,{m:1}],[63,'2022-11-22','MS','down','63d',{note:'path call'}],[64,'2023-05-24','HA','unclear'],[65,'2023-07-07','ND','up','42d'],
 [66,'2023-07-24','MS','unclear'],[67,'2023-10','MS','down',null,{m:1}],[68,'2023-10-05','JP','down','63d',{note:'video title only'}],[69,'2023-11','TL','up',null,{m:1}],
 [70,'2023-12-08','RB','down','20d'],[71,'2024-04-30','BS','up','63d'],[72,'2024-06-30','ND','up','2024-12-31'],[73,'2024-07-08','MS','down','2024-11-04',{dup:9}],
 [74,'2024-07-17','RB','down','21d'],[75,'2024-09-04','RB','down','2024-09-30',{note:'conditional; later cancelled'}],[76,'2024-11','TL','up',null,{m:1}],
 [77,'2025-02-24','RB','down','21d'],[78,'2025-06-05','JP','down','21d',{note:'ex-JPM'}],[79,'2025-06-12','JP','up','10d'],[80,'2025-06-12','JP','down','2025-07-31'],
 [81,'2025-09-09','GS','up','2025-12-31'],[82,'2026-03-19','BH','down','21d'],[83,'2026-05','MS','up',null,{m:1}],[84,'2026-06','BS','neutral',null,{m:1}],
 [85,'2026-07','MS','unclear',null,{m:1}],[86,'2026-07-06','TL','up','2026-07-31'],[87,'2026-07-06','TL','down','2026-10-30'],[88,'2026-08-13','TL','up','2026-08-31'],
 [89,'2026-08-13','TL','down','2026-09-30',{start:'2026-08-31'}],[90,'2026-08-25','BS','down','2026-12-31'],[91,'2026-08-25','PA','down','2026-12-31'],[92,'2026-09','MS','up',null,{m:1}],
 [93,'2026-09-17','BS','down','2026-10-30'],[94,'2026-09-28','MS','down','21d',{note:'conditional'}],[95,'2026-09-28','MS','up','2026-12-31'],[96,'2026-09-28','BH','unclear'],
 [97,'2026-10-20','RB','up','2026-11-30'],[98,'2026-10-24','MS','up','15d'],[99,'2026-10','TL','up',null,{m:1}],
].map(([id, date, g, dir, hz, o = {}]) => ({ id, date, g, dir, hz, ...o }));
if (calls.length !== 99) throw new Error('expected 99 calls, got ' + calls.length);

const ret = (i, k) => (i >= 0 && i + k < N) ? C[i + k] / C[i] - 1 : null;
const mdd = (i, k) => { if (i < 0 || i + k >= N) return null; let m = 0; for (let j = 1; j <= k; j++) m = Math.min(m, C[i + j] / C[i] - 1); return m; };
const hit = (dir, r) => r == null ? null : dir === 'up' ? r > 0 : r < 0;

function score(c, sameDay) {
  if (c.m) return { ...c, status: 'month-only' };
  let i = c.start ? onOrAfter(c.start) : sameDay ? onOrAfter(c.date) : firstAfter(c.date);
  const r21 = ret(i, 21), r63 = ret(i, 63), dd21 = mdd(i, 21);
  let rH = null, hzEnd = null;
  const hz = c.hz || '21d';
  if (hz.endsWith('d')) { const k = +hz.slice(0, -1); rH = ret(i, k); hzEnd = i + k < N ? D[i + k] : '(未到)'; }
  else { if (hz > D[N - 1]) hzEnd = '(未到)'; else { const j = lastOnOrBefore(hz); hzEnd = D[j]; rH = j > i ? C[j] / C[i] - 1 : null; } }
  return { ...c, entry: D[i], entryClose: C[i], r21, r63, dd21, rH, hzEnd,
    h21: hit(c.dir, r21), h63: hit(c.dir, r63), hH: hit(c.dir, rH) };
}
function wilson(k, n, z = 1.96) {
  if (!n) return [NaN, NaN]; const p = k / n, d = 1 + z * z / n, ctr = (p + z * z / (2 * n)) / d;
  const h = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d; return [ctr - h, ctr + h];
}
const pct = x => x == null || Number.isNaN(x) ? '—' : (100 * x).toFixed(1) + '%';

// Base rates: all overlapping windows starting 2018-01-02 whose end lies within data.
const s0 = onOrAfter('2018-01-02');
const base = k => { let up = 0, n = 0; for (let i = s0; i + k < N; i++) { n++; if (C[i + k] > C[i]) up++; } return up / n; };
let dd5 = 0, ddn = 0; for (let i = s0; i + 21 < N; i++) { ddn++; if (mdd(i, 21) <= -0.05) dd5++; }
const B = { up21: base(21), up63: base(63), dd5: dd5 / ddn };
console.log(`BASE 2018-01..: P(up21)=${pct(B.up21)} P(up63)=${pct(B.up63)} P(dd21<=-5%)=${pct(B.dd5)} (n21=${ddn})`);

for (const mode of ['next', 'same']) {
  const S = calls.map(c => score(c, mode === 'same'));
  if (mode === 'next') {
    console.log('\nPER-CALL (entry = first trading day after publication)');
    console.log('id|date|src|dir|entry|hzEnd|rH|hitH|r21|hit21|r63|hit63|dd21|flags');
    for (const s of S) console.log([s.id, s.date, s.g, s.dir, s.entry ?? '', s.hzEnd ?? '', pct(s.rH), s.hH ?? '', pct(s.r21), s.h21 ?? '', pct(s.r63), s.h63 ?? '', pct(s.dd21),
      [s.status, s.dup && 'dup-of-' + s.dup, s.glob && 'global', s.note].filter(Boolean).join(';')].join('|'));
  }
  const scored = S.filter(s => !s.dup && !s.m && (s.dir === 'up' || s.dir === 'down'));
  const agg = (arr, key) => { const v = arr.filter(s => s[key] != null); const k = v.filter(s => s[key]).length; return { k, n: v.length, ci: wilson(k, v.length) }; };
  const fmt = (a) => a.n ? `${a.k}/${a.n}=${pct(a.k / a.n)} [${pct(a.ci[0])},${pct(a.ci[1])}]` : '—';
  console.log(`\nAGG mode=${mode}`);
  console.log('group|dir|nAll|stated-hz hit|21d hit|63d hit|base(dir,21d)|base(dir,63d)|mean dd21|share dd21<=-5%');
  const groups = [...Object.keys(G), 'ALL'];
  for (const g of groups) for (const dir of ['up', 'down']) {
    const arr = scored.filter(s => (g === 'ALL' || s.g === g) && s.dir === dir);
    if (!arr.length) continue;
    const dds = arr.filter(s => s.dd21 != null).map(s => s.dd21);
    const b21 = dir === 'up' ? B.up21 : 1 - B.up21, b63 = dir === 'up' ? B.up63 : 1 - B.up63;
    console.log([g === 'ALL' ? 'ALL' : G[g], dir, arr.length, fmt(agg(arr, 'hH')), fmt(agg(arr, 'h21')), fmt(agg(arr, 'h63')), pct(b21), pct(b63),
      dds.length ? pct(dds.reduce((a, b) => a + b, 0) / dds.length) : '—', dds.length ? `${dds.filter(x => x <= -0.05).length}/${dds.length}` : '—'].join('|'));
  }
  // excluding global-equity proxies and video/paraphrase-only
  if (mode === 'next') {
    const strict = scored.filter(s => !s.glob);
    for (const dir of ['up', 'down']) { const a = strict.filter(s => s.dir === dir); console.log(`ALL-noGlobal|${dir}|${a.length}|${fmt(agg(a, 'hH'))}|${fmt(agg(a, 'h21'))}`); }
    // cluster: drop same-group same-dir calls whose entry is within 21 trading days of a kept call
    for (const dir of ['up', 'down']) {
      const kept = []; const a = scored.filter(s => s.dir === dir).sort((x, y) => x.entry < y.entry ? -1 : 1);
      for (const s of a) { const i = D.indexOf(s.entry); if (!kept.some(k => k.g === s.g && Math.abs(D.indexOf(k.entry) - i) < 21)) kept.push(s); }
      console.log(`ALL-declustered|${dir}|${kept.length}|${fmt(agg(kept, 'hH'))}|${fmt(agg(kept, 'h21'))}|dropped=${a.filter(s => !kept.includes(s)).map(s => s.id).join(',')}`);
    }
    // month-only sensitivity: entry = first trading day of month and of the 15th
    for (const day of ['01', '15']) {
      const ms = calls.filter(c => c.m && (c.dir === 'up' || c.dir === 'down')).map(c => score({ ...c, m: 0, date: c.date + '-' + day }, true));
      console.log(`MONTH-ONLY day=${day}: ` + ms.map(s => `#${s.id} ${s.dir} r21=${pct(s.r21)} hit=${s.h21}`).join('; '));
    }
    const counts = {}; for (const c of calls) { const k = c.dup ? 'dup' : c.m ? 'month-only:' + c.dir : c.dir; counts[k] = (counts[k] || 0) + 1; }
    console.log('COUNTS', JSON.stringify(counts));
  }
}
