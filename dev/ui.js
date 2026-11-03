// ---- 画面(DOM を使うのはここだけ)
(() => {
'use strict';
/* global Igen, SAMPLE_TEXT, HELP_HTML */
const $ = (s) => document.querySelector(s);
const srcEl = $('#src'), hlEl = $('#hl'), msgEl = $('#msg'), viewEl = $('#view'), canvasEl = $('#canvas'), editEl = $('#edit'), inboxEl = $('#inbox'), formEl = $('#form'), viewKindEl = $('#viewKind');
const LINE_PX = 19.5;
const E = Igen.Edit;
let last = null;          // 最後の解析の結果
let lastOk = null;        // 最後にエラーなく解析できた結果(エラーの間は、この図を薄く出す)
let debounce = null;
let fileBase = 'igen', fileName = '', fileHandle = null, dirty = false, editGen = 0, docGen = 0;
// 画面の状態(テキストには書かない)。アイディアは書き換えの後も探せるよう、鍵({ name, nth })で持つ
// mandala: 盤面の中心、honeycomb: シートの根、hcParent: 広げる元の枠(null は根)、matrix: マトリックスの名前、mxCell: 書くマス [行, 列]、
// cl: 観点の並びの手法ごとの { target: 対象, vp: 観点の番号 }、mmParent: マインドマップで枝を伸ばす元(null はテーマ)
const CHECK = ['sixhats', 'osborn', 'scamper', 'triz'];
const LIST = ['defects', 'wishes', 'attributes'];
// ls: 欠点列挙法などの { target: 対象, item: 改善案を書く項目, vp: 特性の種類の番号 }、posmap: ポジショニングの名前、story: ストーリーボードのアイディア
const freshState = () => ({ mandala: null, honeycomb: null, hcParent: null, matrix: null, mxCell: null, cl: Object.fromEntries(CHECK.map((m) => [m, { target: null, vp: 0 }])), mmParent: null,
  ls: Object.fromEntries(LIST.map((m) => [m, { target: null, item: null, vp: 0 }])), posmap: null, story: null });
let st = freshState();
let selKeys = [];         // 選んでいるアイディア
let selGroup = null;      // 選んでいるグループ(名前)
let selSummary = false;   // 全体のまとめを選んでいる
let selOther = null;      // 選んでいる分類・観点・マトリックスの項目({ kind: 'class' | 'crit' | 'mxitem', value })
let focusKey = null;      // 表で押したセルの欄(5W1H の項目・比較の観点)

// ビューの選択欄(発散と収束で分ける)
for (const [ph, label] of [['d', '発散'], ['c', '収束']]) {
  const og = document.createElement('optgroup');
  og.label = label;
  for (const v of Igen.VIEWS.filter((x) => x.phase === ph)) og.append(new Option(v.label, v.id));
  viewKindEl.append(og);
}
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

// ---- 色付け
const escH = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const METHOD_RE = new RegExp(`^(${Object.keys(Igen.METHODS).join('|')})\\b`);
function hlLine(line) {
  let cut = line.length;
  for (let k = 0; k < line.length - 1; k++) if (line[k] === '/' && line[k + 1] === '/' && (k === 0 || line[k - 1] === ' ' || line[k - 1] === '\t')) { cut = k; break; }
  const body = line.slice(0, cut), cm = line.slice(cut);
  let h;
  const m = /^([ \t]+)(by|from|group|who|what|why|when|where|how|decision|reason|note|relate|cause|oppose|rank|score|row|col|class|weight|pos|scene|x|y|url|for|diff):(.*)$/.exec(body);
  if (m) {
    let v = escH(m[3]);
    if (m[2] === 'from') { const k = /^([ \t]*)(\S+)/.exec(m[3]); if (k && METHOD_RE.test(k[2]) && Object.hasOwn(Igen.METHODS, k[2])) v = `${k[1]}<span class="nu">${k[2]}</span>${escH(m[3].slice(k[0].length))}`; }
    if (m[2] === 'decision') v = v.replace(/\b(adopt|backup|drop)\b/, '<span class="nu">$1</span>');
    h = `${m[1]}<span class="kw">${m[2]}:</span>${v}`;
  } else {
    h = escH(body).replace(/^(theme|author|summary|group|matrix|sevencross|criterion|must|positioning|research):/, '<span class="kw">$1:</span>').replace(/^- /, '<span class="kw">-</span> ');
  }
  if (cm) h += `<span class="cm">${escH(cm)}</span>`;
  return h;
}
function updateHighlight() { hlEl.innerHTML = srcEl.value.split('\n').map(hlLine).join('\n') + '\n'; syncScroll(); }
function syncScroll() { hlEl.scrollTop = srcEl.scrollTop; hlEl.scrollLeft = srcEl.scrollLeft; }
srcEl.addEventListener('scroll', syncScroll);

// ---- 解析と描画
const editable = () => !!(last?.ok && debounce === null);
const ids = (r) => ({
  mandala: E.locate(r, st.mandala), honeycomb: E.locate(r, st.honeycomb), matrix: st.matrix, mxCell: st.mxCell,
  cl: Object.fromEntries(CHECK.map((m) => [m, { target: E.locate(r, st.cl[m].target), vp: st.cl[m].vp }])),
  ls: Object.fromEntries(LIST.map((m) => [m, { target: E.locate(r, st.ls[m].target) }])), posmap: st.posmap, story: storyId(r),
});
// 相談の文に入れる画面の状態(render の状態に、広げる元・伸ばす元・選んだ項目・特性の種類・選んでいるアイディアを足す)
const consultState = (r) => {
  const view = viewKindEl.value;
  return { ...ids(r), ls: Object.fromEntries(LIST.map((m) => [m, { target: E.locate(r, st.ls[m].target), vp: st.ls[m].vp }])),
    hcParent: E.locate(r, st.hcParent), mmParent: E.locate(r, st.mmParent), lsItem: LIST.includes(view) ? E.locate(r, st.ls[view].item) : null,
    sel: selKeys.map((k) => E.locate(r, k)).filter(Boolean) };
};
const storyId = (r) => E.locate(r, st.story) ?? r.ideas.find((n) => n.scenes.length)?.id ?? r.ideas[0]?.id ?? null;
const curPos = (r) => r.posmaps.find((m) => m.name === st.posmap) ?? r.posmaps[0] ?? null;
const curMatrix = (r) => r.matrices.find((m) => m.name === st.matrix) ?? r.matrices[0] ?? null;
function analyze() {
  let r;
  try { r = Igen.analyze(srcEl.value); } catch (e) {
    // 解析が止まったら、古い結果で編集させない(図を古い表示にし、図・入力欄からの書き換えを止める)
    last = { ok: false, diags: [{ level: 'error', cat: '内部エラー', line: 1, start: 0, end: 0, message: `解析の途中で止まりました(${e.message})。テキストを直すか、この内容を報告してください` }] };
    draw();
    renderDiagnostics(last.diags);
    return;
  }
  last = r;
  if (r.ok) lastOk = r;
  draw();
  renderDiagnostics(r.diags);
}
function draw() {
  const r = last?.ok ? last : lastOk;
  const stale = !last?.ok;
  viewEl.classList.toggle('stale', stale);
  if (!r) {
    canvasEl.textContent = '';
    canvasEl.append(el('div', 'empty', 'エラーを直すと図が出ます(左下の診断を見てください)。'));
  } else {
    let svg;
    try { svg = Igen.render(r, viewKindEl.value, ids(r)); } catch (e) { showInternal(`内部エラー(描画): ${e.message}`); return; }
    canvasEl.innerHTML = svg;
    if (!stale) addPieceButtons(r);
  }
  // 選択を、書き換えた後のテキストで探し直す
  if (!stale) {
    selKeys = selKeys.filter((k) => E.locate(last, k));
    if (selGroup && !last.groupMap.has(selGroup)) selGroup = null;
    if (selOther?.kind === 'class' && !Igen.sevenClasses(last).includes(selOther.value)) selOther = null;
    if (selOther?.kind === 'crit' && !last.criteria.some((c) => c.name === selOther.value)) selOther = null;
    if (selOther?.kind === 'scene' && !E.find(last, storyId(last))?.scenes[+selOther.value]) selOther = null;
    if (selOther?.kind === 'res' && !last.researches[+selOther.value]) selOther = null;
  }
  markSelection();
  buildInbox();
  buildForm();
}
function markSelection() {
  canvasEl.querySelectorAll('.selected').forEach((g) => { g.classList.remove('selected'); if (!g.getAttribute('class')) g.removeAttribute('class'); });
  if (!last?.ok) return;
  for (const k of selKeys) { const id = E.locate(last, k); if (id) canvasEl.querySelectorAll(`[data-id="${CSS.escape(id)}"]`).forEach((g) => g.classList.add('selected')); }
  if (selGroup) canvasEl.querySelectorAll(`[data-group="${CSS.escape(selGroup)}"]`).forEach((g) => g.classList.add('selected'));
  if (selSummary) canvasEl.querySelector('[data-summary]')?.classList.add('selected');
  const attr = { class: 'data-sxc', crit: 'data-crit', mxitem: 'data-mxh', scene: 'data-scene', res: 'data-res' }[selOther?.kind];
  if (attr) canvasEl.querySelectorAll(`[${attr}="${CSS.escape(selOther.value)}"]`).forEach((g) => g.classList.add('selected'));
}
const clearSel = () => { selKeys = []; selGroup = null; selSummary = false; selOther = null; };

// ---- 診断
function renderDiagnostics(diags) {
  msgEl.textContent = '';
  const er = diags.filter((d) => d.level === 'error'), wr = diags.filter((d) => d.level === 'warn');
  const bar = el('div', 'bar');
  const sum = el('span', er.length ? 'err' : wr.length ? 'warn' : 'ok');
  sum.textContent = er.length || wr.length ? [er.length ? `エラー ${er.length} 件` : '', wr.length ? `警告 ${wr.length} 件` : ''].filter(Boolean).join('、') : 'エラーと警告はありません。';
  const copy = el('button', null, '修正依頼をコピー');
  copy.title = '診断とテキストを、生成 AI に渡す修正依頼の文としてコピーする';
  copy.addEventListener('click', () => {
    // 打った直後(解析を待つ間)なら、待たずに解析し直してから作る
    if (debounce !== null) { clearTimeout(debounce); debounce = null; analyze(); }
    copyText(Igen.toPrompt(last?.diags ?? diags, srcEl.value), msgEl.querySelector('.bar button') ?? copy);
  });
  bar.append(sum, copy);
  msgEl.append(bar);
  const groups = new Map();
  for (const d of [...er, ...wr]) { const k = `${d.level}|${d.cat}`; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(d); }
  for (const [k, list] of groups) {
    const [lv, cat] = k.split('|');
    const cls = lv === 'error' ? 'err' : 'warn';
    msgEl.append(el('div', `sec ${cls}`, `${lv === 'error' ? 'エラー' : '警告'}: ${cat}(${list.length} 件)`));
    const ul = el('ul');
    for (const d of list) {
      const li = el('li', cls, `${d.line} 行: ${d.message}`);
      li.style.cursor = 'pointer';
      li.title = `${d.line} 行の該当箇所を選ぶ`;
      li.addEventListener('click', () => selectText(d.start, Math.max(d.end, d.start)));
      ul.append(li);
    }
    msgEl.append(ul);
  }
}
function showInternal(m) { msgEl.prepend(el('div', 'err', m)); }
const copyTimers = new WeakMap();
async function copyText(text, btn) {
  let ok = true;
  try { await navigator.clipboard.writeText(text); }
  catch {
    const ta = document.createElement('textarea'); ta.value = text; document.body.append(ta); ta.select();
    try { ok = document.execCommand('copy'); } catch { ok = false; }
    ta.remove();
  }
  if (btn.dataset.label === undefined) btn.dataset.label = btn.textContent;
  clearTimeout(copyTimers.get(btn));
  btn.textContent = ok ? 'コピーしました' : 'コピーできませんでした';
  copyTimers.set(btn, setTimeout(() => { btn.textContent = btn.dataset.label; }, 2000));
}

// ---- 書き換えをテキスト欄に書き込む。変わった部分だけを、元に戻す(Ctrl+Z)の履歴に載る書き方で入れる
let applying = false;
function spliceSrc(nt) {
  const old = srcEl.value;
  let p = 0;
  while (p < old.length && p < nt.length && old[p] === nt[p]) p++;
  let q = 0;
  while (q < old.length - p && q < nt.length - p && old[old.length - 1 - q] === nt[nt.length - 1 - q]) q++;
  const hi = (c) => c >= 0xd800 && c <= 0xdbff, lo = (c) => c >= 0xdc00 && c <= 0xdfff;
  if (p > 0 && hi(old.charCodeAt(p - 1))) p--;
  if (q > 0 && lo(old.charCodeAt(old.length - q))) q--;
  const mid = nt.slice(p, nt.length - q);
  const top = srcEl.scrollTop;
  applying = true;
  try {
    srcEl.focus();
    srcEl.setSelectionRange(p, old.length - q);
    const done = mid ? document.execCommand('insertText', false, mid) : document.execCommand('delete');
    if (!done || srcEl.value !== nt) srcEl.value = nt; // execCommand が使えないブラウザでは直接書く(このときは Ctrl+Z で戻せない)
    srcEl.scrollTop = top;
  } finally { applying = false; }
  return p;
}
// o: { select: 書き換えの後に選ぶか(既定は選ぶ), refocus: 書き込んだ後に入力を戻す要素を探す関数 }
function applyEdit(res, o = {}) {
  if (!res || applying) return false;
  if (res.error) { showEditError(res.error); return false; }
  if (!editable()) { showEditError('いまは図から編集できません(テキストにエラーがあるか、描き直しの途中です)。'); return false; }
  if (srcEl.value === res.text) return false;
  const p = spliceSrc(res.text);
  if (o.select !== false && res.select !== undefined && res.select !== null) { selKeys = [res.select]; selGroup = null; selSummary = false; }
  updateHighlight();
  edited();
  persist();
  clearTimeout(debounce); debounce = null;
  analyze(); // 待たずに解析し直して描く(図とテキストを一致させる)
  scrollToOffset(p);
  const t = o.refocus ? o.refocus() : null;
  if (t) { t.focus(); if (t.select && o.selectAll) t.select(); } else srcEl.blur();
  return true;
}
function showEditError(msg) {
  let m = editEl.querySelector('.editerr');
  if (!m) { m = el('div', 'editerr'); editEl.prepend(m); }
  m.textContent = msg;
}
function clearEditError() { editEl.querySelector('.editerr')?.remove(); }
function scrollToOffset(pos) { const line = srcEl.value.slice(0, pos).split('\n').length; srcEl.scrollTop = Math.max(0, (line - 4) * LINE_PX); syncScroll(); }
function selectText(start, end) { srcEl.focus(); srcEl.setSelectionRange(start, end); scrollToOffset(start); }

// ---- 入力欄の部品。Enter で書き込み、欄を離れたときも書き込む。Escape で元に戻す。日本語入力の変換中の Enter は使わない
// onSet(値) は書き換えの結果を返す。role は書き込んだ後に入力を戻すための印
let fieldWrote = false, downInCanvas = false, armed = false, gotClick = false; // 図のクリックの送り直し(「図をクリックする」の節)
let troubleText = ''; // AI に相談: 困っていること(欄を作り直しても、エラーの間も残す)
const keptTyped = new Map(); // 入力欄の書きかけの文(役目ごと。欄を作り直しても、エラーの間も残す)
function field(parent, label, value, onSet, o = {}) {
  const lab = el('label', null, label);
  const inp = o.multi ? document.createElement('textarea') : document.createElement('input');
  inp.value = value ?? '';
  inp.dataset.role = o.role ?? label;
  if (o.multi) inp.rows = Math.max(2, inp.value.split('\n').length);
  if (o.ph) inp.placeholder = o.ph;
  if (o.cls) inp.className = o.cls;
  inp.disabled = !editable();
  let done = false;
  const commit = () => {
    if (done || inp.value === (value ?? '')) return;
    done = true;
    const ok = applyEdit(onSet(inp.value), { select: o.select, refocus: () => (o.stay ? (o.find ?? findRole)(inp.dataset.role) : null) });
    if (!ok) done = false;
  };
  inp.addEventListener('keydown', (e) => {
    if (e.isComposing || e.keyCode === 229) return;
    if (e.key === 'Enter' && !(o.multi && e.shiftKey)) { e.preventDefault(); commit(); }
    else if (e.key === 'Escape') { inp.value = value ?? ''; inp.blur(); }
  });
  if (!o.enterOnly) inp.addEventListener('change', () => { commit(); if (done) markFieldWrote(); });
  lab.append(inp);
  parent.append(lab);
  return inp;
}
const findRole = (role) => editEl.querySelector(`[data-role="${CSS.escape(role)}"]`);

// ---- 入力欄(右下の上段)。テーマ・書いた人と、ビューごとのアイディアの入力
const pickable = (r) => r.ideas.filter((n) => Igen.refOk(r, n));
const nameOf = (r, n) => (r.ideas.filter((x) => x.name === n.name).length > 1 ? `${n.name}(${n.line} 行)` : n.name);
function selectBox(parent, label, role, options, value, onChange) {
  const lab = el('label', null, label);
  const s = document.createElement('select');
  s.dataset.role = role;
  for (const [v, t] of options) s.append(new Option(t, v));
  s.value = value;
  s.disabled = !editable();
  s.addEventListener('change', () => onChange(s.value));
  lab.append(s);
  parent.append(lab);
  return s;
}
function buildInbox() {
  const act = document.activeElement, role = inboxEl.contains(act) ? act.dataset.role : null;
  // 書きかけの値は残す(足し終えた欄は空にする)
  // 欄がない間(テキストのエラーの間など)も残すので、画面の状態(keptTyped)に持つ
  for (const x of inboxEl.querySelectorAll('[data-role]')) { if (!x.dataset.keep) continue; if (x.dataset.clear || !x.value) keptTyped.delete(x.dataset.role); else keptTyped.set(x.dataset.role, x.value); }
  const typed = keptTyped;
  const selRange = role && act.selectionStart != null ? [act.selectionStart, act.selectionEnd] : null;
  inboxEl.textContent = '';
  const r = last?.ok ? last : null;
  const view = viewKindEl.value;
  const row = el('div', 'row');
  field(row, 'テーマ(theme)', r?.theme ?? '', (v) => E.setCommon(last, 'theme', v), { role: 'theme', stay: true });
  field(row, '書いた人(author)', r?.author ?? '', (v) => E.setCommon(last, 'author', v), { role: 'author', stay: true, ph: '自分の名前' });
  inboxEl.append(row);
  if (!r) { inboxEl.append(el('div', 'small', 'テキストのエラーを直すと、入力欄から書けます。')); restore(); return; }
  const themeOpt = ['', `テーマ: ${r.theme || '(テーマなし)'}`];
  // アイディアを 1 件足す入力欄。足したら空にして、続けて書けるようにする
  const adder = (label, froms, ph) => {
    const row2 = el('div', 'row');
    const inp = field(row2, label, '', (v) => { const x = E.addIdea(last, v, last.author, froms()); if (!x.error) inp.dataset.clear = '1'; return x; },
      { role: 'add', stay: true, select: false, enterOnly: true, cls: 'main', ph: ph ?? 'アイディアを書いて Enter で足す' });
    inp.dataset.keep = '1';
    if (!r.author) row2.append(el('span', 'small', '書いた人(author)を入れると、足したアイディアに by: が付きます'));
    inboxEl.append(row2);
  };
  // 1 行の入力欄(Enter で書き込む。書き込んだら空にする)
  const oneLine = (parent, label, role, fn, ph) => { const inp = field(parent, label, '', (v) => { const x = fn(v); if (!x.error) inp.dataset.clear = '1'; return x; }, { role, stay: true, enterOnly: true, ph }); inp.dataset.keep = '1'; return inp; };
  const row2 = el('div', 'row');
  if (view === 'list') adder('アイディア', () => ['direct']);
  else if (view === 'mandala') {
    if (!Igen.refOk(r, E.find(r, E.locate(r, st.mandala)))) st.mandala = null;
    const cid = E.locate(r, st.mandala), b = Igen.boardOf(r, cid);
    const cands = r.ideas.filter((n) => (r.boards.has(n.id) || n.id === cid) && Igen.refOk(r, n));
    selectBox(row2, '盤面の中心', 'board', [themeOpt, ...cands.map((n) => [n.id, nameOf(r, n)])], cid ?? '', (v) => { const n = E.find(last, v); st.mandala = n ? E.keyOf(last, n) : null; clearSel(); draw(); });
    if (cid) { const back = el('button', null, 'テーマの盤面に戻る'); back.addEventListener('click', () => { st.mandala = null; clearSel(); draw(); }); row2.append(back); }
    row2.append(el('span', 'small', b.cells.length >= 8 ? '8 マスが埋まっています(9 個目からは盤面に置けません)' : `空き ${8 - b.cells.length} マス`));
    inboxEl.append(row2);
    adder(`マスに書く(中心: ${b.center ? b.center.name : r.theme || 'テーマ'})`, () => { const c = E.find(last, E.locate(last, st.mandala)); return ['mandala', ...(c ? [c.name] : [])]; });
  } else if (view === 'honeycomb') {
    if (!Igen.refOk(r, E.find(r, E.locate(r, st.honeycomb)))) st.honeycomb = null;
    const rid = E.locate(r, st.honeycomb);
    const roots = r.ideas.filter((n) => !n.methods.some((m) => m.method === 'honeycomb') && Igen.refOk(r, n));
    selectBox(row2, 'シートの中心', 'sheet', [themeOpt, ...roots.map((n) => [n.id, `${nameOf(r, n)}${r.sheets.has(n.id) ? '' : '(新しいシート)'}`])], rid ?? '', (v) => { const n = E.find(last, v); st.honeycomb = n ? E.keyOf(last, n) : null; st.hcParent = null; clearSel(); draw(); });
    const pid = E.locate(r, st.hcParent), p = pid ? E.find(r, pid) : null;
    const root = rid ? E.find(r, rid) : null;
    row2.append(el('span', 'small', `枠をクリックすると、その枠の隣に広げて書けます。広げる元: ${p ? p.name : root ? root.name : r.theme || 'テーマ'}`));
    inboxEl.append(row2);
    adder(`隣に書く(元: ${p ? p.name : root ? root.name : r.theme || 'テーマ'})`, () => { const q = E.find(last, E.locate(last, st.hcParent)) ?? E.find(last, E.locate(last, st.honeycomb)); return ['honeycomb', ...(q ? [q.name] : [])]; });
  } else if (view === 'matrix') {
    const m = curMatrix(r);
    if (r.matrices.length > 1) selectBox(row2, 'マトリックス', 'matrix', r.matrices.map((x) => [x.name, x.name]), m.name, (v) => { st.matrix = v; st.mxCell = null; clearSel(); draw(); });
    oneLine(row2, '新しいマトリックスの名前(Enter で作る)', 'newmatrix', (v) => { const x = E.addMatrix(last, v); if (!x.error) { st.matrix = v.trim(); st.mxCell = null; } return x; }, '例: 対象者 × 場所');
    inboxEl.append(row2);
    if (!m) { addConsult(); return restore(); }
    const row3 = el('div', 'row');
    oneLine(row3, '縦の項目を足す', 'addrow', (v) => E.addMatrixItem(last, m.name, 'row', v));
    oneLine(row3, '横の項目を足す', 'addcol', (v) => E.addMatrixItem(last, m.name, 'col', v));
    inboxEl.append(row3);
    const cell = st.mxCell && m.rows[st.mxCell[0]] !== undefined && m.cols[st.mxCell[1]] !== undefined ? [m.rows[st.mxCell[0]], m.cols[st.mxCell[1]]] : null;
    if (cell) adder(`マスに書く(${cell[0]} × ${cell[1]})`, () => [`matrix ${cell[0]} × ${cell[1]}`]);
    else inboxEl.append(el('div', 'small', '表の組み合わせのマスをクリックすると、そのマスに書けます。'));
  } else if (CHECK.includes(view)) {
    const def = Igen.CHECKLISTS[view], c = st.cl[view];
    if (!Igen.refOk(r, E.find(r, E.locate(r, c.target)))) c.target = null; // 同じ名前がほかにある案などは対象にできない
    const tid = E.locate(r, c.target);
    selectBox(row2, '対象', 'target', [themeOpt, ...pickable(r).map((n) => [n.id, nameOf(r, n)])], tid ?? '', (v) => { const n = E.find(last, v); c.target = n ? E.keyOf(last, n) : null; draw(); });
    selectBox(row2, '観点', 'vp', def.items.map((x, i) => [String(i), x.label]), String(c.vp), (v) => { c.vp = +v; draw(); findRole('add')?.focus(); });
    row2.append(el('span', 'q', def.items[c.vp].q));
    inboxEl.append(row2);
    adder(`${def.items[c.vp].label}で書く`, () => { const t = E.find(last, E.locate(last, c.target)); return [`${view} ${def.items[c.vp].vp}`, ...(t ? [t.name] : [])]; });
  } else if (view === 'sevencross') {
    field(row2, '分類の軸(sevencross)', r.seven.axis, (v) => E.setSevenAxis(last, v), { role: 'axis', stay: true, ph: '例: 困りごとの種類' });
    if (r.seven.def) oneLine(row2, '分類を足す(class)', 'addclass', (v) => E.addSevenClass(last, v));
    row2.append(el('span', 'small', 'アイディアを選んでから、表のマスをクリックすると、その分類と重要度に置きます'));
    inboxEl.append(row2);
  } else if (view === 'mindmap') {
    const pid = E.locate(r, st.mmParent), p = pid ? E.find(r, pid) : null;
    row2.append(el('span', 'small', `枠をクリックすると、その枠から枝を伸ばして書けます。テーマをクリックすると、テーマから伸ばします。伸ばす元: ${p ? p.name : r.theme || 'テーマ'}`));
    inboxEl.append(row2);
    adder(`枝を伸ばして書く(元: ${p ? p.name : r.theme || 'テーマ'})`, () => { const q = E.find(last, E.locate(last, st.mmParent)); return ['mindmap', ...(q ? [q.name] : [])]; });
  } else if (LIST.includes(view)) {
    const L = Igen.LISTINGS[view], c = st.ls[view];
    if (!Igen.refOk(r, E.find(r, E.locate(r, c.target)))) c.target = null; // 同じ名前がほかにある案などは対象にできない
    const tid = E.locate(r, c.target);
    selectBox(row2, '対象', 'target', [themeOpt, ...pickable(r).map((n) => [n.id, nameOf(r, n)])], tid ?? '', (v) => { const n = E.find(last, v); c.target = n ? E.keyOf(last, n) : null; c.item = null; draw(); });
    if (L.items.length > 1) selectBox(row2, '特性の種類', 'lsvp', L.items.map((x, i) => [String(i), `${x}特性(${L.hint[x]})`]), String(c.vp), (v) => { c.vp = +v; draw(); findRole('add')?.focus(); });
    inboxEl.append(row2);
    const vp = L.items[c.vp] ?? L.items[0];
    adder(`${L.items.length > 1 ? `${vp}特性` : L.itemLabel}を書く`, () => { const t = E.find(last, E.locate(last, c.target)); return [`${view} ${vp}`, ...(t ? [t.name] : [])]; }, `${L.items.length > 1 ? `${vp}特性` : L.itemLabel}を書いて Enter で足す`);
    const item = E.find(r, E.locate(r, c.item));
    if (item) {
      const row3 = el('div', 'row');
      const inp = field(row3, `「${item.name}」の${L.impLabel}を書く`, '', (v) => { const x = E.addIdea(last, v, last.author, [`${view} ${L.improve}`, item.name]); if (!x.error) inp.dataset.clear = '1'; return x; },
        { role: 'improve', stay: true, select: false, enterOnly: true, cls: 'main', ph: `${L.impLabel}を書いて Enter で足す` });
      inp.dataset.keep = '1';
      inboxEl.append(row3);
    } else inboxEl.append(el('div', 'small', `図の${L.itemLabel}をクリックすると、その${L.itemLabel}の${L.impLabel}を書けます。`));
  } else if (view === 'positioning') {
    const m = curPos(r);
    if (r.posmaps.length > 1) selectBox(row2, 'ポジショニング', 'posmap', r.posmaps.map((x) => [x.name, x.name]), m.name, (v) => { st.posmap = v; clearSel(); draw(); });
    oneLine(row2, '新しいポジショニングの名前(Enter で作る)', 'newpos', (v) => { const x = E.addPosMap(last, v); if (!x.error) st.posmap = v.trim(); return x; }, '例: 費用と効果');
    inboxEl.append(row2);
    if (!m) { addConsult(); return restore(); }
    const row3 = el('div', 'row');
    const axisText = (a) => (a ? `${a.lo} .. ${a.hi}` : '');
    field(row3, '横の軸(x: 左 .. 右)', axisText(m.x), (v) => E.setPosAxis(last, m.name, 'x', v), { role: 'posx', stay: true, ph: '例: 安い .. 高い' });
    field(row3, '縦の軸(y: 下 .. 上)', axisText(m.y), (v) => E.setPosAxis(last, m.name, 'y', v), { role: 'posy', stay: true, ph: '例: 小さい .. 大きい' });
    row3.append(el('span', 'small', 'アイディアを選んでから、図の中をクリックすると、その位置に置きます'));
    inboxEl.append(row3);
  } else if (view === 'storyboard') {
    const sid = storyId(r);
    selectBox(row2, 'アイディア', 'story', r.ideas.map((n) => [n.id, `${nameOf(r, n)}${n.scenes.length ? `(${n.scenes.length} 場面)` : ''}`]), sid ?? '', (v) => { const n = E.find(last, v); st.story = n ? E.keyOf(last, n) : null; clearSel(); draw(); });
    inboxEl.append(row2);
    if (sid) {
      const row3 = el('div', 'row');
      oneLine(row3, '場面を足す(scene。Enter で足す)', 'addscene', (v) => E.addScene(last, storyId(last), v), '例: 昼休みに財布がないことに気づく');
      inboxEl.append(row3);
    }
  } else if (view === 'research') {
    const name = field(row2, '調べたもの(research)', '', () => null, { role: 'resname', enterOnly: true, ph: '製品・サービス・論文などの名前' });
    name.dataset.keep = '1';
    const url = field(row2, 'URL', '', () => null, { role: 'resurl', enterOnly: true, ph: 'https://…' });
    url.dataset.keep = '1';
    const fr = selectBox(row2, '関係する案', 'resfor', [['', '(あとで選ぶ)'], ...pickable(r).map((n) => [n.name, n.name])], '', () => {});
    const b = el('button', null, '調べたものを足す');
    b.disabled = !editable();
    const add = () => { const x = E.addResearch(last, name.value, url.value, fr.value); if (!x.error) { name.dataset.clear = '1'; url.dataset.clear = '1'; } applyEdit(x, { select: false, refocus: () => findRole('resname') }); };
    b.addEventListener('click', add);
    for (const f of [name, url]) f.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.isComposing && e.keyCode !== 229) add(); });
    row2.append(b);
    inboxEl.append(row2);
  } else if (view === 'compare') {
    const name = field(row2, '観点の名前', '', () => null, { role: 'critname', enterOnly: true });
    name.dataset.keep = '1';
    const kind = selectBox(row2, '種類', 'critkind', [['criterion', '評価の観点(1〜5)'], ['must', '必須の条件(○・×)']], 'criterion', () => {});
    const w = field(row2, '重み(評価の観点だけ。省略は 1)', '', () => null, { role: 'critweight', enterOnly: true, ph: '1' });
    w.dataset.keep = '1';
    const b = el('button', null, '観点を足す');
    b.disabled = !editable();
    const add = () => { const x = E.addCriterion(last, name.value, kind.value === 'must', w.value); if (!x.error) { name.dataset.clear = '1'; w.dataset.clear = '1'; } applyEdit(x, { select: false, refocus: () => findRole('critname') }); };
    b.addEventListener('click', add);
    name.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.isComposing && e.keyCode !== 229) add(); });
    row2.append(b);
    inboxEl.append(row2);
  }
  addConsult();
  restore();
  // AI に相談する文(仕様書 2.6 節)。いまのビューの状態と、困っていることを入れた文をコピーする
  function addConsult() {
    const row3 = el('div', 'row consult');
    const lab = el('label', null, 'AI に相談: 困っていること(任意)');
    const inp = document.createElement('input');
    inp.dataset.role = 'trouble'; inp.className = 'main';
    inp.value = troubleText;
    inp.addEventListener('input', () => { troubleText = inp.value; });
    inp.placeholder = '例: 似た案しか出ない / どれを残すか決められない';
    lab.append(inp);
    const b = el('button', null, 'AI に相談する文をコピー');
    b.title = 'テーマ・フェーズ・手法・いまの状態と、困っていることを入れた相談の文をコピーする。生成 AI に貼って使う';
    b.addEventListener('click', () => {
      // 打った直後(解析を待つ間)なら、待たずに解析し直してから作る
      if (debounce !== null) { clearTimeout(debounce); debounce = null; analyze(); }
      if (!last?.ok) { showEditError('テキストにエラーがあるので、相談の文を作れません。エラーを直してから押してください。'); return; }
      copyText(Igen.consultPrompt(last, viewKindEl.value, consultState(last), troubleText), findRole('consult') ?? b);
    });
    b.dataset.role = 'consult';
    row3.append(lab, b);
    inboxEl.append(row3);
  }
  function restore() {
    for (const [k, v] of typed) { const x = findRole(k); if (x) x.value = v; }
    if (role) { const x = findRole(role); if (x) { x.focus(); if (selRange && x.setSelectionRange && x.value) x.setSelectionRange(...selRange); } }
  }
}

