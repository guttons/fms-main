import zipfile
import xml.etree.ElementTree as ET

def dump_sheet_preview(fn, target_sheet_name, max_rows=20):
    print(f"==================================================")
    print(f"FILE: {fn} | SHEET: {target_sheet_name}")
    print(f"==================================================")
    z = zipfile.ZipFile('../' + fn)
    shared_strings = []
    if 'xl/sharedStrings.xml' in z.namelist():
        tree = ET.fromstring(z.read('xl/sharedStrings.xml'))
        for t in tree.iter('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}t'):
            shared_strings.append(t.text or '')

    workbook_tree = ET.fromstring(z.read('xl/workbook.xml'))
    rels_tree = ET.fromstring(z.read('xl/_rels/workbook.xml.rels'))
    rel_map = {r.attrib['Id']: r.attrib['Target'] for r in rels_tree.findall('{http://schemas.openxmlformats.org/package/2006/relationships}Relationship')}
    
    target_path = None
    for s in workbook_tree.findall('.//{http://schemas.openxmlformats.org/spreadsheetml/2006/main}sheet'):
        if s.attrib['name'] == target_sheet_name:
            rId = s.attrib['{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id']
            t = rel_map.get(rId, '')
            target_path = 'xl/' + t if not t.startswith('xl/') else t
            break

    if not target_path or target_path not in z.namelist():
        print("Sheet not found")
        return

    stree = ET.fromstring(z.read(target_path))
    rows = stree.findall('.//{http://schemas.openxmlformats.org/spreadsheetml/2006/main}row')
    count = 0
    for r in rows:
        r_idx = r.attrib.get('r')
        vals = []
        for c in r.findall('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}c'):
            v = c.find('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}v')
            t = c.attrib.get('t')
            cell_ref = c.attrib.get('r')
            val_str = ''
            if v is not None and v.text is not None:
                val_str = v.text
                if t == 's' and int(val_str) < len(shared_strings):
                    val_str = shared_strings[int(val_str)]
            if val_str.strip():
                vals.append(f"{cell_ref}:{val_str.strip()}")
        if vals:
            print(f"Row {r_idx}: {' | '.join(vals[:15])}")
            count += 1
            if count >= max_rows:
                break

dump_sheet_preview('SUMMER 2026 Ver.08.xlsx', 'Days of OPS', 20)
dump_sheet_preview('SUMMER 2026 Ver.08.xlsx', 'MON', 20)
dump_sheet_preview('SUMMER 2026 Ver.08.xlsx', 'Domestic', 20)
