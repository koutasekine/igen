/*CORE-BEGIN*/
// ---- 計算部(DOM を使わない。Node でも動く)。アイディア生成 版 0.6
const Igen = (() => {
'use strict';

// 字下げしない行のうち、下に属性を持つもの(ブロック)と、その属性。multi は何回でも書ける属性
const BLOCK = {
  idea: { keys: ['by', 'from', 'group', 'who', 'what', 'why', 'when', 'where', 'how', 'decision', 'reason', 'note', 'rank', 'score', 'pos', 'scene'], multi: ['from', 'group', 'rank', 'score', 'pos', 'scene'], ja: 'アイディア' },
  group: { keys: ['note', 'relate', 'cause', 'oppose'], multi: ['relate', 'cause', 'oppose'], ja: 'グループ' },
  matrix: { keys: ['row', 'col', 'note'], multi: ['row', 'col'], ja: 'マトリックス' },
  sevencross: { keys: ['class', 'note'], multi: ['class'], ja: 'セブンクロス' },
  criterion: { keys: ['weight', 'note'], multi: [], ja: '評価の観点' },
  must: { keys: ['note'], multi: [], ja: '必須の条件' },
  positioning: { keys: ['x', 'y', 'note'], multi: [], ja: 'ポジショニング' },
  research: { keys: ['url', 'for', 'diff', 'note'], multi: ['for'], ja: '既存調査' },
};
const ALL_KEYS = [...new Set(Object.values(BLOCK).flatMap((b) => b.keys))];
const TOP_BLOCKS = ['group', 'matrix', 'sevencross', 'criterion', 'must', 'positioning', 'research'];
const POS_MAX = 5; // ポジショニングの目盛り(-5〜5)
const RANKS = 7; // セブンクロスの重要度の段階(1 がいちばん重要)
const COMMON = ['theme', 'author', 'summary'];
const W5 = ['who', 'what', 'why', 'when', 'where', 'how'];
const W5_JA = { who: '誰のためか', what: '何をする案か', why: 'なぜ必要か', when: 'いつ使うか', where: 'どこで使うか', how: 'どう実現するか' };
const DECISION = { adopt: '採用', backup: '代替', drop: '見送り' };
const REL = { relate: '関連', cause: '因果', oppose: '対立' };

// 問いの文言(仕様書 7 章)
const HATS = [['白', '事実', '分かっている事実やデータは?'], ['赤', '直感', '直感ではどう感じる?'], ['黒', 'リスク', '最悪の場合、何が問題になる?'], ['黄', '長所', '良い点は? どうすれば実現できる?'], ['緑', '新しい案', '黒の懸念を乗り越える案は?'], ['青', 'まとめ', '全体を見て、次に何をする?']];
const OSBORN = [['転用', '別の使い道にしたら?'], ['応用', '他や過去のものを持ってきたら?'], ['変更', '色・形・動きを変えたら?'], ['拡大', '大きく・多くしたら?'], ['縮小', '小さく・少なくしたら?'], ['代用', '他の人・もの・場所にしたら?'], ['再編成', '配置や順序を変えたら?'], ['逆転', '逆にしたら?'], ['結合', '組み合わせたら?']];
const SCAMPER = [['代用する', 'S', '何かで代用したら?'], ['組み合わせる', 'C', '何かと組み合わせたら?'], ['応用する', 'A', '他の何かを応用したら?'], ['修正する', 'M', 'どこかを修正したら?'], ['転用する', 'P', '別の用途に使ったら?'], ['削ぎ落とす', 'E', '何かを削ったら?'], ['再構成する', 'R', '逆にしたり組み替えたりしたら?']];
const TRIZ = [['分割', '分割したら?'], ['分離', '分離したら?'], ['局所性質', '一部を変更したら?'], ['非対称', '非対称にしたら?'], ['組み合わせ', '2 つ以上を合わせたら?'], ['汎用性', '他でも使えるようにしたら?'], ['入れ子', '中に入れたら?'], ['つりあい', 'バランスをよくしたら?'], ['先取り反作用', '先に反動をつけたら?'], ['先取り作用', '先に予想したら?'], ['事前保護', '重要なところを保護したら?'], ['等ポテンシャル', '同じ高さにしたら?'], ['逆発想', '逆にしたら?'], ['曲面', '回転させたら?'], ['ダイナミック性', '環境に合わせたら?'], ['アバウト', 'おおざっぱにしたら?'], ['他次元移行', '垂直方向を使ったら?'], ['機械的振動', '振動を与えたら?'], ['周期的作用', '繰り返しにしたら?'], ['連続性', '継続的に続けたら?'], ['高速実行', '高速で実行したら?'], ['災い転じて福となす', 'マイナス点をプラスに変えたら?'], ['フィードバック', '基準値に戻したら?'], ['仲介', '仲介したら?'], ['セルフサービス', '自分で行うようにしたら?'], ['代替', 'コピーしたら?'], ['高価な長寿命より安価な短寿命', '安くて使い捨てのものにしたら?'], ['機械的システム代替', '別のシステムを使ったら?'], ['流体利用', '流体を使ったら?'], ['薄膜利用', '薄い膜を利用したら?'], ['多孔質利用', 'スキマを利用したら?'], ['変色利用', '色を変えたら?'], ['均質性', '質を統一したら?'], ['排除/再生', '捨てたり再生したりしたら?'], ['パラメータ', '形や条件を変更したら?'], ['相変化', '形状を変更したら?'], ['熱膨張', '熱でふくらませたら?'], ['高濃度酸素利用', '濃度を濃くしたら?'], ['不活性雰囲気利用', '反応しないものを入れたら?'], ['複合材料', '違う質のものを合わせたら?']];

// 手法名(仕様書 3.6 節)。vp: null は観点なし、'any' は観点をまだ決めていない(何を書いてもよい)、配列は書ける観点
const METHODS = {
  direct: { ja: '共通入力', vp: null },
  mandala: { ja: 'マンダラート', vp: null },
  honeycomb: { ja: '蜂の巣ノート', vp: null },
  matrix: { ja: 'マトリックス法', vp: 'any' }, // 観点は「縦の項目 × 横の項目」(解析で確かめる)
  sixhats: { ja: 'シックスハット', vp: HATS.map((x) => x[0]) },
  osborn: { ja: 'オズボーンのチェックリスト', vp: OSBORN.map((x) => x[0]) },
  scamper: { ja: 'SCAMPER', vp: SCAMPER.map((x) => x[0]) },
  triz: { ja: 'TRIZ の 40 原理', vp: TRIZ.map((x, i) => String(i + 1)) },
  defects: { ja: '欠点列挙法', vp: ['欠点', '改善案'] },
  wishes: { ja: '希望点列挙法', vp: ['希望点', '案'] },
  attributes: { ja: '特性列挙法', vp: ['名詞的', '形容詞的', '動詞的', '改善案'] },
  kj: { ja: 'KJ 法', vp: null },
  sevencross: { ja: 'セブンクロス', vp: null },
  fivew1h: { ja: '5W1H', vp: null },
  mindmap: { ja: 'マインドマップ', vp: null },
  storyboard: { ja: 'ストーリーボード', vp: null },
  positioning: { ja: 'ポジショニング', vp: null },
  research: { ja: '既存調査', vp: null },
  compare: { ja: '候補比較・評価', vp: null },
  eliminate: { ja: '判断・消去法', vp: null },
};

const norm = (t) => t.replace(/\uFEFF/g, '').replace(/\r\n?/g, '\n'); // BOM はどこにあっても除く(BOM 付きのファイルを途中に貼ったとき)
// 注の始まり: // が行頭か、空白・タブの直後のとき
function cutComment(raw) {
  for (let k = 0; k < raw.length - 1; k++) if (raw[k] === '/' && raw[k + 1] === '/' && (k === 0 || raw[k - 1] === ' ' || raw[k - 1] === '\t')) return k;
  return raw.length;
}
function trimRange(str, a, b) {
  while (a < b && /[ \t\u3000\u00a0]/.test(str[a])) a++;
  while (b > a && /[ \t\u3000\u00a0]/.test(str[b - 1])) b--;
  return { text: str.slice(a, b), a, b };
}
// 項目を挙げてから改善案を出す手法(仕様書 4.7 節)。items: 項目の観点、improve: 改善案の観点
const LISTINGS = {
  defects: { title: '欠点列挙法', items: ['欠点'], improve: '改善案', itemLabel: '欠点', impLabel: '改善案', hint: {} },
  wishes: { title: '希望点列挙法', items: ['希望点'], improve: '案', itemLabel: '希望点', impLabel: '案', hint: {} },
  attributes: { title: '特性列挙法', items: ['名詞的', '形容詞的', '動詞的'], improve: '改善案', itemLabel: '特性', impLabel: '改善案', hint: { 名詞的: '全体・部分・材料・製法', 形容詞的: '色・性質・形・デザイン', 動詞的: 'メカニズム・機能' } },
};
const firstWord = (s) => s.split(/[ \t\u3000\u00a0]/)[0];
const methodLike = (name) => Object.hasOwn(METHODS, firstWord(name));
const normPath = (s) => s.split('::').map((x) => x.trim()).join('::');
const badPath = (s) => s.split('::').some((x) => !x.trim());

// ================= 解析(仕様書 3 章) =================
function parse(text0) {
  const text = norm(text0);
  const lines = text.split('\n');
  const diags = [];
  const ideas = [], blocks = [], common = { theme: [], author: [], summary: [] };
  let off = 0, cur = null;
  const err = (ln, start, end, message) => diags.push({ level: 'error', cat: '構文', line: ln, start, end, message });
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i], ls = off, ln = i + 1;
    off += raw.length + 1;
    const cut = cutComment(raw);
    const s = raw.slice(0, cut).replace(/[ \t]+$/, '');
    if (!s.trim()) continue;
    const E = (a, b, m) => err(ln, ls + a, ls + Math.max(b, a + 1), m);
    const lead = /^[ \t　]*/.exec(s)[0];
    if (lead.includes('　')) { const k = lead.indexOf('　'); E(k, k + 1, '字下げに全角空白が使われています。半角の空白かタブにしてください'); continue; }
    const c0 = lead.length, c = s.slice(c0);
    if (c0 === 0) {
      if (/^-[ \t]*[\u3000\u00a0]/.test(c)) { const k = c.search(/[\u3000\u00a0]/); E(k, k + 1, '「-」の後ろは半角の空白にしてください(全角の空白は使えません)'); cur = { bad: true }; continue; }
      if (/^-([ \t]|$)/.test(c)) {
        const nm = trimRange(s, 1, s.length);
        if (!nm.text) { E(0, 1, '名前がありません。「- 」の後ろにアイディアを書いてください'); cur = { bad: true }; continue; }
        cur = { kind: 'idea', id: `i${ideas.length}`, name: nm.text, line: ln, start: ls + nm.a, end: ls + nm.b, lineIdx: i, endIdx: i, lineStart: ls, attrs: [] };
        ideas.push(cur);
        continue;
      }
      const m = /^(theme|author|summary|group|matrix|sevencross|criterion|must|positioning|research):/.exec(c);
      if (m) {
        const v = trimRange(s, m[0].length, s.length);
        const isBlock = TOP_BLOCKS.includes(m[1]);
        if (!v.text) { E(0, m[0].length, `「${m[1]}:」の後ろに値がありません`); cur = isBlock ? { bad: true } : null; continue; }
        if (isBlock) {
          if (m[1] === 'group' && badPath(v.text)) { E(v.a, v.b, `グループの名前「${v.text}」の :: の前後に名前がありません`); cur = { bad: true }; continue; }
          if (m[1] === 'matrix' && /×/.test(v.text)) { /* 名前に × を書いてよい(縦の意味 × 横の意味) */ }
          cur = { kind: m[1], name: m[1] === 'group' ? normPath(v.text) : v.text, line: ln, start: ls + v.a, end: ls + v.b, lineIdx: i, endIdx: i, lineStart: ls, attrs: [] };
          if (m[1] === 'group') cur.path = cur.name;
          blocks.push(cur);
        } else {
          common[m[1]].push({ key: m[1], value: v.text, line: ln, start: ls + v.a, end: ls + v.b, lineIdx: i });
          cur = null;
        }
        continue;
      }
      const ak = /^([A-Za-z]+):/.exec(c);
      if (ak && ALL_KEYS.includes(ak[1])) { E(0, ak[0].length, `「${ak[1]}:」の行は、アイディア(- 名前)などの行の下に、字下げして書きます`); continue; }
      if (c[0] === '#') { E(0, s.length, '見出し(#)は使えません'); continue; }
      if (/^\d+[.)](\s|$)/.test(c)) { E(0, s.length, '番号付きのリストは使えません。アイディアは「- 」で書いてください'); continue; }
      if (/^[*+](\s|$)/.test(c)) { E(0, 1, 'リストの印は「- 」だけです(「* 」「+ 」は使えません)'); continue; }
      if (c.startsWith('```')) { E(0, s.length, 'コードブロック(```)は使えません。この行を消してください'); continue; }
      E(0, s.length, 'この行は書き方に合いません。説明の文は書けません(メモは note: に書きます)。アイディアは「- 名前」、テーマは「theme: テーマ」のように書きます');
      continue;
    }
    // 字下げした行: 属性
    if (/^-([ \t　 ]|$)/.test(c)) { E(c0, c0 + 1, 'アイディアの下に「- 」の行は書けません。アイディアは字下げせずに書き、出所は from: で書きます'); continue; }
    const m = /^([A-Za-z][A-Za-z0-9]*):/.exec(c);
    if (!m) { E(c0, s.length, '説明の文は書けません。メモは note: に書きます'); continue; }
    if (!cur) { E(c0, c0 + m[0].length, '属性の行の前に、アイディア(- 名前)やグループ(group: 名前)などの行が必要です'); continue; }
    if (cur.bad) continue; // 前の行のエラーに含める
    const def = BLOCK[cur.kind];
    const key = m[1];
    if (!def.keys.includes(key)) { E(c0, c0 + m[0].length, `「${key}:」は${def.ja}に書けません(書けるもの: ${def.keys.map((k) => `${k}:`).join(' ')})`); continue; }
    const v = trimRange(s, c0 + m[0].length, s.length);
    if (!v.text) { E(c0, c0 + m[0].length, `「${key}:」の後ろに値がありません`); continue; }
    if (!def.multi.includes(key)) { const d = cur.attrs.find((a) => a.key === key); if (d) { E(c0, c0 + m[0].length, `「${key}:」が 2 回書かれています(${d.line} 行。1 つの${def.ja}に 1 回だけ書けます)`); continue; } }
    const at = { key, text: v.text, line: ln, start: ls + v.a, end: ls + v.b, lineIdx: i };
    if (key === 'decision' && !Object.hasOwn(DECISION, v.text)) { E(v.a, v.b, `判断「${v.text}」が読めません。adopt(採用)・backup(代替)・drop(見送り)のどれかを書いてください`); continue; }
    if (key === 'from') {
      const fm = /^([^ \t\u3000\u00a0]+)(?:[ \t\u3000\u00a0]+(.*))?$/.exec(v.text); // 値は空でないので必ず一致する
      if (Object.hasOwn(METHODS, fm[1])) {
        const vp = trimRange(fm[2] ?? '', 0, (fm[2] ?? '').length).text, def = METHODS[fm[1]].vp;
        if (def === null && vp) { E(v.a, v.b, `${METHODS[fm[1]].ja}(${fm[1]})には観点がありません。「from: ${fm[1]}」とだけ書きます(元のアイディアは別の from: の行に書きます)`); continue; }
        if (Array.isArray(def) && !def.includes(vp)) { E(v.a, v.b, vp ? `「${vp}」は${METHODS[fm[1]].ja}の観点にありません(書けるもの: ${def.length > 10 ? `${def[0]}〜${def[def.length - 1]}` : def.join('・')})` : `${METHODS[fm[1]].ja}は「from: ${fm[1]} 観点」のように観点を書きます(書けるもの: ${def.length > 10 ? `${def[0]}〜${def[def.length - 1]}` : def.join('・')})`); continue; }
        if (fm[1] === 'matrix') {
          const mx = /^(.+?)[ \t]*×[ \t]*(.+)$/.exec(vp);
          if (!mx) { E(v.a, v.b, 'マトリックス法は「from: matrix 縦の項目 × 横の項目」のように書きます'); continue; }
          at.row = mx[1].trim(); at.col = mx[2].trim();
        }
        at.method = fm[1]; at.vp = vp;
      } else at.ref = v.text;
    }
    if (key === 'rank') {
      const rk = /^(.*\S)[ \t]+(\d+)$/.exec(v.text);
      if (!rk || +rk[2] < 1 || +rk[2] > RANKS) { E(v.a, v.b, `rank: は「分類の名前 1〜${RANKS} の重要度」のように書きます(1 がいちばん重要)`); continue; }
      at.cls = rk[1]; at.level = +rk[2];
    }
    if (key === 'score') {
      const sc = /^(.*\S)[ \t]+(\S+)$/.exec(v.text);
      if (!sc) { E(v.a, v.b, 'score: は「観点の名前 値」のように書きます(評価の観点は 1〜5、必須の条件は ok か ng)'); continue; }
      at.crit = sc[1]; at.value = sc[2];
    }
    if (key === 'weight' && !(/^\d+(\.\d+)?$/.test(v.text) && +v.text > 0)) { E(v.a, v.b, `重み「${v.text}」が読めません。0 より大きい数で書いてください`); continue; }
    if (key === 'pos') {
      const ps = /^(.*\S)[ \t]+(-?\d+)[ \t]+(-?\d+)$/.exec(v.text);
      if (!ps || Math.abs(+ps[2]) > POS_MAX || Math.abs(+ps[3]) > POS_MAX) { E(v.a, v.b, `pos: は「ポジショニングの名前 横 縦」のように書きます(横と縦は -${POS_MAX}〜${POS_MAX} の整数)`); continue; }
      at.map = ps[1]; at.x = +ps[2]; at.y = +ps[3];
    }
    if (key === 'x' || key === 'y') {
      const ax = /^(.*?)[ \t]*\.\.[ \t]*(.*)$/.exec(v.text);
      if (!ax || !ax[1] || !ax[2]) { E(v.a, v.b, `${key}: は「低い側の言葉 .. 高い側の言葉」のように書きます(例: 安い .. 高い)`); continue; }
      at.lo = ax[1]; at.hi = ax[2];
    }
    if ((key === 'row' || key === 'col') && /×/.test(v.text)) { E(v.a, v.b, 'マトリックスの項目に「×」は使えません'); continue; }
    if (key === 'group' || BLOCK.group.multi.includes(key)) {
      if (badPath(v.text)) { E(v.a, v.b, `グループの名前「${v.text}」の :: の前後に名前がありません`); continue; }
      at.path = normPath(v.text);
    }
    cur.attrs.push(at);
    cur.endIdx = i;
  }
  return { text, lines, diags, ideas, blocks, groupLines: blocks.filter((b) => b.kind === 'group'), common };
}

