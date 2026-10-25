/* RxGuard checking engine — pure logic, no DOM (runs in browser and Node). */
(function (G) {
  const D = G.RX_DATA, RX = G.RX = G.RX || {};
  const byId = {}; D.drugs.forEach(x => byId[x.id] = x);
  const SEV = { contraindicated: 4, major: 3, moderate: 2, minor: 1 };
  const EVR = { E: 3, P: 2, T: 1 };
  const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const aliasRe = [];
  D.drugs.forEach(x => [x.name, ...x.aliases].forEach(a => aliasRe.push([a.toLowerCase(), x.id, new RegExp('(^|[^a-z0-9])' + esc(a.toLowerCase()) + '($|[^a-z0-9])')])));
  aliasRe.sort((a, b) => b[0].length - a[0].length);

  function findDrug(text) {
    const t = ' ' + String(text).toLowerCase().replace(/[^a-z0-9+\-. ]/g, ' ') + ' ';
    for (const [, id, re] of aliasRe) if (re.test(t)) return id;
    return null;
  }
  const matches = (key, drug) => key.startsWith('c:') ? drug.classes.includes(key.slice(2)) : drug.id === key;

  const FREQ = { od: 1, bd: 2, tds: 3, qid: 4 };
  function parseLine(raw) {
    const line = raw.trim(); if (!line) return null;
    const lower = line.toLowerCase();
    const drugId = findDrug(lower);
    let freq = null, sos = false, rest = lower;
    const pat = rest.match(/(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)(?:\s*-\s*(\d+(?:\.\d+)?))?/);
    if (pat) { freq = pat.slice(1).filter(Boolean).reduce((s, v) => s + parseFloat(v), 0); rest = rest.replace(pat[0], ' '); }
    else if (/\b(sos|prn|if needed|as needed)\b/.test(rest)) sos = true;
    else if (/\b(qid|qds|four times|4 times)\b/.test(rest)) freq = 4;
    else if (/\b(tds|tid|thrice|three times|3 times)\b/.test(rest)) freq = 3;
    else if (/\b(bd|bid|twice|two times|2 times)\b/.test(rest)) freq = 2;
    else if (/\b(od|qd|hs|nocte|once|daily|1 time)\b/.test(rest)) freq = 1;
    let dose = null;
    const m = rest.match(/(\d+(?:\.\d+)?)\s*(mg|mcg|µg|ug|g)\b/);
    if (m) { dose = parseFloat(m[1]); const u = m[2]; if (u === 'g') dose *= 1000; else if (u !== 'mg') dose /= 1000; }
    else {
      let r2 = rest; if (drugId) aliasRe.forEach(([, id, re]) => { if (id === drugId) r2 = (' ' + r2 + ' ').replace(re, ' '); });
      const b = r2.match(/(?:^|[^0-9.])(\d{2,4}(?:\.\d+)?)(?:$|[^0-9])/); if (b) dose = parseFloat(b[1]);
    }
    return { raw: line, drugId, dose, freq, sos };
  }
  const parseText = text => String(text).split(/[\n;,]+/).map(parseLine).filter(Boolean);

  function dailyOf(e) {
    if (e.dose == null) return null;
    if (e.sos) return e.dose * 4;
    if (e.freq == null) return null;
    return e.dose * e.freq;
  }

  function analyze(entries, p) {
    p = Object.assign({ age: null, weight: null, sex: 'f', conditions: [], allergies: [], otherAllergy: '' }, p || {});
    const findings = [], unknown = [], seen = {};
    const add = f => findings.push(f);
    // resolve
    const resolved = entries.map(e => {
      const id = e.drugId || findDrug(e.name || e.raw || '');
      if (!id) unknown.push(e);
      return Object.assign({}, e, { drugId: id });
    });
    const known = resolved.filter(e => e.drugId);
    const drugs = [...new Set(known.map(e => e.drugId))];
    // same drug entered twice + summed dose
    const daily = {};
    known.forEach(e => { seen[e.drugId] = (seen[e.drugId] || 0) + 1; const dd = dailyOf(e); if (dd != null) daily[e.drugId] = (daily[e.drugId] || 0) + dd; });
    Object.keys(seen).forEach(id => { if (seen[id] > 1) add({ type: 'duplicate', sev: 'major', cat: 'duplication', ev: 'E', drugs: [id], note: 'The same medicine appears ' + seen[id] + ' times (possibly under different brand names). Doses add up.' }); });

    // pairwise interactions
    const cand = [];
    D.interactions.forEach(r => cand.push({ a: r[0], b: r[1], sev: r[2], cat: r[3], ev: r[4], note: r[5], spec: (r[0].startsWith('c:') ? 0 : 1) + (r[1].startsWith('c:') ? 0 : 1) }));
    Object.keys(D.dup).forEach(c => cand.push({ a: 'c:' + c, b: 'c:' + c, sev: D.dup[c], cat: 'duplication', ev: 'E', note: 'Two medicines of the same type (' + c.toUpperCase() + ') — duplicated effect and higher overdose/side-effect risk.', spec: -1 }));
    for (let i = 0; i < drugs.length; i++) for (let j = i + 1; j < drugs.length; j++) {
      const X = byId[drugs[i]], Y = byId[drugs[j]]; let best = null;
      cand.forEach(r => {
        if (!((matches(r.a, X) && matches(r.b, Y)) || (matches(r.a, Y) && matches(r.b, X)))) return;
        const k = [SEV[r.sev], r.spec, EVR[r.ev]];
        if (!best || k[0] > best.k[0] || (k[0] === best.k[0] && (k[1] > best.k[1] || (k[1] === best.k[1] && k[2] > best.k[2])))) best = Object.assign({ k }, r);
      });
      if (best) add({ type: 'interaction', sev: best.sev, cat: best.cat, ev: best.ev, drugs: [X.id, Y.id], note: best.note });
    }
    // "triple whammy"
    const hasC = c => drugs.filter(id => byId[id].classes.includes(c));
    if (hasC('nsaid').length && hasC('raas').length && hasC('diuretic').length)
      add({ type: 'interaction', sev: 'major', cat: 'kidney', ev: 'E', drugs: [hasC('nsaid')[0], hasC('raas')[0], hasC('diuretic')[0]], note: 'NSAID + ACE inhibitor/ARB + diuretic ("triple whammy") sharply raises the risk of acute kidney injury.' });

    // patient conditions
    const conds = new Set(p.conditions);
    D.conditionRules.forEach(([c, key, sev, cat, ev, note]) => {
      if (!conds.has(c)) return;
      drugs.forEach(id => { if (matches(key, byId[id])) add({ type: 'patient', subject: { kind: 'cond', key: c }, sev, cat, ev, drugs: [id], note }); });
    });
    const age = p.age != null && p.age !== '' ? Number(p.age) : null;
    if (age != null && !isNaN(age)) D.ageRules.forEach(([kind, lim, key, sev, cat, ev, note]) => {
      if (kind === 'child' ? age < lim : age >= lim)
        drugs.forEach(id => { if (matches(key, byId[id])) add({ type: 'patient', subject: { kind: 'age', age }, sev, cat, ev, drugs: [id], note }); });
    });
    // allergies
    const other = String(p.otherAllergy || '').trim();
    const otherIds = other ? other.split(/[,;\n]+/).map(findDrug).filter(Boolean) : [];
    drugs.forEach(id => {
      const dr = byId[id];
      p.allergies.forEach(a => (D.allergyMap[a] || []).forEach(k => { if (matches(k, dr)) add({ type: 'allergy', subject: { kind: 'allergy', key: a }, sev: 'contraindicated', cat: 'allergy', ev: 'E', drugs: [id], note: 'Patient is recorded as allergic to this drug group.' }); }));
      D.allergyCross.forEach(([a, k, sev, note]) => { if (p.allergies.includes(a) && matches(k, dr)) add({ type: 'allergy', subject: { kind: 'allergy', key: a }, sev, cat: 'allergy', ev: 'P', drugs: [id], note }); });
      if (otherIds.includes(id)) add({ type: 'allergy', subject: { kind: 'other' }, sev: 'contraindicated', cat: 'allergy', ev: 'E', drugs: [id], note: 'This medicine matches the "other allergy" entered.' });
    });
    // dose checks
    drugs.forEach(id => {
      const dr = byId[id], dd = daily[id]; if (dd == null || dr.weekly) return;
      const liver = conds.has('liver') && dr.liverMax;
      const cap = liver ? dr.liverMax : dr.max;
      if (cap != null && dd > cap) {
        const r = dd / cap;
        add({ type: 'dose', sev: r > 1.5 ? 'major' : 'moderate', cat: 'dose', ev: 'E', drugs: [id], dose: { daily: dd, cap, liver } , note: liver ? 'Maximum is reduced in liver disease.' : 'Above the usual adult maximum daily dose.' });
      }
      if (dr.ped && age != null && age < 12 && p.weight > 0) {
        const perDayCap = dr.ped.perDay * p.weight;
        const perDoseCap = dr.ped.perDose * p.weight;
        const singles = known.filter(e => e.drugId === id && e.dose != null).map(e => e.dose);
        if (dd > perDayCap * 1.05) add({ type: 'dose', sev: dd > perDayCap * 1.5 ? 'major' : 'moderate', cat: 'dose', ev: 'E', drugs: [id], dose: { daily: dd, cap: Math.round(perDayCap), ped: true, weight: p.weight }, note: 'Child dose by weight: usual maximum is ' + dr.ped.perDay + ' mg/kg/day.' });
        else if (singles.some(s => s > perDoseCap * 1.1)) add({ type: 'dose', sev: 'moderate', cat: 'dose', ev: 'E', drugs: [id], dose: { single: Math.max(...singles), cap: Math.round(perDoseCap), ped: true, weight: p.weight }, note: 'Single dose above ' + dr.ped.perDose + ' mg/kg for this child.' });
      }
    });

    findings.sort((a, b) => SEV[b.sev] - SEV[a.sev] || EVR[b.ev] - EVR[a.ev]);
    const w = { contraindicated: 40, major: 20, moderate: 8, minor: 2 };
    const counts = { contraindicated: 0, major: 0, moderate: 0, minor: 0 };
    let pen = 0; findings.forEach(f => { counts[f.sev]++; pen += w[f.sev]; });
    const score = Math.max(0, 100 - pen);
    const band = !known.length ? 'none' : score >= 90 ? 'low' : score >= 70 ? 'review' : score >= 40 ? 'high' : 'critical';
    return { findings, counts, score, band, total: resolved.length, recognized: known.length, unknown, daily, drugs };
  }
  RX.engine = { analyze, parseText, parseLine, findDrug, byId, dailyOf };
  RX.byId = byId;
})(globalThis);
