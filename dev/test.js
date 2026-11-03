// 計算部の試験。使い方: node dev/test.js(リポジトリのトップで)
'use strict';
const fs = require('fs');
const path = require('path');
const Igen = require('./core.js');
const sample = fs.readFileSync(path.join(__dirname, 'sample.igen'), 'utf8');

let fails = 0, count = 0;
const ok = (c, msg) => { count++; if (!c) { fails++; console.log(`NG: ${msg}`); } };
const diags = (t) => Igen.analyze(t).diags;
const errs = (t) => diags(t).filter((d) => d.level === 'error');
const warns = (t) => diags(t).filter((d) => d.level === 'warn');
const hasWarn = (t, re) => warns(t).some((d) => re.test(d.message));
const hasErr = (t, re) => errs(t).some((d) => re.test(d.message));

// ---- 例: エラーも警告もない
{
  const d = diags(sample);
  ok(d.length === 0, `例に診断が出ない(出たもの: ${d.map((x) => `${x.line} 行 ${x.message}`).join(' / ')})`);
  const r = Igen.analyze(sample);
  ok(r.ideas.length === 23, '例のアイディアは 23 件');
  ok(r.boards.get('theme').cells.length === 8, 'テーマの盤面は 8 マス');
  ok(r.groupMap.get('探す手間を減らす::写真で探す').members.length === 5, '下位グループの所属');
  ok(r.rels.length === 2, '関係は 2 本');
  ok(r.summary.length === 2, 'まとめは 2 行');
}

// ---- 貼り付け: 2 人分をつなげてもエラーにならない
{
  const a = 'theme: 落とし物\nauthor: 青木\n- 案 A\n  by: 青木\n  from: direct\n';
  const b = 'theme: 落とし物\nauthor: 井上\n- 案 A\n  by: 井上\n  from: direct\n';
  const r = Igen.analyze(a + b);
  ok(r.ok && !warns(a + b).length, '同じテーマの 2 人分の貼り付けに診断が出ない');
  ok(r.ideas.length === 2, '同じ名前のアイディアを両方残す');
  ok(r.author === '青木', 'author: は先に書いた方を使う');
  const c = 'theme: 別のテーマ\n- 案 B\n  by: 上田\n  from: direct\n';
  ok(hasWarn(a + c, /テーマ「別のテーマ」が/), 'テーマが違えば警告');
  ok(hasWarn(a + a, /名前と属性がすべて同じ/), 'すべて同じアイディアは警告');
}

// ---- 警告
{
  ok(hasWarn('- 案\n  from: direct\n', /書いた人/), 'by: がなければ警告');
  ok(hasWarn('- 案\n  by: 青木\n', /出所/), 'from: がなければ警告');
  ok(hasWarn('- 案\n  by: 青木\n  from: ない案\n', /見つかりません/), '元のアイディアが見つからなければ警告');
  const dup = '- X\n  by: a\n  from: direct\n- X\n  by: b\n  from: direct\n- Y\n  by: a\n  from: X\n';
  ok(hasWarn(dup, /どれか決まりません/), '同じ名前の参照は警告');
  ok(Igen.analyze(dup).ideas[2].parents[0].line === 1, '同じ名前の参照は先に書いた方を指す');
  const ad = '- A\n  by: a\n  from: direct\n  decision: adopt\n- B\n  by: a\n  from: direct\n  decision: adopt\n';
  ok(hasWarn(ad, /採用\(adopt\)は 1 つだけ/), '採用が 2 つで警告');
  const m7 = Array.from({ length: 7 }, (_, i) => `- m${i}\n  by: a\n  from: mandala\n`).join('');
  ok(hasWarn(`theme: T\n${m7}`, /8 マス中 7 マス/), 'マンダラートの空きは警告');
  const m9 = Array.from({ length: 9 }, (_, i) => `- m${i}\n  by: a\n  from: mandala\n`).join('');
  ok(hasWarn(`theme: T\n${m9}`, /9 個目以降/), 'マンダラートの 9 個目は警告');
  ok(!hasWarn(`theme: T\n${Array.from({ length: 8 }, (_, i) => `- m${i}\n  by: a\n  from: mandala\n`).join('')}`, /マンダラート/), 'マンダラートの 8 マスは警告なし');
  ok(hasWarn('group: G\ngroup: G\n', /2 回あります/), '同じグループの行は警告');
  ok(hasWarn('group: G\n  cause: H\n', /見つかりません/), '関係の相手がなければ警告');
}

// ---- エラー
{
  ok(hasErr('# 見出し\n', /見出し/), '見出しはエラー');
  ok(hasErr('1. 案\n', /番号付き/), '番号付きのリストはエラー');
  ok(hasErr('* 案\n', /リストの印/), '* のリストはエラー');
  ok(hasErr('- 案\n  - 子\n', /「- 」の行は書けません/), 'アイディアの下の - はエラー');
  ok(hasErr('by: 青木\n', /字下げして/), '字下げしない属性はエラー');
  ok(hasErr('- 案\n  説明の文\n', /説明の文/), '説明の文はエラー');
  ok(hasErr('- 案\n  foo: x\n', /書けません/), '知らない予約語はエラー');
  ok(hasErr('- 案\n  by: a\n  by: b\n', /2 回/), '1 回だけの属性の重複はエラー');
  ok(hasErr('- 案\n  decision: yes\n', /判断/), 'decision の値はエラー');
  ok(hasErr('- 案\n  from: scamper 拡大\n', /観点にありません/), 'SCAMPER の観点にないものはエラー');
  ok(hasErr('- 案\n  from: scamper\n', /観点を書きます/), 'SCAMPER の観点がなければエラー');
  ok(hasErr('- 案\n  from: triz 41\n', /観点にありません/), 'TRIZ の番号の範囲');
  ok(!hasErr('- 案\n  from: triz 36\n', /./), 'TRIZ の 36 は書ける');
  ok(hasErr('- 案\n  from: kj 見出し\n', /観点がありません/), '観点のない手法に観点はエラー');
  ok(hasErr('- 案\n  group: A::\n', /::/), 'グループの名前の :: の前後が空ならエラー');
  ok(hasErr('　- 案\n', /全角空白/), '字下げの全角空白はエラー');
  ok(hasErr('theme:\n', /値がありません/), '値のない共通項目はエラー');
  ok(!errs('- URL は http://x.jp\n  by: a // 注\n  from: direct\n').length, '// は空白の後だけ注');
}