// ================= 意味の解析・診断(仕様書 8 章) =================
function analyze(text) {
  const p = parse(text);
  const diags = p.diags;
  const res = { text: p.text, parse: p, diags, ok: false };
  if (diags.some((d) => d.level === 'error')) return res; // エラーがあるときは、エラーだけを出す
  const warn = (o, message, cat) => diags.push({ level: 'warn', cat, line: o.line, start: o.start, end: o.end, message });
  const { ideas, common } = p;
  // 共通項目: 先に書いた方を使う。テーマが違えば警告
  const theme = common.theme[0] ?? null;
  for (const t of common.theme.slice(1)) if (t.value !== theme.value) warn(t, `テーマ「${t.value}」が、${theme.line} 行のテーマ「${theme.value}」と違います(${theme.line} 行のテーマを使います)`, 'テーマ');
  const author = common.author[0] ?? null;
  // アイディアの属性
  for (const n of ideas) {
    const one = (k) => n.attrs.find((a) => a.key === k)?.text ?? null;
    n.by = one('by'); n.note = one('note'); n.decision = one('decision'); n.reason = one('reason');
    n.w5 = Object.fromEntries(W5.map((k) => [k, one(k)]));
    n.froms = n.attrs.filter((a) => a.key === 'from');
    n.methods = n.froms.filter((a) => a.method);
    n.groups = [...new Set(n.attrs.filter((a) => a.key === 'group').map((a) => a.path))];
    if (!n.by) warn(n, `「${n.name}」に書いた人(by:)がありません`, '書いた人');
    if (!n.froms.length) warn(n, `「${n.name}」に出所(from:)がありません`, '出所');
    if (methodLike(n.name)) warn(n, `「${n.name}」は手法名(${firstWord(n.name)})で始まるので、from: で元のアイディアとして指せません。名前を変えてください`, '参照');
  }
  // 元のアイディアの参照(仕様書 3.7 節)
  const byName = new Map();
  for (const n of ideas) { if (!byName.has(n.name)) byName.set(n.name, []); byName.get(n.name).push(n); }
  for (const n of ideas) {
    n.parents = [];
    for (const f of n.froms) {
      if (!f.ref) continue;
      const all = byName.get(f.ref) ?? [];
      const cands = all.filter((x) => x !== n);
      if (!cands.length) { warn(f, all.length ? `「${f.ref}」は自分自身です(元のアイディアにはなりません)` : `元のアイディア「${f.ref}」が見つかりません`, '参照'); continue; }
      if (cands.length > 1) warn(f, `「${f.ref}」という名前のアイディアが ${cands.length} つあり、どれか決まりません(${cands[0].line} 行のアイディアを指します)`, '参照');
      f.target = cands[0];
      if (!n.parents.includes(cands[0])) n.parents.push(cands[0]);
    }
  }
  // すべての属性まで同じアイディア
  const sigs = new Map();
  for (const n of ideas) {
    const fsig = (a) => (a.method ? `from\u0002${a.method}\u0002${a.method === 'matrix' ? `${a.row}\u0003${a.col}` : a.vp}` : `from\u0002\u0004${a.ref}`); // 区切りの空白の違いは同じとみなす
    const sig = [n.name, ...n.froms.map(fsig), ...n.attrs.filter((a) => a.key !== 'from').map((a) => `${a.key}\u0002${a.text}`).sort()].join('\u0001');
    if (sigs.has(sig)) warn(n, `${sigs.get(sig).line} 行のアイディアと、名前と属性がすべて同じです(同じものを 2 回貼り付けていないか確かめてください)`, '重複');
    else sigs.set(sig, n);
  }
  // 採用は 1 つだけ
  const adopts = ideas.filter((n) => n.decision === 'adopt');
  for (const n of adopts.slice(1)) warn(n, `採用(adopt)は 1 つだけです(${adopts[0].line} 行の「${adopts[0].name}」も採用です)。ほかの案は backup(代替)にできます`, '判断');
  // グループ(仕様書 3.5 節)
  const groups = new Map();
  const ensure = (path) => {
    if (groups.has(path)) return groups.get(path);
    // 上位から順に作る(深い入れ子でも再帰しない)
    const segs = path.split('::');
    let parent = null, p = '';
    for (let k = 0; k < segs.length; k++) {
      p = k ? `${p}::${segs[k]}` : segs[k];
      let g = groups.get(p);
      if (!g) { g = { path: p, name: segs[k], parent, children: [], members: [], def: null, rels: [], depth: k }; groups.set(p, g); if (parent) parent.children.push(g); }
      parent = g;
    }
    return parent;
  };
  for (const gl of p.groupLines) {
    const g = ensure(gl.path);
    if (g.def) warn(gl, `グループ「${gl.path}」の行が 2 回あります(${g.def.line} 行の方を使います)`, 'グループ');
    else g.def = gl;
  }
  for (const n of ideas) for (const path of n.groups) ensure(path).members.push(n);
  const findGroup = (path) => {
    if (groups.has(path)) return groups.get(path);
    const c = [...groups.values()].filter((g) => g.name === path);
    return c.length === 1 ? c[0] : null;
  };
  const rels = [];
  for (const g of groups.values()) {
    if (!g.def) continue;
    g.note = g.def.attrs.find((a) => a.key === 'note')?.text ?? null;
    for (const a of g.def.attrs) {
      if (!Object.hasOwn(REL, a.key)) continue;
      const t = findGroup(a.path);
      if (!t) { warn(a, `関係の相手のグループ「${a.path}」が見つかりません`, 'グループ'); continue; }
      if (t === g) { warn(a, 'グループ自身との関係は書けません(無視します)', 'グループ'); continue; }
      const rel = { kind: a.key, from: g, to: t, attr: a };
      g.rels.push(rel); rels.push(rel);
    }
  }
  // マンダラートの盤面(仕様書 4.2 節)。中心は最初の元のアイディア、なければテーマ
  const boards = new Map();
  for (const n of ideas) {
    if (!n.methods.some((m) => m.method === 'mandala')) continue;
    const refs = n.froms.filter((f) => f.ref);
    if (refs.length && !n.parents.length) continue; // 元のアイディアが見つからない(警告済み)
    const center = n.parents[0] ?? null; // 循環は警告し、盤面はそのまま描く
    const key = center ? center.id : 'theme';
    if (!boards.has(key)) boards.set(key, { key, center, cells: [] });
    boards.get(key).cells.push(n);
  }
  for (const b of boards.values()) {
    const label = b.center ? b.center.name : theme ? theme.value : '(テーマなし)';
    const at = b.center ?? theme ?? b.cells[0];
    if (b.cells.length < 8) warn(at, `マンダラート「${label}」の周りのマスに空きがあります(8 マス中 ${b.cells.length} マス)`, 'マンダラート');
    for (const n of b.cells.slice(8)) warn(n, `マンダラート「${label}」の 9 個目以降のマスです(盤面は 8 マスまでなので置けません)`, 'マンダラート');
  }
  // 出所をたどると循環していないか(最初の元のアイディアだけをたどる。マンダラート・蜂の巣・マインドマップの木に使う)
  // 各アイディアを一度だけたどる。たどった道が自分の道に戻ったら、その輪が循環。輪の上のアイディアは木の根(テーマ)につなぐ
  const state = new Map(), onCycle = new Set();
  for (const n of ideas) {
    if (state.has(n)) continue;
    const path = [];
    let x = n;
    while (x && !state.has(x)) { state.set(x, 1); path.push(x); x = x.parents[0]; }
    if (x && state.get(x) === 1) {
      const ring = path.slice(path.indexOf(x));
      for (const y of ring) onCycle.add(y);
      const first = ring.reduce((a, y) => (y.lineIdx < a.lineIdx ? y : a));
      warn(first, `「${first.name}」の元のアイディアをたどると、自分に戻ります(循環しています)`, '参照');
    }
    for (const y of path) state.set(y, 2);
  }
  for (const n of ideas) n.tparent = onCycle.has(n) ? null : n.parents[0] ?? null;
  // 蜂の巣ノート(仕様書 4.4 節)。シートの根は、蜂の巣の元をたどって最初に蜂の巣でなくなったアイディア(なければテーマ)
  const isHc = (n) => n.methods.some((m) => m.method === 'honeycomb');
  const sheets = new Map();
  for (const n of ideas) {
    if (!isHc(n)) continue;
    let root = n.tparent;
    const seen = new Set([n]);
    while (root && isHc(root) && !seen.has(root)) { seen.add(root); root = root.tparent; }
    if (root && isHc(root)) root = null;
    const key = root ? root.id : 'theme';
    if (!sheets.has(key)) sheets.set(key, { key, root, nodes: [] });
    sheets.get(key).nodes.push(n);
  }
  // マトリックス(仕様書 4.5 節)
  const matrices = new Map();
  for (const b of p.blocks.filter((x) => x.kind === 'matrix')) {
    if (matrices.has(b.name)) { warn(b, `マトリックス「${b.name}」の行が 2 回あります(${matrices.get(b.name).def.line} 行の方を使います)`, 'マトリックス'); continue; }
    const m = { name: b.name, def: b, rows: [], cols: [], note: b.attrs.find((a) => a.key === 'note')?.text ?? null };
    for (const a of b.attrs) {
      if (a.key !== 'row' && a.key !== 'col') continue;
      const list = a.key === 'row' ? m.rows : m.cols;
      if (list.includes(a.text)) warn(a, `「${a.text}」が ${a.key === 'row' ? '縦' : '横'}の項目に 2 回あります(1 回とみなします)`, 'マトリックス'); else list.push(a.text);
    }
    matrices.set(b.name, m);
  }
  const mlist = [...matrices.values()];
  mlist.forEach((m, i) => {
    for (const o of mlist.slice(0, i)) {
      const row = m.rows.find((x) => o.rows.includes(x)), col = m.cols.find((x) => o.cols.includes(x));
      if (row !== undefined && col !== undefined) { warn(m.def, `マトリックス「${m.name}」には、「${o.name}」と同じ組み合わせ(${row} × ${col} など)があります。その組み合わせの案は「${o.name}」に置きます`, 'マトリックス'); break; }
    }
  });
  for (const n of ideas) for (const f of n.methods) {
    if (f.method !== 'matrix') continue;
    f.matrix = [...matrices.values()].find((m) => m.rows.includes(f.row) && m.cols.includes(f.col)) ?? null;
    if (!f.matrix) warn(f, `「${f.row} × ${f.col}」の組み合わせのマトリックスがありません(matrix: の row: と col: を確かめてください)`, 'マトリックス');
  }
  // セブンクロス(仕様書 5.4 節)
  const sevBlocks = p.blocks.filter((x) => x.kind === 'sevencross');
  for (const b of sevBlocks.slice(1)) warn(b, `セブンクロスの行が 2 回あります(${sevBlocks[0].line} 行の方を使います)`, 'セブンクロス');
  const seven = { axis: sevBlocks[0]?.name ?? '', def: sevBlocks[0] ?? null, classes: [] };
  for (const a of sevBlocks[0]?.attrs ?? []) {
    if (a.key !== 'class') continue;
    if (seven.classes.includes(a.text)) warn(a, `分類「${a.text}」が 2 回あります(1 回とみなします)`, 'セブンクロス'); else seven.classes.push(a.text);
  }
  seven.extra = [];
  for (const n of ideas) {
    n.ranks = [];
    for (const a of n.attrs.filter((x) => x.key === 'rank')) {
      if (n.ranks.some((x) => x.cls === a.cls)) { warn(a, `分類「${a.cls}」の重要度が 2 回あります(先に書いた方を使います)`, 'セブンクロス'); continue; }
      if (!seven.classes.includes(a.cls) && !seven.extra.includes(a.cls)) { warn(a, `分類「${a.cls}」が sevencross: の class: にありません`, 'セブンクロス'); seven.extra.push(a.cls); }
      n.ranks.push({ cls: a.cls, level: a.level, attr: a });
    }
  }
  // 候補比較・評価(仕様書 5.6 節)
  const criteria = new Map();
  for (const b of p.blocks.filter((x) => x.kind === 'criterion' || x.kind === 'must')) {
    if (criteria.has(b.name)) { warn(b, `観点「${b.name}」が 2 回あります(${criteria.get(b.name).def.line} 行の方を使います)`, '比較'); continue; }
    const w = b.attrs.find((a) => a.key === 'weight');
    criteria.set(b.name, { name: b.name, must: b.kind === 'must', weight: w ? +w.text : 1, def: b, note: b.attrs.find((a) => a.key === 'note')?.text ?? null });
  }
  const verr = (o, message) => diags.push({ level: 'error', cat: '構文', line: o.line, start: o.start, end: o.end, message });
  for (const n of ideas) {
    n.scores = new Map();
    for (const a of n.attrs.filter((x) => x.key === 'score')) {
      const c = criteria.get(a.crit);
      if (!c) { warn(a, `観点「${a.crit}」が criterion: にも must: にもありません`, '比較'); continue; }
      if (c.must ? !['ok', 'ng'].includes(a.value) : !/^[1-5]$/.test(a.value)) { verr(a, c.must ? `必須の条件「${c.name}」の値は ok か ng です` : `評価の観点「${c.name}」の値は 1〜5 の整数です`); continue; }
      if (n.scores.has(c.name)) { warn(a, `観点「${c.name}」の評価が 2 回あります(先に書いた方を使います)`, '比較'); continue; }
      n.scores.set(c.name, { value: c.must ? a.value : +a.value, attr: a });
    }
  }
  // 欠点列挙法・希望点列挙法・特性列挙法(仕様書 4.7 節)。改善案の最初の元のアイディアは、同じ手法の項目(欠点など)
  for (const n of ideas) for (const f of n.methods) {
    const L = LISTINGS[f.method];
    if (!L || f.vp !== L.improve) continue;
    const p0 = n.parents[0];
    if (!p0 || !p0.methods.some((m) => m.method === f.method && L.items.includes(m.vp))) warn(f, `${L.impLabel}「${n.name}」の元の${L.itemLabel}(最初の元のアイディアの from:)がありません`, L.title);
  }
  // ポジショニング(仕様書 5.7 節)
  const posmaps = new Map();
  for (const b of p.blocks.filter((x) => x.kind === 'positioning')) {
    if (posmaps.has(b.name)) { warn(b, `ポジショニング「${b.name}」の行が 2 回あります(${posmaps.get(b.name).def.line} 行の方を使います)`, 'ポジショニング'); continue; }
    const ax = (k) => { const a = b.attrs.find((x) => x.key === k); return a ? { lo: a.lo, hi: a.hi } : null; };
    posmaps.set(b.name, { name: b.name, def: b, x: ax('x'), y: ax('y'), note: b.attrs.find((a) => a.key === 'note')?.text ?? null });
  }
  for (const n of ideas) {
    n.pos = new Map();
    for (const a of n.attrs.filter((x) => x.key === 'pos')) {
      if (!posmaps.has(a.map)) { warn(a, `ポジショニング「${a.map}」がありません(positioning: の行を確かめてください)`, 'ポジショニング'); continue; }
      if (n.pos.has(a.map)) { warn(a, `ポジショニング「${a.map}」の位置が 2 回あります(先に書いた方を使います)`, 'ポジショニング'); continue; }
      n.pos.set(a.map, { x: a.x, y: a.y, attr: a });
    }
    n.scenes = n.attrs.filter((x) => x.key === 'scene');
  }
  // 既存調査(仕様書 5.9 節)
  const researches = [];
  for (const b of p.blocks.filter((x) => x.kind === 'research')) {
    if (researches.some((x) => x.name === b.name)) { warn(b, `既存調査「${b.name}」の行が 2 回あります(先に書いた方を使います)`, '既存調査'); continue; }
    const one = (k) => b.attrs.find((a) => a.key === k)?.text ?? null;
    const fors = [];
    for (const a of b.attrs.filter((x) => x.key === 'for')) {
      const c = byName.get(a.text) ?? [];
      if (!c.length) { warn(a, `案「${a.text}」が見つかりません`, '既存調査'); fors.push({ attr: a, target: null }); continue; }
      if (c.length > 1) warn(a, `「${a.text}」という名前のアイディアが ${c.length} つあり、どれか決まりません(${c[0].line} 行のアイディアを指します)`, '既存調査');
      fors.push({ attr: a, target: c[0] });
    }
    researches.push({ name: b.name, def: b, url: one('url'), diff: one('diff'), note: one('note'), fors });
  }
  if (diags.some((d) => d.level === 'error')) { for (let i = diags.length - 1; i >= 0; i--) if (diags[i].level !== 'error') diags.splice(i, 1); return res; }
  Object.assign(res, {
    ok: true, theme: theme ? theme.value : '', author: author ? author.value : '', summary: common.summary.map((x) => x.value),
    ideas, groups: [...groups.values()], groupMap: groups, rels, boards, findGroup, sheets, matrices: [...matrices.values()], seven, criteria: [...criteria.values()], posmaps: [...posmaps.values()], researches,
  });
  return res;
}

// ================= 描画(SVG の文字列) =================
const FONT = "'Hiragino Sans','Noto Sans JP','Yu Gothic UI','Meiryo','Segoe UI',sans-serif";
const COL = { accent: '#8b1a2b', line: '#333', warnFill: '#fff3c4', warnLine: '#b07800', grid: '#c8c8c4', head: '#f4f4f2', text: '#222', sub: '#666', empty: '#fafaf8', drop: '#9a9a96' };
const esc = (s) => String(s).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const charW = (ch, fs) => (/[\u0000-ɏ｡-ﾟ]/.test(ch) ? 0.6 : 1) * fs;
const textW = (s, fs) => [...s].reduce((a, ch) => a + charW(ch, fs), 0);
const NOHEAD = '、。，．,.)）」』】〕〉》・：；:;!！?？ー…';
function wrap(s, maxW, fs) {
  const out = [];
  let cur = '', w = 0;
  for (const ch of s) {
    const cw = charW(ch, fs);
    if (w + cw > maxW && cur) {
      if (NOHEAD.includes(ch) && [...cur].length > 1) { const k = [...cur]; const mv = []; do { mv.unshift(k.pop()); } while (k.length > 1 && NOHEAD.includes(mv[0])); out.push(k.join('')); cur = mv.join(''); w = textW(cur, fs); }
      else { out.push(cur); cur = ''; w = 0; }
    }
    cur += ch; w += cw;
  }
  if (cur) out.push(cur);
  return out.length ? out : [''];
}
function clip(s, maxW, fs) {
  if (textW(s, fs) <= maxW) return s;
  let out = '', w = textW('…', fs);
  for (const ch of s) { const cw = charW(ch, fs); if (w + cw > maxW) break; out += ch; w += cw; }
  return `${out}…`;
}
// 折り返して、max 行を超えたら最後の行を … で切る
const wrapMax = (s, maxW, fs, max) => { const l = wrap(s, maxW, fs); if (l.length <= max) return l; const k = l.slice(0, max); k[max - 1] = clip(`${k[max - 1]}……`, maxW, fs); return k; };
const T_ = (x, y, s, o = {}) => `<text x="${x}" y="${y}" font-size="${o.fs ?? 13}"${o.anchor ? ` text-anchor="${o.anchor}"` : ''}${o.fill ? ` fill="${o.fill}"` : ''}${o.weight ? ` font-weight="${o.weight}"` : ''}${o.deco ? ` text-decoration="${o.deco}"` : ''}${o.halo ? ' stroke="#fff" stroke-width="4" stroke-linejoin="round" paint-order="stroke"' : ''}>${esc(s)}</text>`;
const wrapSvg = (w, h, body) => `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.ceil(w)}" height="${Math.ceil(h)}" viewBox="0 0 ${Math.ceil(w)} ${Math.ceil(h)}" font-family="${esc(FONT)}"><rect x="0" y="0" width="${Math.ceil(w)}" height="${Math.ceil(h)}" fill="#fff"/>${body}</svg>`;
const sel = (n) => `data-id="${n.id}" data-start="${n.start}" data-end="${n.end}"`;
const themeLabel = (r) => r.theme || '(テーマなし)';
const lacks = (n) => !n.by || !n.froms.length;
// 出所の短い説明
function fromLabel(n) {
  const ms = n.methods.map((m) => (m.method === 'triz' && m.vp ? `TRIZ ${m.vp} ${TRIZ[+m.vp - 1][0]}` : `${METHODS[m.method].ja}${m.vp ? ` ${m.vp}` : ''}`));
  const ps = n.froms.filter((f) => f.ref).map((f) => `元: ${f.ref}`);
  return [...ms, ...ps].join(' / ') || '(出所なし)';
}

// ---- アイディア一覧(仕様書 4.1 節)
function renderList(r) {
  const M = 20, CW = 210, GAP = 12, FS = 13, SFS = 11, PAD = 9, TOP = 56;
  const title = `アイディア一覧: ${themeLabel(r)}`;
  const sub = `${r.ideas.length} 件。点線の黄色い枠は、書いた人(by:)か出所(from:)がないアイディア`;
  if (!r.ideas.length) return wrapSvg(Math.max(520, textW(title, 14) + 2 * M), 110, T_(M, 26, title, { fs: 14, weight: '600' }) + T_(M, 70, 'アイディアはまだありません。下の入力欄に書いて Enter で足します。', { fs: 12, fill: COL.sub }));
  const cols = Math.min(4, r.ideas.length);
  const cards = r.ideas.map((n) => {
    const lines = wrapMax(n.name, CW - 2 * PAD, FS, 6);
    const subl = [clip(n.by ? `書いた人: ${n.by}` : '書いた人なし', CW - 2 * PAD, SFS), ...wrapMax(fromLabel(n), CW - 2 * PAD, SFS, 2)];
    if (n.decision) subl.push(DECISION[n.decision]);
    return { n, lines, subl, h: 2 * PAD + lines.length * FS * 1.4 + subl.length * SFS * 1.4 + 4 };
  });
  const out = [];
  let y = TOP;
  for (let i = 0; i < cards.length; i += cols) {
    const row = cards.slice(i, i + cols), rh = Math.max(...row.map((c) => c.h));
    row.forEach((c, j) => {
      const x = M + j * (CW + GAP), w = lacks(c.n), dropped = c.n.decision === 'drop';
      let g = `<g ${sel(c.n)}><title>${esc(c.n.name)}${c.n.note ? `\n${esc(c.n.note)}` : ''}</title><rect x="${x}" y="${y}" width="${CW}" height="${rh}" rx="6" fill="${w ? COL.warnFill : '#fff'}" stroke="${w ? COL.warnLine : c.n.decision === 'adopt' ? COL.accent : COL.line}" stroke-width="${c.n.decision === 'adopt' ? 2.5 : 1.3}"${w ? ' stroke-dasharray="5 3"' : ''}/>`;
      let ty = y + PAD + FS;
      for (const l of c.lines) { g += T_(x + PAD, ty, l, { fs: FS, fill: dropped ? COL.drop : COL.text }); ty += FS * 1.4; }
      ty += 2;
      c.subl.forEach((l, k) => { const isDec = c.n.decision && k === c.subl.length - 1; g += T_(x + PAD, ty, l, { fs: SFS, fill: isDec && c.n.decision === 'adopt' ? COL.accent : COL.sub, weight: isDec ? '600' : null }); ty += SFS * 1.4; });
      out.push(`${g}</g>`);
    });
    y += rh + GAP;
  }
  const W = Math.max(M * 2 + cols * CW + (cols - 1) * GAP, textW(sub, SFS) + 2 * M, textW(title, 14) + 2 * M);
  return wrapSvg(W, y + M - GAP, T_(M, 26, title, { fs: 14, weight: '600' }) + T_(M, 44, sub, { fs: SFS, fill: COL.sub }) + out.join(''));
}