// ---- 編集パネル(右下の下段)。選んだアイディア・グループ・まとめ・分類・観点・項目
function buildForm() {
  formEl.textContent = '';
  clearEditError();
  const r = last?.ok ? last : null;
  if (!r) return;
  const view = viewKindEl.value;
  const form = el('div', 'form');
  const btn = (parent, label, fn, title) => { const b = el('button', null, label); b.disabled = !editable(); if (title) b.title = title; b.addEventListener('click', fn); parent.append(b); return b; };
  const ideasSel = selKeys.map((k) => E.find(r, E.locate(r, k))).filter(Boolean);
  const groupNames = r.groups.map((g) => g.path);
  const done = () => { formEl.append(form); };
  // KJ 法: 選んだアイディアをグループにする・入れる・選んだ案から新しい案を作る
  const kjTools = (parent) => {
    const row = el('div', 'row');
    const gname = field(row, '新しいグループの名前', '', () => null, { role: 'newgroup', enterOnly: true });
    const mk = btn(row, 'グループにする', () => applyEdit(E.addToGroup(last, ideasSel.map((n) => n.id), gname.value.trim()), { select: false }), '選んだアイディアを、この名前のグループに入れる');
    gname.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.isComposing && e.keyCode !== 229) mk.click(); });
    if (groupNames.length) {
      const s = selectBox(row, '既存のグループ', 'pickgroup', groupNames.map((p) => [p, p]), groupNames[0], () => {});
      btn(row, 'このグループに入れる', () => applyEdit(E.addToGroup(last, ideasSel.map((n) => n.id), s.value), { select: false }));
    }
    parent.append(row);
    const row2 = el('div', 'row');
    field(row2, `選んだ ${ideasSel.length} 件から生まれた新しい案(Enter で足す)`, '', (v) => E.addIdea(last, v, last.author, ['kj', ...ideasSel.map((n) => n.name)]), { role: 'kjnew', enterOnly: true, cls: 'main', select: false });
    parent.append(row2);
  };
  if (selSummary && view === 'kj') {
    form.append(el('span', 'kind', '全体のまとめ'));
    field(form, 'まとめ(1 行に 1 文。改行は Shift+Enter)', r.summary.join('\n'), (v) => E.setSummary(last, v.split('\n')), { multi: true, role: 'summary', stay: true });
    return done();
  }
  if (selGroup && view === 'kj') {
    const g = r.groupMap.get(selGroup);
    if (!g) return;
    form.append(el('span', 'kind', 'グループ'));
    const parentPath = g.parent ? g.parent.path : '';
    const norm = (p) => p.split('::').map((x) => x.trim()).join('::');
    const regroup = (nw) => { const x = E.renameGroup(last, g.path, nw); if (!x.error) selGroup = norm(nw); return x; };
    field(form, '見出し', g.name, (v) => regroup(parentPath ? `${parentPath}::${v.trim()}` : v), { role: 'gname' });
    field(form, '上位グループ(なければ空)', parentPath, (v) => regroup(v.trim() ? `${v.trim()}::${g.name}` : g.name), { role: 'gparent', ph: '例: 大きなグループ' });
    field(form, '説明(note)', g.note ?? '', (v) => E.setGroupNote(last, g.path, v), { role: 'gnote' });
    done();
    const row = el('div', 'row');
    row.append(el('span', 'small', `アイディア ${g.members.length} 件`));
    g.rels.forEach((rel, i) => { const c = el('span', 'chip', `${Igen.REL[rel.kind]} → ${rel.to.path}`); btn(c, '消す', () => applyEdit(E.removeRelation(last, g.path, i)), 'この関係を消す'); row.append(c); });
    formEl.append(row);
    const others = groupNames.filter((p) => p !== g.path);
    if (others.length) {
      const row2 = el('div', 'row');
      const k = selectBox(row2, '関係', 'relkind', Object.entries(Igen.REL).map(([key, ja]) => [key, `${ja}(${key})`]), 'relate', () => {});
      const t = selectBox(row2, '相手のグループ', 'reltarget', others.map((p) => [p, p]), others[0], () => {});
      btn(row2, '関係を足す', () => applyEdit(E.addRelation(last, g.path, k.value, t.value)));
      formEl.append(row2);
    }
    return;
  }
  if (selOther?.kind === 'class' && view === 'sevencross') {
    const cls = selOther.value;
    form.append(el('span', 'kind', '分類'));
    field(form, '名前(class)', cls, (v) => { const x = E.renameSevenClass(last, cls, v); if (!x.error) selOther = { kind: 'class', value: v.trim() }; return x; }, { role: 'clsname' });
    const n = r.ideas.filter((x) => x.ranks.some((k) => k.cls === cls)).length;
    form.append(el('span', 'small', `置いたアイディア ${n} 件`));
    btn(form, 'この分類を消す', () => { selOther = null; applyEdit(E.removeSevenClass(last, cls)); }, '置いたアイディアがあるときは消せません');
    return done();
  }
  if (selOther?.kind === 'crit' && view === 'compare') {
    const c = r.criteria.find((x) => x.name === selOther.value);
    if (!c) return;
    form.append(el('span', 'kind', c.must ? '必須の条件(must)' : '評価の観点(criterion)'));
    field(form, '名前', c.name, (v) => { const x = E.renameCriterion(last, c.name, v); if (!x.error) selOther = { kind: 'crit', value: v.trim() }; return x; }, { role: 'critrename' });
    if (!c.must) field(form, '重み(weight。空なら 1)', c.def.attrs.find((a) => a.key === 'weight')?.text ?? '', (v) => E.setCriterionWeight(last, c.name, v), { role: 'critw' });
    btn(form, 'この観点を消す', () => { selOther = null; applyEdit(E.removeCriterion(last, c.name)); }, '評価したアイディアがあるときは消せません');
    return done();
  }
  if (selOther?.kind === 'scene' && view === 'storyboard') {
    const n = E.find(r, storyId(r)), i = +selOther.value, sc = n?.scenes[i];
    if (!sc) return;
    form.append(el('span', 'kind', `場面 ${i + 1}`));
    field(form, '場面(scene)', sc.text, (v) => E.setScene(last, n.id, i, v), { role: 'scenetext' });
    const b1 = btn(form, '前へ', () => { if (applyEdit(E.moveScene(last, n.id, i, -1))) { selOther = { kind: 'scene', value: String(i - 1) }; draw(); } });
    b1.disabled = b1.disabled || i === 0;
    const b2 = btn(form, '後ろへ', () => { if (applyEdit(E.moveScene(last, n.id, i, 1))) { selOther = { kind: 'scene', value: String(i + 1) }; draw(); } });
    b2.disabled = b2.disabled || i === n.scenes.length - 1;
    btn(form, 'この場面を消す', () => { selOther = null; applyEdit(E.setScene(last, n.id, i, '')); });
    return done();
  }
  if (selOther?.kind === 'res' && view === 'research') {
    const x = r.researches[+selOther.value];
    if (!x) return;
    form.append(el('span', 'kind', `調べたもの: ${x.name}`));
    field(form, 'URL(url)', x.url ?? '', (v) => E.setResearchAttr(last, x.name, 'url', v), { role: 'resurl2' });
    field(form, '違い(diff)', x.diff ?? '', (v) => E.setResearchAttr(last, x.name, 'diff', v), { role: 'resdiff' });
    field(form, 'メモ(note)', x.note ?? '', (v) => E.setResearchAttr(last, x.name, 'note', v), { role: 'resnote' });
    btn(form, '削除', () => { if (confirm(`「${x.name}」を消しますか?(Ctrl+Z で元に戻せます)`)) { selOther = null; applyEdit(E.removeResearch(last, x.name)); } });
    done();
    const row = el('div', 'row');
    x.fors.forEach((f, i) => { const c = el('span', 'chip', `関係する案: ${f.attr.text}`); btn(c, '外す', () => applyEdit(E.removeResearchFor(last, x.name, i))); row.append(c); });
    const pk = pickable(r);
    if (pk.length) {
      const fr = selectBox(row, '関係する案を足す', 'resfor2', pk.map((n) => [n.name, n.name]), pk[0].name, () => {});
      btn(row, '足す', () => applyEdit(E.addResearchFor(last, x.name, fr.value)));
    }
    formEl.append(row);
    return;
  }
  if (selOther?.kind === 'mxitem' && view === 'matrix') {
    const m = curMatrix(r);
    const [axis, i] = selOther.value.split('|');
    const item = m && (axis === 'row' ? m.rows : m.cols)[+i];
    if (!item) return;
    form.append(el('span', 'kind', `${axis === 'row' ? '縦' : '横'}の項目: ${item}`));
    btn(form, 'この項目を消す', () => { selOther = null; st.mxCell = null; applyEdit(E.removeMatrixItem(last, m.name, axis, item)); }, 'この項目の組み合わせから出したアイディアがあるときは消せません');
    return done();
  }
  if (ideasSel.length > 1 && view === 'kj') {
    form.append(el('span', 'kind', `選んだアイディア ${ideasSel.length} 件`));
    done();
    kjTools(formEl);
    return;
  }
  if (ideasSel.length !== 1) return;
  const n = ideasSel[0];
  form.append(el('span', 'kind', 'アイディア'));
  field(form, '名前', n.name, (v) => E.rename(last, n.id, v), { role: 'name' });
  field(form, '書いた人(by)', n.by ?? '', (v) => E.setAttr(last, n.id, 'by', v), { role: 'by' });
  if (view === 'w5') for (const k of Igen.W5) field(form, `${k}(${Igen.W5_JA[k]})`, n.w5[k] ?? '', (v) => E.setAttr(last, n.id, k, v), { role: `w5-${k}`, stay: true });
  else if (view === 'elim') {
    selectBox(form, '判断(decision)', 'decision', [['', '未判断'], ...Object.entries(Igen.DECISION).map(([k, ja]) => [k, `${ja}(${k})`])], n.decision ?? '',
      (v) => { if (!applyEdit(E.setAttr(last, n.id, 'decision', v), { refocus: () => findRole('decision') })) buildForm(); });
    field(form, '理由(reason)', n.reason ?? '', (v) => E.setAttr(last, n.id, 'reason', v), { role: 'reason' });
  } else if (view === 'compare') {
    for (const c of r.criteria) {
      const cur = n.scores.get(c.name)?.value;
      const opts = c.must ? [['', '未評価'], ['ok', '○ 満たす(ok)'], ['ng', '× 満たさない(ng)']] : [['', '未評価'], ...[1, 2, 3, 4, 5].map((v) => [String(v), String(v)])];
      selectBox(form, `${c.must ? '必須: ' : ''}${c.name}`, `cmp-${c.name}`, opts, cur === undefined ? '' : String(cur),
        (v) => { if (!applyEdit(E.setScore(last, n.id, c.name, v), { refocus: () => findRole(`cmp-${c.name}`) })) buildForm(); });
    }
    if (!r.criteria.length) form.append(el('span', 'small', '観点がまだありません。上の入力欄で足します。'));
  } else field(form, 'メモ(note)', n.note ?? '', (v) => E.setAttr(last, n.id, 'note', v), { role: 'note' });
  const btns = el('div', 'btns');
  if (view === 'mandala' && Igen.refOk(r, n) && E.locate(r, st.mandala) !== n.id) btn(btns, 'このアイディアを中心にした盤面を開く', () => { st.mandala = E.keyOf(last, n); clearSel(); draw(); });
  if (CHECK.includes(view) && Igen.refOk(r, n) && E.locate(r, st.cl[view].target) !== n.id) btn(btns, 'このアイディアを対象にする', () => { st.cl[view].target = E.keyOf(last, n); draw(); });
  btn(btns, '削除', () => {
    const x = E.remove(last, n.id);
    if (x.error) { showEditError(x.error); return; }
    if (confirm(`「${n.name}」を消しますか?${x.refs ? `\nほかのアイディアの from: から ${x.refs} か所で参照されています。消すと、その参照は警告になります。` : ''}\n(Ctrl+Z で元に戻せます)`)) { clearSel(); applyEdit(x, { select: false }); }
  });
  form.append(btns);
  done();
  const info = el('div', 'row');
  info.append(el('span', 'small', `出所: ${Igen.fromLabel(n)}`));
  for (const p of n.groups) { const c = el('span', 'chip', `グループ: ${p}`); if (view === 'kj') btn(c, '外す', () => applyEdit(E.removeFromGroup(last, n.id, p))); info.append(c); }
  if (view === 'positioning') {
    const m = curPos(r), p0 = m && n.pos.get(m.name);
    if (p0) { const c = el('span', 'chip', `位置: 横 ${p0.x}、縦 ${p0.y}`); btn(c, '外す', () => applyEdit(E.setPos(last, n.id, m.name, null))); info.append(c); }
    info.append(el('span', 'small', '図の中をクリックすると、このアイディアをその位置に置きます'));
  }
  if (view === 'storyboard' && storyId(r) !== n.id) btn(info, 'このアイディアのストーリーボードを開く', () => { st.story = E.keyOf(last, n); clearSel(); draw(); });
  if (view === 'sevencross') {
    for (const k of n.ranks) { const c = el('span', 'chip', `${k.cls}: 重要度 ${k.level}`); btn(c, '外す', () => applyEdit(E.setRank(last, n.id, k.cls, null))); info.append(c); }
    info.append(el('span', 'small', '表のマスをクリックすると、このアイディアをその分類と重要度に置きます'));
  }
  formEl.append(info);
  if (view === 'kj') kjTools(formEl);
  if (focusKey) { findRole(focusKey)?.focus(); focusKey = null; }
}