// ---- 書き換え
{
  const E = Igen.Edit;
  let r = Igen.analyze('');
  let x = E.setCommon(r, 'theme', '新しいテーマ');
  ok(x.text === 'theme: 新しいテーマ\n', '空のテキストにテーマを書く');
  r = Igen.analyze(x.text);
  x = E.addIdea(r, '案 1', '青木', ['direct']);
  ok(!x.error && Igen.analyze(x.text).ideas.length === 1 && !warns(x.text).length, 'アイディアを足す');
  r = Igen.analyze(x.text);
  x = E.addIdea(r, '案 2', '青木', ['scamper 代用する', '案 1']);
  r = Igen.analyze(x.text);
  ok(r.ideas[1].parents[0] === r.ideas[0], '元のアイディア付きで足す');
  x = E.rename(r, r.ideas[0].id, '案 1 改');
  r = Igen.analyze(x.text);
  ok(r.ideas[1].froms[1].ref === '案 1 改' && !warns(x.text).length, '名前を変えると参照も変わる');
  x = E.setAttr(r, r.ideas[0].id, 'who', '学生');
  r = Igen.analyze(x.text);
  ok(r.ideas[0].w5.who === '学生', '属性を足す');
  x = E.setAttr(r, r.ideas[0].id, 'who', '');
  r = Igen.analyze(x.text);
  ok(r.ideas[0].w5.who === null, '属性を消す');
  ok(E.setAttr(r, r.ideas[0].id, 'note', 'a // b').error, '空白 + // は書けない');
  x = E.addToGroup(r, [r.ideas[0].id, r.ideas[1].id], '大::小');
  r = Igen.analyze(x.text);
  ok(r.groupMap.get('大::小').members.length === 2 && r.groupMap.get('大').children.length === 1, 'グループに入れる');
  x = E.renameGroup(r, '大', '上');
  r = Igen.analyze(x.text);
  ok(r.groupMap.has('上::小') && !r.groupMap.has('大'), '上位グループの名前を変えると下位も変わる');
  x = E.setGroupNote(r, '上', '説明');
  r = Igen.analyze(x.text);
  ok(r.groupMap.get('上').note === '説明', 'グループの行がなくても説明を書ける');
  x = E.addRelation(r, '上', 'cause', '上::小');
  r = Igen.analyze(x.text);
  ok(r.rels.length === 1, '関係を足す');
  x = E.renameGroup(r, '上::小', '上::中');
  r = Igen.analyze(x.text);
  ok(r.rels[0].to.path === '上::中', 'グループの名前を変えると関係の相手も変わる');
  x = E.removeRelation(r, '上', 0);
  r = Igen.analyze(x.text);
  ok(r.rels.length === 0, '関係を消す');
  x = E.removeFromGroup(r, r.ideas[0].id, '上::中');
  r = Igen.analyze(x.text);
  ok(r.groupMap.get('上::中').members.length === 1, 'グループから外す');
  x = E.setSummary(r, ['一つ目', '二つ目']);
  r = Igen.analyze(x.text);
  ok(r.summary.join('|') === '一つ目|二つ目', 'まとめを書く');
  x = E.setSummary(r, ['一つ目']);
  r = Igen.analyze(x.text);
  ok(r.summary.join('|') === '一つ目', 'まとめを減らす');
  x = E.setAttr(r, r.ideas[0].id, 'decision', 'adopt');
  r = Igen.analyze(x.text);
  ok(r.ideas[0].decision === 'adopt', '判断を書く');
  x = E.remove(r, r.ideas[0].id);
  r = Igen.analyze(x.text);
  ok(r.ideas.length === 1 && hasWarn(x.text, /見つかりません/), '消すと参照は警告になる');
  // 注を保つ
  r = Igen.analyze('- 案 // 注\n  by: a // 注2\n  from: direct\n');
  x = E.setAttr(r, r.ideas[0].id, 'by', 'b');
  ok(x.text.includes('by: b // 注2'), '書き換えても行の注を保つ');
  x = E.rename(r, r.ideas[0].id, '新');
  ok(x.text.startsWith('- 新 // 注'), '名前を変えても行の注を保つ');
}