// ---- マンダラート(仕様書 4.2 節)。centerId: 中心のアイディアの id(なければテーマ)
const MANDALA_POS = [[0, 0], [0, 1], [0, 2], [1, 0], [1, 2], [2, 0], [2, 1], [2, 2]];
function boardOf(r, centerId) {
  const c = centerId ? r.ideas.find((n) => n.id === centerId) : null;
  return r.boards.get(c ? c.id : 'theme') ?? { key: c ? c.id : 'theme', center: c, cells: [] };
}
function renderMandala(r, centerId) {
  const b = boardOf(r, centerId);
  const M = 20, S = 170, H = 116, FS = 13, TOP = 60, PAD = 9;
  const label = b.center ? b.center.name : themeLabel(r);
  const title = `マンダラート: ${label}`;
  const sub = `8 マス中 ${Math.min(8, b.cells.length)} マス${b.cells.length < 8 ? '。点線のマスは空き(クリックして書く)' : ''}`;
  const out = [];
  const cell = (row, col) => [M + col * S, TOP + row * H];
  // 中心
  {
    const [x, y] = cell(1, 1);
    const lines = wrapMax(label, S - 2 * PAD, FS, 5);
    let g = `<rect x="${x}" y="${y}" width="${S}" height="${H}" fill="${COL.head}" stroke="${COL.line}" stroke-width="1.6"/>`;
    const y0 = y + H / 2 - (lines.length - 1) * FS * 0.7 + 4;
    lines.forEach((l, i) => { g += T_(x + S / 2, y0 + i * FS * 1.4, l, { fs: FS, anchor: 'middle', weight: '600' }); });
    out.push(b.center ? `<g ${sel(b.center)}><title>${esc(b.center.name)}</title>${g}</g>` : g);
  }
  MANDALA_POS.forEach(([row, col], i) => {
    const [x, y] = cell(row, col);
    const n = b.cells[i];
    if (!n) { out.push(`<g data-cell="${i}"><title>空きのマス(クリックして書く)</title><rect x="${x}" y="${y}" width="${S}" height="${H}" fill="${COL.empty}" stroke="${COL.grid}" stroke-dasharray="5 4"/>${T_(x + S / 2, y + H / 2 + 4, '空き', { fs: 12, anchor: 'middle', fill: '#aaa' })}</g>`); return; }
    const lines = wrapMax(n.name, S - 2 * PAD, FS, 5);
    const sub2 = clip(n.by ?? '書いた人なし', S - 2 * PAD, 11);
    const w = lacks(n);
    let g = `<g ${sel(n)}><title>${esc(n.name)}</title><rect x="${x}" y="${y}" width="${S}" height="${H}" fill="${w ? COL.warnFill : '#fff'}" stroke="${COL.line}" stroke-width="1.2"/>`;
    const y0 = y + H / 2 - lines.length * FS * 0.7 + 2;
    lines.forEach((l, k) => { g += T_(x + S / 2, y0 + k * FS * 1.4, l, { fs: FS, anchor: 'middle', fill: n.decision === 'drop' ? COL.drop : COL.text }); });
    g += T_(x + S - 6, y + H - 7, sub2, { fs: 11, anchor: 'end', fill: COL.sub });
    if (r.boards.has(n.id)) g += T_(x + 6, y + H - 7, '▸ 盤面あり', { fs: 11, fill: COL.accent });
    out.push(`${g}</g>`);
  });
  let y = TOP + 3 * H;
  const over = b.cells.slice(8);
  if (over.length) { y += 22; out.push(T_(M, y, `盤面に置けないマス(9 個目以降): ${over.map((n) => n.name).join('、')}`, { fs: 12, fill: COL.warnLine })); }
  const W = Math.max(2 * M + 3 * S, textW(title, 14) + 2 * M, textW(sub, 11) + 2 * M);
  return wrapSvg(W, y + M, T_(M, 26, title, { fs: 14, weight: '600' }) + T_(M, 44, sub, { fs: 11, fill: COL.sub }) + out.join(''));
}

// ---- 観点の並びで書く手法(SCAMPER・オズボーン・シックスハット・TRIZ。仕様書 4.3 節・4.6 節)
// 対象がテーマのアイディアは、元のアイディアの from: がないもの。対象がアイディア X のものは、最初の元のアイディアが X のもの
const CHECKLISTS = {
  sixhats: { title: 'シックスハット', items: HATS.map(([c, h, q]) => ({ vp: c, label: `${c}(${h})`, q })) },
  osborn: { title: 'オズボーンのチェックリスト', items: OSBORN.map(([v, q]) => ({ vp: v, label: v, q })) },
  scamper: { title: 'SCAMPER', items: SCAMPER.map(([v, l, q]) => ({ vp: v, label: `${v}(${l})`, q })) },
  triz: { title: 'TRIZ の 40 原理', items: TRIZ.map(([nm, q], i) => ({ vp: String(i + 1), label: `${i + 1} ${nm}`, q })) },
};
function checklistIdeas(r, method, targetId, vp) {
  return r.ideas.filter((n) => n.methods.some((m) => m.method === method && m.vp === vp)
    && (targetId ? n.parents[0]?.id === targetId : !n.froms.some((f) => f.ref)));
}
// 対象の一覧(テーマは null)。書いた順
function checklistTargets(r, method) {
  const t = new Set();
  for (const n of r.ideas) if (n.methods.some((m) => m.method === method)) { if (!n.froms.some((f) => f.ref)) t.add(null); else if (n.parents[0]) t.add(n.parents[0].id); }
  return [...t].sort((a, b) => (a ? r.ideas.find((n) => n.id === a).lineIdx : -1) - (b ? r.ideas.find((n) => n.id === b).lineIdx : -1));
}
function renderChecklist(r, method, targetId, curVp) {
  const def = CHECKLISTS[method];
  const tall = def.items.length > 10; // TRIZ は 40 行あるので、行を低くする
  const M = 20, TOP = 58, LW = tall ? 250 : 220, CW = 560, FS = 13, CH = 26, CGAP = 6, MINH = tall ? 46 : 62;
  const t = targetId ? r.ideas.find((n) => n.id === targetId) : null;
  const title = `${def.title}: ${t ? t.name : themeLabel(r)}`;
  const out = [];
  let y = TOP;
  def.items.forEach(({ vp, label, q }, i) => {
    // 観点の欄の右に、その観点から出したアイディアを札で並べる
    const chips = [];
    let cx = 0, cy = 0;
    for (const n of checklistIdeas(r, method, targetId, vp)) {
      const lb = clip(n.name, CW - 20, FS);
      const w = textW(lb, FS) + 18;
      if (cx + w > CW - 12 && cx > 0) { cx = 0; cy += CH + CGAP; }
      chips.push({ n, label: lb, x: cx, y: cy, w });
      cx += w + CGAP;
    }
    const rh = Math.max(MINH, 10 + (chips.length ? cy + CH : 0) + 10);
    const on = i === curVp;
    const qlines = tall ? [clip(q, LW - 20, 12)] : wrapMax(q, LW - 20, 12, 2);
    out.push(`<g data-vp="${i}"><title>この観点で書く</title><rect x="${M}" y="${y}" width="${LW}" height="${rh}" fill="${on ? '#fbf3f4' : COL.head}" stroke="${on ? COL.accent : COL.grid}" stroke-width="${on ? 2 : 1}"/>${T_(M + 10, y + (tall ? 18 : 22), label, { fs: tall ? 13 : 14, weight: '600', fill: on ? COL.accent : COL.text })}${qlines.map((l, k) => T_(M + 10, y + (tall ? 36 : 42) + k * 16, l, { fs: 12, fill: COL.sub })).join('')}<rect x="${M + LW}" y="${y}" width="${CW}" height="${rh}" fill="#fff" stroke="${on ? COL.accent : COL.grid}" stroke-width="${on ? 2 : 1}"/></g>`);
    for (const c of chips) {
      const x = M + LW + 10 + c.x, yy = y + 10 + c.y, w = lacks(c.n);
      out.push(`<g ${sel(c.n)}><title>${esc(c.n.name)}${c.n.by ? `(${esc(c.n.by)})` : ''}</title><rect x="${x}" y="${yy}" width="${c.w}" height="${CH}" rx="4" fill="${w ? COL.warnFill : '#fff'}" stroke="${w ? COL.warnLine : COL.line}"${w ? ' stroke-dasharray="5 3"' : ''}/>${T_(x + 9, yy + 18, c.label, { fs: FS, fill: c.n.decision === 'drop' ? COL.drop : COL.text })}</g>`);
    }
    y += rh;
  });
  const sub = '観点の欄をクリックすると、その観点で書けます。右の札がその観点から出したアイディア';
  return wrapSvg(Math.max(2 * M + LW + CW, textW(title, 14) + 2 * M), y + M, T_(M, 26, title, { fs: 14, weight: '600' }) + T_(M, 44, sub, { fs: 11, fill: COL.sub }) + out.join(''));
}

// ---- 蜂の巣ノート(仕様書 4.4 節)。六角形の格子に、元の枠の隣から順に置く。sheetKey: シートの根の id(なければテーマ)
const HEX_DIRS = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
function hexLayout(r, sheetKey) {
  const sh = r.sheets.get(sheetKey ?? 'theme') ?? { key: sheetKey ?? 'theme', root: sheetKey ? r.ideas.find((n) => n.id === sheetKey) ?? null : null, nodes: [] };
  const inSheet = new Set(sh.nodes);
  const kids = new Map();
  const pid = (n) => (n.tparent && inSheet.has(n.tparent) ? n.tparent : null);
  for (const n of sh.nodes) { const k = pid(n); if (!kids.has(k)) kids.set(k, []); kids.get(k).push(n); }
  const pos = new Map(), used = new Set();
  const key = (q, s) => `${q},${s}`;
  const place = (node, q, s) => { pos.set(node, [q, s]); used.add(key(q, s)); };
  place(null, 0, 0);
  // 広さ優先で、親の隣の空いた枠に置く。隣が埋まっていれば、親からいちばん近い空いた枠
  const queue = [null];
  while (queue.length) {
    const p = queue.shift();
    const [pq, ps] = pos.get(p);
    for (const c of kids.get(p) ?? []) {
      let spot = HEX_DIRS.map(([dq, ds]) => [pq + dq, ps + ds]).find(([q, s]) => !used.has(key(q, s)));
      for (let ring = 2; !spot; ring++) {
        const cand = [];
        for (let dq = -ring; dq <= ring; dq++) for (let ds = Math.max(-ring, -dq - ring); ds <= Math.min(ring, -dq + ring); ds++) if (!used.has(key(pq + dq, ps + ds))) cand.push([pq + dq, ps + ds]);
        cand.sort((a, b) => Math.hypot(a[0] - pq + (a[1] - ps) / 2, (a[1] - ps) * 0.866) - Math.hypot(b[0] - pq + (b[1] - ps) / 2, (b[1] - ps) * 0.866));
        spot = cand[0];
      }
      place(c, ...spot);
      queue.push(c);
    }
  }
  return { sh, pos, pid };
}
function renderHoneycomb(r, sheetKey) {
  const { sh, pos, pid } = hexLayout(r, sheetKey);
  const R = 62, FS = 12, M = 20, TOP = 58;
  const hw = Math.sqrt(3) * R;
  const px = ([q, s]) => [hw * (q + s / 2), 1.5 * R * s];
  const pts = [...pos.values()].map(px);
  const minX = Math.min(...pts.map((p) => p[0])) - hw / 2, minY = Math.min(...pts.map((p) => p[1])) - R;
  const maxX = Math.max(...pts.map((p) => p[0])) + hw / 2, maxY = Math.max(...pts.map((p) => p[1])) + R;
  const ox = M - minX, oy = TOP - minY;
  const hex = (cx, cy) => Array.from({ length: 6 }, (_, k) => { const a = Math.PI / 180 * (60 * k - 30); return `${(cx + R * Math.cos(a)).toFixed(1)},${(cy + R * Math.sin(a)).toFixed(1)}`; }).join(' ');
  const out = [], lines = [];
  const rootLabel = sh.root ? sh.root.name : themeLabel(r);
  for (const [node, qs] of pos) {
    const [x, y] = px(qs), cx = x + ox, cy = y + oy;
    if (node) { const p = pid(node); const [x2, y2] = px(pos.get(p)); lines.push(`<path d="M${(x2 + ox).toFixed(1)} ${(y2 + oy).toFixed(1)}L${cx.toFixed(1)} ${cy.toFixed(1)}" stroke="${COL.grid}" stroke-width="2"/>`); }
    const label = node ? node.name : rootLabel;
    const tl = wrapMax(label, hw - 26, FS, 4);
    const w = node && lacks(node);
    let g = `<polygon points="${hex(cx, cy)}" fill="${!node ? COL.head : w ? COL.warnFill : '#fff'}" stroke="${node ? COL.line : COL.accent}" stroke-width="${node ? 1.3 : 2}"/>`;
    const y0 = cy - (tl.length - 1) * FS * 0.68 + 4;
    tl.forEach((l, k) => { g += T_(cx, y0 + k * FS * 1.36, l, { fs: FS, anchor: 'middle', weight: node ? null : '600', fill: node && node.decision === 'drop' ? COL.drop : COL.text }); });
    if (node) out.push(`<g ${sel(node)}><title>${esc(node.name)}${node.by ? `(${esc(node.by)})` : ''}</title>${g}</g>`);
    else out.push(sh.root ? `<g ${sel(sh.root)} data-hcroot="1"><title>${esc(rootLabel)}</title>${g}</g>` : `<g data-hcroot="1"><title>${esc(rootLabel)}</title>${g}</g>`);
  }
  const title = `蜂の巣ノート: ${rootLabel}`;
  const sub = `${sh.nodes.length} 枠。枠をクリックすると、その枠の隣に広げて書けます(線は元の枠とのつながり)`;
  return wrapSvg(Math.max(maxX - minX + 2 * M, textW(title, 14) + 2 * M, textW(sub, 11) + 2 * M), maxY - minY + TOP + M, T_(M, 26, title, { fs: 14, weight: '600' }) + T_(M, 44, sub, { fs: 11, fill: COL.sub }) + lines.join('') + out.join(''));
}

// ---- マトリックス法(仕様書 4.5 節)。縦の項目 × 横の項目の表に、その組み合わせから出したアイディアを並べる
function matrixIdeas(r, m, row, col) { return r.ideas.filter((n) => n.methods.some((f) => f.method === 'matrix' && f.matrix === m && f.row === row && f.col === col)); }
function renderMatrix(r, name, cur) {
  const M = 20, TOP = 58, FS = 12, LH = 17, RW = 150, CW = 190, PAD = 6;
  const m = r.matrices.find((x) => x.name === name) ?? r.matrices[0];
  if (!m) { const t = 'マトリックス法'; return wrapSvg(560, 110, T_(M, 26, t, { fs: 14, weight: '600' }) + T_(M, 70, 'マトリックスがありません。下の入力欄で名前を付けて作ります。', { fs: 12, fill: COL.sub })); }
  const title = `マトリックス法: ${m.name}`;
  const out = [];
  let x = M + RW, y = TOP;
  out.push(`<rect x="${M}" y="${y}" width="${RW}" height="30" fill="${COL.head}" stroke="${COL.grid}"/>${T_(M + PAD, y + 19, '縦 \\ 横', { fs: FS, fill: COL.sub })}`);
  m.cols.forEach((c, j) => { out.push(`<g data-mxh="col|${j}"><title>横の項目</title><rect x="${x}" y="${y}" width="${CW}" height="30" fill="${COL.head}" stroke="${COL.grid}"/>${T_(x + PAD, y + 19, clip(c, CW - 2 * PAD, FS), { fs: FS, weight: '600' })}</g>`); x += CW; });
  y += 30;
  m.rows.forEach((rw, i) => {
    const cells = m.cols.map((c) => matrixIdeas(r, m, rw, c));
    const lines = cells.map((list) => list.map((n) => wrapMax(n.name, CW - 2 * PAD - 8, FS, 3)));
    const h = Math.max(48, ...lines.map((ls) => ls.reduce((a, l) => a + l.length * LH + 8, 10)));
    out.push(`<g data-mxh="row|${i}"><title>縦の項目</title><rect x="${M}" y="${y}" width="${RW}" height="${h}" fill="${COL.head}" stroke="${COL.grid}"/>${wrapMax(rw, RW - 2 * PAD, FS, 3).map((l, k) => T_(M + PAD, y + 20 + k * LH, l, { fs: FS, weight: '600' })).join('')}</g>`);
    let cx = M + RW;
    cells.forEach((list, j) => {
      const on = cur && cur[0] === i && cur[1] === j;
      out.push(`<g data-mx="${i}|${j}"><title>${esc(`${rw} × ${m.cols[j]}`)}(クリックして書く)</title><rect x="${cx}" y="${y}" width="${CW}" height="${h}" fill="${on ? '#fbf3f4' : list.length ? '#fff' : COL.empty}" stroke="${on ? COL.accent : COL.grid}" stroke-width="${on ? 2 : 1}"/>${list.length ? '' : T_(cx + CW / 2, y + h / 2 + 4, '空き', { fs: 11, anchor: 'middle', fill: '#aaa' })}</g>`);
      let yy = y + 6;
      list.forEach((n, k) => {
        const ls = lines[j][k], ch = ls.length * LH + 4, w = lacks(n);
        out.push(`<g ${sel(n)}><title>${esc(n.name)}</title><rect x="${cx + 4}" y="${yy}" width="${CW - 8}" height="${ch}" rx="3" fill="${w ? COL.warnFill : '#fff'}" stroke="${w ? COL.warnLine : '#999'}"/>${ls.map((l, q) => T_(cx + 4 + PAD, yy + 14 + q * LH, l, { fs: FS, fill: n.decision === 'drop' ? COL.drop : COL.text })).join('')}</g>`);
        yy += ch + 4;
      });
      cx += CW;
    });
    y += h;
  });
  const sub = '組み合わせのマスをクリックすると、そのマスに書けます。点線の灰色のマスはまだアイディアがない組み合わせ';
  return wrapSvg(Math.max(M * 2 + RW + CW * m.cols.length, textW(title, 14) + 2 * M, textW(sub, 11) + 2 * M), y + M, T_(M, 26, title, { fs: 14, weight: '600' }) + T_(M, 44, sub, { fs: 11, fill: COL.sub }) + out.join(''));
}

// ---- KJ 法(仕様書 5.1 節)。グループを入れ子の枠で描き、関係の線を引く。下に全体のまとめ
function renderKJ(r) {
  const M = 20, W0 = 300, GAP = 24, FS = 13, SFS = 11, PAD = 8, CARD = 6;
  const TOP = r.rels.length ? 120 : 58; // 関係の線を枠の上に通す場所を空ける
  const title = `KJ 法: ${themeLabel(r)}`;
  const sub = 'アイディアをクリックで選び、Ctrl(⌘)を押しながらクリックで複数選べます。グループの見出しをクリックすると、見出しと関係を編集できます';
  const rects = new Map();
  // 枠の大きさを先に求め、描くときに位置を決める
  const cardH = (n, w) => wrapMax(n.name, w - 2 * PAD, FS, 4).length * FS * 1.35 + 2 * 6;
  // 深い入れ子でも止まらないように、再帰せず、上位から並べた順の逆(下位から)に大きさを求める
  const measure = (g0, w0) => {
    const order = [], stack = [[g0, w0]];
    while (stack.length) { const [g, w] = stack.pop(); order.push([g, w]); for (const c of g.children) stack.push([c, w - 2 * PAD]); }
    const done = new Map();
    for (let k = order.length - 1; k >= 0; k--) {
      const [g, w] = order[k];
      const head = wrapMax(g.name, w - 2 * PAD, FS, 3), note = g.note ? wrapMax(g.note, w - 2 * PAD, SFS, 4) : [];
      let h = PAD + head.length * FS * 1.4 + note.length * SFS * 1.4 + 4;
      const kids = g.children.map((c) => done.get(c));
      for (const m of kids) h += m.h + CARD;
      for (const n of g.members) h += cardH(n, w - 2 * PAD) + CARD;
      done.set(g, { g, w, h: h + PAD, head, note, kids });
    }
    return done.get(g0);
  };
  const out = [];
  // 描く順は、枠 → 下位のグループ(それぞれの中身まで) → 所属のアイディア。再帰せず、手順の山で描く
  const draw = (m0, x0, y0) => {
    const stack = [{ m: m0, x: x0, y: y0 }];
    while (stack.length) {
      const t = stack.pop();
      if (t.cards) { drawCards(t.m, t.x, t.cy); continue; }
      const { m, x, y } = t, g = m.g;
      rects.set(g.path, { x, y, w: m.w, h: m.h });
      let s = `<g data-group="${esc(g.path)}"><title>${esc(g.path)}${g.note ? `\n${esc(g.note)}` : ''}</title><rect x="${x}" y="${y}" width="${m.w}" height="${m.h}" rx="8" fill="${g.depth % 2 ? '#f7f7f4' : '#fff'}" stroke="${COL.line}" stroke-width="1.4"/>`;
      let ty = y + PAD + FS;
      for (const l of m.head) { s += T_(x + PAD, ty, l, { fs: FS, weight: '600' }); ty += FS * 1.4; }
      for (const l of m.note) { s += T_(x + PAD, ty - 2, l, { fs: SFS, fill: COL.sub }); ty += SFS * 1.4; }
      out.push(`${s}</g>`);
      let cy = ty - FS + 4;
      const ks = m.kids.map((k) => { const at = { m: k, x: x + PAD, y: cy }; cy += k.h + CARD; return at; });
      stack.push({ cards: true, m, x, cy });
      for (let k = ks.length - 1; k >= 0; k--) stack.push(ks[k]);
    }
  };
  const drawCards = (m, x, cy) => {
    for (const n of m.g.members) {
      const cw = m.w - 2 * PAD, lines = wrapMax(n.name, cw - 2 * PAD, FS, 4), ch = cardH(n, cw), w = lacks(n);
      let c = `<g ${sel(n)}><title>${esc(n.name)}</title><rect x="${x + PAD}" y="${cy}" width="${cw}" height="${ch}" rx="4" fill="${w ? COL.warnFill : '#fff'}" stroke="${w ? COL.warnLine : '#888'}"${w ? ' stroke-dasharray="5 3"' : ''}/>`;
      lines.forEach((l, i) => { c += T_(x + 2 * PAD, cy + 6 + FS + i * FS * 1.35, l, { fs: FS, fill: n.decision === 'drop' ? COL.drop : COL.text }); });
      out.push(`${c}</g>`);
      cy += ch + CARD;
    }
  };
  const tops = r.groups.filter((g) => !g.parent);
  const ungrouped = r.ideas.filter((n) => !n.groups.length);
  const ms = tops.map((g) => measure(g, W0));
  if (ungrouped.length) ms.push(measure({ path: '', name: '未所属', note: null, children: [], members: ungrouped, depth: 0 }, W0));
  const cols = Math.max(1, Math.min(3, ms.length));
  const colY = new Array(cols).fill(TOP);
  for (const m of ms) {
    const c = colY.indexOf(Math.min(...colY));
    draw(m, M + c * (W0 + GAP * 2), colY[c]);
    colY[c] += m.h + GAP;
  }
  rects.delete('');
  // 関係の線: 枠の上を通る曲線にする(間にある枠の上を横切らないため)。
  // 横に離れた枠どうしは、枠の上辺の中ほどから上へ出て結ぶ。縦に重なる枠どうしは、右辺から右へ出て結ぶ
  const lbl = [];
  r.rels.forEach((rel, k) => {
    const a = rects.get(rel.from.path), b = rects.get(rel.to.path);
    if (!a || !b) return;
    const apart = a.x + a.w <= b.x || b.x + b.w <= a.x;
    let x1, y1, x2, y2, d, lx, ly, tx, ty;
    if (apart) {
      x1 = a.x + a.w / 2 + (b.x > a.x ? 30 : -30); y1 = a.y; x2 = b.x + b.w / 2 + (a.x > b.x ? 30 : -30); y2 = b.y;
      const top = Math.min(y1, y2) - 28 - (k % 4) * 12;
      d = `M${x1} ${y1}C${x1} ${top} ${x2} ${top} ${x2} ${y2}`;
      // 曲線のいちばん上(t = 0.5)に文字を置く
      lx = (x1 + x2) / 2; ly = (y1 + y2) / 8 + 0.75 * top - 4; tx = 0; ty = 1;
    } else {
      x1 = a.x + a.w; y1 = a.y + Math.min(30, a.h / 2); x2 = b.x + b.w; y2 = b.y + Math.min(30, b.h / 2);
      const right = Math.max(x1, x2) + 28 + (k % 4) * 12;
      d = `M${x1} ${y1}C${right} ${y1} ${right} ${y2} ${x2} ${y2}`;
      lx = right - 4; ly = (y1 + y2) / 2 + 4; tx = -1; ty = 0;
    }
    let s = `<path d="${d}" fill="none" stroke="${COL.accent}" stroke-width="2"${rel.kind === 'oppose' ? ' stroke-dasharray="7 4"' : ''}/>`;
    // 因果の矢じりは、結果の枠に入る向き
    if (rel.kind === 'cause') s += apart ? `<path d="M${x2} ${y2}l-5.5 -11l11 0Z" fill="${COL.accent}"/>` : `<path d="M${x2} ${y2}l11 -5.5l0 11Z" fill="${COL.accent}"/>`;
    out.push(`<g pointer-events="none">${s}</g>`);
    lbl.push(T_(lx, ly, REL[rel.kind], { fs: 12, anchor: tx ? 'end' : 'middle', fill: COL.accent, weight: '600', halo: true }));
  });
  out.push(`<g pointer-events="none">${lbl.join('')}</g>`);
  // 全体のまとめ
  const totalW = Math.max(cols * (W0 + GAP * 2) - GAP * 2 + (r.rels.length ? 80 : 0), 620); // 右に出る関係の線の分も空ける
  let y = Math.max(...colY) + 10;
  const sumLines = r.summary.length ? r.summary.flatMap((s) => wrap(s, totalW - 20, 13)) : ['(まだ書いていません。クリックして書けます)'];
  const sh = 34 + sumLines.length * 13 * 1.5 + 8;
  out.push(`<g data-summary="1"><title>全体のまとめ(summary:)を書く</title><rect x="${M}" y="${y}" width="${totalW}" height="${sh}" fill="${COL.head}" stroke="${COL.grid}"/>${T_(M + 10, y + 22, '全体のまとめ', { fs: 13, weight: '600' })}${sumLines.map((l, i) => T_(M + 10, y + 44 + i * 13 * 1.5, l, { fs: 13, fill: r.summary.length ? COL.text : COL.sub })).join('')}</g>`);
  y += sh;
  const legend = '線: 実線は関連、矢印は因果(原因 → 結果)、破線は対立';
  return wrapSvg(Math.max(totalW + 2 * M, textW(sub, 11) + 2 * M, textW(title, 14) + 2 * M), y + M + 18, T_(M, 26, title, { fs: 14, weight: '600' }) + T_(M, 44, sub, { fs: 11, fill: COL.sub }) + out.join('') + T_(M, y + 20, legend, { fs: 11, fill: COL.sub }));
}

