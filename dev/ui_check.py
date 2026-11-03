#!/usr/bin/env python3
"""画面の確認(Chrome を Playwright で動かす)。使い方: python3 dev/ui_check.py [画像を置くフォルダ]
主な操作を順に行い、テキストが書いたとおりに変わるかを確かめる。ビューごとの画面の画像も保存する。"""
import pathlib
import sys

from playwright.sync_api import sync_playwright

root = pathlib.Path(__file__).resolve().parent.parent
shots = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else None
fails = []


def check(cond, msg):
    print(('OK  ' if cond else 'NG  ') + msg)
    if not cond:
        fails.append(msg)


with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    ctx = b.new_context(viewport={'width': 1500, 'height': 950}, accept_downloads=True)
    ctx.grant_permissions(['clipboard-read', 'clipboard-write'])
    pg = ctx.new_page()
    errors = []
    pg.on('pageerror', lambda e: errors.append(str(e)))
    pg.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
    pg.on('dialog', lambda d: d.accept())
    pg.goto((root / 'index.html').as_uri())
    src = lambda: pg.eval_on_selector('#src', 'e => e.value')
    view = lambda v: (pg.select_option('#viewKind', v), pg.wait_for_timeout(100))

    # 例: 診断なし、どのビューも描ける
    pg.click('#btnSample')
    pg.wait_for_timeout(300)
    check('エラーと警告はありません' in pg.inner_text('#msg'), '例に診断が出ない')
    for v in ['list', 'mandala', 'honeycomb', 'matrix', 'sixhats', 'osborn', 'scamper', 'triz', 'defects', 'wishes', 'attributes', 'kj', 'sevencross', 'w5', 'mindmap', 'storyboard', 'positioning', 'research', 'compare', 'elim']:
        view(v)
        check(pg.locator('#canvas svg').count() == 1 and pg.locator('#canvas .tbtns button').count() >= 3, f'{v} を描き、題の右に保存のボタンを置く')
        if shots:
            pg.screenshot(path=str(shots / f'{v}.png'), full_page=False)

    # 図の保存と表のコピー
    view('kj')
    with pg.expect_download() as dl:
        pg.click('#canvas .tbtns button:has-text("SVG")')
    svgtext = pathlib.Path(dl.value.path()).read_text(encoding='utf-8')
    check(svgtext.startswith('<?xml') and 'data-' not in svgtext and '探す手間を減らす' in svgtext, 'KJ 法の図を SVG で保存する(操作の印を含まない)')
    view('w5')
    pg.click('#canvas .tbtns button:has-text("コピー")')
    pg.wait_for_timeout(200)
    clip = pg.evaluate('navigator.clipboard.readText()')
    check(clip.split('\n')[0].startswith('案\twho(誰のためか)') and len(clip.strip().split('\n')) == 24, '5W1H の表をタブ区切りでコピーする')

    # 新規から: テーマ・書いた人・アイディア一覧で 2 件足す
    pg.click('#btnNew')
    pg.wait_for_timeout(200)
    view('list')
    pg.fill('[data-role="theme"]', '学食の混雑')
    pg.press('[data-role="theme"]', 'Enter')
    pg.fill('[data-role="author"]', '青木')
    pg.press('[data-role="author"]', 'Enter')
    check(src().startswith('author: 青木\ntheme: 学食の混雑') or ('theme: 学食の混雑' in src() and 'author: 青木' in src()), 'テーマと書いた人を書く')
    for name in ['時間をずらす', '席を予約する']:
        pg.fill('[data-role="add"]', name)
        pg.press('[data-role="add"]', 'Enter')
        pg.wait_for_timeout(50)
    check(f'- 時間をずらす\n  by: 青木\n  from: direct\n- 席を予約する\n  by: 青木\n  from: direct' in src(), '一覧の入力欄から 2 件足す')
    check(pg.eval_on_selector('[data-role="add"]', 'e => e.value') == '' and pg.evaluate('document.activeElement.dataset.role') == 'add', '足した後は入力欄が空で、続けて書ける')

    # マンダラート: 空きのマスを押して書く
    view('mandala')
    pg.click('[data-cell="0"]')
    pg.keyboard.type('メニューを先に選ぶ')
    pg.keyboard.press('Enter')
    check('- メニューを先に選ぶ\n  by: 青木\n  from: mandala' in src(), 'マンダラートのマスに書く')
    check('8 マス中 1 マス' in pg.inner_text('#msg'), 'マンダラートの空きの警告')

    # SCAMPER: 対象を選び、観点の欄を押して書く
    view('scamper')
    pg.select_option('[data-role="target"]', label='席を予約する')
    pg.wait_for_timeout(100)
    pg.click('[data-vp="1"]')
    pg.keyboard.type('予約と注文を組み合わせる')
    pg.keyboard.press('Enter')
    check('- 予約と注文を組み合わせる\n  by: 青木\n  from: scamper 組み合わせる\n  from: 席を予約する' in src(), 'SCAMPER で対象付きで書く')

    # KJ 法: 2 件を選んでグループにし、見出しを変え、関係を足す
    view('kj')
    ids = pg.eval_on_selector_all('#canvas [data-id]', 'es => es.map(e => e.getAttribute("data-id"))')
    pg.click(f'#canvas [data-id="{ids[0]}"]')
    pg.click(f'#canvas [data-id="{ids[1]}"]', modifiers=['Control'])
    pg.fill('[data-role="newgroup"]', '混む時間を避ける')
    pg.press('[data-role="newgroup"]', 'Enter')
    check(src().count('group: 混む時間を避ける') == 2, '選んだ 2 件をグループにする')
    pg.click('#canvas [data-group="混む時間を避ける"]', position={'x': 30, 'y': 12})
    pg.fill('[data-role="gname"]', '時間を分ける')
    pg.press('[data-role="gname"]', 'Enter')
    check(src().count('group: 時間を分ける') == 2 and '混む時間を避ける' not in src(), 'グループの見出しを変える')
    pg.click('#canvas [data-group="時間を分ける"]', position={'x': 30, 'y': 12})
    pg.fill('[data-role="gnote"]', '昼休みに集中する')
    pg.press('[data-role="gnote"]', 'Enter')
    check('group: 時間を分ける\n  note: 昼休みに集中する' in src(), 'グループの説明を書く(group: の行を足す)')
    pg.click('#canvas [data-summary]')
    pg.fill('[data-role="summary"]', '昼休みの集中を分散させる')
    pg.press('[data-role="summary"]', 'Enter')
    check('summary: 昼休みの集中を分散させる' in src(), '全体のまとめを書く')

    # 5W1H: セルを押して書く
    view('w5')
    pg.click('#canvas [data-w5$="|who"]')
    check(pg.evaluate('document.activeElement.dataset.role') == 'w5-who', '5W1H のセルを押すと、その項目の欄に入る')
    pg.keyboard.type('昼に食べる学生')
    pg.keyboard.press('Enter')
    check('  who: 昼に食べる学生' in src(), '5W1H を書く')

    # 判断・消去法
    view('elim')
    first = pg.eval_on_selector('#canvas [data-id]', 'e => e.getAttribute("data-id")')
    pg.click(f'#canvas [data-id="{first}"]')
    pg.select_option('[data-role="decision"]', 'adopt')
    check('  decision: adopt' in src(), '採用を付ける')
    pg.fill('[data-role="reason"]', '費用がかからない')
    pg.press('[data-role="reason"]', 'Enter')
    check('  reason: 費用がかからない' in src(), '理由を書く')

    # 元に戻す(Ctrl+Z)
    before = src()
    pg.focus('#src')
    pg.keyboard.press('Control+z')
    pg.wait_for_timeout(400)
    check('reason: 費用がかからない' not in src() and src() != before, 'Ctrl+Z で図からの書き換えを戻せる')

    # 蜂の巣ノート: 根の隣に書き、その枠の隣にも書く
    view('honeycomb')
    pg.fill('[data-role="add"]', '昼休みを 2 回に分ける')
    pg.press('[data-role="add"]', 'Enter')
    check('- 昼休みを 2 回に分ける\n  by: 青木\n  from: honeycomb\n' in src(), '蜂の巣ノートの根の隣に書く')
    hid = pg.eval_on_selector_all('#canvas [data-id]', 'es => es.map(e => [e.getAttribute("data-id"), e.textContent])')
    pg.click(f'#canvas [data-id="{[i for i, t in hid if "昼休みを 2 回" in t][0]}"]')
    pg.keyboard.type('学年ごとに時間を決める')
    pg.keyboard.press('Enter')
    check('- 学年ごとに時間を決める\n  by: 青木\n  from: honeycomb\n  from: 昼休みを 2 回に分ける' in src(), '蜂の巣ノートで選んだ枠の隣に書く')

    # マトリックス法: 作り、項目を足し、マスに書く
    view('matrix')
    pg.fill('[data-role="newmatrix"]', '対象 × 時間')
    pg.press('[data-role="newmatrix"]', 'Enter')
    pg.fill('[data-role="addrow"]', '学生')
    pg.press('[data-role="addrow"]', 'Enter')
    pg.fill('[data-role="addcol"]', '昼')
    pg.press('[data-role="addcol"]', 'Enter')
    check('matrix: 対象 × 時間\n  row: 学生\n  col: 昼' in src(), 'マトリックスを作り、項目を足す')
    pg.click('#canvas [data-mx="0|0"]')
    pg.keyboard.type('学生証で混雑を見る')
    pg.keyboard.press('Enter')
    check('  from: matrix 学生 × 昼' in src(), 'マトリックスのマスに書く')

    # TRIZ: 観点の欄を押して書く
    view('triz')
    pg.select_option('[data-role="target"]', index=0)
    pg.wait_for_timeout(100)
    pg.click('#canvas [data-vp="0"]')
    pg.keyboard.type('席を区画に分ける')
    pg.keyboard.press('Enter')
    check('- 席を区画に分ける\n  by: 青木\n  from: triz 1\n' in src(), 'TRIZ の観点で書く')

    # セブンクロス: 軸と分類を書き、アイディアを選んでマスに置く
    view('sevencross')
    pg.fill('[data-role="axis"]', '効き目')
    pg.press('[data-role="axis"]', 'Enter')
    pg.fill('[data-role="addclass"]', '混雑')
    pg.press('[data-role="addclass"]', 'Enter')
    check('sevencross: 効き目\n  class: 混雑' in src(), '分類の軸と分類を書く')
    first = pg.eval_on_selector('#canvas [data-id]', 'e => e.getAttribute("data-id")')
    pg.click(f'#canvas [data-id="{first}"]')
    pg.click('#canvas [data-sx="混雑|2"]')
    check('  rank: 混雑 2' in src(), 'アイディアを選んでセブンクロスのマスに置く')

    # マインドマップ: 枠を押して枝を伸ばす
    view('mindmap')
    mid = pg.eval_on_selector_all('#canvas [data-id]', 'es => es.map(e => [e.getAttribute("data-id"), e.textContent])')
    pg.click(f'#canvas [data-id="{[i for i, t in mid if t.startswith("席を予約する")][0]}"]')
    pg.keyboard.type('予約は 10 分前まで')
    pg.keyboard.press('Enter')
    check('- 予約は 10 分前まで\n  by: 青木\n  from: mindmap\n  from: 席を予約する' in src(), 'マインドマップで枝を伸ばす')

    # 候補比較・評価: 観点を足し、セルを押して評価する
    view('compare')
    pg.fill('[data-role="critname"]', '安さ')
    pg.fill('[data-role="critweight"]', '2')
    pg.click('#inbox button:has-text("観点を足す")')
    check('criterion: 安さ\n  weight: 2' in src(), '評価の観点を足す')
    pg.click('#canvas [data-cmp]')
    pg.select_option('[data-role="cmp-安さ"]', '4')
    check('  score: 安さ 4' in src(), '評価を書く')

    # 欠点列挙法: 欠点を書き、欠点を押して改善案を書く
    view('defects')
    pg.select_option('[data-role="target"]', index=0)
    pg.wait_for_timeout(100)
    pg.fill('[data-role="add"]', '列が長い')
    pg.press('[data-role="add"]', 'Enter')
    check('- 列が長い\n  by: 青木\n  from: defects 欠点\n' in src(), '欠点を書く')
    did = pg.eval_on_selector_all('#canvas [data-lsitem]', 'es => es.map(e => [e.getAttribute("data-id"), e.textContent])')
    pg.click(f'#canvas [data-id="{[i for i, t in did if t.startswith("列が長い")][0]}"]')
    check(pg.evaluate('document.activeElement.dataset.role') == 'improve', '欠点を押すと改善案の欄に入る')
    pg.keyboard.type('食券を先に買えるようにする')
    pg.keyboard.press('Enter')
    check('- 食券を先に買えるようにする\n  by: 青木\n  from: defects 改善案\n  from: 列が長い' in src(), '改善案を書く')

    # 特性列挙法: 種類を選んで書く
    view('attributes')
    pg.select_option('[data-role="lsvp"]', '2')
    pg.fill('[data-role="add"]', '注文してから受け取るまでの流れ')
    pg.press('[data-role="add"]', 'Enter')
    check('  from: attributes 動詞的' in src(), '動詞的特性を書く')

    # ストーリーボード: 場面を足し、入れ替える
    view('storyboard')
    pg.select_option('[data-role="story"]', label='席を予約する')
    pg.wait_for_timeout(100)
    for t in ['授業が終わる', '席を予約する画面を開く']:
        pg.fill('[data-role="addscene"]', t)
        pg.press('[data-role="addscene"]', 'Enter')
    check('  scene: 授業が終わる\n  scene: 席を予約する画面を開く' in src(), '場面を足す')
    pg.click('#canvas [data-scene="1"]')
    pg.click('#form button:has-text("前へ")')
    check('  scene: 席を予約する画面を開く\n  scene: 授業が終わる' in src(), '場面を入れ替える')

    # ポジショニング: 図を作り、軸を書き、アイディアを選んで図の中に置く
    view('positioning')
    pg.fill('[data-role="newpos"]', '手間と効果')
    pg.press('[data-role="newpos"]', 'Enter')
    pg.fill('[data-role="posx"]', '手間が少ない .. 手間が多い')
    pg.press('[data-role="posx"]', 'Enter')
    check('positioning: 手間と効果\n  x: 手間が少ない .. 手間が多い' in src(), 'ポジショニングの図と軸を書く')
    pid = pg.eval_on_selector_all('#canvas [data-id]', 'es => es.map(e => [e.getAttribute("data-id"), e.textContent])')
    pg.click(f'#canvas [data-id="{[i for i, t in pid if t.startswith("席を予約する")][0]}"]')
    box = pg.eval_on_selector('#canvas [data-plot] rect', 'e => { const b = e.getBoundingClientRect(); return [b.x, b.y, b.width, b.height]; }')
    pg.mouse.click(box[0] + box[2] * 0.8, box[1] + box[3] * 0.2)  # 横 +3、縦 +3
    check('  pos: 手間と効果 3 3' in src(), '図の中をクリックして置く')

    # 既存調査: 調べたものを足し、違いを書く
    view('research')
    pg.fill('[data-role="resname"]', 'ほかの学食の予約アプリ')
    pg.fill('[data-role="resurl"]', 'https://example.com/app')
    pg.select_option('[data-role="resfor"]', label='席を予約する')
    pg.click('#inbox button:has-text("調べたものを足す")')
    check('research: ほかの学食の予約アプリ\n  url: https://example.com/app\n  for: 席を予約する' in src(), '調べたものを足す')
    pg.click('#canvas [data-res="0"]')
    pg.fill('[data-role="resdiff"]', '注文はできない')
    pg.press('[data-role="resdiff"]', 'Enter')
    check('  diff: 注文はできない' in src(), '違いを書く')

    # 貼り付けによる共有: 違うテーマを貼ると警告
    pg.focus('#src')
    pg.keyboard.press('Control+End')
    pg.keyboard.insert_text('\ntheme: 別のテーマ\n- 井上の案\n  by: 井上\n  from: direct\n')
    pg.wait_for_timeout(500)
    check('テーマ「別のテーマ」が' in pg.inner_text('#msg'), '違うテーマを貼ると警告')

    # エラーの間は図を薄くし、入力欄を使えない
    pg.keyboard.insert_text('\n# 見出し\n')
    pg.wait_for_timeout(500)
    check(pg.eval_on_selector('#view', 'e => e.classList.contains("stale")'), 'エラーの間は図を薄くする')
    check(pg.eval_on_selector('[data-role="theme"]', 'e => e.disabled'), 'エラーの間は入力欄を使えない')

    # 開き直すと続きから
    text = src()
    pg.reload()
    pg.wait_for_timeout(300)
    check(src() == text, '開き直すと続きから開く')

    # ---- レビューの指摘の回帰(L1・H2・L3・M3)
    def settext(t):
        pg.click('#btnNew'); pg.wait_for_timeout(100)
        pg.eval_on_selector('#src', '(e, t) => { e.focus(); e.select(); document.execCommand("insertText", false, t); }', t)
        pg.wait_for_timeout(400)
    def view(v): pg.select_option('#viewKind', v); pg.wait_for_timeout(80)
    # L1: 欄に書きかけのまま別のアイディアを押しても、書き込みとクリックの両方が効く
    settext('theme: T\nauthor: a\n- A\n  by: a\n  from: direct\n- B\n  by: a\n  from: direct\n')
    view('list')
    ids = pg.eval_on_selector_all('#canvas [data-id]', 'es => es.map(e => e.getAttribute("data-id"))')
    pg.click(f'#canvas [data-id="{ids[0]}"]')
    pg.fill('[data-role="name"]', 'A2')
    pg.click(f'#canvas [data-id="{ids[1]}"]'); pg.wait_for_timeout(200)
    check('- A2\n' in src() and pg.eval_on_selector('[data-role="name"]', 'e => e.value') == 'B', 'L1: 書きかけの欄を書き込み、押したアイディアも選ぶ')
    # L1: 書き込めない名前(既存の名前)なら書き換えず、ふつうのクリックとして選ぶ
    pg.click(f'#canvas [data-id="{ids[0]}"]')
    pg.fill('[data-role="name"]', 'B')
    pg.click(f'#canvas [data-id="{ids[1]}"]'); pg.wait_for_timeout(200)
    check('- A2\n' in src() and pg.eval_on_selector('[data-role="name"]', 'e => e.value') == 'B', 'L1: 書き込めない名前なら書き換えず、押したアイディアを選ぶ')
    # M3: 同じ名前のアイディアは、対象の選択肢に出さない
    settext('theme: T\nauthor: a\n- X\n  by: a\n  from: direct\n- X\n  by: b\n  from: direct\n- Y\n  by: a\n  from: direct\n')
    view('scamper')
    opts = pg.eval_on_selector_all('[data-role="target"] option', 'es => es.map(e => e.textContent)')
    check(opts[1:] == ['Y'], f'M3: 同じ名前の案は対象に選べない({opts})')
    # L3: BOM と CR の入った文字を貼っても、どちらも入らない
    settext('theme: T\n')
    pg.eval_on_selector('#src', 'e => { e.focus(); e.setSelectionRange(e.value.length, e.value.length); const dt = new DataTransfer(); dt.setData("text/plain", "\\uFEFF- 貼った案\\r\\n  by: a\\r\\n  from: direct\\r\\n"); e.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true })); }')
    pg.wait_for_timeout(400)
    check('﻿' not in src() and '\r' not in src() and '- 貼った案\n  by: a' in src(), 'L3: 貼り付けた BOM と CR を除く')
    # H2: 解析が止まったら、図を古い表示にして、図・入力欄から書き換えない
    pg.evaluate('() => { window.__orig = Igen.analyze; Igen.analyze = () => { throw new Error("試験の例外"); }; }')
    pg.focus('#src'); pg.keyboard.press('Control+End'); pg.keyboard.insert_text('x')
    pg.wait_for_timeout(500)
    check(pg.eval_on_selector('#view', 'e => e.classList.contains("stale")') and pg.eval_on_selector('[data-role="theme"]', 'e => e.disabled') and '解析の途中で止まりました' in pg.inner_text('#msg'), 'H2: 解析が止まると、図を薄くして入力欄を止める')
    pg.evaluate('() => { Igen.analyze = window.__orig; }')
    pg.keyboard.press('Backspace'); pg.wait_for_timeout(500)
    check(not pg.eval_on_selector('#view', 'e => e.classList.contains("stale")'), 'H2: 解析が戻ると、図も戻る')

    # ---- AI に相談する文(2.6 節)
    settext('theme: 学食の混雑\nauthor: a\n- 席を予約する\n  by: a\n  from: direct\n')
    pg.evaluate('() => { window.__copied = null; navigator.clipboard.writeText = async (t) => { window.__copied = t; }; }')
    view('scamper')
    pg.select_option('[data-role="target"]', label='席を予約する'); pg.wait_for_timeout(100)
    pg.fill('[data-role="trouble"]', '似た案しか出ない')
    pg.click('button:has-text("AI に相談する文をコピー")'); pg.wait_for_timeout(200)
    c = pg.evaluate('() => window.__copied') or ''
    check('学食の混雑' in c and '「SCAMPER」' in c and '似た案しか出ない' in c and 'from: 席を予約する' in c, 'AI に相談: SCAMPER の対象と困っていることが文に入る')
    view('kj')
    check(pg.eval_on_selector('[data-role="trouble"]', 'e => e.value') == '似た案しか出ない', 'AI に相談: ビューを替えても、困っていることの欄は残る')
    pg.click('button:has-text("AI に相談する文をコピー")'); pg.wait_for_timeout(200)
    c = pg.evaluate('() => window.__copied') or ''
    check('収束のフェーズで「KJ 法」' in c and 'まだグループに入っていないアイディア' in c, 'AI に相談: KJ 法では収束の相談の文になる')

    # ---- レビュー(版 0.5)の指摘の回帰(R1・N1・N4・N5・N6)
    BTN = 'button:has-text("AI に相談する文をコピー")'
    def copied():
        return pg.evaluate('() => window.__copied') or ''
    def drag_from_src(box, fx, fy):
        sb = pg.locator('#src').bounding_box()
        pg.mouse.move(sb['x'] + 40, sb['y'] + 20); pg.mouse.down()
        pg.mouse.move(box['x'] + box['width'] * fx, box['y'] + box['height'] * fy, steps=8); pg.mouse.up(); pg.wait_for_timeout(300)
    # R1: 欄を離れて書き込んだ後、テキスト欄から図の上までドラッグしても、図に書き込まない
    settext('theme: T\nauthor: a\npositioning: P\n  x: 安い .. 高い\n  y: 小 .. 大\n- A\n  by: a\n  from: direct\n')
    view('positioning')
    pg.click('#canvas [data-id]', force=True); pg.wait_for_timeout(150)
    pg.fill('[data-role="note"]', 'メモ'); pg.keyboard.press('Tab'); pg.wait_for_timeout(300)
    drag_from_src(pg.locator('#canvas [data-plot]').first.bounding_box(), 0.8, 0.2)
    check('note: メモ' in src() and 'pos:' not in src(), 'R1: 欄の後に、テキスト欄からのドラッグを図の上で離しても、位置を書かない')
    settext('theme: T\nauthor: a\nsevencross: S\n  class: C\n- A\n  by: a\n  from: direct\n')
    view('sevencross')
    pg.click('#canvas [data-id]', force=True); pg.wait_for_timeout(150)
    pg.fill('[data-role="note"]', 'メモ'); pg.keyboard.press('Tab'); pg.wait_for_timeout(300)
    pg.click('#src'); pg.wait_for_timeout(300)
    drag_from_src(pg.locator('#canvas [data-sx="C|1"]').first.bounding_box(), 0.5, 0.5)
    check('rank:' not in src(), 'R1: 欄の後に、テキスト欄を押してからのドラッグでも、重要度を書かない')
    # N1: マトリックス・ポジショニングの図がなくても、相談の欄とボタンがある
    settext('theme: T\nauthor: a\n')
    pg.evaluate('() => { window.__copied = null; navigator.clipboard.writeText = async (t) => { window.__copied = t; }; }')
    for v in ['matrix', 'positioning']:
        view(v)
        check(pg.locator(BTN).count() == 1 and pg.locator('[data-role="trouble"]').count() == 1, f'N1: 図のない{v}でも、相談の欄とボタンがある')
    view('matrix'); pg.click(BTN); pg.wait_for_timeout(200)
    check('縦の項目と横の項目の候補を一緒に考えて' in copied(), 'N1: 図のないマトリックスでも、相談の文を作れる')
    # N4: 同じ名前の枠・手法名で始まる項目は、元に選ばない
    settext('theme: T\nauthor: a\n- X\n  by: a\n  from: direct\n- X\n  by: b\n  from: direct\n')
    view('mindmap')
    ids = pg.eval_on_selector_all('#canvas [data-id]', 'es => es.map(e => e.getAttribute("data-id"))')
    pg.click(f'#canvas [data-id="{ids[1]}"]', force=True); pg.wait_for_timeout(150)
    check('伸ばす元: T' in pg.inner_text('#edit') and pg.locator('#edit .editerr').count() == 1, 'N4: 同じ名前の枠は伸ばす元にせず、知らせる')
    settext('theme: T\nauthor: a\n- kj が遅い\n  by: a\n  from: defects 欠点\n')
    view('defects')
    pg.click('#canvas [data-lsitem]', force=True); pg.wait_for_timeout(150)
    check(pg.locator('[data-role="improve"]').count() == 0 and pg.locator('#edit .editerr').count() == 1, 'N4: 手法名で始まる欠点は、改善案の元にせず、知らせる')
    # N5: テキストが一時的にエラーになっても、困っていることの欄の文は残る
    settext('theme: T\nauthor: a\n- A\n  by: a\n  from: direct\n')
    view('scamper')
    pg.fill('[data-role="trouble"]', '似た案しか出ない')
    pg.focus('#src'); pg.keyboard.press('Control+End'); pg.keyboard.insert_text('# x'); pg.wait_for_timeout(500)
    for _ in range(3): pg.keyboard.press('Backspace')
    pg.wait_for_timeout(500)
    check(pg.eval_on_selector('[data-role="trouble"]', 'e => e.value') == '似た案しか出ない', 'N5: テキストが一時的にエラーになっても、困っていることの欄の文は残る')
    # N6: 打った直後に押しても、新しいテキストで文を作る
    settext('theme: 古いテーマ\nauthor: a\n')
    view('list')
    pg.eval_on_selector('#src', '(e) => { e.focus(); e.select(); document.execCommand("insertText", false, "theme: 新しいテーマ\\nauthor: a\\n"); }')
    pg.click(BTN); pg.wait_for_timeout(300)
    check('新しいテーマ' in copied(), 'N6: 打った直後に押しても、新しいテキストで文を作る')

    # ---- 修正もれの確認(版 0.6)の回帰
    # N5: 右下の入力欄の書きかけの文も、テキストが一時的にエラーになっても残る
    settext('theme: T\nauthor: a\n')
    view('list')
    pg.fill('[data-role="add"]', '書きかけの案')
    pg.focus('#src'); pg.keyboard.press('Control+End'); pg.keyboard.insert_text('# x'); pg.wait_for_timeout(500)
    for _ in range(3): pg.keyboard.press('Backspace')
    pg.wait_for_timeout(500)
    check(pg.eval_on_selector('[data-role="add"]', 'e => e.value') == '書きかけの案', 'N5: 入力欄の書きかけの文は、テキストが一時的にエラーになっても残る')
    # N6: 打った直後に「修正依頼をコピー」を押しても、いま打ったエラーが入る
    pg.evaluate('() => { window.__copied = null; navigator.clipboard.writeText = async (t) => { window.__copied = t; }; }')
    settext('theme: T\nauthor: a\n')
    pg.eval_on_selector('#src', '(e) => { e.focus(); e.setSelectionRange(e.value.length, e.value.length); document.execCommand("insertText", false, "# 見出し\\n"); }')
    pg.click('button:has-text("修正依頼をコピー")'); pg.wait_for_timeout(300)
    c = pg.evaluate('() => window.__copied') or ''
    check('## エラー' in c and '見出し' in c, 'N6: 打った直後に押しても、修正依頼の文にいまのエラーが入る')

    check(not errors, 'ページのエラーがない' + (f': {errors}' if errors else ''))
    b.close()

print(f'NG {len(fails)} 件' if fails else 'すべて OK')
sys.exit(1 if fails else 0)