// ---- 第 2 段: 蜂の巣ノート・マトリックス法・観点の並び・セブンクロス・マインドマップ・候補比較
{
  const r = Igen.analyze(sample);
  ok(r.sheets.get('theme').nodes.length === 2, '蜂の巣ノートのシート');
  const hl = Igen.hexLayout(r, null);
  const cells = [...hl.pos.values()].map((x) => x.join(','));
  ok(new Set(cells).size === cells.length, '蜂の巣ノートの枠が重ならない');
  const big = `theme: T\n${Array.from({ length: 20 }, (_, i) => `- h${i}\n  by: a\n  from: honeycomb\n`).join('')}`;
  const hb = Igen.hexLayout(Igen.analyze(big), null);
  const cb = [...hb.pos.values()].map((x) => x.join(','));
  ok(new Set(cb).size === 21 && !warns(big).length, '蜂の巣ノートで隣が埋まっても、重ならずに置く');
  ok(r.matrices.length === 1 && r.matrices[0].rows.join() === '学生,教員', 'マトリックスの項目');
  ok(Igen.checklistIdeas(r, 'triz', null, '10').length === 1, 'TRIZ の観点のアイディア');
  ok(Igen.checklistIdeas(r, 'sixhats', r.ideas[0].id, '黒').length === 1, 'シックスハットは対象付き');
  ok(Igen.sevenClasses(r).join() === '探す,届ける,落とさない', 'セブンクロスの分類');
  const cd = Igen.compareData(r);
  ok(cd.musts.length === 1 && cd.crits.length === 2, '比較の観点');
  const top = cd.rows.find((x) => x.n.name === '写真と地図で探せる落とし物ページ');
  ok(top.total === 13 && !top.ng, '合計は重み × 評価の和(2 × 5 + 3)');
  ok(cd.rows.find((x) => x.n.name === '学生証にタグを付ける').ng, '必須の条件が ng なら印を付ける');
  ok(cd.rows.find((x) => x.n.name === '退室前に忘れ物を知らせる放送').total === null, '未評価があれば合計を出さない');
  ok(!cd.rows.some((x) => x.n.decision === 'drop'), '比較の表に見送りの案を入れない');
  const kids = Igen.mindTree(r);
  ok(kids.get(null).length === 13 && kids.get(r.ideas[0]).length === 4, 'マインドマップの木は最初の元のアイディアでつなぐ');
}
{
  // 警告とエラー
  ok(hasErr('- a\n  from: matrix 学生\n', /縦の項目 × 横の項目/), 'マトリックスの観点は「縦 × 横」');
  ok(hasWarn('- a\n  by: x\n  from: matrix 学生 × 図書館\n', /組み合わせのマトリックスがありません/), 'マトリックスにない組み合わせは警告');
  ok(hasErr('matrix: M\n  row: A×B\n', /×/), 'マトリックスの項目に × は書けない');
  ok(hasErr('- a\n  rank: 探す 8\n', /1〜7/), '重要度は 1〜7');
  ok(hasWarn('- a\n  by: x\n  from: direct\n  rank: 探す 1\n', /class: にありません/), '分類がなければ警告');
  ok(hasErr('criterion: C\n- a\n  score: C 6\n', /1〜5/), '評価は 1〜5');
  ok(hasErr('must: C\n- a\n  score: C 3\n', /ok か ng/), '必須の条件は ok か ng');
  ok(hasWarn('- a\n  by: x\n  from: direct\n  score: なし 3\n', /criterion: にも must: にもありません/), '観点がなければ警告');
  ok(hasErr('criterion: C\n  weight: 0\n', /0 より大きい/), '重みは 0 より大きい');
  ok(hasWarn('- a\n  by: x\n  from: b\n- b\n  by: x\n  from: a\n', /循環/), '元のアイディアの循環は警告');
  const cyc = Igen.analyze('- a\n  by: x\n  from: b\n- b\n  by: x\n  from: a\n- c\n  by: x\n  from: a\n');
  ok(cyc.ok && Igen.mindTree(cyc).get(null).length >= 2, '循環があってもマインドマップを描ける');
  ok(/^<svg/.test(Igen.render(cyc, 'mindmap', {})), '循環があってもマインドマップの図を描く');
  ok(!errs('- a\n  by: x\n  from: sixhats 白\n- b\n  by: x\n  from: osborn 結合\n').length, 'シックスハットとオズボーンの観点');
  ok(hasErr('- a\n  from: sixhats 紫\n', /観点にありません/), 'シックスハットの観点にない色はエラー');
}
{
  // 書き換え
  const E = Igen.Edit;
  let r = Igen.analyze('theme: T\nauthor: a\n- x\n  by: a\n  from: direct\n');
  let x = E.addMatrix(r, 'M');
  r = Igen.analyze(x.text);
  x = E.addMatrixItem(r, 'M', 'row', '学生'); r = Igen.analyze(x.text);
  x = E.addMatrixItem(r, 'M', 'col', '教室'); r = Igen.analyze(x.text);
  ok(r.matrices[0].rows[0] === '学生' && r.matrices[0].cols[0] === '教室', 'マトリックスを作り、項目を足す');
  x = E.addIdea(r, '案', 'a', ['matrix 学生 × 教室']); r = Igen.analyze(x.text);
  ok(!warns(x.text).length, 'マトリックスのマスに書く');
  ok(E.removeMatrixItem(r, 'M', 'row', '学生').error, '使っている項目は消せない');
  x = E.setSevenAxis(r, '軸'); r = Igen.analyze(x.text);
  x = E.addSevenClass(r, '甲'); r = Igen.analyze(x.text);
  x = E.setRank(r, r.ideas[0].id, '甲', 3); r = Igen.analyze(x.text);
  ok(r.ideas[0].ranks[0].level === 3, '重要度を付ける');
  x = E.setRank(r, r.ideas[0].id, '甲', 1); r = Igen.analyze(x.text);
  ok(r.ideas[0].ranks.length === 1 && r.ideas[0].ranks[0].level === 1, '重要度を変える');
  x = E.renameSevenClass(r, '甲', '乙'); r = Igen.analyze(x.text);
  ok(r.ideas[0].ranks[0].cls === '乙' && r.seven.classes[0] === '乙', '分類の名前を変えると重要度の行も変わる');
  ok(E.removeSevenClass(r, '乙').error, '使っている分類は消せない');
  x = E.setRank(r, r.ideas[0].id, '乙', null); r = Igen.analyze(x.text);
  x = E.removeSevenClass(r, '乙'); r = Igen.analyze(x.text);
  ok(!r.seven.classes.length, '分類を消す');
  x = E.addCriterion(r, '速さ', false, '2'); r = Igen.analyze(x.text);
  x = E.addCriterion(r, '予算', true, ''); r = Igen.analyze(x.text);
  ok(r.criteria.length === 2 && r.criteria[0].weight === 2 && r.criteria[1].must, '観点を足す');
  x = E.setScore(r, r.ideas[0].id, '速さ', '4'); r = Igen.analyze(x.text);
  x = E.setScore(r, r.ideas[0].id, '予算', 'ok'); r = Igen.analyze(x.text);
  ok(r.ideas[0].scores.get('速さ').value === 4 && r.ideas[0].scores.get('予算').value === 'ok', '評価を書く');
  ok(E.setScore(r, r.ideas[0].id, '速さ', '9').error, '範囲外の評価は書き込まない');
  x = E.renameCriterion(r, '速さ', '早さ'); r = Igen.analyze(x.text);
  ok(r.ideas[0].scores.has('早さ'), '観点の名前を変えると評価の行も変わる');
  x = E.setCriterionWeight(r, '早さ', '3'); r = Igen.analyze(x.text);
  ok(r.criteria[0].weight === 3, '重みを変える');
  ok(E.removeCriterion(r, '早さ').error, '使っている観点は消せない');
  x = E.setScore(r, r.ideas[0].id, '早さ', ''); r = Igen.analyze(x.text);
  x = E.removeCriterion(r, '早さ'); r = Igen.analyze(x.text);
  ok(r.criteria.length === 1 && !/weight/.test(x.text), '観点を消すと重みの行も消える');
}