// ---- 図をクリックする
// 欄に書きかけのまま図を押すと、欄を離れたときの書き込みで図が描き直され、押した要素が入れ替わるので、ブラウザはクリックを送らない。
// そこで、欄を離れて書き込んだ直後の押し離しでクリックが届かなかったときは、離した位置の要素へクリックを送り直す
// 欄を離れたときの書き込みは、ブラウザによって、押した合図(pointerdown)の前にも後にも起きる。どちらでも同じ操作の中のことなので、
// 書き込みの印と押した位置の印は、その操作の処理が終わったら(setTimeout 0)消す。両方がそろったときだけ、送り直しの準備をする
function markFieldWrote() {
  fieldWrote = true;
  if (downInCanvas) armed = true;
  setTimeout(() => { fieldWrote = false; }, 0);
}
window.addEventListener('pointerdown', (e) => {
  armed = false;
  downInCanvas = e.button === 0 && canvasEl.contains(e.target);
  if (downInCanvas && fieldWrote) armed = true;
  setTimeout(() => { downInCanvas = false; }, 0);
}, true);
canvasEl.addEventListener('click', (e) => { if (e.isTrusted) gotClick = true; }, true);
canvasEl.addEventListener('pointerup', (e) => {
  if (!armed || e.button !== 0) { armed = false; return; }
  armed = false; gotClick = false;
  const p = { clientX: e.clientX, clientY: e.clientY, ctrlKey: e.ctrlKey, metaKey: e.metaKey, shiftKey: e.shiftKey, altKey: e.altKey };
  setTimeout(() => {
    if (gotClick) return; // ふつうにクリックが届いた
    const t = document.elementFromPoint(p.clientX, p.clientY);
    if (t && canvasEl.contains(t)) t.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, ...p }));
  }, 0);
});
canvasEl.addEventListener('click', (e) => {
  const t = e.target;
  if (t.closest('.tbtns')) return;
  const r = last?.ok ? last : null;
  const view = viewKindEl.value;
  const sel = (keys) => { selKeys = keys; selGroup = null; selSummary = false; selOther = null; };
  const refresh = () => { markSelection(); buildInbox(); buildForm(); };
  const vp = t.closest('[data-vp]');
  if (vp && !t.closest('[data-id]') && st.cl[view]) { st.cl[view].vp = +vp.getAttribute('data-vp'); draw(); findRole('add')?.focus(); return; }
  if (t.closest('[data-cell]')) { clearSel(); draw(); findRole('add')?.focus(); return; }
  if (!r || viewEl.classList.contains('stale')) return;
  const mx = t.closest('[data-mx]');
  if (mx && !t.closest('[data-id]')) { st.mxCell = mx.getAttribute('data-mx').split('|').map(Number); clearSel(); draw(); findRole('add')?.focus(); return; }
  const mxh = t.closest('[data-mxh]');
  if (mxh) { clearSel(); selOther = { kind: 'mxitem', value: mxh.getAttribute('data-mxh') }; refresh(); return; }
  const sx = t.closest('[data-sx]');
  if (sx && !t.closest('[data-id]')) {
    const [cls, lv] = sx.getAttribute('data-sx').split(/\|(?=\d+$)/);
    const one = selKeys.length === 1 ? E.locate(r, selKeys[0]) : null;
    if (!one) { showEditError('先にアイディアをクリックで選んでから、表のマスをクリックしてください。'); return; }
    applyEdit(E.setRank(last, one, cls, +lv));
    return;
  }
  const sxc = t.closest('[data-sxc]');
  if (sxc) { clearSel(); selOther = { kind: 'class', value: sxc.getAttribute('data-sxc') }; refresh(); return; }
  const crit = t.closest('[data-crit]');
  if (crit) { clearSel(); selOther = { kind: 'crit', value: crit.getAttribute('data-crit') }; refresh(); return; }
  const sc = t.closest('[data-scene]');
  if (sc) { clearSel(); selOther = { kind: 'scene', value: sc.getAttribute('data-scene') }; refresh(); return; }
  const rs = t.closest('[data-res]');
  if (rs) { clearSel(); selOther = { kind: 'res', value: rs.getAttribute('data-res') }; refresh(); return; }
  const plot = t.closest('[data-plot]');
  if (plot && !t.closest('[data-id]')) {
    const one = selKeys.length === 1 ? E.locate(r, selKeys[0]) : null;
    if (!one) { showEditError('先にアイディアをクリックで選んでから、図の中をクリックしてください。'); return; }
    const svg = canvasEl.querySelector('svg'), pt = svg.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const q = pt.matrixTransform(svg.getScreenCTM().inverse());
    const [x0, y0, size] = plot.getAttribute('data-plot').split('|').map(Number), M = Igen.POS_MAX;
    applyEdit(E.setPos(last, one, curPos(r).name, (q.x - x0) / size * 2 * M - M, M - (q.y - y0) / size * 2 * M));
    return;
  }
  if (t.closest('[data-mmroot]')) { st.mmParent = null; clearSel(); refresh(); findRole('add')?.focus(); return; }
  const cell = t.closest('[data-w5],[data-cmp]');
  const g = t.closest('[data-id]');
  if (cell || g) {
    const id = cell ? (cell.getAttribute('data-w5') ?? cell.getAttribute('data-cmp')).split('|')[0] : g.getAttribute('data-id');
    const n = E.find(r, id);
    if (!n) return;
    const key = E.keyOf(r, n);
    if (view === 'kj' && (e.ctrlKey || e.metaKey || e.shiftKey)) {
      const i = selKeys.findIndex((k) => E.locate(r, k) === id);
      const keys = [...selKeys];
      if (i >= 0) keys.splice(i, 1); else keys.push(key);
      sel(keys);
    } else sel([key]);
    if (cell?.hasAttribute('data-w5')) focusKey = `w5-${cell.getAttribute('data-w5').split('|')[1]}`;
    if (cell?.hasAttribute('data-cmp')) focusKey = `cmp-${cell.getAttribute('data-cmp').split('|').slice(1).join('|')}`;
    // 蜂の巣ノートは押した枠の隣に、マインドマップは押した枠から書く
    const asSource = view === 'honeycomb' || view === 'mindmap' || (LIST.includes(view) && g?.hasAttribute('data-lsitem'));
    const srcOk = Igen.refOk(r, n) || (view === 'honeycomb' && g?.hasAttribute('data-hcroot'));
    if (asSource && !srcOk) {
      // 同じ名前がほかにある案・最初の語が手法名の案は、元として指せない(仕様書 3.7 節)
      if (view === 'honeycomb') st.hcParent = null;
      if (view === 'mindmap') st.mmParent = null;
      if (LIST.includes(view)) st.ls[view].item = null;
      refresh();
      showEditError(`「${n.name}」は、同じ名前の案がほかにあるか、名前の最初の語が手法名なので、元にできません(名前を変えると元にできます)。`);
      return;
    }
    if (view === 'honeycomb') st.hcParent = g?.hasAttribute('data-hcroot') ? null : key;
    if (view === 'mindmap') st.mmParent = key;
    if (LIST.includes(view) && g?.hasAttribute('data-lsitem')) st.ls[view].item = key;
    refresh();
    if (selKeys.length === 1 && !focusKey && view !== 'honeycomb' && view !== 'mindmap') { srcEl.setSelectionRange(n.start, n.end); scrollToOffset(n.start); }
    if (view === 'honeycomb' || view === 'mindmap') findRole('add')?.focus();
    if (LIST.includes(view) && g?.hasAttribute('data-lsitem')) findRole('improve')?.focus();
    return;
  }
  if (t.closest('[data-hcroot]')) { st.hcParent = null; clearSel(); refresh(); findRole('add')?.focus(); return; }
  const grp = t.closest('[data-group]');
  if (grp) { clearSel(); selGroup = grp.getAttribute('data-group'); refresh(); return; }
  if (t.closest('[data-summary]')) { clearSel(); selSummary = true; refresh(); findRole('summary')?.focus(); return; }
  clearSel(); refresh();
});
viewKindEl.addEventListener('change', () => { selGroup = null; selSummary = false; selOther = null; draw(); });

