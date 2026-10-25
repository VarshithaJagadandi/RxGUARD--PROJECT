/* RxGuard UI */
(function () {
  const { engine, i18n } = RX, $ = id => document.getElementById(id), D = RX_DATA;
  const state = { lang: 'en', entries: [], conds: new Set(), alls: new Set() };
  try { const l = localStorage.getItem('rxguard.lang'); if (l && i18n.L[l]) state.lang = l; } catch (e) {}
  const t = (k, v) => { let s = (i18n.L[state.lang][k] ?? i18n.L.en[k] ?? k); if (v) for (const x in v) s = s.replace('{' + x + '}', v[x]); return s; };
  const nm = id => RX.byId[id].name;
  const COND = ['pregnant', 'kidney', 'liver', 'asthma', 'ulcer', 'heartfailure', 'diabetes', 'hypertension'];
  const ALL = ['penicillin', 'sulfa', 'nsaid', 'macrolide', 'fq', 'cephalosporin'];
  const FREQS = [['1', 'f_od'], ['2', 'f_bd'], ['3', 'f_tds'], ['4', 'f_qid'], ['sos', 'f_sos']];
  const SAMPLES = {
    sample_cardiac: { p: { age: 72, weight: 68, conds: ['kidney'] }, rx: 'Tab Warfarin 5mg OD\nAspirin 75mg OD\nDiclofenac 50mg TDS\nEnalapril 5mg OD\nSpironolactone 25mg OD\nPotassium chloride 600mg BD\nOmeprazole 20mg OD' },
    sample_child: { p: { age: 4, weight: 16, conds: [] }, rx: 'Paracetamol 500mg QID\nIbuprofen 400mg TDS\nAspirin 300mg BD\nCetirizine 5mg OD' },
    sample_pregnant: { p: { age: 27, weight: 58, conds: ['pregnant'] }, rx: 'Enalapril 5mg OD\nIbuprofen 400mg TDS\nDoxycycline 100mg BD\nIron tablet 1-0-1' },
    sample_diabetic: { p: { age: 58, weight: 74, conds: ['diabetes'] }, rx: 'Glimepiride 2mg OD\nFluconazole 150mg OD\nMetoprolol 50mg BD\nPrednisolone 10mg OD\nCiprofloxacin 500mg BD' },
    sample_tb: { p: { age: 29, weight: 52, conds: [] }, rx: 'Rifampicin 450mg OD\nIsoniazid 300mg OD\nMala-D 1 OD\nParacetamol 650mg TDS\nIbuprofen 400mg TDS' },
    sample_clean: { p: { age: 30, weight: 62, conds: [] }, rx: 'Amoxicillin 500mg TDS\nDolo 650 1-1-1\nCetirizine 10mg OD' }
  };

  const ICON = { sample_cardiac: '❤️', sample_child: '🧒', sample_pregnant: '🤰', sample_diabetic: '🩸', sample_tb: '🫁', sample_clean: '✅' };
  /* ---------- theme ---------- */
  function setTheme(th, save) {
    document.documentElement.setAttribute('data-theme', th);
    const m = document.getElementById('metaTheme'); if (m) m.content = th === 'light' ? '#ffffff' : '#071231';
    const b = $('themeBtn'); if (b) { const l = t(th === 'light' ? 'themeToDark' : 'themeToLight'); b.title = l; b.setAttribute('aria-label', l); }
    if (save) try { localStorage.setItem('rxguard.theme', th); } catch (e) {}
  }
  const curTheme = () => document.documentElement.getAttribute('data-theme') || 'dark';
  /* ---------- static text / controls ---------- */
  function applyText() {
    document.documentElement.lang = state.lang;
    document.querySelectorAll('[data-t]').forEach(e => e.textContent = t(e.dataset.t));
    document.querySelectorAll('[data-ph]').forEach(e => e.placeholder = t(e.dataset.ph));
    document.querySelectorAll('.langs button').forEach(b => b.classList.toggle('on', b.dataset.lang === state.lang));
    $('medFreq').innerHTML = FREQS.map(([v, k]) => `<option value="${v}">${t(k)}</option>`).join('');
    const mk = (box, list, set, pre) => { box.innerHTML = list.map(k => `<button type="button" class="chip warn${set.has(k) ? ' on' : ''}" data-k="${k}" aria-pressed="${set.has(k)}">${t(pre + k)}</button>`).join(''); };
    mk($('condChips'), COND, state.conds, 'cond_'); mk($('allChips'), ALL, state.alls, 'all_');
    $('samples').innerHTML = Object.keys(SAMPLES).map(k => `<button type="button" class="chip sample" data-s="${k}"><em>${ICON[k]||'💊'}</em>${t(k)}</button>`).join('');
    updateSpeakBtn(); setTheme(curTheme(), false);
  }
  function fillDatalist() {
    const o = []; D.drugs.forEach(d => { o.push(d.name); d.aliases.slice(0, 3).forEach(a => o.push(a)); });
    $('medlist').innerHTML = [...new Set(o)].sort().map(v => `<option value="${v}">`).join('');
  }

  /* ---------- helpers ---------- */
  const patient = () => ({ age: $('age').value === '' ? null : Number($('age').value), weight: $('weight').value === '' ? null : Number($('weight').value), conditions: [...state.conds], allergies: [...state.alls], otherAllergy: $('otherAllergy').value });
  const sevColor = { contraindicated: '#ff3b5c', major: '#ff8a2a', moderate: '#f5c518', minor: '#5aa9ff' };
  const bandColor = { none: '#6b7a99', low: '#2fe37a', review: '#f5c518', high: '#ff8a2a', critical: '#ff3b5c' };
  const num = n => Math.round(n * 100) / 100;
  function title(f) {
    const names = f.drugs.map(nm);
    if (f.type === 'interaction') return names.join(' + ');
    if (f.type === 'duplicate') return `${names[0]} — ${t('dupTitle')}`;
    if (f.type === 'dose') return `${names[0]} — ${t('doseTitle')}`;
    let s = f.subject, sub = s.kind === 'cond' ? t('cond_' + s.key) : s.kind === 'age' ? t('subjectAge', { age: s.age }) : s.kind === 'allergy' ? t('all_' + s.key) : t('subjectOther');
    return `${names[0]} · ${sub}`;
  }
  function detail(f) {
    if (f.type === 'dose') {
      const d = f.dose; let s = d.daily != null ? t('doseDaily', { daily: num(d.daily), cap: d.cap }) : t('doseSingle', { single: num(d.single), cap: d.cap });
      if (d.liver) s += t('doseLiver'); if (d.ped) s += t('doseChild', { weight: d.weight }); return s;
    }
    return f.note;
  }
  const evClass = { E: 'hi', P: 'md', T: 'lo' }, evConf = { E: 'high', P: 'medium', T: 'lowc' };
  let last = null;

  /* ---------- render ---------- */
  function renderMeds() {
    if (!state.entries.length) { $('meds').innerHTML = `<li class="empty">${t('noMeds')}</li>`; return; }
    $('meds').innerHTML = state.entries.map((e, i) => {
      const known = !!e.drugId, d = engine.dailyOf(e);
      const freqTxt = e.sos ? t('asNeeded') : e.freq != null ? '×' + e.freq : '';
      const dz = e.dose != null ? `${num(e.dose)} ${t('mg')} ${freqTxt}${d != null ? `<br><small>${num(d)} ${t('mg')} ${t('daily')}</small>` : ''}` : '';
      return `<li class="med${known ? '' : ' unk'}"><span class="pill"></span><div class="nm"><b>${known ? nm(e.drugId) : escapeHtml(e.name || e.raw)}</b><small>${known ? escapeHtml(e.raw && e.raw !== nm(e.drugId) ? e.raw : '') : t('notRecognised')}</small></div><div class="dz">${dz}</div><button type="button" data-rm="${i}" aria-label="${t('remove')}">×</button></li>`;
    }).join('');
  }
  const escapeHtml = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function render() {
    renderMeds();
    const r = last = engine.analyze(state.entries, patient());
    // score
    const col = bandColor[r.band]; const ps = $('pScore'); ps.style.setProperty('--sc', col);
    $('scoreNum').textContent = r.band === 'none' ? '–' : r.score;
    $('ringArc').setAttribute('stroke-dasharray', `${(r.band === 'none' ? 0 : r.score) / 100 * 314} 314`);
    $('band').textContent = t('band_' + r.band);
    $('counts').innerHTML = ['contraindicated', 'major', 'moderate', 'minor'].map(k => `<div class="cnt" style="--c:${sevColor[k]}"><b>${r.counts[k]}</b>${t('sev_' + k)}</div>`).join('');
    $('cov').textContent = `${r.recognized}/${r.total}`; $('covBar').style.width = (r.total ? r.recognized / r.total * 100 : 0) + '%';
    // findings
    let h = '';
    if (r.unknown.length) h += `<div class="unk-note">⚠ ${t('notRecognised')}: <b>${r.unknown.map(u => escapeHtml(u.name || u.raw)).join(', ')}</b></div>`;
    if (!r.recognized) h += `<p class="empty">${t('empty')}</p>`;
    else if (!r.findings.length) h += `<div class="okbox"><b>✔ ${t('none')}</b><p>${t('noneNote')}</p></div>`;
    h += r.findings.map(f => `<article class="finding ${f.sev}"><div class="fh"><div class="ft">${escapeHtml(title(f))}</div><span class="sev">${t('sev_' + f.sev)}</span></div>
      <p class="why">${t('cat_' + f.cat)}</p>
      <p class="do"><b>${t('whatToDo')}:</b> ${t('act_' + f.sev)}</p>
      <div class="meta"><span class="${evClass[f.ev]}">${t('confidence')}: ${t(evConf[f.ev])}</span><span>${t('evidence')}: ${t('ev_' + f.ev)}</span></div>
      <p class="detail">${state.lang !== 'en' && f.type !== 'dose' ? t('detail') + ': ' : ''}${escapeHtml(detail(f))}</p></article>`).join('');
    $('results').innerHTML = h;
  }

  /* ---------- actions ---------- */
  function addFromForm() {
    const name = $('medName').value.trim(); if (!name) return;
    const f = $('medFreq').value, dose = $('medDose').value === '' ? null : Number($('medDose').value);
    state.entries.push({ name, raw: name, drugId: engine.findDrug(name), dose, freq: f === 'sos' ? null : Number(f), sos: f === 'sos' });
    $('medName').value = ''; $('medDose').value = ''; render(); $('medName').focus();
  }
  function loadSample(k) {
    const s = SAMPLES[k]; state.conds = new Set(s.p.conds); state.alls = new Set();
    $('age').value = s.p.age; $('weight').value = s.p.weight; $('otherAllergy').value = '';
    state.entries = engine.parseText(s.rx); applyText(); render();
    $('pResult').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function summaryText() {
    const r = last, p = patient(), L = [];
    L.push(t('printTitle')); L.push(`${t('patientLine')}: ${p.age ?? '?'} y, ${p.weight ?? '?'} kg; ${[...p.conditions.map(c => t('cond_' + c)), ...p.allergies.map(a => t('all_' + a))].join(', ') || '—'}`);
    L.push(`${t('medsLine')}: ${state.entries.map(e => (e.drugId ? nm(e.drugId) : e.name || e.raw) + (e.dose != null ? ' ' + num(e.dose) + t('mg') : '')).join('; ') || '—'}`);
    L.push(`${t('score')}: ${r.band === 'none' ? '–' : r.score}/100 — ${t('band_' + r.band)}`);
    r.findings.forEach(f => L.push(`[${t('sev_' + f.sev)}] ${title(f)} — ${t('cat_' + f.cat)}`));
    L.push(t('noneNote')); return L.join('\n');
  }
  let speaking = false;
  function updateSpeakBtn() { $('btnSpeak').textContent = (speaking ? '⏹ ' + t('stop') : '🔊 ' + t('readAloud')); }
  function speak() {
    if (!('speechSynthesis' in window)) return;
    if (speaking) { speechSynthesis.cancel(); speaking = false; updateSpeakBtn(); return; }
    const r = last, parts = [`${t('score')} ${r.band === 'none' ? '' : r.score}. ${t('band_' + r.band)}.`];
    r.findings.filter(f => f.sev === 'contraindicated' || f.sev === 'major').slice(0, 6).forEach(f => parts.push(`${title(f)}. ${t('cat_' + f.cat)}. ${t('act_' + f.sev)}`));
    const u = new SpeechSynthesisUtterance(parts.join(' ')); u.lang = i18n.SPEECH[state.lang]; u.rate = 0.92;
    u.onend = u.onerror = () => { speaking = false; updateSpeakBtn(); };
    speaking = true; updateSpeakBtn(); speechSynthesis.speak(u);
  }
  function doPrint() {
    const p = patient();
    $('printHead').innerHTML = `<h1>${t('printTitle')}</h1><p>${t('generated')}: ${new Date().toLocaleString()}</p><p>${t('patientLine')}: ${p.age ?? '?'} y, ${p.weight ?? '?'} kg · ${[...p.conditions.map(c => t('cond_' + c)), ...p.allergies.map(a => t('all_' + a))].join(', ') || '—'}</p><p>${t('noneNote')}</p>`;
    window.print();
  }

  /* ---------- wiring ---------- */
  function bind() {
    $('btnAdd').onclick = addFromForm;
    ['medName', 'medDose'].forEach(id => $(id).addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); addFromForm(); } }));
    $('btnParse').onclick = () => { const x = engine.parseText($('pasteBox').value); if (x.length) { state.entries.push(...x.map(e => Object.assign(e, { name: e.raw }))); $('pasteBox').value = ''; render(); } };
    $('btnClear').onclick = () => { state.entries = []; state.conds.clear(); state.alls.clear(); ['age', 'weight', 'otherAllergy'].forEach(i => $(i).value = ''); applyText(); render(); };
    $('meds').addEventListener('click', e => { const b = e.target.closest('[data-rm]'); if (b) { state.entries.splice(+b.dataset.rm, 1); render(); } });
    const tog = (box, set) => box.addEventListener('click', e => { const b = e.target.closest('[data-k]'); if (!b) return; const k = b.dataset.k; set.has(k) ? set.delete(k) : set.add(k); b.classList.toggle('on'); b.setAttribute('aria-pressed', set.has(k)); render(); });
    tog($('condChips'), state.conds); tog($('allChips'), state.alls);
    $('samples').addEventListener('click', e => { const b = e.target.closest('[data-s]'); if (b) loadSample(b.dataset.s); });
    ['age', 'weight', 'otherAllergy'].forEach(i => $(i).addEventListener('input', render));
    document.querySelector('.langs').addEventListener('click', e => { const b = e.target.closest('[data-lang]'); if (!b) return; state.lang = b.dataset.lang; try { localStorage.setItem('rxguard.lang', state.lang); } catch (x) {} if (speaking) { speechSynthesis.cancel(); speaking = false; } applyText(); render(); });
    $('themeBtn').onclick = () => setTheme(curTheme() === 'light' ? 'dark' : 'light', true);
    $('ctaSample').onclick = () => loadSample('sample_cardiac');
    $('ctaStart').onclick = () => { $('pRx').scrollIntoView({ behavior: 'smooth', block: 'start' }); $('medName').focus({ preventScroll: true }); };
    $('btnSpeak').onclick = speak; $('btnPrint').onclick = doPrint;
    $('btnCopy').onclick = async () => { try { await navigator.clipboard.writeText(summaryText()); const b = $('btnCopy'); b.textContent = '✔ ' + t('copied'); setTimeout(() => b.textContent = t('copy'), 1500); } catch (e) { prompt(t('copy'), summaryText()); } };
    if (!('speechSynthesis' in window)) $('btnSpeak').style.display = 'none';
  }
  bind(); fillDatalist(); applyText(); render();
  $('offline').classList.add('ready');
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) navigator.serviceWorker.register('sw.js').catch(() => {});
  RX.app = { state, render, loadSample };
})();