// ---- セブンクロス(仕様書 5.4 節)。分類を列、重要度(1 がいちばん重要)を行にした表に、アイディアを置く
function sevenClasses(r) { return [...r.seven.classes, ...r.seven.extra]; }
function renderSeven(r, o = {}) {
  const M = 20, FS = 12, LH = 16, LW = 80, CW = 170, PAD = 5;
  const classes = sevenClasses(r);
  const title = `セブンクロス: ${r.seven.axis || '(分類の軸なし)'}`;
  const TOP = o.noTitle ? M : 58;
  const out = [];
  const chip = (n, x, y, w) => {
    const ls = wrapMax(n.name, w - 2 * PAD, FS, 3), h = ls.length * LH + 4, wn = lacks(n);
    out.push(`<g ${sel(n)}><title>${esc(n.name)}</title><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3" fill="${wn ? COL.warnFill : '#fff'}" stroke="${wn ? COL.warnLine : '#999'}"/>${ls.map((l, k) => T_(x + PAD, y + 13 + k * LH, l, { fs: FS, fill: n.decision === 'drop' ? COL.drop : COL.text })).join('')}</g>`);
    return h;
  };
  const chipH = (n, w) => wrapMax(n.name, w - 2 * PAD, FS, 3).length * LH + 4;
  if (!classes.length) {
    const msg = '分類がまだありません。下の入力欄で分類の軸と分類を足します。';
    return { svg: wrapSvg(Math.max(560, textW(title, 14) + 2 * M), 110, T_(M, 26, title, { fs: 14, weight: '600' }) + T_(M, 70, msg, { fs: 12, fill: COL.sub })), header: [], rows: [] };
  }
  let y = TOP;
  out.push(`<rect x="${M}" y="${y}" width="${LW}" height="30" fill="${COL.head}" stroke="${COL.grid}"/>${T_(M + PAD, y + 19, '重要度', { fs: FS, fill: COL.sub })}`);
  classes.forEach((c, j) => { const extra = !r.seven.classes.includes(c); out.push(`<g data-sxc="${esc(c)}"><title>分類${extra ? '(class: にない)' : ''}</title><rect x="${M + LW + j * CW}" y="${y}" width="${CW}" height="30" fill="${extra ? COL.warnFill : COL.head}" stroke="${COL.grid}"/>${T_(M + LW + j * CW + PAD, y + 19, clip(c, CW - 2 * PAD, FS), { fs: FS, weight: '600' })}</g>`); });
  y += 30;
  const at = (cls, lv) => r.ideas.filter((n) => n.ranks.some((x) => x.cls === cls && x.level === lv));
  const table = [];
  for (let lv = 1; lv <= RANKS; lv++) {
    const cells = classes.map((c) => at(c, lv));
    const h = Math.max(36, ...cells.map((l) => l.reduce((a, n) => a + chipH(n, CW - 8) + 4, 8)));
    out.push(`<rect x="${M}" y="${y}" width="${LW}" height="${h}" fill="${COL.head}" stroke="${COL.grid}"/>${T_(M + PAD, y + 20, lv === 1 ? '1(高)' : lv === RANKS ? `${RANKS}(低)` : String(lv), { fs: FS, weight: '600' })}`);
    cells.forEach((list, j) => {
      const x = M + LW + j * CW;
      out.push(`<g data-sx="${esc(classes[j])}|${lv}"><title>${esc(`${classes[j]} の重要度 ${lv}`)}(選んだアイディアをここに置く)</title><rect x="${x}" y="${y}" width="${CW}" height="${h}" fill="#fff" stroke="${COL.grid}"/></g>`);
      let yy = y + 4;
      for (const n of list) yy += chip(n, x + 4, yy, CW - 8) + 4;
    });
    table.push([String(lv), ...cells.map((l) => l.map((n) => n.name).join('、'))]);
    y += h;
  }
  const tableEnd = y;
  if (!o.noTitle) {
    // まだどの分類にも置いていないアイディア
    const rest = r.ideas.filter((n) => !n.ranks.length);
    y += 24;
    out.push(T_(M, y, `まだ置いていないアイディア(${rest.length} 件)`, { fs: 13, weight: '600' }));
    y += 8;
    let x = M;
    let rowH = 0;
    const W = Math.max(LW + CW * classes.length, 600);
    for (const n of rest) {
      const w = Math.min(220, textW(n.name, FS) + 2 * PAD + 4);
      if (x + w > M + W && x > M) { x = M; y += rowH + 6; rowH = 0; }
      const h = chip(n, x, y, w);
      rowH = Math.max(rowH, h);
      x += w + 6;
    }
    y += rowH;
  }
  const sub = 'アイディアを選んでから表のマスをクリックすると、その分類と重要度に置きます(1 がいちばん重要)。分類の見出しをクリックすると、名前を変えたり消したりできます';
  const head = o.noTitle ? '' : T_(M, 26, title, { fs: 14, weight: '600' }) + T_(M, 44, sub, { fs: 11, fill: COL.sub });
  return { svg: wrapSvg(Math.max(M * 2 + LW + CW * classes.length, o.noTitle ? 0 : Math.max(textW(title, 14), textW(sub, 11)) + 2 * M), (o.noTitle ? tableEnd : y) + M, head + out.join('')), header: ['重要度', ...classes], rows: table };
}

// ---- マインドマップ(仕様書 5.5 節)。テーマを中心に、元のアイディアをたどった木を左右に広げる
function mindTree(r) {
  const kids = new Map([[null, []]]);
  for (const n of r.ideas) { const p = n.tparent; if (!kids.has(p)) kids.set(p, []); kids.get(p).push(n); }
  return kids;
}
function renderMind(r) {
  const M = 20, TOP = 58, FS = 12, NW = 170, GX = 40, GY = 8, PAD = 6, LH = 16;
  const kids = mindTree(r);
  const nh = (n) => wrapMax(n.name, NW - 2 * PAD, FS, 3).length * LH + 8;
  const size = new Map();
  // 木を上から並べ(tparent は循環しない)、その逆の順(下から)に高さと深さを求める。深い木でも再帰しない
  const top = kids.get(null);
  const order = [], stack = [...top];
  while (stack.length) { const n = stack.pop(); order.push(n); for (const c of kids.get(n) ?? []) stack.push(c); }
  const dep = new Map();
  for (let k = order.length - 1; k >= 0; k--) {
    const n = order[k], ks = kids.get(n) ?? [];
    const sub = ks.reduce((a, c) => a + size.get(c) + GY, -GY);
    size.set(n, Math.max(nh(n), ks.length ? sub : 0));
    dep.set(n, 1 + ks.reduce((a, c) => Math.max(a, dep.get(c)), 0));
  }
  // 根の子を、高さが釣り合うように右と左に分ける
  const right = [], left = [];
  let hr = 0, hl = 0;
  for (const c of top) { if (hr <= hl) { right.push(c); hr += size.get(c) + GY; } else { left.push(c); hl += size.get(c) + GY; } }
  const H = Math.max(hr, hl, 60);
  const dR = right.reduce((a, c) => Math.max(a, dep.get(c)), 0), dL = left.reduce((a, c) => Math.max(a, dep.get(c)), 0);
  const RW = 190, rootX = M + dL * (NW + GX), rootCY = TOP + H / 2;
  const out = [], lines = [], pos = new Map();
  const place = (n0, side, x0, y0) => {
    const st = [[n0, x0, y0]];
    while (st.length) {
      const [n, x, y] = st.pop();
      const h = size.get(n), own = nh(n), cy = y + h / 2;
      const nx = side > 0 ? x : x - NW;
      pos.set(n, { x: nx, y: cy - own / 2, w: NW, h: own, side });
      const ks = kids.get(n) ?? [];
      let yy = y + (h - (ks.reduce((a, c) => a + size.get(c) + GY, -GY))) / 2;
      const next = [];
      for (const c of ks) { next.push([c, side > 0 ? x + NW + GX : x - NW - GX, yy]); yy += size.get(c) + GY; }
      for (let k = next.length - 1; k >= 0; k--) st.push(next[k]);
    }
  };
  let yR = TOP + (H - (hr - GY)) / 2, yL = TOP + (H - (hl - GY)) / 2;
  for (const c of right) { place(c, 1, rootX + RW + GX, yR); yR += size.get(c) + GY; }
  for (const c of left) { place(c, -1, rootX - GX, yL); yL += size.get(c) + GY; }
  const rootLines = wrapMax(themeLabel(r), RW - 2 * PAD, 14, 3);
  const rootH = rootLines.length * 19 + 16;
  const rootBox = { x: rootX, y: rootCY - rootH / 2, w: RW, h: rootH };
  const anchor = (b, toward) => (toward > 0 ? [b.x + b.w, b.y + b.h / 2] : [b.x, b.y + b.h / 2]);
  const curve = ([x1, y1], [x2, y2], dash) => `<path d="M${x1} ${y1}C${(x1 + x2) / 2} ${y1} ${(x1 + x2) / 2} ${y2} ${x2} ${y2}" fill="none" stroke="${dash ? COL.grid : '#888'}" stroke-width="${dash ? 1.2 : 1.6}"${dash ? ' stroke-dasharray="4 3"' : ''}/>`;
  for (const [n, b] of pos) {
    const p = n.tparent ? pos.get(n.tparent) : null;
    lines.push(curve(p ? anchor(p, b.side) : anchor(rootBox, b.side), anchor(b, -b.side), false));
    // 2 つ目以降の元のアイディア(組み合わせた案など)は点線で結ぶ
    for (const q of n.parents.slice(1)) { const pb = pos.get(q); if (pb) lines.push(curve([pb.x + pb.w / 2, pb.y + pb.h], [b.x + b.w / 2, b.y], true)); }
    const ls = wrapMax(n.name, NW - 2 * PAD, FS, 3), w = lacks(n);
    out.push(`<g ${sel(n)}><title>${esc(n.name)}\n${esc(fromLabel(n))}</title><rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="10" fill="${w ? COL.warnFill : '#fff'}" stroke="${n.decision === 'adopt' ? COL.accent : w ? COL.warnLine : COL.line}" stroke-width="${n.decision === 'adopt' ? 2.5 : 1.2}"/>${ls.map((l, k) => T_(b.x + PAD, b.y + 16 + k * LH, l, { fs: FS, fill: n.decision === 'drop' ? COL.drop : COL.text })).join('')}</g>`);
  }
  out.push(`<g data-mmroot="1"><title>テーマ</title><rect x="${rootBox.x}" y="${rootBox.y}" width="${RW}" height="${rootH}" rx="14" fill="${COL.head}" stroke="${COL.accent}" stroke-width="2"/>${rootLines.map((l, k) => T_(rootX + RW / 2, rootBox.y + 22 + k * 19, l, { fs: 14, anchor: 'middle', weight: '600' })).join('')}</g>`);
  const W = rootX + RW + dR * (NW + GX) + M;
  const title = `マインドマップ: ${themeLabel(r)}`;
  const sub = '元のアイディア(from:)をたどった木。点線は 2 つ目以降の元のアイディア。枠をクリックすると、その枠から枝を伸ばして書けます';
  return wrapSvg(Math.max(W, textW(title, 14) + 2 * M, textW(sub, 11) + 2 * M), TOP + H + M, T_(M, 26, title, { fs: 14, weight: '600' }) + T_(M, 44, sub, { fs: 11, fill: COL.sub }) + lines.join('') + out.join(''));
}

// ---- 候補比較・評価(仕様書 5.6 節)。見送り以外の案を行、必須の条件と評価の観点を列にした表
function compareData(r) {
  const musts = r.criteria.filter((c) => c.must), crits = r.criteria.filter((c) => !c.must);
  const ideas = r.ideas.filter((n) => n.decision !== 'drop');
  const rows = ideas.map((n) => {
    const ng = musts.some((c) => n.scores.get(c.name)?.value === 'ng');
    const all = crits.every((c) => n.scores.has(c.name));
    const total = crits.length && all ? crits.reduce((a, c) => a + c.weight * n.scores.get(c.name).value, 0) : null;
    return { n, ng, total };
  });
  return { musts, crits, rows };
}
const fmtNum = (v) => (Number.isInteger(v) ? String(v) : String(Math.round(v * 100) / 100));
function renderCompare(r, o = {}) {
  const M = 20, FS = 12, PAD = 6, NW = 230, MW = 110, CW = 110, TW = 80;
  const { musts, crits, rows } = compareData(r);
  const title = `候補比較・評価: ${themeLabel(r)}`;
  const TOP = o.noTitle ? M : 66;
  if (!musts.length && !crits.length) return { svg: wrapSvg(Math.max(560, textW(title, 14) + 2 * M), 110, T_(M, 26, title, { fs: 14, weight: '600' }) + T_(M, 70, '観点がまだありません。下の入力欄で、必須の条件と評価の観点を足します。', { fs: 12, fill: COL.sub })), header: [], rows: [] };
  const cols = [['案', NW, null], ...musts.map((c) => [`必須: ${c.name}`, MW, c]), ...crits.map((c) => [`${c.name}${c.weight !== 1 ? `(×${fmtNum(c.weight)})` : ''}`, CW, c]), ...(crits.length ? [['合計', TW, null]] : [])];
  const out = [];
  let x = M, y = TOP;
  const HH = 44;
  for (const [h, w, c] of cols) {
    const ls = wrapMax(h, w - 2 * PAD, FS, 2);
    const cell = `<rect x="${x}" y="${y}" width="${w}" height="${HH}" fill="${COL.head}" stroke="${COL.grid}"/>${ls.map((l, k) => T_(x + PAD, y + 18 + k * 16, l, { fs: FS, weight: '600' })).join('')}`;
    out.push(c ? `<g data-crit="${esc(c.name)}"><title>観点(クリックで編集)</title>${cell}</g>` : cell);
    x += w;
  }
  y += HH;
  const data = [];
  for (const { n, ng, total } of rows) {
    const ls = wrapMax(n.name, NW - 2 * PAD, FS, 3), h = Math.max(30, ls.length * 16 + 12);
    x = M;
    out.push(`<g ${sel(n)}><title>${esc(n.name)}</title><rect x="${x}" y="${y}" width="${NW}" height="${h}" fill="${ng ? '#f6f6f4' : '#fff'}" stroke="${COL.grid}"/>${ls.map((l, k) => T_(x + PAD, y + 19 + k * 16, l, { fs: FS, fill: ng ? COL.drop : COL.text, weight: n.decision === 'adopt' ? '600' : null })).join('')}</g>`);
    x += NW;
    const rowData = [n.name];
    for (const c of [...musts, ...crits]) {
      const v = n.scores.get(c.name)?.value;
      const t = v === undefined ? '未評価' : c.must ? (v === 'ok' ? '○' : '×') : String(v);
      const w = c.must ? MW : CW;
      out.push(`<g data-cmp="${n.id}|${esc(c.name)}" data-start="${n.start}" data-end="${n.end}"><title>${esc(`${n.name}: ${c.name}`)}(クリックで評価)</title><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${v === 'ng' ? '#fbf3f4' : '#fff'}" stroke="${COL.grid}"/>${T_(x + w / 2, y + h / 2 + 4, t, { fs: v === undefined ? 11 : 14, anchor: 'middle', fill: v === undefined ? '#aaa' : v === 'ng' ? COL.accent : COL.text, weight: v === undefined ? null : '600' })}</g>`);
      rowData.push(v === undefined ? '' : c.must ? v : String(v));
      x += w;
    }
    if (crits.length) {
      out.push(`<rect x="${x}" y="${y}" width="${TW}" height="${h}" fill="#fff" stroke="${COL.grid}"/>${T_(x + TW - PAD, y + h / 2 + 4, total === null ? '―' : fmtNum(total), { fs: 13, anchor: 'end', weight: '600', fill: ng ? COL.drop : COL.text })}`);
      rowData.push(total === null ? '' : fmtNum(total));
    }
    data.push(rowData);
    y += h;
  }
  const sub = '必須の条件は ○(満たす)・×(満たさない)。× の案は灰色で表示します。評価は 1〜5(大きいほど良い)。合計は「重み × 評価」の和で、未評価があると「―」';
  const head = o.noTitle ? '' : T_(M, 26, title, { fs: 14, weight: '600' }) + T_(M, 46, sub, { fs: 11, fill: COL.sub });
  const W = M * 2 + cols.reduce((a, c) => a + c[1], 0);
  return { svg: wrapSvg(Math.max(W, o.noTitle ? 0 : Math.max(textW(title, 14), textW(sub, 11)) + 2 * M), y + M, head + out.join('')), header: cols.map((c) => c[0]), rows: data };
}

// ---- 表の部品(5W1H・判断・消去法)
function table(cols, rows, o) {
  // cols: [見出し, 幅]、rows: { cells: [{ t, fill, weight, attr }], attr }
  const FS = 12, LH = FS * 1.4, PAD = 6, x0 = o.x, out = [];
  let y = o.y;
  let x = x0;
  for (const [h, w] of cols) { out.push(`<rect x="${x}" y="${y}" width="${w}" height="26" fill="${COL.head}" stroke="${COL.grid}"/>${T_(x + PAD, y + 17, h, { fs: FS, weight: '600' })}`); x += w; }
  y += 26;
  for (const row of rows) {
    const ls = row.cells.map((c, i) => wrapMax(String(c.t ?? ''), cols[i][1] - 2 * PAD, FS, 8));
    const h = Math.max(26, Math.max(...ls.map((l) => l.length)) * LH + 10);
    x = x0;
    let s = '';
    row.cells.forEach((c, i) => {
      const w = cols[i][1];
      let cell = `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c.bg ?? '#fff'}" stroke="${COL.grid}"/>`;
      ls[i].forEach((l, k) => { cell += T_(x + PAD, y + 7 + FS + k * LH, l, { fs: FS, fill: c.fill, weight: c.weight }); });
      s += c.attr ? `<g ${c.attr}>${cell}</g>` : cell;
      x += w;
    });
    out.push(row.attr ? `<g ${row.attr}>${s}</g>` : s);
    y += h;
  }
  return { svg: out.join(''), y, w: cols.reduce((a, c) => a + c[1], 0) };
}