// ---- 図・表を 1 つずつ保存する(題の右のボタン)
const PIECE_TIP = {
  copy: '表をタブ区切りの文字でコピーする(表計算ソフトや Word の表にそのまま貼れる)',
  svg: 'SVG(ベクター形式)で保存する',
  png: 'PNG(2 倍の解像度)で保存する',
  pdf: 'この図・表だけを、同じ大きさの紙で印刷する(印刷の画面で「PDF に保存」を選ぶと、余白のない PDF になる。Chrome・Edge で使う)',
};
function addPieceButtons(r) {
  const svg = canvasEl.querySelector('svg');
  const title = svg?.querySelector('text');
  if (!title) return;
  const isT = Igen.TABLE_VIEWS.includes(viewKindEl.value);
  const box = el('span', 'tbtns');
  for (const k of isT ? ['copy', 'svg', 'png', 'pdf'] : ['svg', 'png', 'pdf']) {
    const b = el('button', null, k === 'copy' ? 'コピー' : k.toUpperCase());
    b.title = PIECE_TIP[k];
    b.addEventListener('click', () => pieceAction(k, b));
    box.append(b);
  }
  for (const ev of ['pointerdown', 'mousedown', 'click', 'dblclick']) box.addEventListener(ev, (e) => e.stopPropagation());
  canvasEl.append(box);
  // 題の文字の右に、見た目の中心をそろえて置く(和文の字面の中心は、基準線から文字の大きさの約 0.38 倍上)
  const c = canvasEl.getBoundingClientRect(), sv = svg.getBoundingClientRect(), tr = title.getBoundingClientRect();
  const mid = sv.top - c.top + +title.getAttribute('y') - 0.38 * +title.getAttribute('font-size');
  box.style.left = `${tr.right - c.left + 8}px`;
  box.style.top = `${mid - box.getBoundingClientRect().height / 2}px`;
}
const safeName = (s) => s.replace(/[\\/:*?"<>|\s]+/g, '_');
function pieceAction(k, btn) {
  if (debounce !== null) { clearTimeout(debounce); debounce = null; analyze(); }
  if (!last?.ok) { alert('保存できる図がありません(エラーを直してください)'); return; }
  const view = viewKindEl.value;
  const p = Igen.pieces(last, view, ids(last));
  if (k === 'copy') { copyText(Igen.tsv(p.header, p.rows), canvasEl.querySelector('.tbtns button') ?? btn); return; }
  saveImage(p.svg, `${safeName(fileBase)}_${view}`, k);
}
const withPage = (svg) => { const [, w, h] = /width="([\d.]+)" height="([\d.]+)"/.exec(svg); const i = svg.indexOf('>', svg.indexOf('<svg')); return `${svg.slice(0, i + 1)}<style>@page{size:${w}px ${h}px;margin:0}</style>${svg.slice(i + 1)}`; };
const uniqIds = (svg, pre) => svg.replace(/ id="([^"]+)"/g, ` id="${pre}$1"`).replace(/url\(#([^)]+)\)/g, `url(#${pre}$1)`);
function printOne(svg, base) {
  const [, w, h] = /width="([\d.]+)" height="([\d.]+)"/.exec(svg).map(Number);
  const area = $('#printArea');
  area.textContent = ''; area.classList.add('one');
  const pg = el('div', 'page'); pg.style.width = `${w}px`; pg.style.height = `${h}px`; pg.innerHTML = uniqIds(svg, 'p1-'); area.append(pg);
  let s = $('#pageOne');
  if (!s) { s = document.createElement('style'); s.id = 'pageOne'; document.head.append(s); }
  s.textContent = `@media print{@page{size:${w}px ${h}px;margin:0}}`;
  const title = document.title; document.title = base;
  try { window.print(); } finally { document.title = title; }
}
function saveImage(svg, base, kind) {
  if (kind === 'pdf') { printOne(svg, base); return; }
  if (kind === 'svg') { download(`${base}.svg`, new Blob([`<?xml version="1.0" encoding="UTF-8"?>\n${withPage(svg)}`], { type: 'image/svg+xml' })); return; }
  const scale = 2;
  const m = /width="(\d+)" height="(\d+)"/.exec(svg);
  const w = +m[1], h = +m[2];
  const img = new Image();
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  const big = () => alert('画像が大きすぎて PNG にできませんでした。SVG で保存してください');
  img.onload = () => {
    URL.revokeObjectURL(url);
    const c = document.createElement('canvas'); c.width = w * scale; c.height = h * scale;
    const g = c.getContext('2d');
    if (!g) { big(); return; }
    g.scale(scale, scale); g.drawImage(img, 0, 0);
    c.toBlob((b) => { if (b) download(`${base}.png`, b); else big(); }, 'image/png');
  };
  img.onerror = () => { URL.revokeObjectURL(url); alert('PNG の作成に失敗しました'); };
  img.src = url;
}
function download(name, blob) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); }

