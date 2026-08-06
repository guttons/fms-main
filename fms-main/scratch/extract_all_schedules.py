import zipfile
import xml.etree.ElementTree as ET
import re
import json

def parse_days_of_ops(raw_str):
    if not raw_str:
        return [1, 2, 3, 4, 5, 6, 7]
    s = str(raw_str).strip()
    days = [d for d in range(1, 8) if str(d) in s]
    return days if days else [1, 2, 3, 4, 5, 6, 7]

def parse_macl_time(raw_str):
    if not raw_str or raw_str == '-':
        return ''
    s = str(raw_str).strip()
    if ':' in s:
        return s
    nums = re.sub(r'\D', '', s)
    if not nums:
        return ''
    padded = nums.zfill(4)
    hh, mm = padded[:2], padded[2:4]
    if int(hh) < 24 and int(mm) < 60:
        return f"{hh}:{mm}"
    return s

def parse_macl_date_range(raw_str, default_from="2026-03-29", default_to="2026-10-24"):
    if not raw_str or str(raw_str).strip() in ['', '-']:
        return default_from, default_to
    s = str(raw_str).strip()
    parts = re.split(r'[-–—to]+', s, flags=re.I)
    
    def parse_d(d_str):
        d_str = d_str.strip()
        m = re.match(r'^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$', d_str)
        if m:
            dd, mm, yy = m.group(1).zfill(2), m.group(2).zfill(2), m.group(3)
            if len(yy) == 2:
                yy = "20" + yy
            return f"{yy}-{mm}-{dd}"
        return default_from
        
    f = parse_d(parts[0])
    t = parse_d(parts[1]) if len(parts) > 1 else f
    return f, t

def estimate_uplift(seats, ac_type, is_domestic=False):
    u_ac = (ac_type or '').upper()
    if is_domestic:
        if 'A330' in u_ac: return 14000
        if 'ATR' in u_ac: return max(1800, round((seats or 64) * 28))
        if 'DH8' in u_ac or 'DASH' in u_ac: return max(1300, round((seats or 50) * 26))
        return max(1500, round((seats or 50) * 30))
    if seats <= 0:
        if any(x in u_ac for x in ['777', '77W', '350', '359', '787', '330']):
            return 48000
        if any(x in u_ac for x in ['320', '321', '32Q', '737', '73H']):
            return 18000
        return 35000
    if any(x in u_ac for x in ['777', '77W', '350', '359', '787', '330']):
        return round(seats * 115)
    if any(x in u_ac for x in ['777', '77W', '350', '359', '787', '330']):
        return round(seats * 115)
    if any(x in u_ac for x in ['320', '321', '32Q', '737', '73H']):
        return round(seats * 85)
    return round(seats * 95)