// ---- 第 3 段: 欠点列挙法・希望点列挙法・特性列挙法・ポジショニング・ストーリーボード・既存調査
{
  const r = Igen.analyze(sample);
  const tgt = r.ideas.find((n) => n.name === '落とし物の一覧を掲示板に出す');
  const items = Igen.listingItems(r, 'defects', tgt.id, '欠点');
  ok(items.length === 1 && Igen.listingImprovements(r, 'defects', items[0]).length === 1, '欠点と改善案');
  ok(Igen.listingItems(r, 'wishes', null, '希望点').length === 1, '希望点(対象はテーマ)');
  ok(Igen.listingItems(r, 'attributes', null, '名詞的').length === 1, '特性列挙法の名詞的特性');
  ok(r.posmaps.length === 1 && r.posmaps[0].x.lo === '費用が安い' && r.posmaps[0].y.hi === '効果が大きい', 'ポジショニングの軸');
  ok(r.ideas.filter((n) => n.pos.has('費用と効果')).length === 3, 'ポジショニングに置いた案');
  ok(r.ideas.find((n) => n.decision === 'adopt').scenes.length === 4, 'ストーリーボードの場面');
  ok(r.researches.length === 1 && r.researches[0].fors[0].target.decision === 'adopt', '既存調査の関係する案');
  ok(hasWarn('- a\n  by: x\n  from: defects 改善案\n', /元の欠点/), '元の欠点のない改善案は警告');
  ok(hasErr('- a\n  from: defects 不満\n', /観点にありません/), '欠点列挙法の観点');
  ok(hasErr('- a\n  pos: M 6 0\n', /-5〜5/), '位置は -5〜5');
  ok(hasWarn('- a\n  by: x\n  from: direct\n  pos: M 1 1\n', /ポジショニング「M」がありません/), 'ポジショニングの図がなければ警告');
  ok(hasErr('positioning: M\n  x: 安い\n', /\.\./), '軸は「低い .. 高い」');
  ok(hasWarn('research: R\n  for: ない案\n', /見つかりません/), '既存調査の関係する案がなければ警告');
  ok(!errs('research: R\n  url: https://example.com/a\n').length, 'URL の // は注にならない');
}
{
  const E = Igen.Edit;
  let r = Igen.analyze('theme: T\n- 案\n  by: a\n  from: direct\n');
  let x = E.addScene(r, r.ideas[0].id, '一つ目'); r = Igen.analyze(x.text);
  x = E.addScene(r, r.ideas[0].id, '二つ目'); r = Igen.analyze(x.text);
  x = E.moveScene(r, r.ideas[0].id, 1, -1); r = Igen.analyze(x.text);
  ok(r.ideas[0].scenes.map((a) => a.text).join() === '二つ目,一つ目', '場面を入れ替える');
  x = E.setScene(r, r.ideas[0].id, 0, ''); r = Igen.analyze(x.text);
  ok(r.ideas[0].scenes.length === 1, '場面を消す');
  x = E.addPosMap(r, '図'); r = Igen.analyze(x.text);
  x = E.setPosAxis(r, '図', 'x', '安い .. 高い'); r = Igen.analyze(x.text);
  ok(r.posmaps[0].x.hi === '高い', '軸を書く');
  ok(E.setPosAxis(r, '図', 'y', '小さい').error, '「..」のない軸は書き込まない');
  x = E.setPos(r, r.ideas[0].id, '図', 3, -2); r = Igen.analyze(x.text);
  ok(r.ideas[0].pos.get('図').x === 3 && r.ideas[0].pos.get('図').y === -2, '位置を書く');
  x = E.setPos(r, r.ideas[0].id, '図', 9, 9); r = Igen.analyze(x.text);
  ok(r.ideas[0].pos.get('図').x === 5, '位置は -5〜5 にそろえる');
  x = E.setPos(r, r.ideas[0].id, '図', null); r = Igen.analyze(x.text);
  ok(!r.ideas[0].pos.size, '図から外す');
  x = E.addResearch(r, '他社の例', 'https://example.com', '案'); r = Igen.analyze(x.text);
  ok(r.researches[0].fors[0].target === r.ideas[0] && r.researches[0].url === 'https://example.com', '既存調査を足す');
  x = E.setResearchAttr(r, '他社の例', 'diff', '地図がない'); r = Igen.analyze(x.text);
  ok(r.researches[0].diff === '地図がない', '違いを書く');
  x = E.rename(r, r.ideas[0].id, '新しい案'); r = Igen.analyze(x.text);
  ok(r.researches[0].fors[0].attr.text === '新しい案' && !warns(x.text).length, '案の名前を変えると既存調査の for: も変わる');
  x = E.removeResearchFor(r, '他社の例', 0); r = Igen.analyze(x.text);
  ok(!r.researches[0].fors.length, '関係する案を外す');
  x = E.removeResearch(r, '他社の例'); r = Igen.analyze(x.text);
  ok(!r.researches.length && !/diff|url/.test(x.text), '既存調査を消す');
}