// ---- 印刷 / PDF: ビューをすべて、1 ページに 1 つずつ
$('#btnPrint').addEventListener('click', () => {
  if (debounce !== null) { clearTimeout(debounce); debounce = null; analyze(); }
  if (!last?.ok) { alert('テキストにエラーがあるので印刷できません。エラーを直してから印刷してください'); return; }
  const area = $('#printArea');
  area.textContent = ''; area.classList.remove('one');
  { const s = $('#pageOne'); if (s) s.textContent = ''; }
  Igen.printPages(last).forEach((svg, i) => { const pg = el('div', 'page'); pg.innerHTML = uniqIds(svg, `p${i + 1}-`); area.append(pg); });
  window.print();
});
window.addEventListener('afterprint', () => { const a = $('#printArea'); a.textContent = ''; a.classList.remove('one'); const s = $('#pageOne'); if (s) s.textContent = ''; });

// ---- ブラウザへの自動保持(このブラウザの localStorage だけに書く。どこにも送信しない)
const KEY_DOC = 'igen.sapp.jp:doc';
const warnEl = $('#warn');
const WARN = { save: '', tab: '' };
const setWarn = (kind, t) => { WARN[kind] = t; warnEl.textContent = [WARN.save, WARN.tab].filter(Boolean).join(' / '); };
function persist() {
  let ok = true;
  try { localStorage.setItem(KEY_DOC, JSON.stringify({ text: srcEl.value, base: fileBase, name: fileName, dirty })); } catch { ok = false; }
  setWarn('save', ok ? '' : 'ブラウザへの自動保持に失敗しました。「上書き保存」か「別名で保存」でファイルに残してください');
}
function restored() { try { const d = JSON.parse(localStorage.getItem(KEY_DOC) ?? 'null'); return d && typeof d.text === 'string' ? d : null; } catch { return null; } }
window.addEventListener('storage', (e) => { if (e.key === KEY_DOC && e.newValue !== null) setWarn('tab', '別のタブでこのテキストが編集されました。このタブで続けると、そちらの内容は上書きされます'); });