// ---- 5W1H(仕様書 5.2 節)
function w5Table(r) {
  const cols = [['案', 190], ...W5.map((k) => [`${k}(${W5_JA[k]})`, 150])];
  const rows = r.ideas.map((n) => ({
    cells: [{ t: n.name, fill: n.decision === 'drop' ? COL.drop : COL.text, weight: n.decision === 'adopt' ? '600' : null, attr: sel(n) },
      ...W5.map((k) => ({ t: n.w5[k] ?? '', attr: `data-w5="${n.id}|${k}" data-start="${n.start}" data-end="${n.end}"` }))],
  }));
  return { cols, rows, header: cols.map((c) => c[0]), data: r.ideas.map((n) => [n.name, ...W5.map((k) => n.w5[k] ?? '')]) };
}
function renderW5(r, o = {}) {
  const M = 20, title = `5W1H: ${themeLabel(r)}`;
  const tb = w5Table(r);
  const top = o.noTitle ? M : 58;
  if (!r.ideas.length) return wrapSvg(520, 110, T_(M, 26, title, { fs: 14, weight: '600' }) + T_(M, 70, 'アイディアがありません', { fs: 12, fill: COL.sub }));
  const t = table(tb.cols, tb.rows, { x: M, y: top });
  const head = o.noTitle ? '' : T_(M, 26, title, { fs: 14, weight: '600' }) + T_(M, 44, 'セルをクリックすると、その案の 5W1H を編集できます。すべて埋めなくてかまいません', { fs: 11, fill: COL.sub });
  return wrapSvg(Math.max(t.w + 2 * M, o.noTitle ? 0 : textW(title, 14) + 2 * M), t.y + M, head + t.svg);
}

// ---- 判断・消去法(仕様書 5.3 節)
function elimTable(r) {
  const cols = [['案', 260], ['判断', 80], ['理由', 320], ['書いた人', 100]];
  const rows = r.ideas.map((n) => {
    const d = n.decision, dropped = d === 'drop';
    return {
      attr: sel(n),
      cells: [{ t: n.name, fill: dropped ? COL.drop : COL.text, weight: d === 'adopt' ? '600' : null, bg: d === 'adopt' ? '#fbf3f4' : undefined },
        { t: d ? DECISION[d] : '未判断', fill: d === 'adopt' ? COL.accent : d ? COL.text : COL.sub, weight: d === 'adopt' ? '600' : null, bg: d === 'adopt' ? '#fbf3f4' : undefined },
        { t: n.reason ?? '', fill: dropped ? COL.drop : COL.text, bg: d === 'adopt' ? '#fbf3f4' : undefined },
        { t: n.by ?? '', fill: COL.sub, bg: d === 'adopt' ? '#fbf3f4' : undefined }],
    };
  });
  return { cols, rows, header: cols.map((c) => c[0]), data: r.ideas.map((n) => [n.name, n.decision ? DECISION[n.decision] : '未判断', n.reason ?? '', n.by ?? '']) };
}
function elimSummary(r) {
  const c = (k) => r.ideas.filter((n) => n.decision === k).length;
  const ad = r.ideas.filter((n) => n.decision === 'adopt');
  return `採用: ${ad.length ? ad.map((n) => n.name).join('、') : 'まだありません'} / 代替 ${c('backup')} 件 / 見送り ${c('drop')} 件 / 未判断 ${r.ideas.filter((n) => !n.decision).length} 件`;
}
function renderElim(r, o = {}) {
  const M = 20, title = `判断・消去法: ${themeLabel(r)}`;
  if (!r.ideas.length) return wrapSvg(520, 110, T_(M, 26, title, { fs: 14, weight: '600' }) + T_(M, 70, 'アイディアがありません', { fs: 12, fill: COL.sub }));
  const tb = elimTable(r);
  const top = o.noTitle ? M : 66;
  const t = table(tb.cols, tb.rows, { x: M, y: top });
  const sum = elimSummary(r);
  const head = o.noTitle ? '' : T_(M, 26, title, { fs: 14, weight: '600' }) + T_(M, 48, clip(sum, Math.max(t.w, 700), 12), { fs: 12, fill: COL.accent, weight: '600' });
  return wrapSvg(Math.max(t.w + 2 * M, o.noTitle ? 0 : Math.min(textW(sum, 12), 700) + 2 * M, textW(title, 14) + 2 * M), t.y + M, head + t.svg);
}

// ---- 欠点列挙法・希望点列挙法・特性列挙法(仕様書 4.7 節)。左に項目(欠点など)、右にその項目から出した改善案
// 対象がテーマの項目は、元のアイディアの from: がないもの。対象がアイディア X の項目は、最初の元のアイディアが X のもの
function listingItems(r, method, targetId, vp) {
  return r.ideas.filter((n) => n.methods.some((m) => m.method === method && m.vp === vp)
    && (targetId ? n.parents[0]?.id === targetId : !n.froms.some((f) => f.ref)));
}
function listingImprovements(r, method, item) {
  const L = LISTINGS[method];
  return r.ideas.filter((n) => n.parents[0] === item && n.methods.some((m) => m.method === method && m.vp === L.improve));
}
function listingTargets(r, method) {
  const L = LISTINGS[method], t = new Set();
  for (const n of r.ideas) if (n.methods.some((m) => m.method === method && L.items.includes(m.vp))) { if (!n.froms.some((f) => f.ref)) t.add(null); else if (n.parents[0]) t.add(n.parents[0].id); }
  return [...t].sort((a, b) => (a ? r.ideas.find((n) => n.id === a).lineIdx : -1) - (b ? r.ideas.find((n) => n.id === b).lineIdx : -1));
}
function renderListing(r, method, targetId) {
  const L = LISTINGS[method];
  const M = 20, TOP = 58, IW = 250, CW = 540, FS = 13, CH = 26, GAP = 6, PAD = 8;
  const t = targetId ? r.ideas.find((n) => n.id === targetId) : null;
  const title = `${L.title}: ${t ? t.name : themeLabel(r)}`;
  const out = [];
  let y = TOP;
  const chipBox = (n, x, yy, w) => {
    const wn = lacks(n);
    return `<g ${sel(n)}><title>${esc(n.name)}${n.by ? `(${esc(n.by)})` : ''}</title><rect x="${x}" y="${yy}" width="${w}" height="${CH}" rx="4" fill="${wn ? COL.warnFill : '#fff'}" stroke="${wn ? COL.warnLine : COL.line}"${wn ? ' stroke-dasharray="5 3"' : ''}/>${T_(x + 9, yy + 18, clip(n.name, w - 18, FS), { fs: FS, fill: n.decision === 'drop' ? COL.drop : COL.text })}</g>`;
  };
  for (const vp of L.items) {
    if (L.items.length > 1) {
      out.push(`<rect x="${M}" y="${y}" width="${IW + CW}" height="28" fill="${COL.head}" stroke="${COL.grid}"/>${T_(M + PAD, y + 19, `${vp}特性(${L.hint[vp]})`, { fs: 13, weight: '600' })}`);
      y += 28;
    } else {
      out.push(`<rect x="${M}" y="${y}" width="${IW}" height="28" fill="${COL.head}" stroke="${COL.grid}"/>${T_(M + PAD, y + 19, L.itemLabel, { fs: 13, weight: '600' })}<rect x="${M + IW}" y="${y}" width="${CW}" height="28" fill="${COL.head}" stroke="${COL.grid}"/>${T_(M + IW + PAD, y + 19, `${L.impLabel}(${L.itemLabel}をクリックしてから書く)`, { fs: 13, weight: '600' })}`);
      y += 28;
    }
    const items = listingItems(r, method, targetId, vp);
    if (!items.length) { out.push(`<rect x="${M}" y="${y}" width="${IW + CW}" height="34" fill="#fff" stroke="${COL.grid}"/>${T_(M + PAD, y + 22, `(まだありません。下の入力欄で${L.items.length > 1 ? `${vp}特性` : L.itemLabel}を書きます)`, { fs: 12, fill: '#aaa' })}`); y += 34; continue; }
    for (const it of items) {
      const lines = wrapMax(it.name, IW - 2 * PAD, FS, 4);
      const imps = listingImprovements(r, method, it);
      const chips = [];
      let cx = 0, cy = 0;
      for (const n of imps) {
        const w = Math.min(CW - 20, textW(n.name, FS) + 18);
        if (cx + w > CW - 16 && cx > 0) { cx = 0; cy += CH + GAP; }
        chips.push({ n, x: cx, y: cy, w });
        cx += w + GAP;
      }
      const h = Math.max(lines.length * FS * 1.4 + 2 * PAD, imps.length ? cy + CH + 16 : 40);
      const wn = lacks(it);
      out.push(`<g ${sel(it)} data-lsitem="1"><title>${esc(it.name)}(クリックすると、この${L.itemLabel}の${L.impLabel}を書けます)</title><rect x="${M}" y="${y}" width="${IW}" height="${h}" fill="${wn ? COL.warnFill : '#fff'}" stroke="${COL.grid}"/>${lines.map((l, k) => T_(M + PAD, y + PAD + FS + k * FS * 1.4, l, { fs: FS, fill: it.decision === 'drop' ? COL.drop : COL.text })).join('')}</g>`);
      out.push(`<rect x="${M + IW}" y="${y}" width="${CW}" height="${h}" fill="#fff" stroke="${COL.grid}"/>`);
      if (!imps.length) out.push(T_(M + IW + PAD, y + h / 2 + 4, `(${L.impLabel}はまだありません)`, { fs: 12, fill: '#aaa' }));
      for (const c of chips) out.push(chipBox(c.n, M + IW + 8 + c.x, y + 8 + c.y, c.w));
      y += h;
    }
  }
  const sub = `${L.itemLabel}を書いてから、${L.itemLabel}をクリックして${L.impLabel}を書きます。${L.impLabel}は${L.itemLabel}から出したアイディアとして、収束の候補になります`;
  return wrapSvg(Math.max(2 * M + IW + CW, textW(title, 14) + 2 * M, textW(sub, 11) + 2 * M), y + M, T_(M, 26, title, { fs: 14, weight: '600' }) + T_(M, 44, sub, { fs: 11, fill: COL.sub }) + out.join(''));
}

// ---- ポジショニング(仕様書 5.7 節)。横と縦の 2 つの軸(-5〜5)の上に、アイディアを置く
const POS_GEOM = { M: 20, TOP: 70, LEFT: 120, SIZE: 520 };
function renderPositioning(r, name, o = {}) {
  const { M, LEFT, SIZE } = POS_GEOM, TOP = POS_GEOM.TOP, FS = 12;
  const m = r.posmaps.find((x) => x.name === name) ?? r.posmaps[0];
  if (!m) return wrapSvg(600, 110, T_(M, 26, 'ポジショニング', { fs: 14, weight: '600' }) + T_(M, 70, 'ポジショニングの図がありません。下の入力欄で名前を付けて作ります。', { fs: 12, fill: COL.sub }));
  const title = `ポジショニング: ${m.name}`;
  const out = [];
  const step = SIZE / (2 * POS_MAX);
  const X = (v) => LEFT + (v + POS_MAX) * step, Y = (v) => TOP + (POS_MAX - v) * step;
  out.push(`<g data-plot="${LEFT}|${TOP}|${SIZE}"><title>アイディアを選んでから、ここをクリックすると置きます</title><rect x="${LEFT}" y="${TOP}" width="${SIZE}" height="${SIZE}" fill="#fff" stroke="${COL.grid}"/>`);
  for (let k = -POS_MAX; k <= POS_MAX; k++) if (k) out.push(`<path d="M${X(k)} ${TOP}V${TOP + SIZE}M${LEFT} ${Y(k)}H${LEFT + SIZE}" stroke="#eeeeea"/>`);
  out.push(`<path d="M${X(0)} ${TOP + SIZE}V${TOP}M${LEFT} ${Y(0)}H${LEFT + SIZE}" stroke="${COL.line}" stroke-width="1.5"/>`);
  out.push(`<path d="M${LEFT + SIZE} ${Y(0)}l-9 -4.5l0 9Z M${X(0)} ${TOP}l-4.5 9l9 0Z" fill="${COL.line}"/></g>`);
  // 軸の言葉
  const xl = m.x ?? { lo: '(横の軸の低い側)', hi: '(横の軸の高い側)' }, yl = m.y ?? { lo: '(縦の軸の低い側)', hi: '(縦の軸の高い側)' };
  out.push(T_(LEFT, TOP + SIZE + 18, xl.lo, { fs: 12, fill: m.x ? COL.text : '#aaa' }), T_(LEFT + SIZE, TOP + SIZE + 18, xl.hi, { fs: 12, anchor: 'end', fill: m.x ? COL.text : '#aaa' }));
  out.push(T_(X(0), TOP - 8, yl.hi, { fs: 12, anchor: 'middle', fill: m.y ? COL.text : '#aaa' }), T_(X(0), TOP + SIZE + 36, yl.lo, { fs: 12, anchor: 'middle', fill: m.y ? COL.text : '#aaa' }));
  // アイディア: 同じ位置に重なるときは、下にずらす
  const used = new Map();
  for (const n of r.ideas) {
    const p = n.pos.get(m.name);
    if (!p) continue;
    const k = `${p.x},${p.y}`, i = used.get(k) ?? 0;
    used.set(k, i + 1);
    const label = clip(n.name, 150, FS), w = textW(label, FS) + 14, cx = X(p.x), cy = Y(p.y) + i * 22;
    const wn = lacks(n);
    out.push(`<g ${sel(n)}><title>${esc(n.name)}(横 ${p.x}、縦 ${p.y})</title><circle cx="${cx}" cy="${Y(p.y)}" r="3.5" fill="${COL.accent}"/><rect x="${cx + 6}" y="${cy - 10}" width="${w}" height="20" rx="4" fill="${wn ? COL.warnFill : '#fff'}" stroke="${n.decision === 'adopt' ? COL.accent : COL.line}" stroke-width="${n.decision === 'adopt' ? 2 : 1}"/>${T_(cx + 13, cy + 4, label, { fs: FS, fill: n.decision === 'drop' ? COL.drop : COL.text })}</g>`);
  }
  let y = TOP + SIZE + 50;
  if (!o.noRest) {
    const rest = r.ideas.filter((n) => !n.pos.has(m.name));
    y += 10;
    out.push(T_(M, y, `まだ置いていないアイディア(${rest.length} 件)`, { fs: 13, weight: '600' }));
    y += 8;
    let x = M, rowH = 0;
    const W = LEFT + SIZE + 200 - M;
    for (const n of rest) {
      const w = Math.min(220, textW(n.name, FS) + 14);
      if (x + w > M + W && x > M) { x = M; y += rowH + 6; rowH = 0; }
      out.push(`<g ${sel(n)}><title>${esc(n.name)}</title><rect x="${x}" y="${y}" width="${w}" height="22" rx="3" fill="${lacks(n) ? COL.warnFill : '#fff'}" stroke="#999"/>${T_(x + 7, y + 15, clip(n.name, w - 14, FS), { fs: FS, fill: n.decision === 'drop' ? COL.drop : COL.text })}</g>`);
      rowH = 22;
      x += w + 6;
    }
    y += rowH;
  }
  const sub = 'アイディアを選んでから、図の中をクリックすると、その位置に置きます(横・縦とも -5〜5 の目盛り)';
  return wrapSvg(Math.max(LEFT + SIZE + 200, textW(title, 14) + 2 * M, textW(sub, 11) + 2 * M), y + M, T_(M, 26, title, { fs: 14, weight: '600' }) + T_(M, 44, sub, { fs: 11, fill: COL.sub }) + out.join(''));
}

// ---- ストーリーボード(仕様書 5.8 節)。1 つのアイディアの使われ方を、場面(scene:)の並びで描く
function renderStory(r, ideaId) {
  const M = 20, TOP = 58, PW = 230, PH = 160, GAP = 16, COLS = 3, FS = 13, PAD = 10;
  const n = ideaId ? r.ideas.find((x) => x.id === ideaId) : r.ideas.find((x) => x.scenes.length) ?? null;
  if (!n) return wrapSvg(600, 110, T_(M, 26, 'ストーリーボード', { fs: 14, weight: '600' }) + T_(M, 70, 'アイディアがありません。', { fs: 12, fill: COL.sub }));
  const title = `ストーリーボード: ${n.name}`;
  const out = [];
  const sc = n.scenes;
  sc.forEach((a, i) => {
    const x = M + (i % COLS) * (PW + GAP), y = TOP + Math.floor(i / COLS) * (PH + GAP);
    const lines = wrapMax(a.text, PW - 2 * PAD, FS, 7);
    out.push(`<g data-scene="${i}" data-start="${a.start}" data-end="${a.end}"><title>場面 ${i + 1}(クリックで編集)</title><rect x="${x}" y="${y}" width="${PW}" height="${PH}" rx="6" fill="#fff" stroke="${COL.line}" stroke-width="1.4"/><circle cx="${x + 16}" cy="${y + 16}" r="11" fill="${COL.accent}"/>${T_(x + 16, y + 20.5, String(i + 1), { fs: 12, anchor: 'middle', fill: '#fff', weight: '600' })}${lines.map((l, k) => T_(x + PAD, y + 46 + k * FS * 1.45, l, { fs: FS })).join('')}</g>`);
    if (i < sc.length - 1 && (i + 1) % COLS) out.push(`<path d="M${x + PW + 3} ${y + PH / 2}h${GAP - 6}" stroke="${COL.accent}" stroke-width="2"/><path d="M${x + PW + GAP - 2} ${y + PH / 2}l-6 -4l0 8Z" fill="${COL.accent}"/>`);
  });
  const rows = Math.max(1, Math.ceil(sc.length / COLS));
  if (!sc.length) out.push(`<rect x="${M}" y="${TOP}" width="${PW}" height="${PH}" rx="6" fill="${COL.empty}" stroke="${COL.grid}" stroke-dasharray="5 4"/>${T_(M + PAD, TOP + PH / 2, '場面はまだありません', { fs: 12, fill: '#aaa' })}`);
  const sub = '場面(scene:)を書いた順に並べます。場面をクリックすると、文を直したり、順番を変えたりできます';
  return wrapSvg(Math.max(M * 2 + COLS * PW + (COLS - 1) * GAP, textW(title, 14) + 2 * M), TOP + rows * (PH + GAP) + M, T_(M, 26, title, { fs: 14, weight: '600' }) + T_(M, 44, sub, { fs: 11, fill: COL.sub }) + out.join(''));
}

// ---- 既存調査(仕様書 5.9 節)。調べたものごとに、関係する案と、自分の案との違いを表にする
function renderResearch(r, o = {}) {
  const M = 20, title = `既存調査: ${themeLabel(r)}`;
  const cols = [['調べたもの', 200], ['URL', 220], ['関係する案', 200], ['違い(diff)', 260], ['メモ', 200]];
  const data = r.researches.map((x) => [x.name, x.url ?? '', x.fors.map((f) => f.attr.text).join('、'), x.diff ?? '', x.note ?? '']);
  if (!r.researches.length) return { svg: wrapSvg(600, 110, T_(M, 26, title, { fs: 14, weight: '600' }) + T_(M, 70, '調べたものがまだありません。下の入力欄で足します。', { fs: 12, fill: COL.sub })), header: cols.map((c) => c[0]), rows: [] };
  const rows = r.researches.map((x, i) => ({ attr: `data-res="${i}" data-start="${x.def.start}" data-end="${x.def.end}"`, cells: data[i].map((t, k) => ({ t, fill: k === 1 ? '#1d4ed8' : k === 2 && x.fors.some((f) => !f.target) ? COL.warnLine : COL.text, weight: k === 0 ? '600' : null })) }));
  const top = o.noTitle ? M : 58;
  const t = table(cols, rows, { x: M, y: top });
  const head = o.noTitle ? '' : T_(M, 26, title, { fs: 14, weight: '600' }) + T_(M, 44, '行をクリックすると、URL・関係する案・違い・メモを編集できます', { fs: 11, fill: COL.sub });
  return { svg: wrapSvg(Math.max(t.w + 2 * M, o.noTitle ? 0 : textW(title, 14) + 2 * M), t.y + M, head + t.svg), header: cols.map((c) => c[0]), rows: data };
}