// ---- レビューの指摘(H1〜L7)の回帰試験
const safe = (f) => { try { return f(); } catch (e) { return { thrown: e.message }; } };
{
  const E = Igen.Edit;
  // H1・L4: 全角空白・NBSP
  const fw = '- 写真　アプリ\n  by: a\n  from: direct\n- B\n  by: a\n  from: 写真　アプリ\n';
  const r1 = safe(() => Igen.analyze(fw));
  ok(!r1.thrown && r1.ok && r1.ideas[1].parents[0] === r1.ideas[0], 'H1: 全角空白を含む名前を from: で参照できる');
  ok(!safe(() => Igen.analyze('- a\n  by: x\n  from: 　x\n')).thrown, 'H1: from: の先頭の全角空白で止まらない');
  ok(!safe(() => Igen.analyze('- a\n  by: x\n  from: x y\n')).thrown, 'H1: from: の NBSP で止まらない');
  const r1b = Igen.analyze('- a\n  by: x\n  from: scamper　代用する\n');
  ok(r1b.ok && r1b.ideas[0].methods[0]?.vp === '代用する', 'H1: 手法名と観点の間の全角空白も区切りとして読む');
  ok(hasErr('- 　名前\n', /全角/), 'L4: 「- 」の後ろの全角空白はエラー');
  const r4 = Igen.analyze('- 名前　\n  by: 青木　\n  from: direct\n');
  ok(r4.ideas[0].name === '名前' && r4.ideas[0].by === '青木', 'L4: 名前と値の前後の全角空白は除く');
  let r = Igen.analyze('theme: T\n- 写真　アプリ\n  by: a\n  from: direct\n');
  const x1 = safe(() => E.addIdea(r, '子', 'a', ['mindmap', '写真　アプリ']));
  ok(!x1.thrown && !x1.error && !warns(x1.text).length, 'H1: 全角空白を含む名前の枠から書き足せる');
  // M1: 手法名で始まる名前
  r = Igen.analyze('- 親\n  by: a\n  from: direct\n- 子\n  by: a\n  from: mindmap\n  from: 親\n');
  ok(E.rename(r, r.ideas[0].id, 'direct').error, 'M1: 手法名の名前には変えられない');
  ok(E.rename(r, r.ideas[0].id, 'scamper 代用する').error, 'M1: 手法名で始まる名前には変えられない');
  ok(E.addIdea(r, 'kj まとめ', 'a', ['direct']).error, 'M1: 手法名で始まる名前のアイディアは足せない');
  ok(hasWarn('- kj まとめ\n  by: a\n  from: direct\n', /手法名/), 'M1: 手で書いた手法名で始まる名前は警告');
  // M2: 既存の名前への変更
  r = Igen.analyze('- A\n  by: a\n  from: direct\n- B\n  by: a\n  from: direct\n- C\n  by: a\n  from: mindmap\n  from: B\n');
  ok(E.rename(r, r.ideas[0].id, 'B').error, 'M2: 既存の名前には変えられない');
  // M3: 同じ名前のアイディアは元として指せない
  r = Igen.analyze('- X\n  by: a\n  from: direct\n- X\n  by: b\n  from: direct\n');
  ok(E.addIdea(r, '新', 'a', ['scamper 代用する', 'X']).error, 'M3: 同じ名前が 2 つある元は指せない');
  ok(Igen.refOk(r, r.ideas[0]) === false, 'M3: 同じ名前のアイディアは対象にできない');
  // M7: 消したアイディアの鍵は、同じ名前の別のアイディアを指さない
  ok(E.locate(r, { name: 'X', nth: 2 }) === null, 'M7: 見つからない鍵は null');
  // M4: グループの名前を変えても、短い名前の関係を保つ
  r = Igen.analyze('group: A::X\n  relate: Y\ngroup: B::Y\n');
  let x = E.renameGroup(r, 'A::X', 'A::Y');
  ok(!x.error && Igen.analyze(x.text).rels.length === 1 && Igen.analyze(x.text).rels[0].to.path === 'B::Y', 'M4: 名前を変えても関係の相手が変わらない(例 1)');
  r = Igen.analyze('group: G1\n  relate: X\ngroup: P::X\ngroup: Q::Z\n');
  x = E.renameGroup(r, 'Q::Z', 'Q::X');
  ok(!x.error && Igen.analyze(x.text).rels[0]?.to.path === 'P::X', 'M4: 関係のないグループの関係を壊さない(例 2)');
  // M5: 重なったブロック
  r = Igen.analyze('criterion: 費用\ncriterion: 費用\n');
  x = E.renameCriterion(r, '費用', '効果');
  ok(!/費用/.test(x.text), 'M5: 観点の名前の変更は、重なったブロックもすべて書き換える');
  x = E.removeCriterion(r, '費用');
  ok(!/費用/.test(x.text), 'M5: 観点を消すと、重なったブロックもすべて消す');
  r = Igen.analyze('- 案\n  by: a\n  from: direct\nresearch: R\n  for: 案\nresearch: R\n  for: 案\n');
  x = E.rename(r, r.ideas[0].id, '新しい案');
  ok(!/for: 案$/m.test(x.text), 'M5: 既存調査が重なっても、すべての for: を書き換える');
  r = Igen.analyze('group: G\ngroup: G\n  relate: H\ngroup: H\n');
  x = E.renameGroup(r, 'H', 'H2');
  ok(/relate: H2/.test(x.text), 'M5: 2 つ目の group: の行の下の関係も書き換える');
  r = Igen.analyze('theme: A\ntheme: B\n');
  x = E.setCommon(r, 'theme', 'C');
  ok(!warns(x.text).length && Igen.analyze(x.text).theme === 'C' && !/theme: B/.test(x.text), 'M5: テーマを書くと、重なった theme: もそろえる');
  x = E.setCommon(r, 'theme', '');
  ok(!/theme:/.test(x.text), 'M5: テーマを空にすると、すべての theme: を消す');
  // M6: マトリックスの組み合わせの重なり
  r = Igen.analyze('matrix: M1\n  row: 学生\n  col: 朝\nmatrix: M2\n  row: 学生\n');
  ok(E.addMatrixItem(r, 'M2', 'col', '朝').error, 'M6: ほかのマトリックスと同じ組み合わせになる項目は足せない');
  ok(hasWarn('matrix: M1\n  row: 学生\n  col: 朝\nmatrix: M2\n  row: 学生\n  col: 朝\n', /同じ組み合わせ/), 'M6: 手で書いた重なりは警告');
  // M8: 深い入力
  const deep = Array.from({ length: 3000 }, (_, i) => `- n${i}\n  by: a\n  from: ${i ? `n${i - 1}` : 'direct'}\n`).join('');
  const rd = Igen.analyze(deep);
  ok(!safe(() => Igen.render(rd, 'mindmap', {})).thrown, 'M8: 3000 段のつながりでもマインドマップを描ける');
  ok(!safe(() => Igen.printPages(rd)).thrown, 'M8: 3000 段のつながりでも印刷のページを作れる');
  const gdeep = `- a\n  by: x\n  from: direct\n  group: ${Array.from({ length: 3000 }, (_, i) => `g${i}`).join('::')}\n`;
  const rg = safe(() => Igen.analyze(gdeep));
  ok(!rg.thrown && !safe(() => Igen.render(rg, 'kj', {})).thrown, 'M8: 3000 段のグループの入れ子でも解析して描ける');
  const many = Array.from({ length: 12000 }, (_, i) => `- n${i}\n  by: a\n  from: direct\n`).join('');
  const t0 = Date.now(); Igen.analyze(many); const dt = Date.now() - t0;
  ok(dt < 3000, `M8: 12000 件の解析が 3 秒以内(${dt} ms)`);
  // L2: 制御文字
  const rc = Igen.analyze('- a\u000bb\n  by: x\n  from: direct\n');
  ok(!/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(Igen.render(rc, 'list', {})), 'L2: SVG に制御文字を入れない');
  // L3: 途中の BOM
  ok(!errs('theme: T\n﻿theme: T\n- a\n  by: x\n  from: direct\n').length, 'L3: 途中の BOM はエラーにしない');
  // L5: 属性の順が違っても同じなら警告
  ok(hasWarn('- a\n  by: x\n  from: direct\n  note: n\n- a\n  note: n\n  by: x\n  from: direct\n', /すべて同じ/), 'L5: 属性の順が違っても、同じなら警告');
  // L6: 既存のグループの名前には変えない(版 0.6 で R2 に合わせて、まとめるのをやめ、断るように変えた)
  r = Igen.analyze('- a\n  by: x\n  from: direct\n  group: X\n  group: Y\n');
  x = E.renameGroup(r, 'X', 'Y');
  ok(x.error && !x.text, 'L6: 既存のグループの名前には変えない');
}

