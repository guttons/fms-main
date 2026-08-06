import zipfile
import xml.etree.ElementTree as ET
import re

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

def parse_macl_date_range(raw_str):
    today = "2026-08-01"
    default_end = "2026-10-31"
    if not raw_str:
        return today, default_end
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
        return today
        
    f = parse_d(parts[0])
    t = parse_d(parts[1]) if len(parts) > 1 else f
    return f, t

def estimate_uplift(seats, ac_type):
    u_ac = (ac_type or '').upper()
    if seats <= 0:
        if any(x in u_ac for x in ['777', '77W', '350', '359', '787', '330']):
            return 48000
        if any(x in u_ac for x in ['320', '321', '32Q', '737', '73H']):
            return 18000
        return 35000
    if any(x in u_ac for x in ['777', '77W', '350', '359', '787', '330']):
        return round(seats * 115)
    if any(x in u_ac for x in ['320', '321', '32Q', '737', '73H']):
        return round(seats * 85)
    if 'ATR' in u_ac or 'DASH' in u_ac:
        return round(seats * 25)
    return round(seats * 95)

def test_workbook(fn):
    print("==================================================")
    print("PARSING WORKBOOK:", fn)
    print("==================================================")
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
    airlines = set()

    for s in workbook_tree.findall('.//{http://schemas.openxmlformats.org/spreadsheetml/2006/main}sheet'):
        sname = s.attrib['name']
        if not ('days of ops' in sname.lower() or 'domestic' in sname.lower()):
            continue
            
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

            b_val = cells.get('B', cells.get('A', ''))
            if b_val and not any(x in b_val.upper() for x in ['AIRLINE', 'SLOT', 'VELANA', 'DAYS OF OPS', 'LAST UPDATED']) and len(b_val) > 2 and len(cells) <= 2:
                current_airline = b_val
                airlines.add(current_airline)
                continue

            flt_no = cells.get(col_map.get('fltNo', 'F'), '')
            if not flt_no or any(x in flt_no.upper() for x in ['FLT NO', 'FLIGHT']):
                continue

            airline_row = cells.get(col_map.get('airline', 'B'), current_airline)
            if airline_row and len(airline_row) > 2:
                airlines.add(airline_row)

            days_raw = cells.get(col_map.get('days', 'C'), '1234567')
            days_of_week = parse_days_of_ops(days_raw)
            ac_type = cells.get(col_map.get('aircraft', 'D'), 'Widebody')
            route = cells.get(col_map.get('route', 'E'), 'INT-MLE')
            sta = parse_macl_time(cells.get(col_map.get('sta', 'G'), ''))
            std = parse_macl_time(cells.get(col_map.get('std', 'H'), ''))
            eff_from, eff_to = parse_macl_date_range(cells.get(col_map.get('effective', 'I'), ''))
            
            try:
                seats = int(re.sub(r'\D', '', cells.get(col_map.get('seats', 'J'), '0')))
            except:
                seats = 0

            est_uplift = estimate_uplift(seats, ac_type)
            clean_flt = re.sub(r'\s+', '', flt_no).upper()

            schedules.append({
                'flightNumber': clean_flt,
                'airline': airline_row,
                'days': days_of_week,
                'acType': ac_type,
                'route': route,
                'sta': sta,
                'std': std,
                'effective': f"{eff_from} to {eff_to}",
                'seats': seats,
                'estUpliftLiters': est_uplift
            })

    print(f"Successfully extracted {len(schedules)} flight schedules across {len(airlines)} distinct airlines!")
    print(f"Sample First 5 Records:")
    for s in schedules[:5]:
        print(" ", s)
    print(f"Sample Last 5 Records:")
    for s in schedules[-5:]:
        print(" ", s)

test_workbook('SUMMER 2026 Ver.08.xlsx')
test_workbook('WINTER 2026-27 Ver.01.xlsx')