def extract_schedules(fn, default_from, default_to):
    z = zipfile.ZipFile('../' + fn)
    shared_strings = []
    if 'xl/sharedStrings.xml' in z.namelist():
        tree = ET.fromstring(z.read('xl/sharedStrings.xml'))
        for t in tree.iter('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}t'):
            shared_strings.append(t.text or '')

    workbook_tree = ET.fromstring(z.read('xl/workbook.xml'))
    rels_tree = ET.fromstring(z.read('xl/_rels/workbook.xml.rels'))
    rel_map = {r.attrib['Id']: r.attrib['Target'] for r in rels_tree.findall('{http://schemas.openxmlformats.org/package/2006/relationships}Relationship')}

    schedules = []
    
    for s in workbook_tree.findall('.//{http://schemas.openxmlformats.org/spreadsheetml/2006/main}sheet'):
        sname = s.attrib['name']
        if not ('days of ops' in sname.lower() or 'domestic' in sname.lower()):
            continue
            
        is_domestic_sheet = 'domestic' in sname.lower()
        rId = s.attrib['{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id']
        t = rel_map.get(rId, '')
        sheet_path = 'xl/' + t if not t.startswith('xl/') else t
        if sheet_path not in z.namelist():
            continue

        stree = ET.fromstring(z.read(sheet_path))
        rows = stree.findall('.//{http://schemas.openxmlformats.org/spreadsheetml/2006/main}row')
        
        current_airline = "International Carrier"
        col_map = {}

        for r in rows:
            r_idx = r.attrib.get('r')
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

            if not cells:
                continue

            row_str_values = list(cells.values())
            is_header = any(x in ' '.join(row_str_values).upper() for x in ['AIRLINE', 'DAYS OF OPS', 'A/C TYPE', 'ROUTE', 'FLT NO'])
            
            if is_header:
                col_map = {}
                for col_let, val in cells.items():
                    u = val.upper()
                    if 'AIRLINE' in u: col_map['airline'] = col_let
                    elif 'DAYS' in u: col_map['days'] = col_let
                    elif 'A/C TYPE' in u or 'EQUIPMENT' in u: col_map['aircraft'] = col_let
                    elif 'ROUTE' in u: col_map['route'] = col_let
                    elif 'FLT' in u or 'FLIGHT' in u: col_map['fltNo'] = col_let
                    elif 'STA' in u: col_map['sta'] = col_let
                    elif 'STD' in u: col_map['std'] = col_let
                    elif 'EFFECTIVE' in u: col_map['effective'] = col_let
                    elif 'SEATS' in u: col_map['seats'] = col_let
                continue

            section_val = cells.get('B', cells.get('C', cells.get('A', '')))
            if section_val and not any(x in section_val.upper() for x in ['AIRLINE', 'SLOT', 'VELANA', 'DAYS OF OPS', 'LAST UPDATED']) and len(section_val) > 2 and len(cells) <= 2:
                current_airline = section_val
                continue

            flt_no = cells.get(col_map.get('fltNo', 'F'), cells.get('G', ''))
            if not flt_no or any(x in flt_no.upper() for x in ['FLT NO', 'FLIGHT', 'SLOT', 'A/C TYPE']):
                continue

            airline_row = cells.get(col_map.get('airline', 'B'), cells.get('C', current_airline))
            if not airline_row or any(x in airline_row.upper() for x in ['SLOT', 'VELANA', 'DAYS OF OPS']):
                airline_row = current_airline

            days_raw = cells.get(col_map.get('days', 'C'), cells.get('D', '1234567'))
            days_of_week = parse_days_of_ops(days_raw)
            ac_type = cells.get(col_map.get('aircraft', 'D'), cells.get('E', 'Widebody'))
            route = cells.get(col_map.get('route', 'E'), cells.get('F', 'INT-MLE'))
            sta = parse_macl_time(cells.get(col_map.get('sta', 'G'), cells.get('H', '')))
            std = parse_macl_time(cells.get(col_map.get('std', 'H'), ''))
            eff_from, eff_to = parse_macl_date_range(cells.get(col_map.get('effective', 'I'), ''), default_from, default_to)
            
            try:
                seats = int(re.sub(r'\D', '', cells.get(col_map.get('seats', 'J'), '0')))
            except:
                seats = 0

            is_dom = is_domestic_sheet or ['MANTA', 'FLYME', 'MALDIVIAN', 'MAVDIVIAN', 'VILLA'].some(lambda n: n in airline_row.upper()) if False else (is_domestic_sheet or any(n in airline_row.upper() for n in ['MANTA', 'FLYME', 'MALDIVIAN', 'MAVDIVIAN', 'VILLA']) or any(c in flt_no.upper() for c in ['NR', 'VP', 'Q2']))

            est_uplift = estimate_uplift(seats, ac_type, is_dom)
            clean_flt = re.sub(r'\s+', '', flt_no).upper()

            schedules.append({
                'flightNumber': clean_flt,
                'airlineName': airline_row,
                'daysOfWeek': days_of_week,
                'aircraftType': ac_type,
                'route': route,
                'sta': sta,
                'std': std,
                'effectiveFrom': eff_from,
                'effectiveTo': eff_to,
                'seats': seats,
                'estimatedUpliftLiters': est_uplift,
                'isDomestic': is_dom
            })
            
    return schedules

summer = extract_schedules('SUMMER 2026 Ver.08.xlsx', '2026-03-29', '2026-10-24')
winter = extract_schedules('WINTER 2026-27 Ver.01.xlsx', '2026-10-25', '2027-03-27')

print(f"Summer total rows: {len(summer)} (Intl: {len([s for s in summer if not s['isDomestic']])}, Dom: {len([s for s in summer if s['isDomestic']])})")
print(f"Winter total rows: {len(winter)} (Intl: {len([s for s in winter if not s['isDomestic']])}, Dom: {len([s for s in winter if s['isDomestic']])})")