const VIEWS = [
  { id: 'list', label: 'アイディア一覧(共通入力)', phase: 'd' },
  { id: 'mandala', label: 'マンダラート', phase: 'd' },
  { id: 'honeycomb', label: '蜂の巣ノート', phase: 'd' },
  { id: 'matrix', label: 'マトリックス法', phase: 'd' },
  { id: 'sixhats', label: 'シックスハット', phase: 'd' },
  { id: 'osborn', label: 'オズボーンのチェックリスト', phase: 'd' },
  { id: 'scamper', label: 'SCAMPER', phase: 'd' },
  { id: 'triz', label: 'TRIZ の 40 原理', phase: 'd' },
  { id: 'defects', label: '欠点列挙法', phase: 'd' },
  { id: 'wishes', label: '希望点列挙法', phase: 'd' },
  { id: 'attributes', label: '特性列挙法', phase: 'd' },
  { id: 'kj', label: 'KJ 法', phase: 'c' },
  { id: 'sevencross', label: 'セブンクロス', phase: 'c' },
  { id: 'w5', label: '5W1H', phase: 'c' },
  { id: 'mindmap', label: 'マインドマップ', phase: 'c' },
  { id: 'storyboard', label: 'ストーリーボード', phase: 'c' },
  { id: 'positioning', label: 'ポジショニング', phase: 'c' },
  { id: 'research', label: '既存調査', phase: 'c' },
  { id: 'compare', label: '候補比較・評価', phase: 'c' },
  { id: 'elim', label: '判断・消去法', phase: 'c' },
];
const TABLE_VIEWS = ['sevencross', 'w5', 'compare', 'research', 'elim'];
// st: 画面の状態。mandala: 盤面の中心の id、honeycomb: シートの根の id、matrix: マトリックスの名前、mxCell: [行, 列]、
// cl: { 手法名: { target: 対象の id, vp: 観点の番号 } }
function render(r, view, st = {}, o = {}) {
  const cl = st.cl?.[view] ?? {};
  switch (view) {
    case 'list': return renderList(r);
    case 'mandala': return renderMandala(r, st.mandala);
    case 'honeycomb': return renderHoneycomb(r, st.honeycomb);
    case 'matrix': return renderMatrix(r, st.matrix, st.mxCell);
    case 'sixhats': case 'osborn': case 'scamper': case 'triz': return renderChecklist(r, view, cl.target ?? null, cl.vp ?? 0);
    case 'kj': return renderKJ(r);
    case 'sevencross': return renderSeven(r, o).svg;
    case 'w5': return renderW5(r, o);
    case 'mindmap': return renderMind(r);
    case 'defects': case 'wishes': case 'attributes': return renderListing(r, view, st.ls?.[view]?.target ?? null);
    case 'positioning': return renderPositioning(r, st.posmap);
    case 'storyboard': return renderStory(r, st.story);
    case 'research': return renderResearch(r, o).svg;
    case 'compare': return renderCompare(r, o).svg;
    case 'elim': return renderElim(r, o);
    default: return null;
  }
}
// 図と表(題の右のボタン)。表のビューは、題を入れない表をタブ区切りの文字と一緒に返す
function pieces(r, view, st = {}) {
  const name = VIEWS.find((v) => v.id === view).label;
  if (view === 'w5' || view === 'elim') {
    const tb = view === 'w5' ? w5Table(r) : elimTable(r);
    return { kind: 'table', name, svg: cleanSvg(render(r, view, st, { noTitle: true })), header: tb.header, rows: tb.data };
  }
  if (view === 'sevencross' || view === 'compare' || view === 'research') {
    const x = view === 'sevencross' ? renderSeven(r, { noTitle: true }) : view === 'compare' ? renderCompare(r, { noTitle: true }) : renderResearch(r, { noTitle: true });
    return { kind: 'table', name, svg: cleanSvg(x.svg), header: x.header, rows: x.rows };
  }
  return { kind: 'fig', name, svg: cleanSvg(render(r, view, st)) };
}
// 保存する SVG からは、画面の操作のための印(data-*)と、要素の説明(title)を除く
const cleanSvg = (svg) => svg.replace(/<title>[\s\S]*?<\/title>/g, '').replace(/ data-[a-z0-9-]+="[^"]*"/g, '');
function tsv(header, rows) {
  const c = (v) => String(v).replace(/[\t\r\n]+/g, ' ');
  return `${[header, ...rows].map((row) => row.map(c).join('\t')).join('\n')}\n`;
}
// 印刷のページ: マンダラートは盤面ごと、蜂の巣ノートはシートごと、マトリックスは表ごと、観点の並びの手法は対象ごとに 1 ページ。
// まだ使っていない手法のビューは入れない
function printPages(r) {
  const pages = [renderList(r)];
  const order = (key) => (key ? r.ideas.find((n) => n.id === key)?.lineIdx ?? -1 : -1);
  for (const b of [...r.boards.values()].sort((a, b) => order(a.center?.id) - order(b.center?.id))) pages.push(renderMandala(r, b.center ? b.center.id : null));
  for (const sh of [...r.sheets.values()].sort((a, b) => order(a.root?.id) - order(b.root?.id))) pages.push(renderHoneycomb(r, sh.root ? sh.root.id : null));
  for (const m of r.matrices) pages.push(renderMatrix(r, m.name, null));
  for (const method of ['sixhats', 'osborn', 'scamper', 'triz']) for (const t of checklistTargets(r, method)) pages.push(renderChecklist(r, method, t, -1));
  for (const method of Object.keys(LISTINGS)) for (const t of listingTargets(r, method)) pages.push(renderListing(r, method, t));
  pages.push(renderKJ(r));
  if (sevenClasses(r).length) pages.push(renderSeven(r).svg);
  pages.push(renderW5(r), renderMind(r));
  for (const n of r.ideas.filter((x) => x.scenes.length)) pages.push(renderStory(r, n.id));
  for (const m of r.posmaps) pages.push(renderPositioning(r, m.name, { noRest: true }));
  if (r.researches.length) pages.push(renderResearch(r).svg);
  if (r.criteria.length) pages.push(renderCompare(r).svg);
  pages.push(renderElim(r));
  return pages;
}

// アイディア n を from:・for: の元として指せるか(仕様書 3.7 節)。同じ名前がほかになく、手法名で始まらないこと
const refOk = (r, n) => !!n && !methodLike(n.name) && r.ideas.filter((x) => x.name === n.name).length === 1;