// ---- AI に相談する文(仕様書 2.6 節)
{
  const block = (p) => /```\n([\s\S]*?)\n```/.exec(p)?.[1] ?? null;
  const paste = (t, p, name) => Igen.analyze(`${t}\n${block(p).replace('案の名前', name)}\n`);
  const r = Igen.analyze(sample);
  for (const v of Igen.VIEWS) {
    const p = Igen.consultPrompt(r, v.id, {}, '似た案しか出ない');
    ok(p.includes(r.theme) && p.includes(`「${v.label}」`) && p.includes(v.phase === 'd' ? '発散のフェーズ' : '収束のフェーズ') && p.includes('似た案しか出ない'), `相談の文(${v.id})にテーマ・フェーズ・手法・困っていることが入る`);
    ok(block(p) && !paste(sample, p, `AI の案 ${v.id}`).diags.some((d) => d.level === 'error'), `相談の文(${v.id})の書き方のとおりに貼ってもエラーにならない`);
    ok(!p.includes('summary:') && !p.includes('  by: 青木'), `相談の文(${v.id})にテキスト全体を入れない`);
  }
  // 盤面に空きがある小さなテキストでは、貼っても警告が増えない
  const small = 'theme: T\nauthor: a\n- A\n  by: a\n  from: direct\nmatrix: M\n  row: r1\n  col: c1\nsevencross: S\n  class: C\npositioning: P\n  x: lo .. hi\n  y: lo .. hi\n';
  const rs = Igen.analyze(small);
  for (const v of Igen.VIEWS) {
    const r2 = paste(small, Igen.consultPrompt(rs, v.id, {}, ''), `AI の案 ${v.id}`);
    const extra = r2.diags.filter((d) => !/周りのマスに空き/.test(d.message)); // マンダラートの空きの警告は仕様どおり(4.2 節)
    ok(extra.length === rs.diags.length, `相談の文(${v.id})のとおりに貼っても警告が増えない(${extra.map((d) => d.message).join(' / ')})`);
  }
  ok(Igen.consultPrompt(rs, 'list', {}, '').includes('(書いていません。'), '困っていることが空なら、状況から考えるよう頼む');
  // 対象・中心として、元として指せないアイディアは from: に書かせない
  const rd = Igen.analyze('theme: T\n- X\n  by: a\n  from: direct\n- X\n  by: b\n  from: direct\n');
  const pd = Igen.consultPrompt(rd, 'scamper', { cl: { scamper: { target: rd.ideas[0].id, vp: 0 } } }, '');
  ok(!/from: X$/m.test(block(pd)), '同じ名前のアイディアは、相談の文の from: に書かせない');
  const pt = Igen.consultPrompt(r, 'scamper', { cl: { scamper: { target: r.ideas[0].id, vp: 1 } } }, '');
  ok(block(pt).includes('from: scamper 組み合わせる') && block(pt).includes(`from: ${r.ideas[0].name}`) && pt.includes('何かと組み合わせたら?'), '対象と観点(問い)を相談の文に入れる');
  // 多いときは 80 件までにする
  const many = Igen.analyze(`theme: T\n${Array.from({ length: 200 }, (_, i) => `- 案${i}\n  by: a\n  from: direct\n`).join('')}`);
  ok(Igen.consultPrompt(many, 'list', {}, '').includes('ほか 120 件'), 'アイディアを並べるのは 80 件までにする');
  // 選んでいるアイディアの 5W1H を入れる
  const adopt = r.ideas.find((n) => n.decision === 'adopt');
  ok(Igen.consultPrompt(r, 'elim', { sel: [adopt.id] }, '').includes(`選んでいるアイディア: 「${adopt.name}」`), '選んでいるアイディアを相談の文に入れる');
}

