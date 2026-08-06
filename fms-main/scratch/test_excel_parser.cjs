const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

// Inline test of parseScheduleExcel logic
function testParser(fileName) {
  const filePath = path.join(__dirname, '..', '..', fileName);
  if (!fs.existsSync(filePath)) {
    console.error('File not found:', filePath);
    return;
  }
  const buffer = fs.readFileSync(filePath);
  const workbook = XLSX.read(buffer, { type: 'buffer' });

  console.log(`\n========================================`);
  console.log(`PARSING WORKBOOK: ${fileName}`);
  console.log(`========================================`);
  console.log(`Sheet Names:`, workbook.SheetNames);

  let sheetNamesToProcess = workbook.SheetNames.filter(n => 
    n.toLowerCase().includes('days of ops') || n.toLowerCase().includes('domestic')
  );

  if (sheetNamesToProcess.length === 0) {
    sheetNamesToProcess = workbook.SheetNames.filter(n => !n.toLowerCase().includes('cover'));
  }

  const schedules = [];
  const airlinesSet = new Set();

  function parseDaysOfOps(raw) {
    if (!raw) return [1,2,3,4,5,6,7];
    const str = String(raw).trim();
    const days = [];
    for (let d = 1; d <= 7; d++) {
      if (str.includes(String(d))) days.push(d);
    }
    return days.length > 0 ? days : [1,2,3,4,5,6,7];
  }

  function parseTime(raw) {
    if (!raw || raw === '-') return '';
    const str = String(raw).trim();
    if (str.includes(':')) return str;
    const num = parseInt(str.replace(/\D/g, ''), 10);
    if (isNaN(num)) return '';
    const padded = String(num).padStart(4, '0');
    return `${padded.slice(0,2)}:${padded.slice(2,4)}`;
  }

  function parseDateRange(raw) {
    if (!raw) return { from: '2026-08-01', to: '2026-10-31' };
    const parts = String(raw).trim().split(/[-–—to]+/i);
    const parseD = (s) => {
      const m = String(s).trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/);
      if (m) {
        let yy = m[3];
        if (yy.length === 2) yy = '20' + yy;
        return `${yy}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
      }
      return '2026-08-01';
    };
    return {
      from: parseD(parts[0]),
      to: parts[1] ? parseD(parts[1]) : parseD(parts[0])
    };
  }

  for (const sname of sheetNamesToProcess) {
    const sheet = workbook.Sheets[sname];
    if (!sheet) continue;
    const rawGrid = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

    let currentAirline = 'International Carrier';
    let colIdxMap = {};

    for (let r = 0; r < rawGrid.length; r++) {
      const row = rawGrid[r].map(c => String(c).trim());
      if (row.every(c => !c)) continue;

      const isHeaderRow = row.some(c => {
        const u = c.toUpperCase();
        return u.includes('AIRLINE') || u.includes('DAYS OF OPS') || u.includes('A/C TYPE') || u.includes('ROUTE') || u.includes('FLT NO');
      });

      if (isHeaderRow) {
        colIdxMap = {};
        row.forEach((cell, idx) => {
          const u = cell.toUpperCase();
          if (u.includes('AIRLINE')) colIdxMap['airline'] = idx;
          else if (u.includes('DAYS OF OPS') || u.includes('DAYS')) colIdxMap['days'] = idx;
          else if (u.includes('A/C TYPE') || u.includes('EQUIPMENT')) colIdxMap['aircraft'] = idx;
          else if (u.includes('ROUTE')) colIdxMap['route'] = idx;
          else if (u.includes('FLT NO') || u.includes('FLIGHT')) colIdxMap['fltNo'] = idx;
          else if (u.includes('STA')) colIdxMap['sta'] = idx;
          else if (u.includes('STD')) colIdxMap['std'] = idx;
          else if (u.includes('EFFECTIVE')) colIdxMap['effective'] = idx;
          else if (u.includes('SEATS')) colIdxMap['seats'] = idx;
        });
        continue;
      }

      const bVal = row[1] || row[0] || '';
      if (bVal && !bVal.toUpperCase().includes('AIRLINE') && !bVal.toUpperCase().includes('SLOT') && !bVal.toUpperCase().includes('VELANA') && !bVal.toUpperCase().includes('DAYS OF OPS') && !bVal.toUpperCase().includes('LAST UPDATED') && bVal.length > 2 && row.filter(c => c).length <= 2) {
        currentAirline = bVal;
        airlinesSet.add(currentAirline);
        continue;
      }

      const getVal = (key, defaultCol) => colIdxMap[key] !== undefined && row[colIdxMap[key]] ? row[colIdxMap[key]] : (row[defaultCol] || '');
      const fltNo = getVal('fltNo', 5);
      if (!fltNo || fltNo.toUpperCase().includes('FLT NO') || fltNo.toUpperCase().includes('FLIGHT')) continue;

      const airline = getVal('airline', 1) || currentAirline;
      if (airline && airline.length > 2) airlinesSet.add(airline);

      const days = parseDaysOfOps(getVal('days', 2));
      const acType = getVal('aircraft', 3) || 'Widebody';
      const route = getVal('route', 4) || 'INT-MLE';
      const sta = parseTime(getVal('sta', 6));
      const std = parseTime(getVal('std', 7));
      const dates = parseDateRange(getVal('effective', 8));
      const seats = parseInt(getVal('seats', 9), 10) || 0;

      schedules.push({
        flightNumber: fltNo.replace(/\s+/g, '').toUpperCase(),
        airlineName: airline,
        daysOfWeek: days,
        aircraftType: acType,
        route,
        sta,
        std,
        effectiveFrom: dates.from,
        effectiveTo: dates.to,
        seats
      });
    }
  }

  console.log(`Parsed ${schedules.length} flight schedules across ${airlinesSet.size} distinct airlines.`);
  console.log(`Sample Parsed Records (First 5):`);
  console.log(schedules.slice(0, 5));
}

testParser('SUMMER 2026 Ver.08.xlsx');
testParser('WINTER 2026-27 Ver.01.xlsx');