// ================= 書き換え(図・表・入力欄から。テキストが正本) =================
// どの関数も、解析の結果 r から新しいテキスト全体を作り、解析し直してエラーが出ないことを確かめて返す。
// 戻り値は { text, select } か { error }。select は書き換えの後に選ぶアイディアの鍵({ name, nth })
const Edit = (() => {
  const fail = (error) => ({ error });
  const keyOf = (r, n) => ({ name: n.name, nth: r.ideas.filter((x) => x.name === n.name).indexOf(n) });
  const locate = (r, key) => { if (!key) return null; const c = r.ideas.filter((x) => x.name === key.name); return c[key.nth]?.id ?? null; }; // 見つからなければ null(同じ名前の別のアイディアに移らない)
  const find = (r, id) => r.ideas.find((n) => n.id === id) ?? null;
  // 名前や値に書けない文字列
  const bad = (v, what) => {
    if (!v.trim()) return `${what}が空です`;
    if (/[\r\n]/.test(v)) return `${what}に改行は書けません`;
    if (/(^|[ \t])\/\//.test(v)) return `${what}に「空白 + //」は書けません(そこから後ろが注になります)`;
    return null;
  };
  const badName = (name) => (methodLike(name) ? `「${firstWord(name)}」は手法名なので、アイディアの名前の最初の語には使えません(from: で元のアイディアとして指せなくなります)` : null);
  const indentOf = (raw) => /^[ \t]*/.exec(raw)[0];
  const commentOf = (raw) => { const k = cutComment(raw); return k < raw.length ? ` ${raw.slice(k)}` : ''; };
  // 行の書き換えをまとめて当てる。ops: { idx, line }(置き換え)、{ idx, del: true }、{ after: idx, lines }(idx の後ろに足す。-1 は先頭)
  function applyOps(lines, ops) {
    const base = lines.map((l) => l), del = new Set(), after = new Map();
    for (const o of ops) {
      if (o.del) del.add(o.idx);
      else if (o.lines) { if (!after.has(o.after)) after.set(o.after, []); after.get(o.after).push(...o.lines); }
      else base[o.idx] = o.line;
    }
    const out = [...(after.get(-1) ?? [])];
    base.forEach((l, i) => { if (!del.has(i)) out.push(l); out.push(...(after.get(i) ?? [])); });
    return out.join('\n');
  }
  function commit(r, text, select, expect) {
    const r2 = analyze(text);
    const e = r2.diags.find((d) => d.level === 'error');
    if (e) return fail(`この書き換えをするとテキストがエラーになるので、書き換えませんでした(${e.message})`);
    if (expect) { const m = expect(r2); if (m) return fail(m); }
    return { text, select };
  }
  // 最後の行の後ろに足す(テキストの終わりが改行でなければ改行を入れる)
  const append = (r, add) => { const t = r.text; return t + (t && !t.endsWith('\n') ? '\n' : '') + add.join('\n') + '\n'; };
  const attrIndent = (r, n) => { const a = n.attrs[0]; return a ? indentOf(r.parse.lines[a.lineIdx]) : '  '; };

  // アイディアを足す。froms は from: の値の並び
  function addIdea(r, name0, by, froms) {
    const name = name0.trim();
    const b = bad(name, 'アイディア');
    if (b) return fail(b);
    if (by && bad(by, '書いた人')) return fail(bad(by, '書いた人'));
    if (badName(name)) return fail(badName(name));
    for (const f of froms) {
      if (methodLike(f)) continue;
      const c = r.ideas.filter((x) => x.name === f);
      if (c.length !== 1 || !refOk(r, c[0])) return fail(`元のアイディア「${f}」は${c.length > 1 ? '同じ名前が 2 つ以上あるので' : c.length ? '手法名で始まるので' : '見つからないので'}、元として指せません`);
    }
    const add = [`- ${name}`, ...(by ? [`  by: ${by.trim()}`] : []), ...froms.map((f) => `  from: ${f}`)];
    const text = append(r, add);
    const nth = r.ideas.filter((x) => x.name === name).length;
    return commit(r, text, { name, nth }, (r2) => (r2.ideas.filter((x) => x.name === name).length === nth + 1 ? null : '足したアイディアを読めないので、書き換えませんでした'));
  }
  // 1 回だけ書ける属性を書き換える。value が空なら消す
  function setAttr(r, id, key, value0) {
    const n = find(r, id);
    if (!n) return fail('アイディアが見つかりません');
    const value = String(value0 ?? '').trim();
    if (value) { const b = bad(value, '値'); if (b) return fail(b); }
    if (key === 'decision' && value && !Object.hasOwn(DECISION, value)) return fail('判断の値が正しくありません');
    const at = n.attrs.find((a) => a.key === key);
    const lines = r.parse.lines;
    let ops;
    if (at) ops = value ? [{ idx: at.lineIdx, line: `${indentOf(lines[at.lineIdx])}${key}: ${value}${commentOf(lines[at.lineIdx])}` }] : [{ idx: at.lineIdx, del: true }];
    else if (value) ops = [{ after: n.endIdx, lines: [`${attrIndent(r, n)}${key}: ${value}`] }];
    else return { text: r.text, select: keyOf(r, n) };
    return commit(r, applyOps(lines, ops), keyOf(r, n), (r2) => { const m = r2.ideas.find((x) => x.lineIdx === n.lineIdx); return (m?.attrs.find((a) => a.key === key)?.text ?? '') === value ? null : '書いたとおりに読めないので、書き換えませんでした'; });
  }
  // 名前を変える。このアイディアを指していた from: も新しい名前にする
  function rename(r, id, name0) {
    const n = find(r, id);
    if (!n) return fail('アイディアが見つかりません');
    const name = name0.trim();
    const b = bad(name, '名前');
    if (b) return fail(b);
    if (name === n.name) return { text: r.text, select: keyOf(r, n) };
    if (badName(name)) return fail(badName(name));
    if (r.ideas.some((x) => x !== n && x.name === name)) return fail(`「${name}」という名前のアイディアはすでにあります(同じ名前にすると、元として指せなくなります)`);
    // 見つからない from:・for: が使っている名前にすると、その参照がこの案につながってしまう(仕様書 3.7 節)
    if (r.ideas.some((x) => x.froms.some((f) => f.ref === name && !f.target)) || r.parse.blocks.some((b) => b.kind === 'research' && b.attrs.some((a) => a.key === 'for' && a.text === name)))
      return fail(`「${name}」は、見つからない元のアイディア(from:・for:)として書かれている名前なので、この名前には変えられません(変えると、その参照がこの案につながります)`);
    const lines = r.parse.lines;
    const raw = lines[n.lineIdx];
    const ops = [{ idx: n.lineIdx, line: `- ${name}${commentOf(raw)}` }];
    for (const m of r.ideas) for (const f of m.froms) if (f.target === n) ops.push({ idx: f.lineIdx, line: `${indentOf(lines[f.lineIdx])}from: ${name}${commentOf(lines[f.lineIdx])}` });
    // 既存調査の for: は、重なったブロックのものも書き換える(for: は同じ名前の最初のアイディアを指す)
    const first = r.ideas.find((x) => x.name === n.name);
    if (first === n) for (const bl of r.parse.blocks) if (bl.kind === 'research') for (const a of bl.attrs) if (a.key === 'for' && a.text === n.name) ops.push({ idx: a.lineIdx, line: `${indentOf(lines[a.lineIdx])}for: ${name}${commentOf(lines[a.lineIdx])}` });
    return commit(r, applyOps(lines, ops), { name, nth: 0 });
  }
  // アイディアを消す(属性の行も)
  function remove(r, id) {
    const n = find(r, id);
    if (!n) return fail('アイディアが見つかりません');
    const ops = [];
    for (let i = n.lineIdx; i <= n.endIdx; i++) ops.push({ idx: i, del: true });
    const refs = r.ideas.reduce((a, m) => a + m.froms.filter((f) => f.target === n).length, 0);
    const res = commit(r, applyOps(r.parse.lines, ops), null);
    return res.error ? res : { ...res, refs };
  }
  // グループに入れる(すでに入っていれば何もしない)
  function addToGroup(r, ids, path0) {
    if (badPath(path0) || bad(path0, 'グループの名前')) return fail(bad(path0, 'グループの名前') ?? 'グループの名前の :: の前後に名前がありません');
    const path = normPath(path0);
    const ops = [];
    for (const id of ids) {
      const n = find(r, id);
      if (!n || n.groups.includes(path)) continue;
      ops.push({ after: n.endIdx, lines: [`${attrIndent(r, n)}group: ${path}`] });
    }
    if (!ops.length) return fail('選んだアイディアは、すでにこのグループに入っています');
    return commit(r, applyOps(r.parse.lines, ops), null);
  }
  function removeFromGroup(r, id, path) {
    const n = find(r, id);
    if (!n) return fail('アイディアが見つかりません');
    const ops = n.attrs.filter((a) => a.key === 'group' && a.path === path).map((a) => ({ idx: a.lineIdx, del: true }));
    if (!ops.length) return fail('このグループの行がありません');
    return commit(r, applyOps(r.parse.lines, ops), keyOf(r, n));
  }
  // グループの名前(:: で上位グループを含む)を変える。下位のグループ・所属・関係の相手も書き換える
  function renameGroup(r, oldPath, newPath0) {
    if (badPath(newPath0) || bad(newPath0, 'グループの名前')) return fail(bad(newPath0, 'グループの名前') ?? 'グループの名前の :: の前後に名前がありません');
    const newPath = normPath(newPath0);
    if (newPath === oldPath) return { text: r.text };
    if (newPath.startsWith(`${oldPath}::`)) return fail('グループを自分の下位に入れることはできません');
    const map = (p) => (p === oldPath ? newPath : p.startsWith(`${oldPath}::`) ? newPath + p.slice(oldPath.length) : null);
    // 変えた後の名前が既存のグループと重なるなら変えない(仕様書 3.5 節。行が重なり、関係が自分自身になるため)
    for (const x of r.groupMap.keys()) { const q = map(x); if (q && r.groupMap.has(q) && !map(q)) return fail(`グループ「${q}」はすでにあるので、この名前には変えられません`); }
    const lines = r.parse.lines, ops = [];
    const put = (idx, key, val) => ops.push({ idx, line: `${indentOf(lines[idx])}${key}: ${val}${commentOf(lines[idx])}` });
    // 所属。変えた後に同じグループの行が 2 つになるなら、変える方の行を消す
    for (const n of r.ideas) {
      const ga = n.attrs.filter((x) => x.key === 'group'), have = new Set(ga.filter((x) => !map(x.path)).map((x) => x.path));
      for (const x of ga) { const q = map(x.path); if (!q) continue; if (have.has(q)) ops.push({ idx: x.lineIdx, del: true }); else { have.add(q); put(x.lineIdx, 'group', q); } }
    }
    for (const gl of r.parse.groupLines) { const q = map(gl.path); if (q) ops.push({ idx: gl.lineIdx, line: `group: ${q}${commentOf(lines[gl.lineIdx])}` }); }
    // 関係の相手(重なった group: の行の下のものも)。変える前の相手を求め、変えた後も同じ相手を指すように書く。
    // 短い名前のままで相手が変わる・見つからなくなるときは、上位を含めた名前で書く
    const resolve = (paths, q) => { if (paths.has(q)) return q; const c = [...paths].filter((x) => x.split('::').pop() === q); return c.length === 1 ? c[0] : null; };
    const before = new Set(r.groupMap.keys()), after = new Set();
    for (const x of before) after.add(map(x) ?? x);
    { const segs = newPath.split('::'); for (let k = 1; k <= segs.length; k++) after.add(segs.slice(0, k).join('::')); }
    for (const gl of r.parse.groupLines) for (const x of gl.attrs) {
      if (!Object.hasOwn(REL, x.key)) continue;
      const t = resolve(before, x.path);
      if (!t) continue; // 相手が見つからない関係(警告済み)はそのまま
      const nt = map(t) ?? t;
      if (resolve(after, x.path) !== nt) put(x.lineIdx, x.key, nt);
    }
    return commit(r, applyOps(lines, ops), null);
  }
  // グループの行の属性。行がなければ、テキストの最後に group: の行を足す
  function groupAttrOps(r, path, fn) {
    const g = r.groupMap.get(path);
    if (!g) return null;
    return g.def ? fn(g.def, indentOf(r.parse.lines[g.def.attrs[0]?.lineIdx ?? g.def.lineIdx]) || '  ') : null;
  }
  function setGroupNote(r, path, value0) {
    const value = String(value0 ?? '').trim();
    if (value) { const b = bad(value, 'メモ'); if (b) return fail(b); }
    const g = r.groupMap.get(path);
    if (!g) return fail('グループが見つかりません');
    const lines = r.parse.lines;
    if (!g.def) return value ? commit(r, append(r, ['', `group: ${path}`, `  note: ${value}`]), null) : { text: r.text };
    const at = g.def.attrs.find((a) => a.key === 'note');
    const ops = at ? (value ? [{ idx: at.lineIdx, line: `${indentOf(lines[at.lineIdx])}note: ${value}${commentOf(lines[at.lineIdx])}` }] : [{ idx: at.lineIdx, del: true }])
      : value ? [{ after: g.def.endIdx, lines: [`${groupAttrOps(r, path, (d, ind) => (d.attrs.length ? ind : '  '))}note: ${value}`] }] : [];
    return ops.length ? commit(r, applyOps(lines, ops), null) : { text: r.text };
  }
  function addRelation(r, path, kind, toPath) {
    if (!Object.hasOwn(REL, kind)) return fail('関係の種類が正しくありません');
    const g = r.groupMap.get(path), t = r.groupMap.get(toPath);
    if (!g || !t) return fail('グループが見つかりません');
    if (g === t) return fail('同じグループどうしは結べません');
    if (g.rels.some((x) => x.kind === kind && x.to === t)) return fail('この関係はすでにあります');
    if (!g.def) return commit(r, append(r, ['', `group: ${path}`, `  ${kind}: ${toPath}`]), null);
    const ind = g.def.attrs.length ? indentOf(r.parse.lines[g.def.attrs[0].lineIdx]) : '  ';
    return commit(r, applyOps(r.parse.lines, [{ after: g.def.endIdx, lines: [`${ind}${kind}: ${toPath}`] }]), null);
  }
  function removeRelation(r, path, i) {
    const g = r.groupMap.get(path);
    const rel = g?.rels[i];
    if (!rel) return fail('関係が見つかりません');
    return commit(r, applyOps(r.parse.lines, [{ idx: rel.attr.lineIdx, del: true }]), null);
  }
  // 共通項目(theme:・author:)。最初の行を書き換え、なければ先頭に足す。空なら最初の行を消す
  function setCommon(r, key, value0) {
    const value = String(value0 ?? '').trim();
    if (value) { const b = bad(value, '値'); if (b) return fail(b); }
    // 重なった行もそろえる。最初の行を書き換え、2 つ目からは消す。空なら、すべて消す
    const lines = r.parse.lines, all = r.parse.common[key], at = all[0];
    const ops = at ? [value ? { idx: at.lineIdx, line: `${key}: ${value}${commentOf(lines[at.lineIdx])}` } : { idx: at.lineIdx, del: true }, ...all.slice(1).map((x) => ({ idx: x.lineIdx, del: true }))]
      : value ? [{ after: -1, lines: [`${key}: ${value}`] }] : [];
    if (!ops.length) return { text: r.text };
    // 空のテキストに足すときは、余分な空行を作らない
    const text = !r.text ? `${key}: ${value}\n` : applyOps(lines, ops);
    return commit(r, text, null);
  }
  // 全体のまとめ(summary:)の並びを書き換える。同じ位置の行は置き換え、余れば消し、足りなければ最後の summary: の後ろ(なければテキストの最後)に足す
  function setSummary(r, list0) {
    const list = list0.map((s) => s.trim()).filter(Boolean);
    for (const s of list) { const b = bad(s, 'まとめ'); if (b) return fail(b); }
    const lines = r.parse.lines, olds = r.parse.common.summary, ops = [];
    olds.forEach((o, i) => ops.push(i < list.length ? { idx: o.lineIdx, line: `summary: ${list[i]}${commentOf(lines[o.lineIdx])}` } : { idx: o.lineIdx, del: true }));
    const rest = list.slice(olds.length).map((s) => `summary: ${s}`);
    if (rest.length) {
      if (olds.length) ops.push({ after: olds[olds.length - 1].lineIdx, lines: rest });
      else return commit(r, append(r, ['', ...rest]), null);
    }
    return ops.length ? commit(r, applyOps(lines, ops), null) : { text: r.text };
  }
  // ---- ブロック(matrix:・sevencross:・criterion:・must:)の書き換え
  const blockOf = (r, kinds, name) => r.parse.blocks.find((b) => kinds.includes(b.kind) && b.name === name) ?? null;
  const blocksOf = (r, kinds, name) => r.parse.blocks.filter((b) => kinds.includes(b.kind) && b.name === name);
  const blockLines = (bl) => Array.from({ length: bl.endIdx - bl.lineIdx + 1 }, (_, k) => ({ idx: bl.lineIdx + k, del: true }));
  const blockIndent = (r, b) => (b.attrs.length ? indentOf(r.parse.lines[b.attrs[0].lineIdx]) : '  ');
  const putLine = (r, idx, head) => ({ idx, line: `${indentOf(r.parse.lines[idx])}${head}${commentOf(r.parse.lines[idx])}` });
  const used = (r, pred) => r.ideas.filter((n) => n.attrs.some(pred));
  // マトリックス
  function addMatrix(r, name0) {
    const name = String(name0 ?? '').trim();
    const b = bad(name, 'マトリックスの名前');
    if (b) return fail(b);
    if (blockOf(r, ['matrix'], name)) return fail(`マトリックス「${name}」はすでにあります`);
    return commit(r, append(r, ['', `matrix: ${name}`]), null);
  }
  function addMatrixItem(r, name, axis, item0) {
    const item = String(item0 ?? '').trim();
    const b = bad(item, '項目');
    if (b) return fail(b);
    if (/×/.test(item)) return fail('項目に「×」は使えません');
    const bl = blockOf(r, ['matrix'], name);
    if (!bl) return fail('マトリックスが見つかりません');
    if (bl.attrs.some((a) => a.key === axis && a.text === item)) return fail(`「${item}」はすでにあります`);
    const m = r.matrices.find((x) => x.name === name);
    if (m) {
      const rows = axis === 'row' ? [...m.rows, item] : m.rows, cols = axis === 'col' ? [...m.cols, item] : m.cols;
      for (const o of r.matrices) {
        if (o === m) continue;
        const rr = rows.find((x) => o.rows.includes(x)), cc = cols.find((x) => o.cols.includes(x));
        if (rr !== undefined && cc !== undefined) return fail(`「${item}」を足すと、マトリックス「${o.name}」と同じ組み合わせ(${rr} × ${cc})ができるので、足せません`);
      }
    }
    return commit(r, applyOps(r.parse.lines, [{ after: bl.endIdx, lines: [`${blockIndent(r, bl)}${axis}: ${item}`] }]), null);
  }
  function removeMatrixItem(r, name, axis, item) {
    const bl = blockOf(r, ['matrix'], name);
    if (!bl) return fail('マトリックスが見つかりません');
    const m = r.matrices.find((x) => x.name === name);
    const n = used(r, (a) => a.method === 'matrix' && a.matrix === m && (axis === 'row' ? a.row : a.col) === item).length;
    if (n) return fail(`「${item}」の組み合わせから出したアイディアが ${n} 件あるので、消せません`);
    const ops = bl.attrs.filter((a) => a.key === axis && a.text === item).map((a) => ({ idx: a.lineIdx, del: true }));
    return ops.length ? commit(r, applyOps(r.parse.lines, ops), null) : fail('項目が見つかりません');
  }
  // セブンクロス
  function setSevenAxis(r, axis0) {
    const axis = String(axis0 ?? '').trim();
    const b = bad(axis, '分類の軸');
    if (b) return fail(b);
    const bl = r.parse.blocks.find((x) => x.kind === 'sevencross');
    if (bl) return commit(r, applyOps(r.parse.lines, [{ idx: bl.lineIdx, line: `sevencross: ${axis}${commentOf(r.parse.lines[bl.lineIdx])}` }]), null);
    return commit(r, append(r, ['', `sevencross: ${axis}`]), null);
  }
  function addSevenClass(r, cls0) {
    const cls = String(cls0 ?? '').trim();
    const b = bad(cls, '分類');
    if (b) return fail(b);
    const bl = r.parse.blocks.find((x) => x.kind === 'sevencross');
    if (!bl) return fail('先に分類の軸(sevencross:)を書いてください');
    if (r.seven.classes.includes(cls)) return fail(`分類「${cls}」はすでにあります`);
    return commit(r, applyOps(r.parse.lines, [{ after: bl.endIdx, lines: [`${blockIndent(r, bl)}class: ${cls}`] }]), null);
  }
  function renameSevenClass(r, old, nw0) {
    const nw = String(nw0 ?? '').trim();
    const b = bad(nw, '分類');
    if (b) return fail(b);
    if (nw === old) return { text: r.text };
    if (r.seven.classes.includes(nw) || r.seven.extra.includes(nw)) return fail(`分類「${nw}」はすでにあります`);
    const ops = [];
    const bl = r.parse.blocks.find((x) => x.kind === 'sevencross');
    for (const a of bl?.attrs ?? []) if (a.key === 'class' && a.text === old) ops.push(putLine(r, a.lineIdx, `class: ${nw}`));
    for (const n of r.ideas) for (const a of n.attrs) if (a.key === 'rank' && a.cls === old) ops.push(putLine(r, a.lineIdx, `rank: ${nw} ${a.level}`));
    return ops.length ? commit(r, applyOps(r.parse.lines, ops), null) : fail('分類が見つかりません');
  }
  function removeSevenClass(r, cls) {
    const n = used(r, (a) => a.key === 'rank' && a.cls === cls).length;
    if (n) return fail(`分類「${cls}」に置いたアイディアが ${n} 件あるので、消せません(先にアイディアを外してください)`);
    const bl = r.parse.blocks.find((x) => x.kind === 'sevencross');
    const ops = (bl?.attrs ?? []).filter((a) => a.key === 'class' && a.text === cls).map((a) => ({ idx: a.lineIdx, del: true }));
    return ops.length ? commit(r, applyOps(r.parse.lines, ops), null) : fail('分類が見つかりません');
  }
  // 分類 cls の重要度を level にする。level が null なら、その分類から外す
  function setRank(r, id, cls, level) {
    const n = find(r, id);
    if (!n) return fail('アイディアが見つかりません');
    const at = n.attrs.find((a) => a.key === 'rank' && a.cls === cls);
    let ops;
    if (level === null) { if (!at) return { text: r.text, select: keyOf(r, n) }; ops = [{ idx: at.lineIdx, del: true }]; }
    else if (at) ops = [putLine(r, at.lineIdx, `rank: ${cls} ${level}`)];
    else ops = [{ after: n.endIdx, lines: [`${attrIndent(r, n)}rank: ${cls} ${level}`] }];
    return commit(r, applyOps(r.parse.lines, ops), keyOf(r, n));
  }
  // 候補比較・評価
  function addCriterion(r, name0, must, weight0) {
    const name = String(name0 ?? '').trim();
    const b = bad(name, '観点の名前');
    if (b) return fail(b);
    if (blockOf(r, ['criterion', 'must'], name)) return fail(`観点「${name}」はすでにあります`);
    const w = String(weight0 ?? '').trim();
    if (w && !(/^\d+(\.\d+)?$/.test(w) && +w > 0)) return fail('重みは 0 より大きい数で書いてください');
    return commit(r, append(r, ['', must ? `must: ${name}` : `criterion: ${name}`, ...(!must && w && +w !== 1 ? [`  weight: ${w}`] : [])]), null);
  }
  function setCriterionWeight(r, name, w0) {
    const bl = blockOf(r, ['criterion'], name);
    if (!bl) return fail('評価の観点が見つかりません');
    const w = String(w0 ?? '').trim();
    if (w && !(/^\d+(\.\d+)?$/.test(w) && +w > 0)) return fail('重みは 0 より大きい数で書いてください');
    const at = bl.attrs.find((a) => a.key === 'weight');
    const ops = at ? (w ? [putLine(r, at.lineIdx, `weight: ${w}`)] : [{ idx: at.lineIdx, del: true }]) : w ? [{ after: bl.endIdx, lines: [`${blockIndent(r, bl)}weight: ${w}`] }] : [];
    return ops.length ? commit(r, applyOps(r.parse.lines, ops), null) : { text: r.text };
  }
  function renameCriterion(r, old, nw0) {
    const nw = String(nw0 ?? '').trim();
    const b = bad(nw, '観点の名前');
    if (b) return fail(b);
    if (nw === old) return { text: r.text };
    if (blockOf(r, ['criterion', 'must'], nw)) return fail(`観点「${nw}」はすでにあります`);
    const bls = blocksOf(r, ['criterion', 'must'], old);
    if (!bls.length) return fail('観点が見つかりません');
    const ops = bls.map((bl) => ({ idx: bl.lineIdx, line: `${bl.kind}: ${nw}${commentOf(r.parse.lines[bl.lineIdx])}` }));
    for (const n of r.ideas) for (const a of n.attrs) if (a.key === 'score' && a.crit === old) ops.push(putLine(r, a.lineIdx, `score: ${nw} ${a.value}`));
    return commit(r, applyOps(r.parse.lines, ops), null);
  }
  function removeCriterion(r, name) {
    const n = used(r, (a) => a.key === 'score' && a.crit === name).length;
    if (n) return fail(`観点「${name}」で評価したアイディアが ${n} 件あるので、消せません(先に評価を消してください)`);
    const bls = blocksOf(r, ['criterion', 'must'], name);
    if (!bls.length) return fail('観点が見つかりません');
    return commit(r, applyOps(r.parse.lines, bls.flatMap(blockLines)), null);
  }
  // 観点 crit の評価を value にする。value が空なら消す
  function setScore(r, id, crit, value0) {
    const n = find(r, id);
    if (!n) return fail('アイディアが見つかりません');
    const value = String(value0 ?? '').trim();
    const at = n.attrs.find((a) => a.key === 'score' && a.crit === crit);
    let ops;
    if (!value) { if (!at) return { text: r.text, select: keyOf(r, n) }; ops = [{ idx: at.lineIdx, del: true }]; }
    else if (at) ops = [putLine(r, at.lineIdx, `score: ${crit} ${value}`)];
    else ops = [{ after: n.endIdx, lines: [`${attrIndent(r, n)}score: ${crit} ${value}`] }];
    return commit(r, applyOps(r.parse.lines, ops), keyOf(r, n));
  }
  // ストーリーボード: 場面(scene:)を足す・直す・消す・入れ替える
  function addScene(r, id, text0) {
    const n = find(r, id);
    if (!n) return fail('アイディアが見つかりません');
    const text = String(text0 ?? '').trim();
    const b = bad(text, '場面');
    if (b) return fail(b);
    return commit(r, applyOps(r.parse.lines, [{ after: n.endIdx, lines: [`${attrIndent(r, n)}scene: ${text}`] }]), keyOf(r, n));
  }
  function setScene(r, id, i, text0) {
    const n = find(r, id);
    const at = n?.scenes[i];
    if (!at) return fail('場面が見つかりません');
    const text = String(text0 ?? '').trim();
    if (text) { const b = bad(text, '場面'); if (b) return fail(b); }
    return commit(r, applyOps(r.parse.lines, [text ? putLine(r, at.lineIdx, `scene: ${text}`) : { idx: at.lineIdx, del: true }]), keyOf(r, n));
  }
  function moveScene(r, id, i, dir) {
    const n = find(r, id);
    const a = n?.scenes[i], b = n?.scenes[i + dir];
    if (!a || !b) return fail('これ以上動かせません');
    return commit(r, applyOps(r.parse.lines, [putLine(r, a.lineIdx, `scene: ${b.text}`), putLine(r, b.lineIdx, `scene: ${a.text}`)]), keyOf(r, n));
  }
  // ポジショニング
  function addPosMap(r, name0) {
    const name = String(name0 ?? '').trim();
    const b = bad(name, 'ポジショニングの名前');
    if (b) return fail(b);
    if (blockOf(r, ['positioning'], name)) return fail(`ポジショニング「${name}」はすでにあります`);
    return commit(r, append(r, ['', `positioning: ${name}`]), null);
  }
  // 軸(x: か y:)を「低い側 .. 高い側」で書く
  function setPosAxis(r, name, axis, value0) {
    const bl = blockOf(r, ['positioning'], name);
    if (!bl) return fail('ポジショニングが見つかりません');
    const value = String(value0 ?? '').trim();
    if (value) { const b = bad(value, '軸'); if (b) return fail(b); if (!/^.+?[ \t]*\.\.[ \t]*.+$/.test(value)) return fail('軸は「低い側の言葉 .. 高い側の言葉」のように書きます(例: 安い .. 高い)'); }
    const at = bl.attrs.find((a) => a.key === axis);
    const ops = at ? (value ? [putLine(r, at.lineIdx, `${axis}: ${value}`)] : [{ idx: at.lineIdx, del: true }]) : value ? [{ after: bl.endIdx, lines: [`${blockIndent(r, bl)}${axis}: ${value}`] }] : [];
    return ops.length ? commit(r, applyOps(r.parse.lines, ops), null) : { text: r.text };
  }
  // 位置を書く。x が null なら、その図から外す
  function setPos(r, id, map, x, y) {
    const n = find(r, id);
    if (!n) return fail('アイディアが見つかりません');
    const at = n.attrs.find((a) => a.key === 'pos' && a.map === map);
    let ops;
    if (x === null) { if (!at) return { text: r.text, select: keyOf(r, n) }; ops = [{ idx: at.lineIdx, del: true }]; }
    else {
      const c = (v) => Math.max(-POS_MAX, Math.min(POS_MAX, Math.round(v)));
      const line = `pos: ${map} ${c(x)} ${c(y)}`;
      ops = at ? [putLine(r, at.lineIdx, line)] : [{ after: n.endIdx, lines: [`${attrIndent(r, n)}${line}`] }];
    }
    return commit(r, applyOps(r.parse.lines, ops), keyOf(r, n));
  }
  // 既存調査
  function addResearch(r, name0, url0, forName) {
    const name = String(name0 ?? '').trim(), url = String(url0 ?? '').trim();
    const b = bad(name, '調べたものの名前');
    if (b) return fail(b);
    if (url) { const e = bad(url, 'URL'); if (e) return fail(e); }
    if (blockOf(r, ['research'], name)) return fail(`「${name}」はすでにあります`);
    if (forName && !refOk(r, r.ideas.find((x) => x.name === forName))) return fail(`「${forName}」は、同じ名前の案がほかにあるか手法名で始まるので、関係する案として指せません`);
    return commit(r, append(r, ['', `research: ${name}`, ...(url ? [`  url: ${url}`] : []), ...(forName ? [`  for: ${forName}`] : [])]), null);
  }
  function setResearchAttr(r, name, key, value0) {
    const bl = blockOf(r, ['research'], name);
    if (!bl) return fail('既存調査が見つかりません');
    const value = String(value0 ?? '').trim();
    if (value) { const b = bad(value, '値'); if (b) return fail(b); }
    const at = bl.attrs.find((a) => a.key === key);
    const ops = at ? (value ? [putLine(r, at.lineIdx, `${key}: ${value}`)] : [{ idx: at.lineIdx, del: true }]) : value ? [{ after: bl.endIdx, lines: [`${blockIndent(r, bl)}${key}: ${value}`] }] : [];
    return ops.length ? commit(r, applyOps(r.parse.lines, ops), null) : { text: r.text };
  }
  function addResearchFor(r, name, ideaName) {
    if (!String(ideaName ?? '').trim()) return fail('関係する案の名前が空です');
    const bl = blockOf(r, ['research'], name);
    if (!bl) return fail('既存調査が見つかりません');
    if (bl.attrs.some((a) => a.key === 'for' && a.text === ideaName)) return fail('この案はすでに入っています');
    if (!refOk(r, r.ideas.find((x) => x.name === ideaName))) return fail(`「${ideaName}」は、同じ名前の案がほかにあるか手法名で始まるので、関係する案として指せません`);
    return commit(r, applyOps(r.parse.lines, [{ after: bl.endIdx, lines: [`${blockIndent(r, bl)}for: ${ideaName}`] }]), null);
  }
  function removeResearchFor(r, name, i) {
    const x = r.researches.find((y) => y.name === name);
    const f = x?.fors[i];
    if (!f) return fail('関係する案が見つかりません');
    return commit(r, applyOps(r.parse.lines, [{ idx: f.attr.lineIdx, del: true }]), null);
  }
  function removeResearch(r, name) {
    const bls = blocksOf(r, ['research'], name);
    if (!bls.length) return fail('既存調査が見つかりません');
    return commit(r, applyOps(r.parse.lines, bls.flatMap(blockLines)), null);
  }
  return { addScene, setScene, moveScene, addPosMap, setPosAxis, setPos, addResearch, setResearchAttr, addResearchFor, removeResearchFor, removeResearch, addIdea, setAttr, rename, remove, addToGroup, removeFromGroup, renameGroup, setGroupNote, addRelation, removeRelation, setCommon, setSummary,
    addMatrix, addMatrixItem, removeMatrixItem, setSevenAxis, addSevenClass, renameSevenClass, removeSevenClass, setRank, addCriterion, setCriterionWeight, renameCriterion, removeCriterion, setScore, keyOf, locate, find };
})();

// ---- 生成 AI に壁打ちを頼む相談の文(仕様書 2.6 節)
// st: 画面の状態(render と同じ形に、hcParent・mmParent・lsItem: 広げる元・伸ばす元・選んだ項目の id、sel: 選んでいるアイディアの id の並び を足したもの)
// trouble: 困っていること(利用者が書いた文。空でもよい)
const CONSULT_MAX = 80; // 一覧に並べるアイディアの数の上限(超えた分は件数だけ書く)
const VIEW_METHOD = { list: 'direct', w5: 'fivew1h', elim: 'eliminate' };
const VIEW_ABOUT = {
  list: 'テーマに対して、思いついたアイディアを 1 件ずつ書く。',
  mandala: '3×3 の盤面の中心にテーマ(またはアイディア)を置き、周りの 8 マスを関連するアイディアで埋める。',
  honeycomb: '六角形の枠を、ある枠の隣へ隣へと広げながら、連想したアイディアを書く。',
  matrix: '縦の項目と横の項目の表を作り、その組み合わせのマスごとにアイディアを考える。',
  sixhats: '6 つの帽子の色(事実・直感・リスク・長所・新しい案・まとめ)の立場を順にかぶって考える。',
  osborn: 'オズボーンのチェックリストの 9 つの問いを、対象に当てて考える。',
  scamper: 'SCAMPER の 7 つの問いを、対象に当てて考える。',
  triz: 'TRIZ の 40 原理の問いを、対象に当てて考える。',
  defects: '対象の欠点を挙げてから、欠点ごとに改善案を考える。',
  wishes: '対象への希望点(こうだったらいいのに)を挙げてから、希望点ごとに案を考える。',
  attributes: '対象の特性(名詞的・形容詞的・動詞的)を挙げてから、特性ごとに改善案を考える。',
  kj: 'アイディアを似たものどうしのグループにまとめ、グループに見出しを付け、グループの間の関係(関連・因果・対立)を考え、全体を文章にまとめる。',
  sevencross: '分類の軸で分けた分類ごとに、アイディアを重要度 1〜7(1 がいちばん重要)に並べる。',
  w5: '案ごとに、誰のためか・何をする案か・なぜ必要か・いつ使うか・どこで使うか・どう実現するかを書き、案を具体的にする。',
  mindmap: 'テーマを中心に、元のアイディアからたどった枝を伸ばして、案を広げたり整理したりする。',
  storyboard: '案が実際に使われる様子を、場面の文の並びにして確かめる。',
  positioning: '2 つの軸の図の上に案を置き、案どうしの違いや空いている所を見る。',
  research: '似た製品・サービス・論文を調べ、自分の案との違いを書く。',
  compare: '必須の条件(満たすか満たさないか)と、重み付きの評価の観点(1〜5)で、案を比べる。',
  elim: '案ごとに、採用(1 つだけ)・代替・見送りを決め、理由を書く。',
};
function consultPrompt(r, view, st = {}, trouble = '') {
  if (!r?.ok) return 'テキストにエラーがあるので、相談の文を作れません。先にエラーを直してください。'; // 画面からはエラーの間は呼ばない
  const V = VIEWS.find((v) => v.id === view) ?? VIEWS[0];
  const phase = V.phase === 'd' ? '発散' : '収束';
  const byId = (id) => (id ? r.ideas.find((n) => n.id === id) ?? null : null);
  const nm = (n) => `「${n.name}」${refOk(r, n) ? '' : '(元には指せません)'}`; // 元として指せない案には印を付ける(仕様書 3.7 節)
  // 1 行に並べるときも 80 件まで(残りは件数)
  // 行に並べるときも 80 件まで(残りは件数の行)
  const rows = (xs, f, ind = '  ') => [...xs.slice(0, CONSULT_MAX).map(f), ...(xs.length > CONSULT_MAX ? [`${ind}- ほか ${xs.length - CONSULT_MAX} 件`] : [])];
  const join = (xs, f) => [...xs.slice(0, CONSULT_MAX).map(f), ...(xs.length > CONSULT_MAX ? [`ほか ${xs.length - CONSULT_MAX} 件`] : [])].join('、');
  const line = (n) => `${nm(n)}(${n.by ?? '書いた人なし'}。${fromLabel(n)})`;
  const list = (ns, f = line) => (ns.length ? [...ns.slice(0, CONSULT_MAX).map((n) => `  - ${f(n)}`), ...(ns.length > CONSULT_MAX ? [`  - ほか ${ns.length - CONSULT_MAX} 件`] : [])] : ['  - (まだありません)']);
  const out = [], s = [];
  out.push(`あなたは、アイディア出しの相談相手です。私は、アイディア出しのアプリ「アイディア生成」(https://igen.sapp.jp)で、次のテーマについて考えています。いま${phase}のフェーズで「${V.label}」の手法を使っていて、詰まっています。下の状況を読んで、壁打ちの相手になってください。`);
  out.push('');
  out.push('## 状況');
  s.push(`- テーマ: ${r.theme || '(まだ決めていません)'}`);
  s.push(`- フェーズ: ${phase}(${V.phase === 'd' ? 'アイディアをたくさん出す段階' : '出したアイディアをまとめ、1 つの案に絞る段階'})`);
  s.push(`- 手法: ${V.label}。${VIEW_ABOUT[V.id]}`);
  let fromHint = null; // 案を返すときの from: の書き方
  const tgt = (id) => byId(id);
  const refLine = (n) => {
    if (!n) return [];
    if (refOk(r, n)) return [`from: ${n.name}`];
    s.push(`- 「${n.name}」は元には指せない(同じ名前がほかにあるか、最初の語が手法名)ので、案の from: には書けません。テーマから出した案として書きます`);
    return [];
  };
  let noTemplate = false;
  switch (V.id) {
    case 'list':
      fromHint = ['from: direct'];
      break;
    case 'mandala': {
      const b = boardOf(r, st.mandala);
      s.push(`- 盤面の中心: ${b.center ? nm(b.center) : 'テーマ'}`);
      s.push(`- 埋まっているマス(${Math.min(8, b.cells.length)} / 8):`, ...list(b.cells.slice(0, 8)));
      s.push(`- 空きのマス: ${Math.max(0, 8 - b.cells.length)} マス`);
      if (b.cells.length >= 8) s.push('- この盤面は 8 マスが埋まっています。新しい案は、マスのアイディアを中心にした盤面(その案を中心に、周りの 8 マスを考える)に書くと置けます');
      fromHint = ['from: mandala', ...refLine(b.center)];
      break;
    }
    case 'honeycomb': {
      const root = byId(st.honeycomb), p = byId(st.hcParent) ?? root;
      const sh = r.sheets.get(root ? root.id : 'theme');
      s.push(`- シートの中心: ${root ? nm(root) : 'テーマ'}`);
      s.push(`- 広げる元の枠: ${p ? nm(p) : 'テーマ'}`);
      s.push('- シートにある枠:', ...list(sh?.nodes ?? [], (n) => `${nm(n)}${n.tparent && n.tparent !== root ? `(${nm(n.tparent)}の隣)` : ''}`));
      fromHint = ['from: honeycomb', ...refLine(p)];
      break;
    }
    case 'matrix': {
      const m = r.matrices.find((x) => x.name === st.matrix) ?? r.matrices[0] ?? null;
      if (!m) { s.push('- マトリックス: まだ作っていません(縦の項目と横の項目を決めるところで詰まっています)'); noTemplate = true; break; }
      s.push(`- マトリックス: ${m.name}`, `- 縦の項目: ${m.rows.join('、') || '(なし)'}`, `- 横の項目: ${m.cols.join('、') || '(なし)'}`);
      const cell = st.mxCell && m.rows[st.mxCell[0]] !== undefined && m.cols[st.mxCell[1]] !== undefined ? [m.rows[st.mxCell[0]], m.cols[st.mxCell[1]]] : null;
      if (cell) s.push(`- 考えているマス: ${cell[0]} × ${cell[1]}`);
      const inM = r.ideas.filter((n) => n.methods.some((f) => f.method === 'matrix' && f.matrix === m));
      s.push('- マスに書いたアイディア:', ...list(inM, (n) => { const f = n.methods.find((x) => x.method === 'matrix' && x.matrix === m); return `${f.row} × ${f.col}: ${nm(n)}`; }));
      const empty = m.rows.flatMap((a) => m.cols.filter((b) => !inM.some((n) => n.methods.some((f) => f.method === 'matrix' && f.matrix === m && f.row === a && f.col === b))).map((b) => `${a} × ${b}`));
      s.push(`- まだ案のないマス: ${join(empty, (x) => x) || 'なし'}`);
      // マスを選んでいなければ、案のない最初のマス(なければ最初のマス)を例にする
      const ex = cell ?? (empty[0] ? empty[0].split(' × ') : m.rows.length && m.cols.length ? [m.rows[0], m.cols[0]] : null);
      fromHint = ex ? [`from: matrix ${ex[0]} × ${ex[1]}`] : null;
      if (!ex) { noTemplate = true; s.push('- まだ組み合わせのマスがありません(縦の項目と横の項目の両方が必要です)'); }
      if (!cell && ex) s.push(`- 案を書くマスは、上の縦の項目と横の項目から選びます(例: ${ex[0]} × ${ex[1]})`);
      break;
    }
    case 'sixhats': case 'osborn': case 'scamper': case 'triz': {
      const def = CHECKLISTS[V.id], c = st.cl?.[V.id] ?? {}, t = tgt(c.target), it = def.items[c.vp ?? 0] ?? def.items[0];
      s.push(`- 対象: ${t ? nm(t) : 'テーマ'}`);
      s.push(`- 考えている観点: ${it.label}(問い: ${it.q})`);
      s.push('- この対象で、観点ごとにすでに出ている案:');
      for (const x of def.items) { const ns = checklistIdeas(r, V.id, t?.id ?? null, x.vp); if (ns.length) s.push(`  - ${x.label}: ${join(ns, nm)}`); }
      if (!def.items.some((x) => checklistIdeas(r, V.id, t?.id ?? null, x.vp).length)) s.push('  - (まだありません)');
      fromHint = [`from: ${V.id} ${it.vp}`, ...refLine(t)];
      break;
    }
    case 'defects': case 'wishes': case 'attributes': {
      const L = LISTINGS[V.id], c = st.ls?.[V.id] ?? {}, t = tgt(c.target);
      // 元として指せない項目は、改善案の元にしない(状況にその旨を書き、項目を挙げる書き方にする)
      const item0 = byId(st.lsItem), item = item0 && refOk(r, item0) ? item0 : null;
      if (item0 && !item) refLine(item0);
      s.push(`- 対象: ${t ? nm(t) : 'テーマ'}`);
      s.push(`- 挙げた${L.itemLabel}と、その${L.impLabel}:`);
      let any = false, shown = 0;
      for (const vp of L.items) for (const n of listingItems(r, V.id, t?.id ?? null, vp)) {
        any = true;
        const imp = listingImprovements(r, V.id, n);
        if (++shown > CONSULT_MAX) continue;
        s.push(`  - ${L.items.length > 1 ? `${vp}特性 ` : ''}${nm(n)}: ${imp.length ? join(imp, nm) : `(${L.impLabel}はまだありません)`}`);
      }
      if (!any) s.push('  - (まだありません)');
      if (shown > CONSULT_MAX) s.push(`  - ほか ${shown - CONSULT_MAX} 件`);
      if (item) s.push(`- いま${L.impLabel}を考えている${L.itemLabel}: ${nm(item)}`);
      const vp = L.items[c.vp ?? 0] ?? L.items[0];
      if (!item && L.items.length > 1) s.push(`- いま挙げている特性: ${vp}特性(${L.hint[vp]})`);
      fromHint = item ? [`from: ${V.id} ${L.improve}`, ...refLine(item)] : [`from: ${V.id} ${vp}`, ...refLine(t)];
      break;
    }
    case 'kj': {
      s.push('- グループ:');
      const tops = r.groups.filter((g) => !g.parent);
      if (tops.length) {
        // 深い入れ子でも止まらないように、繰り返しで並べる
        const stack = tops.map((g) => [g, 0]).reverse();
        let shown = 0;
        while (stack.length && shown < CONSULT_MAX) {
          const [g, d] = stack.pop();
          shown++;
          s.push(`${'  '.repeat(d + 1)}- グループ「${g.path}」${g.note ? `(説明: ${g.note})` : ''}: ${join(g.members, nm) || '(アイディアなし)'}`);
          for (let k = g.children.length - 1; k >= 0; k--) stack.push([g.children[k], d + 1]);
        }
        // 数えるだけのグループの子も数に入れる(stack に積まないので、全体の数から求める)
        if (r.groups.length > CONSULT_MAX) s.push(`  - ほか ${r.groups.length - CONSULT_MAX} グループ`);
      } else s.push('  - (まだありません)');
      s.push('- まだグループに入っていないアイディア:', ...list(r.ideas.filter((n) => !n.groups.length)));
      if (r.rels.length) s.push('- グループの関係:', ...rows(r.rels, (x) => `  - 「${x.from.path}」と「${x.to.path}」: ${REL[x.kind]}`));
      s.push(`- 全体のまとめ: ${r.summary.length ? r.summary.join('') : '(まだ書いていません)'}`);
      break;
    }
    case 'sevencross': {
      s.push(`- 分類の軸: ${r.seven.axis ?? '(まだ決めていません)'}`);
      const cls = sevenClasses(r);
      s.push(`- 分類: ${join(cls, (x) => x) || '(まだありません)'}`);
      for (const c of cls.slice(0, CONSULT_MAX)) {
        const ns = r.ideas.filter((n) => n.ranks.some((x) => x.cls === c)).sort((a, b) => a.ranks.find((x) => x.cls === c).level - b.ranks.find((x) => x.cls === c).level);
        s.push(`  - ${c}: ${join(ns, (n) => `${n.ranks.find((x) => x.cls === c).level} ${nm(n)}`) || '(まだ置いていません)'}`);
      }
      if (cls.length > CONSULT_MAX) s.push(`  - ほか ${cls.length - CONSULT_MAX} 分類`);
      s.push('- どの分類にも置いていないアイディア:', ...list(r.ideas.filter((n) => !n.ranks.length)));
      break;
    }
    case 'w5': {
      const ns = r.ideas.filter((n) => n.decision !== 'drop');
      s.push('- 案ごとの 5W1H(見送りの案は除く):');
      for (const n of ns.slice(0, CONSULT_MAX)) {
        const have = W5.filter((k) => n.w5[k]), miss = W5.filter((k) => !n.w5[k]);
        s.push(`  - ${nm(n)}: ${have.map((k) => `${k}(${W5_JA[k]}) ${n.w5[k]}`).join(' / ') || '(まだ書いていません)'}${miss.length && have.length ? `。まだ: ${miss.join('・')}` : ''}`);
      }
      if (ns.length > CONSULT_MAX) s.push(`  - ほか ${ns.length - CONSULT_MAX} 件`);
      if (!ns.length) s.push('  - (まだありません)');
      break;
    }
    case 'mindmap': {
      const kids = mindTree(r), p = byId(st.mmParent);
      s.push(`- 枝を伸ばす元: ${p ? nm(p) : 'テーマ'}`);
      s.push('- 木(元のアイディアをたどったつながり):');
      const stack = (kids.get(null) ?? []).map((n) => [n, 0]).reverse();
      let k = 0;
      while (stack.length && k < CONSULT_MAX) { const [n, d] = stack.pop(); k++; s.push(`${'  '.repeat(d + 1)}- ${nm(n)}`); const ks = kids.get(n) ?? []; for (let i = ks.length - 1; i >= 0; i--) stack.push([ks[i], d + 1]); }
      if (r.ideas.length > k) s.push(`  - ほか ${r.ideas.length - k} 件`);
      if (!r.ideas.length) s.push('  - (まだありません)');
      fromHint = ['from: mindmap', ...refLine(p)];
      break;
    }
    case 'storyboard': {
      const n = byId(st.story);
      if (n) { s.push(`- 場面を考えている案: ${nm(n)}`); s.push('- いまの場面:', ...(n.scenes.length ? rows(n.scenes, (x) => `  ${n.scenes.indexOf(x) + 1}. ${x.text}`) : ['  - (まだありません)'])); if (n.w5 && W5.some((k) => n.w5[k])) s.push(`- この案の 5W1H: ${W5.filter((k) => n.w5[k]).map((k) => `${k} ${n.w5[k]}`).join(' / ')}`); }
      else s.push('- 場面を考えている案: (まだありません)');
      break;
    }
    case 'positioning': {
      const m = r.posmaps.find((x) => x.name === st.posmap) ?? r.posmaps[0] ?? null;
      if (!m) { s.push('- ポジショニングの図: まだ作っていません(2 つの軸を決めるところで詰まっています)'); break; }
      s.push(`- 図: ${m.name}`, `- 横の軸: ${m.x ? `${m.x.lo}(-5)〜${m.x.hi}(+5)` : '(まだ決めていません)'}`, `- 縦の軸: ${m.y ? `${m.y.lo}(-5)〜${m.y.hi}(+5)` : '(まだ決めていません)'}`);
      const on = r.ideas.filter((n) => n.pos.has(m.name));
      s.push('- 図に置いた案(横, 縦):', ...list(on, (n) => { const q = n.pos.get(m.name); return `${nm(n)}(${q.x}, ${q.y})`; }));
      s.push('- まだ置いていない案:', ...list(r.ideas.filter((n) => !n.pos.has(m.name) && n.decision !== 'drop'), (n) => nm(n)));
      break;
    }
    case 'research': {
      s.push('- 調べたもの:');
      for (const x of r.researches.slice(0, CONSULT_MAX)) s.push(`  - ${x.name}${x.url ? `(${x.url})` : ''}: 関係する案 ${join(x.fors, (f) => (f.target ? nm(f.target) : `「${f.attr.text}」(見つかりません)`)) || 'なし'}。違い: ${x.diff ?? '(まだ書いていません)'}`);
      if (r.researches.length > CONSULT_MAX) s.push(`  - ほか ${r.researches.length - CONSULT_MAX} 件`);
      if (!r.researches.length) s.push('  - (まだありません)');
      s.push('- まだ調べていない案:', ...list(r.ideas.filter((n) => n.decision !== 'drop' && !r.researches.some((x) => x.fors.some((f) => f.target === n))), (n) => nm(n)));
      break;
    }
    case 'compare': {
      const { musts, crits, rows } = compareData(r);
      s.push(`- 必須の条件: ${musts.map((c) => c.name).join('、') || '(まだありません)'}`);
      s.push(`- 評価の観点(重み): ${crits.map((c) => `${c.name}(${fmtNum(c.weight)})`).join('、') || '(まだありません)'}`);
      s.push('- 案ごとの評価(見送りの案は除く):');
      for (const { n, ng, total } of rows.slice(0, CONSULT_MAX)) {
        const sc = [...musts, ...crits].map((c) => `${c.name} ${n.scores.has(c.name) ? n.scores.get(c.name).value : '未評価'}`).join(' / ');
        s.push(`  - ${nm(n)}: ${sc || '(観点なし)'}${ng ? '。必須の条件を満たさない' : ''}${total !== null ? `。合計 ${fmtNum(total)}` : ''}`);
      }
      if (rows.length > CONSULT_MAX) s.push(`  - ほか ${rows.length - CONSULT_MAX} 件`);
      if (!rows.length) s.push('  - (まだありません)');
      break;
    }
    case 'elim': {
      const by = (d) => r.ideas.filter((n) => (n.decision ?? null) === d);
      s.push('- 採用:', ...list(by('adopt'), (n) => `${nm(n)}${n.reason ? `(理由: ${n.reason})` : ''}`));
      s.push('- 代替:', ...list(by('backup'), (n) => `${nm(n)}${n.reason ? `(理由: ${n.reason})` : ''}`));
      s.push('- 見送り:', ...list(by('drop'), (n) => `${nm(n)}${n.reason ? `(理由: ${n.reason})` : ''}`));
      s.push('- まだ判断していない案:', ...list(by(null), (n) => nm(n)));
      break;
    }
    default: break;
  }
  // 選んでいるアイディア
  const sels = (st.sel ?? []).map(byId).filter(Boolean);
  for (const n of sels.slice(0, 10)) {
    s.push(`- 選んでいるアイディア: ${nm(n)}(${n.by ?? '書いた人なし'}。${fromLabel(n)})`);
    const w = W5.filter((k) => n.w5[k]);
    if (w.length) s.push(`  - 5W1H: ${w.map((k) => `${k} ${n.w5[k]}`).join(' / ')}`);
    if (n.note) s.push(`  - メモ: ${n.note}`);
  }
  if (sels.length > 10) s.push(`- 選んでいるアイディア: ほか ${sels.length - 10} 件`);
  // 発散では、重ならないように、すでにある案の名前を並べる
  if (V.phase === 'd') s.push(`- テキスト全体にあるアイディア(${r.ideas.length} 件):`, ...list(r.ideas, (n) => nm(n)));
  out.push(...s, '');
  out.push('## 困っていること');
  const tr = String(trouble ?? '').trim();
  out.push(tr ? tr.split(/\r\n?|\n/).map((l) => `> ${l}`).join('\n') : '(書いていません。上の状況から、詰まっていそうなところを考えてください)'); // 引用にして、文の区切り(``` や ##)を崩さない
  out.push('');
  out.push('## 頼みたいこと');
  if (V.phase === 'd') {
    out.push('- 発想を広げる問いかけを 3 つほどください。');
    out.push('- 上の状況に合う案の候補を 5 つほどください。すでにある案と重ならないものにしてください。');
  } else {
    out.push('- まとめ方や判断の観点を提案してください(例: どれとどれをまとめられそうか、何を比べると決めやすいか、足りない情報は何か)。');
    out.push('- 決めるのは私です。結論を押しつけず、私に問い返しながら進めてください。');
  }
  out.push('- 一度に全部を答えず、私に問い返してもかまいません。');
  out.push('');
  out.push('## 案を返すときの書き方');
  const method = VIEW_METHOD[V.id] ?? V.id;
  const tmpl = fromHint ?? [`from: ${method}`];
  if (noTemplate) {
    out.push('- まだ案を書くマスがありません。先に、縦の項目と横の項目の候補を一緒に考えてください。案は、縦の項目と横の項目が決まってから、「from: matrix 縦の項目 × 横の項目」の形で書きます。');
  } else {
    out.push('案は、そのまま私のテキストの最後に貼れるように、次の書き方で書き、コードブロック(```)で囲んで、会話の文と分けてください。');
    out.push('```', '- 案の名前', '  by: 生成 AI', ...tmpl.map((x) => `  ${x}`), '```');
  }
  out.push('- 1 つの案ごとに「- 案の名前」の行と、その下の by: と from: の行を書きます(字下げは半角の空白 2 個)。');
  out.push('- from: の元のアイディアの名前は、上の状況にある名前をそのまま書きます。「元には指せません」と印のある案は、from: に書かないでください(同じ名前がほかにあるか、名前の最初の語が手法名なので、元として指せません)。');
  if (!fromHint && V.phase === 'c') out.push('- 新しい案が、上の状況にあるアイディアから生まれたときは、そのアイディアの名前を別の from: の行に書き足します(例: 「from: 元のアイディアの名前」)。');
  out.push('- 案の名前は、すでにある案と同じ名前にせず、最初の語を手法名(direct・mandala・scamper など)にしないでください。');
  out.push('- 5W1H・判断(decision:)・理由(reason:)・評価(score:)などは、私が答えた内容だけを書き、推測で埋めないでください。');
  return out.join('\n');
}

// ---- 生成 AI に渡す修正依頼の文
function toPrompt(diags, text) {
  const out = [];
  out.push('次の「アイディア生成」(https://igen.sapp.jp)のテキスト記法について、下の診断の内容を直したテキストを書いてください。');
  out.push('返すテキストはコードブロック(```)で囲まず、テキストだけを書いてください。見出し(#)・番号付きのリスト・説明の文の行は書けません(構文エラーになります)。');
  out.push('書き方の要点: 字下げしない行は「theme: テーマ」「author: 名前」「summary: まとめの文」「- アイディア」「group: グループ名」などの種類。アイディアとグループの属性は、その下の行に字下げして「予約語: 値」で 1 行に 1 つ書く。アイディアの属性は by:(書いた人)・from:(出所。何行でも)・group:(グループ。何行でも)・who: what: why: when: where: how:(5W1H)・decision:(adopt 採用 / backup 代替 / drop 見送り)・reason:(判断の理由)・note:(メモ)。from: は「from: 手法名 観点」か「from: 元のアイディアの名前」。手法名は direct mandala honeycomb matrix sixhats osborn scamper triz defects wishes attributes kj mindmap など。欠点列挙法は defects 欠点 / defects 改善案、希望点列挙法は wishes 希望点 / wishes 案、特性列挙法は attributes 名詞的 / 形容詞的 / 動詞的 / 改善案(改善案は元の項目の名前を別の from: に書く)。SCAMPER の観点は 代用する 組み合わせる 応用する 修正する 転用する 削ぎ落とす 再構成する、オズボーンは 転用 応用 変更 拡大 縮小 代用 再編成 逆転 結合、シックスハットは 白 赤 黒 黄 緑 青、TRIZ は 1〜40 の番号、マトリックス法は「縦の項目 × 横の項目」。アイディアには rank:(セブンクロス。「分類 1〜7」)・score:(候補比較。「観点 1〜5」か「条件 ok/ng」)・pos:(ポジショニング。「図 横 縦」で -5〜5)・scene:(ストーリーボードの場面)も書ける。字下げしない行には matrix:(下に row: col:)・sevencross:(下に class:)・criterion:(下に weight:)・must:・positioning:(下に x: y: を「低い .. 高い」で)・research:(下に url: for: diff: note:)も書ける。グループの属性は note:・relate:(関連)・cause:(因果)・oppose:(対立)。グループの上位は「大::中」と書く。// から行末までは注(行頭か空白の後の // だけ)。アイディアの名前の最初の語を手法名にしない。同じ名前のアイディアを 2 つ書かない(from: で指せなくなる)。');
  out.push('');
  const er = diags.filter((d) => d.level === 'error'), wr = diags.filter((d) => d.level === 'warn');
  if (er.length) { out.push('## エラー'); for (const d of er) out.push(`- ${d.line} 行: ${d.message}`); out.push(''); }
  if (wr.length) { out.push('## 警告'); for (const d of wr) out.push(`- ${d.line} 行: ${d.message}`); out.push(''); }
  out.push('## テキスト(「----- ここから -----」と「----- ここまで -----」の間)');
  out.push('----- ここから -----');
  out.push(text.replace(/^﻿/, ''));
  out.push('----- ここまで -----');
  return out.join('\n');
}

return { parse, analyze, refOk, methodLike, consultPrompt, render, pieces, tsv, printPages, boardOf, hexLayout, LISTINGS, listingItems, listingImprovements, listingTargets, POS_GEOM, POS_MAX, checklistIdeas, checklistTargets, CHECKLISTS, sevenClasses, compareData, mindTree, RANKS, toPrompt, Edit, VIEWS, TABLE_VIEWS, METHODS, SCAMPER, HATS, OSBORN, TRIZ, W5, W5_JA, DECISION, REL, fromLabel };
})();
if (typeof module !== 'undefined') module.exports = Igen;
/*CORE-END*/