// ---- レビュー(版 0.5)の指摘の回帰試験
{
  const E = Igen.Edit;
  const block = (p) => /```\n([\s\S]*?)\n```/.exec(p)?.[1] ?? null;
  // R2: 既存のグループの名前には変えられない
  let r = Igen.analyze('- a\n  by: x\n  from: direct\n  group: A\n- b\n  by: x\n  from: direct\n  group: B\ngroup: A\n  note: A の説明\n  relate: B\ngroup: B\n  note: B の説明\n');
  ok(E.renameGroup(r, 'A', 'B').error, 'R2: 既存のグループの名前には変えられない');
  r = Igen.analyze('- a\n  by: x\n  from: direct\n  group: P::C\n');
  ok(E.renameGroup(r, 'P::C', 'P').error, 'R2: 上位のグループの名前にも変えられない');
  r = Igen.analyze('- a\n  by: x\n  from: direct\n  group: P::C\n- b\n  by: x\n  from: direct\n  group: C\n');
  ok(E.renameGroup(r, 'P', 'C').error, 'R2: 下位を含めて、変えた後の名前が既存のグループと重なるなら変えられない');
  ok(!E.renameGroup(r, 'P', 'Q').error, 'R2: 重ならない名前には変えられる');
  // 見つからない参照の名前への変更(判断待ちだったもの。案 A)
  r = Igen.analyze('- A\n  by: a\n  from: direct\n- X\n  by: a\n  from: mindmap\n  from: B\n');
  ok(E.rename(r, r.ideas[0].id, 'B').error, '見つからない from: が使っている名前には変えられない');
  r = Igen.analyze('- A\n  by: a\n  from: direct\nresearch: R\n  for: B\n');
  ok(E.rename(r, r.ideas[0].id, 'B').error, '見つからない for: が使っている名前には変えられない');
  // N2: 例にするマスがないマトリックスでは、貼るとエラーになるテンプレートを出さない
  for (const t of ['theme: T\nmatrix: M\n  row: r1\n', 'theme: T\n']) {
    const p = Igen.consultPrompt(Igen.analyze(t), 'matrix', {}, '');
    const b = block(p);
    ok((b === null || !Igen.analyze(`${t}${b.replace('案の名前', '新')}\n`).diags.some((d) => d.level === 'error')) && p.includes('縦の項目と横の項目'), `N2: マスのないマトリックスで、貼るとエラーになるテンプレートを出さない(${JSON.stringify(t)})`);
  }
  // N3: 元として指せない名前に印を付け、指せる案だけを元に書くよう伝える
  r = Igen.analyze('theme: T\n- scamper 的な発想\n  by: a\n  from: direct\n- X\n  by: a\n  from: direct\n- X\n  by: b\n  from: direct\n');
  let p = Igen.consultPrompt(r, 'kj', {}, '');
  ok(p.includes('「scamper 的な発想」(元には指せません)') && p.includes('「X」(元には指せません)') && /元には指せません」と印のある案は、from: に書かない/.test(p), 'N3: 指せない名前に印を付け、from: に書かないよう伝える');
  // N4: 指せない案を元に選んでいても、状況とテンプレートが食い違わない
  p = Igen.consultPrompt(r, 'mindmap', { mmParent: r.ideas[2].id }, '');
  ok(!/from: X$/m.test(block(p)) && p.includes('伸ばす元: 「X」(元には指せません)'), 'N4: 指せない伸ばす元は、状況にその旨を書き、from: に書かせない');
  const rl = Igen.analyze('theme: T\n- kj が遅い\n  by: a\n  from: defects 欠点\n');
  p = Igen.consultPrompt(rl, 'defects', { lsItem: rl.ideas[0].id }, '');
  ok(!block(p).includes('改善案') && p.includes('「kj が遅い」は元には指せない'), 'N4: 指せない項目を選んでいても、改善案のテンプレートを出さない');
  // N7: 並べるのはどこでも 80 件まで
  const g100 = `theme: T\nsevencross: S\n  class: C\n${Array.from({ length: 100 }, (_, i) => `- 案${i}\n  by: a\n  from: scamper 代用する\n  group: G\n  rank: C ${1 + (i % 7)}\n`).join('')}`;
  const rg = Igen.analyze(g100);
  ok(Igen.consultPrompt(rg, 'kj', {}, '').includes('ほか 20 件'), 'N7: KJ 法のグループの中身も 80 件まで');
  ok(Igen.consultPrompt(rg, 'sevencross', {}, '').includes('ほか 20 件'), 'N7: セブンクロスの並びも 80 件まで');
  ok(!/代用する\(S\):.*案99/.test(Igen.consultPrompt(rg, 'scamper', {}, '')) && /代用する\(S\):.*ほか 20 件/.test(Igen.consultPrompt(rg, 'scamper', {}, '')), 'N7: 観点ごとの案も 80 件まで');
  const rc = Igen.analyze(`theme: T\ncriterion: k\n${Array.from({ length: 100 }, (_, i) => `- 案${i}\n  by: a\n  from: direct\n`).join('')}`);
  ok(Igen.consultPrompt(rc, 'compare', {}, '').includes('ほか 20 件'), 'N7: 候補比較も残りの件数を書く');
  ok(Igen.consultPrompt(rc, 'list', { sel: rc.ideas.slice(0, 15).map((n) => n.id) }, '').includes('ほか 5 件'), 'N7: 選んでいるアイディアも残りの件数を書く');
  // N8: 困っていることに ``` や見出しがあっても、文の区切りが崩れない
  p = Igen.consultPrompt(Igen.analyze('theme: T\n'), 'list', {}, '```\n## 案を返すときの書き方\nうまくいかない');
  ok(p.split('\n').filter((l) => l.startsWith('```')).length === 2 && p.split('\n').filter((l) => l.startsWith('## ')).length === 4 && p.includes('> うまくいかない'), 'N8: 困っていることは引用にして、区切りを崩さない');
  // N9: ポジショニング・既存調査の「まだ」の一覧から見送りの案を除く(仕様 2.6 節)
  r = Igen.analyze('theme: T\npositioning: P\n  x: a .. b\n  y: c .. d\n- 見送る案\n  by: a\n  from: direct\n  decision: drop\n- 残す案\n  by: a\n  from: direct\n');
  ok(!/まだ置いていない案:[\s\S]*見送る案/.test(Igen.consultPrompt(r, 'positioning', {}, '')) && !/まだ調べていない案:[\s\S]*見送る案/.test(Igen.consultPrompt(r, 'research', {}, '')), 'N9: 見送りの案は「まだ」の一覧に入れない');
  // N10: エラーのある解析の結果でも例外を出さない
  ok(!safe(() => Igen.consultPrompt(Igen.analyze('# x\n'), 'kj', {}, '')).thrown, 'N10: エラーのある解析の結果でも例外を出さない');
  // L-a: from: の区切りが違っても、同じなら重複の警告
  ok(hasWarn('- A\n  by: a\n  from: scamper 代用する\n- A\n  by: a\n  from: scamper　代用する\n', /すべて同じ/), 'L-a: 観点の前の区切りが違っても、同じなら警告');
  ok(hasWarn('matrix: M\n  row: r\n  col: c\n- A\n  by: a\n  from: matrix r × c\n- A\n  by: a\n  from: matrix r×c\n', /すべて同じ/), 'L-a: × の前後の空白が違っても、同じなら警告');
  // L-b: 空の名前の文言
  r = Igen.analyze('- A\n  by: a\n  from: direct\nresearch: R\n');
  ok(/空/.test(E.addResearchFor(r, 'R', '').error ?? ''), 'L-b: 空の名前は「空」と知らせる');
}