// ---- テキスト欄
srcEl.addEventListener('input', () => {
  updateHighlight(); edited(); persist();
  clearTimeout(debounce);
  debounce = setTimeout(() => { debounce = null; analyze(); }, 250);
});
srcEl.addEventListener('paste', (e) => {
  const t = e.clipboardData?.getData('text/plain');
  if (t == null || !/[\uFEFF\r]/.test(t)) return;
  e.preventDefault();
  const clean = t.replace(/\uFEFF/g, '').replace(/\r\n?/g, '\n');
  if (!document.execCommand('insertText', false, clean)) { srcEl.setRangeText(clean, srcEl.selectionStart, srcEl.selectionEnd, 'end'); srcEl.dispatchEvent(new Event('input')); }
});
srcEl.addEventListener('keydown', (e) => {
  if (e.key === 'Tab' && !e.shiftKey && !e.ctrlKey && !e.altKey) {
    e.preventDefault();
    if (!document.execCommand('insertText', false, '  ')) { srcEl.setRangeText('  ', srcEl.selectionStart, srcEl.selectionEnd, 'end'); srcEl.dispatchEvent(new Event('input')); }
  }
});
function setText(text, base, o = {}) {
  srcEl.value = text.replace(/\uFEFF/g, '').replace(/\r\n?/g, '\n');
  if (base) fileBase = base;
  editGen++; docGen++;
  fileName = o.name ?? '';
  fileHandle = o.handle ?? null;
  dirty = !!o.dirty;
  showName();
  st = freshState();
  clearSel();
  lastOk = null;
  updateHighlight();
  if (o.save !== false) persist();
  clearTimeout(debounce); debounce = null;
  analyze();
  // 開いたときの観点の並びの手法の対象: テーマに当てた案がなく、アイディアに当てた案があれば、最初の対象にする
  if (last?.ok) {
    for (const m of CHECK) {
      const t = Igen.checklistTargets(last, m);
      if (t.length && t[0] !== null) st.cl[m].target = E.keyOf(last, E.find(last, t[0]));
    }
    for (const m of LIST) {
      const t = Igen.listingTargets(last, m);
      if (t.length && t[0] !== null) st.ls[m].target = E.keyOf(last, E.find(last, t[0]));
    }
    draw();
  }
}

