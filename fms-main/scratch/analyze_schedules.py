import zipfile
import xml.etree.ElementTree as ET
import re
import shutil
import os

def analyze_file(fn):
    print("==================================================")
    print("ANALYZING FILE:", fn)
    print("==================================================")
    temp_path = "scratch_temp.xlsx"
    try:
        shutil.copyfile('../' + fn, temp_path)
    except Exception as e:
        print("Copy failed:", e)
        return

    z = zipfile.ZipFile(temp_path)
    shared_strings = []
    if 'xl/sharedStrings.xml' in z.namelist():
        tree = ET.fromstring(z.read('xl/sharedStrings.xml'))
        for t in tree.iter('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}t'):
            shared_strings.append(t.text or '')

    workbook_tree = ET.fromstring(z.read('xl/workbook.xml'))
    rels_tree = ET.fromstring(z.read('xl/_rels/workbook.xml.rels'))
    rel_map = {r.attrib['Id']: r.attrib['Target'] for r in rels_tree.findall('{http://schemas.openxmlformats.org/package/2006/relationships}Relationship')}

    for s in workbook_tree.findall('.//{http://schemas.openxmlformats.org/spreadsheetml/2006/main}sheet'):
        sname = s.attrib['name']
        rId = s.attrib['{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id']
        t = rel_map.get(rId, '')
        sheet_path = 'xl/' + t if not t.startswith('xl/') else t
        if sheet_path not in z.namelist():
            continue

        stree = ET.fromstring(z.read(sheet_path))
        rows = stree.findall('.//{http://schemas.openxmlformats.org/spreadsheetml/2006/main}row')
        
        valid_rows = 0
        for r in rows:
            cells = {}
            for c in r.findall('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}c'):
                v = c.find('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}v')
                t_attr = c.attrib.get('t')
                ref = c.attrib.get('r')
                col_let = re.sub(r'\d', '', ref)
                val_str = ''
                if v is not None and v.text is not None:
                    val_str = v.text
                    if t_attr == 's' and int(val_str) < len(shared_strings):
                        val_str = shared_strings[int(val_str)]
                if val_str.strip():
                    cells[col_let] = val_str.strip()
            if any(x in ' '.join(cells.values()).upper() for x in ['SLOT', 'VELANA', 'DAYS OF OPS']) and len(cells) <= 3:
                continue
            flt = cells.get('F', cells.get('G', cells.get('E', '')))
            if flt and not any(x in flt.upper() for x in ['FLT', 'FLIGHT', 'A/C TYPE', 'ROUTE', 'SLOT']):
                valid_rows += 1
        print(f"Sheet \"{sname}\": {valid_rows} valid flight rows (out of {len(rows)} raw XML rows)")

analyze_file('SUMMER 2026 Ver.08.xlsx')
analyze_file('WINTER 2026-27 Ver.01.xlsx')