// ---- 修正もれの確認(版 0.6)の回帰試験
{
  // N7: 件数の上限は、どの箇所にも効く(行に並べるときも、1 行に並べるときも)
  const M = 200, nm = (i) => `案${i}`;
  let t = 'theme: T\nmatrix: M\n' + Array.from({ length: 20 }, (_, i) => `  row: r${i}\n`).join('') + Array.from({ length: 20 }, (_, i) => `  col: c${i}\n`).join('');
  t += 'sevencross: S\n' + Array.from({ length: M }, (_, i) => `  class: C${i}\n`).join('');
  t += Array.from({ length: M }, (_, i) => `group: G${i}\n  relate: G${(i + 1) % M}\n`).join('');
  t += '- 主\n  by: a\n  from: direct\n' + Array.from({ length: M }, (_, i) => `  scene: 場面${i}\n`).join('');
  t += Array.from({ length: M }, (_, i) => `- ${nm(i)}\n  by: a\n  from: direct\n  group: G${i}\n`).join('');
  t += 'research: R\n' + Array.from({ length: M }, (_, i) => `  for: ${nm(i)}\n`).join('');
  const r = Igen.analyze(t);
  const story = r.ideas.find((n) => n.name === '主').id;
  for (const v of ['kj', 'matrix', 'sevencross', 'storyboard', 'research']) {
    const L = Igen.consultPrompt(r, v, { story }, '').split('\n');
    const widest = Math.max(...L.map((l) => (l.match(/、/g) ?? []).length + 1));
    const runs = []; let k = 0, pre = null; // 同じ字下げで「- 」か「数. 」で始まる行が続く長さ
    for (const l of L) { const m = /^(\s+)(-|\d+\.) /.exec(l); const key = m ? m[1] : null; if (key !== null && key === pre) k++; else k = key !== null ? 1 : 0; pre = key; runs.push(k); }
    ok(widest <= 81 && Math.max(...runs) <= 81, `N7: ${v} の相談の文は、どこも 80 件まで(1 行の最大 ${widest}、続く行の最大 ${Math.max(...runs)})`);
  }
  // N3: 既存調査の関係する案の名前にも、元として指せない印を付ける
  const r2 = Igen.analyze('theme: T\n- X\n  by: a\n  from: direct\n- X\n  by: b\n  from: direct\nresearch: R\n  for: X\n');
  ok(Igen.consultPrompt(r2, 'research', {}, '').includes('関係する案 「X」(元には指せません)'), 'N3: 既存調査の関係する案の名前にも印を付ける');
}

// ---- 描画: どのビューも描ける
{
  const r = Igen.analyze(sample);
  for (const v of Igen.VIEWS) {
    const s = Igen.render(r, v.id, {});
    ok(/^<svg[\s\S]*<\/svg>$/.test(s), `${v.id} を描ける`);
    const p = Igen.pieces(r, v.id, {});
    ok(!/data-|<title>/.test(p.svg), `${v.id} の保存用の SVG に操作の印がない`);
  }
  ok(Igen.printPages(r).length === 20, `印刷のページ(${Igen.printPages(r).length})`);
  const e = Igen.analyze('');
  for (const v of Igen.VIEWS) ok(/^<svg/.test(Igen.render(e, v.id, {})), `空のテキストで ${v.id} を描ける`);
  const t = Igen.pieces(r, 'w5', {});
  ok(Igen.tsv(t.header, t.rows).split('\n').length === 25, '5W1H の表のタブ区切り(見出し + 23 行)');
}

console.log(`${count - fails} / ${count} 件が通りました`);
process.exit(fails ? 1 : 0);
