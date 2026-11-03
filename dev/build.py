#!/usr/bin/env python3
"""dev/ の部品から、リポジトリのトップの index.html(単一 HTML)を作る。使い方: python3 dev/build.py"""
import json
import pathlib

dev = pathlib.Path(__file__).resolve().parent
shell = (dev / 'shell.html').read_text(encoding='utf-8')
core = (dev / 'core.js').read_text(encoding='utf-8')
ui = (dev / 'ui.js').read_text(encoding='utf-8')
sample = (dev / 'sample.igen').read_text(encoding='utf-8')
help_html = (dev / 'help.html').read_text(encoding='utf-8')

# </script> が HTML の script を閉じないように
def js_str(s):
    return json.dumps(s, ensure_ascii=False).replace('</', '<\\/')

data = f'const SAMPLE_TEXT = {js_str(sample)};\nconst HELP_HTML = {js_str(help_html)};'
out = shell.replace('/*@CORE*/', core).replace('/*@DATA*/', data).replace('/*@UI*/', ui)
(dev.parent / 'index.html').write_text(out, encoding='utf-8')
print(f'index.html: {len(out.encode("utf-8"))} バイト')
