import zipfile
import xml.etree.ElementTree as ET

for fn in ['SUMMER 2026 Ver.08.xlsx', 'WINTER 2026-27 Ver.01.xlsx']:
    print('========================================')
    print('FILE:', fn)
    print('========================================')
    z = zipfile.ZipFile('../' + fn)
    workbook_tree = ET.fromstring(z.read('xl/workbook.xml'))
    sheets = workbook_tree.findall('.//{http://schemas.openxmlformats.org/spreadsheetml/2006/main}sheet')
    
    # map rId to target
    rels_tree = ET.fromstring(z.read('xl/_rels/workbook.xml.rels'))
    rel_map = {}
    for r in rels_tree.findall('{http://schemas.openxmlformats.org/package/2006/relationships}Relationship'):
        rel_map[r.attrib['Id']] = r.attrib['Target']
        
    for s in sheets:
        sname = s.attrib['name']
        rId = s.attrib['{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id']
        target = rel_map.get(rId, '')
        sheet_path = 'xl/' + target if not target.startswith('xl/') else target
        if sheet_path in z.namelist():
            stree = ET.fromstring(z.read(sheet_path))
            rows = stree.findall('.//{http://schemas.openxmlformats.org/spreadsheetml/2006/main}row')
            print(f'Sheet Name: "{sname}" -> Path: {sheet_path}, Rows: {len(rows)}')
