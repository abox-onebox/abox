import docx
import sys

path = r'C:/Users/herma/Desktop/MVP修改意见3.docx'
doc = docx.Document(path)

print("===== PARAGRAPHS =====")
for i, p in enumerate(doc.paragraphs):
    if p.text.strip():
        print(f'[P{i}] {p.text}')

print("\n===== TABLES =====")
for ti, t in enumerate(doc.tables):
    print(f'\n== Table {ti} ({len(t.rows)} rows x {len(t.columns)} cols) ==')
    for ri, row in enumerate(t.rows):
        cells = [c.text.strip().replace(chr(10), ' / ') for c in row.cells]
        print(f'  R{ri}: ' + ' | '.join(cells))