// ---- テキストのファイル: 新規・開く・上書き保存・別名で保存(プロジェクト計画と同じ作り)
const FS_OK = typeof window.showOpenFilePicker === 'function' && typeof window.showSaveFilePicker === 'function';
const PICK_OPEN = { types: [{ description: 'アイディア生成のテキスト', accept: { 'text/plain': ['.igen', '.txt'] } }] };
const PICK_SAVE = { types: [{ description: 'アイディア生成のテキスト', accept: { 'text/plain': ['.igen'] } }] };
let statT = null, saving = false, picking = false;
function setStat(t) { const e = $('#stat'); e.textContent = t; clearTimeout(statT); if (t) statT = setTimeout(() => { e.textContent = ''; }, 4000); }
function showName() { const e = $('#fileName'); e.textContent = `${fileName || '(名前なし)'}${dirty ? ' *' : ''}`; e.title = dirty ? '保存していない変更があります' : ''; }
function edited() { editGen++; if (!dirty) { dirty = true; showName(); } }
function setDirty(v) { dirty = v; showName(); persist(); }
const okToDiscard = () => !dirty || srcEl.value.trim() === '' || confirm('保存していない変更があります。破棄して続けますか?');
const stamp = () => { const d = new Date(); return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`; };
const baseOf = (name) => name.replace(/\.[^.]*$/, '') || 'igen';
// 名前の候補: ファイル名がなければ「テーマ.igen」
const suggested = () => fileName || `${safeName(last?.ok && last.theme ? last.theme : fileBase)}.igen`;
function openFile(file, handle, handleP) {
  if (!/\.(igen|txt)$/i.test(file.name)) { alert(`${file.name} は開けません。開けるのは .igen(.txt)です。`); return; }
  const rd = new FileReader();
  rd.onload = () => {
    let text;
    try { text = new TextDecoder('utf-8', { fatal: true }).decode(new Uint8Array(rd.result)); } catch { alert(`${file.name}: UTF-8 として読めません`); return; }
    setText(text, baseOf(file.name), { name: file.name, handle });
    const g = editGen;
    if (handleP) handleP.then((h) => { if (h?.kind === 'file' && editGen === g) fileHandle = h; }).catch(() => {});
  };
  rd.onerror = () => alert(`${file.name} を読めませんでした`);
  rd.readAsArrayBuffer(file);
}
$('#btnOpen').addEventListener('click', async () => {
  if (!okToDiscard()) return;
  if (!FS_OK) { $('#fileOpen').click(); return; }
  try { const [h] = await window.showOpenFilePicker(PICK_OPEN); openFile(await h.getFile(), h); } catch (e) { if (e?.name !== 'AbortError') $('#fileOpen').click(); }
});
$('#fileOpen').addEventListener('change', (e) => { if (e.target.files[0]) openFile(e.target.files[0], null); e.target.value = ''; });
['dragenter', 'dragover'].forEach((ev) => window.addEventListener(ev, (e) => { if (!e.dataTransfer?.types.includes('Files')) return; e.preventDefault(); $('#drop').classList.add('on'); }));
['dragleave', 'drop'].forEach((ev) => window.addEventListener(ev, (e) => { if (ev === 'drop' || e.relatedTarget === null) $('#drop').classList.remove('on'); }));
window.addEventListener('drop', (e) => {
  const f = e.dataTransfer.files[0];
  if (!f) return;
  e.preventDefault();
  const it = e.dataTransfer.items?.[0];
  const hp = it && typeof it.getAsFileSystemHandle === 'function' ? it.getAsFileSystemHandle() : null;
  if (!/\.(igen|txt)$/i.test(f.name)) { alert(`${f.name} は開けません。開けるのは .igen(.txt)です。`); return; }
  if (!okToDiscard()) return;
  openFile(f, null, hp);
});
async function writeTo(h, text) { const w = await h.createWritable(); await w.write(text); await w.close(); }
function setSaving(v) { saving = v; $('#btnSave').disabled = v; $('#btnSaveAs').disabled = v; }
function afterWrite(gen, dg, msg) {
  if (docGen !== dg) { setStat(`${msg}(保存中に別の内容を開いたので、いま開いている内容は保存していません)`); return; }
  if (editGen === gen) { setDirty(false); setStat(msg); return; }
  persist();
  setStat(`${msg}。保存中に変わった内容はまだ保存されていません`);
}
async function saveAs() {
  if (saving || picking) return;
  picking = true;
  try {
    let why = '';
    if (FS_OK) {
      let h;
      try { h = await window.showSaveFilePicker({ suggestedName: suggested(), ...PICK_SAVE }); } catch (e) { if (e?.name === 'AbortError') return; h = null; }
      if (h) {
        const gen = editGen, dg = docGen, text = srcEl.value;
        setSaving(true);
        try {
          await writeTo(h, text);
          if (docGen === dg) { fileHandle = h; fileName = h.name; fileBase = baseOf(h.name); showName(); persist(); }
          afterWrite(gen, dg, `${h.name} に保存しました(${stamp()})`);
          return;
        } catch { why = '保存先に書き込めなかったので、ダウンロードで保存しました'; } finally { setSaving(false); }
      } else why = '保存先を選べなかったので、ダウンロードで保存しました';
    }
    let name = prompt('ファイル名', suggested());
    if (name === null) { if (why) setStat('保存を取りやめました'); return; }
    name = name.trim() || suggested();
    if (!/\.(igen|txt)$/i.test(name)) name += '.igen';
    download(name, new Blob([srcEl.value], { type: 'text/plain;charset=utf-8' }));
    fileName = name; fileBase = baseOf(name); fileHandle = null;
    afterWrite(editGen, docGen, '');
    setStat(why);
  } finally { picking = false; }
}
async function save() {
  if (saving || picking) return;
  if (FS_OK && fileHandle) {
    const gen = editGen, dg = docGen, h = fileHandle;
    setSaving(true);
    try { await writeTo(h, srcEl.value); afterWrite(gen, dg, `${h.name} に上書き保存しました(${stamp()})`); }
    catch (e) { setStat(e?.name === 'AbortError' ? '上書き保存を取りやめました' : '上書きできませんでした。「別名で保存」を使ってください'); }
    finally { setSaving(false); }
    return;
  }
  if (FS_OK || !fileName) { saveAs(); return; }
  download(fileName, new Blob([srcEl.value], { type: 'text/plain;charset=utf-8' }));
  afterWrite(editGen, docGen, '');
}
$('#btnSave').addEventListener('click', save);
$('#btnSaveAs').addEventListener('click', saveAs);
window.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 's') {
    e.preventDefault();
    if (e.repeat) return;
    // 書きかけの欄があれば、先に書き込む
    const a = document.activeElement;
    if (a && editEl.contains(a) && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA') && a.dataset.role !== 'add' && a.dataset.role !== 'kjnew' && a.dataset.role !== 'newgroup') a.dispatchEvent(new Event('change'));
    save();
  }
});

// ---- 上の帯のボタン
$('#btnNew').addEventListener('click', () => { if (okToDiscard()) setText('', 'igen'); });
$('#btnSample').addEventListener('click', () => { if (okToDiscard()) setText(SAMPLE_TEXT, 'sample'); });
$('#btnHelp').addEventListener('click', () => { const d = $('#dlgHelp'); d.innerHTML = HELP_HTML; d.showModal(); });
document.querySelectorAll('dialog').forEach((d) => d.addEventListener('click', (e) => { const r = d.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) d.close(); }));

// ---- 分割バー
(() => {
  const sp = $('#splitter'), left = $('#left');
  let drag = false;
  sp.addEventListener('mousedown', () => { drag = true; document.body.style.userSelect = 'none'; });
  window.addEventListener('mouseup', () => { drag = false; document.body.style.userSelect = ''; });
  window.addEventListener('mousemove', (e) => { if (drag) left.style.width = `${Math.max(200, Math.min(window.innerWidth - 200, e.clientX))}px`; });
})();

// 開いたときは、前に編集していた内容を続ける(なければ空)。上書きの先は覚えていないので、次の上書き保存では保存先を尋ねる
{ const d = restored(); setText(d ? d.text : '', d && typeof d.base === 'string' && d.base ? d.base : 'igen', { name: d && typeof d.name === 'string' ? d.name : '', dirty: !!d?.dirty, save: false }); }
})();
