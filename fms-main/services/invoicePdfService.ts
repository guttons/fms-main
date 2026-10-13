import { FlightLog, User } from '../types';
import { numberToWords } from '../utils/numberToWords';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Formats an ISO string or time string into 24-hour HH:MM format
 */
function formatTime(isoString?: string | null): string {
  if (!isoString) return '-';
  try {
    const str = String(isoString).trim();
    const ampmMatch = str.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?$/i);
    if (ampmMatch) {
      let hours = parseInt(ampmMatch[1], 10);
      const minutes = ampmMatch[2];
      const modifier = (ampmMatch[3] || '').toUpperCase();
      if (modifier === 'PM' && hours < 12) hours += 12;
      if (modifier === 'AM' && hours === 12) hours = 0;
      return `${String(hours).padStart(2, '0')}:${minutes}`;
    }

    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      const h = String(d.getHours()).padStart(2, '0');
      const m = String(d.getMinutes()).padStart(2, '0');
      return `${h}:${m}`;
    }
    if (/^\d{1,2}:\d{2}/.test(str)) {
      const parts = str.split(':');
      return `${parts[0].padStart(2, '0')}:${parts[1].substring(0, 2)}`;
    }
  } catch {}
  return isoString || '-';
}

/**
 * Formats an operational date to DD-Mon-YY format (e.g. 01-Oct-26)
 */
function formatDate(dateStr?: string | null): string {
  if (!dateStr) {
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = MONTHS[now.getMonth()];
    const year = String(now.getFullYear()).slice(-2);
    return `${day}-${month}-${year}`;
  }
  try {
    const str = String(dateStr).trim();
    // Check for YYYY-MM-DD
    const matchYMD = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (matchYMD) {
      const day = matchYMD[3];
      const monthIdx = parseInt(matchYMD[2], 10) - 1;
      const year = matchYMD[1].slice(-2);
      const month = MONTHS[monthIdx] || 'Jan';
      return `${day}-${month}-${year}`;
    }
    // Check for DD/MM/YYYY
    const matchDMY = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
    if (matchDMY) {
      const day = matchDMY[1].padStart(2, '0');
      const monthIdx = parseInt(matchDMY[2], 10) - 1;
      const year = matchDMY[3].slice(-2);
      const month = MONTHS[monthIdx] || 'Jan';
      return `${day}-${month}-${year}`;
    }

    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      const day = String(d.getDate()).padStart(2, '0');
      const month = MONTHS[d.getMonth()] || 'Jan';
      const year = String(d.getFullYear()).slice(-2);
      return `${day}-${month}-${year}`;
    }
  } catch {}
  return dateStr;
}

/**
 * Formats date and time into DD-Mon-YY, HH:MM (24-hour format)
 */
function formatDateTime(dateStr?: string | null): string {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      const day = String(d.getDate()).padStart(2, '0');
      const month = MONTHS[d.getMonth()] || 'Jan';
      const year = String(d.getFullYear()).slice(-2);
      const h = String(d.getHours()).padStart(2, '0');
      const m = String(d.getMinutes()).padStart(2, '0');
      return `${day}-${month}-${year}, ${h}:${m}`;
    }
  } catch {}
  return dateStr;
}

/**
 * Generates high-fidelity HTML for Jet A-1 FORM NO: G-001 Delivery Invoice
 */
export function generateInvoiceHtml(log: Partial<FlightLog>, operatorUser?: Partial<User>): string {
  const deliveryNum = log.deliveryNumber || `MLE-${Math.floor(100000 + Math.random() * 900000)}`;
  const dateFormatted = formatDate(log.timestampStart || log.operationalDate || log.created_at);
  const volumeNumber = typeof log.volume === 'number' ? log.volume : parseFloat(String(log.volume || 0));
  const volumeInWords = numberToWords(volumeNumber);
  
  const isCash = (log.paymentType || '').toUpperCase() === 'CASH';
  const isCredit = !isCash;

  const isMarineOrSeaplane = 
    log.logType === 'MARINE' || 
    log.logType === 'SEAPLANE' || 
    (log.flightNumber || '').startsWith('SEAPLANE') || 
    (log.flightNumber || '').startsWith('VESSEL') ||
    ['SEA', 'MARINE'].includes((log.intDom || '').toUpperCase());

  const isDomestic = isMarineOrSeaplane || !!log.isDomestic || ['DOMESTIC', 'DOM', 'DOM.'].includes((log.intDom || '').toUpperCase());
  const isInternal = !isMarineOrSeaplane && (log.intDom || '').toUpperCase() === 'INTERNAL';
  const isInternational = !isDomestic && !isInternal;

  const arrivedTime = formatTime(log.timestampArrived || log.timestampStart);
  const commencedTime = formatTime(log.timestampFinalStart || log.timestampStart);
  const overTime = formatTime(log.timestampFinalEnd || log.timestampClearance);

  // Delivered By: strictly MACL fuel services refuelling staff (Officer / Operator), NOT aircraft operator
  let deliveringOfficer = log.officer || log.tacticalOperator || (log.operatorId && !log.operatorId.startsWith('st-') ? log.operatorId : '') || operatorUser?.name || 'Refuelling Officer';
  
  // Use specific staff position/designation if configured
  let deliveringDesignation = (operatorUser as any)?.designation;
  if (!deliveringDesignation && typeof window !== 'undefined') {
    try {
      const rawStaff = localStorage.getItem('fms_staff_list_v3');
      if (rawStaff) {
        const staffList: any[] = JSON.parse(rawStaff);
        const officerLower = (deliveringOfficer || '').toLowerCase().trim();
        const matched = staffList.find(s => 
          (operatorUser?.id && s.id === operatorUser.id) ||
          (s.name && s.name.toLowerCase().trim() === officerLower) ||
          (log.operatorId && (s.id === log.operatorId || s.employeeId?.toLowerCase() === log.operatorId.toLowerCase()))
        );
        if (matched?.designation) {
          deliveringDesignation = matched.designation;
        }
      }
    } catch {}
  }
  if (!deliveringDesignation) {
    deliveringDesignation = operatorUser?.role ? operatorUser.role.replace(/_/g, ' ') : 'Refuelling Officer / Operator';
  }

  // Fallback to localStorage signature cache if not in memory
  let signatureImg = log.signatureDataUrl;
  let signerName = log.signerName;
  let signerDesignation = log.signerDesignation;
  let signerEmail = log.signerEmail;
  let signedAt = log.signedAt;

  if (typeof window !== 'undefined') {
    try {
      const keysToTry = [
        log.deliveryNumber ? `fms_sig_${log.deliveryNumber}` : null,
        log.id ? `fms_sig_${log.id}` : null,
        log.flightNumber ? `fms_sig_${log.flightNumber}` : null,
      ].filter(Boolean) as string[];

      for (const k of keysToTry) {
        const raw = localStorage.getItem(k);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed.signatureDataUrl) {
            signatureImg = signatureImg || parsed.signatureDataUrl;
            signerName = signerName || parsed.signerName;
            signerDesignation = signerDesignation || parsed.signerDesignation;
            signerEmail = signerEmail || parsed.signerEmail;
            signedAt = signedAt || parsed.signedAt;
            break;
          }
        }
      }

      if (!signatureImg) {
        const rawRecent = localStorage.getItem('fms_recent_flight_logs');
        if (rawRecent) {
          const recents: FlightLog[] = JSON.parse(rawRecent);
          const match = recents.find(r => 
            (log.deliveryNumber && r.deliveryNumber === log.deliveryNumber) || 
            (log.id && r.id === log.id)
          );
          if (match && match.signatureDataUrl) {
            signatureImg = match.signatureDataUrl;
            signerName = signerName || match.signerName;
            signerDesignation = signerDesignation || match.signerDesignation;
            signerEmail = signerEmail || match.signerEmail;
            signedAt = signedAt || match.signedAt;
          }
        }
      }
    } catch (e) {}
  }

  const escapeHtml = (val: unknown): string => {
    if (val === null || val === undefined) return '';
    return String(val)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  };

  signerName = escapeHtml(signerName ? signerName.toUpperCase() : 'Authorized Flight Crew Rep');
  signerDesignation = escapeHtml(signerDesignation || 'Captain / Representative');
  deliveringOfficer = escapeHtml(deliveringOfficer);
  deliveringDesignation = escapeHtml(deliveringDesignation);

  // Customer / Operator / C/O details
  let customerDisplay = '';
  let operatorDisplay = '';

  if (log.isAdhoc) {
    customerDisplay = log.co || (log.airline && log.airline !== 'Maldivian' ? log.airline : '') || 'GENERAL AVIATION';
    operatorDisplay = log.operatorName || (log.airline && log.airline !== customerDisplay && log.airline !== 'Maldivian' ? log.airline : '') || '';
  } else if (log.logType === 'SEAPLANE' || (log.flightNumber || '').startsWith('SEAPLANE')) {
    const spCust = log.airline || log.operatorName || (log.flightNumber ? log.flightNumber.replace('SEAPLANE-', '') : '') || log.co || 'SEAPLANE OPERATOR';
    customerDisplay = spCust;
    operatorDisplay = spCust;
  } else if (log.logType === 'MARINE' || (log.flightNumber || '').startsWith('VESSEL')) {
    const vesselName = (log as any).vesselName || log.operatorName || (log.flightNumber ? log.flightNumber.replace('VESSEL-', '') : '') || log.co || 'MARINE VESSEL';
    customerDisplay = vesselName;
    operatorDisplay = vesselName;
  } else if (log.logType === 'FILLING_STATION' || (log.flightNumber || '').startsWith('GROUND-')) {
    const fsCust = log.airline || (log as any).customer || log.operatorName || 'GROUND OPERATIONS';
    customerDisplay = fsCust;
    operatorDisplay = log.operatorName || log.airline || '';
  } else {
    customerDisplay = log.airline || (log as any).customer || 'Maldivian';
    operatorDisplay = log.operatorName || (log.co && log.co !== customerDisplay ? log.co : '');
  }
  const productName = String(
    (log as any).product ||
    ((log.flightNumber || '').toUpperCase().includes('PETROL') ? 'PETROL' :
     (log.flightNumber || '').toUpperCase().includes('DIESEL') ? 'DIESEL' : 'JET A-1')
  ).toUpperCase();
  const coDisplay = escapeHtml((log.co && log.co !== customerDisplay) ? log.co : '');
  customerDisplay = escapeHtml(customerDisplay);
  operatorDisplay = escapeHtml(operatorDisplay);

  // Route / Origin / Destination
  let goingTo = log.destination || '';
  if (!goingTo && log.route) {
    if (log.route.includes('➔')) {
      goingTo = log.route.split('➔').pop()?.trim() || '';
    } else if (log.route.includes('-')) {
      goingTo = log.route.split('-').pop()?.trim() || '';
    } else {
      goingTo = log.route;
    }
  }
  if (!goingTo) goingTo = 'N/A';

  let comingFrom = (log as any).origin || '';
  if (!comingFrom && log.route && log.route.includes('➔')) {
    const parts = log.route.split('➔').map(p => p.trim());
    if (parts.length > 1) comingFrom = parts[0];
  }
  if (!comingFrom) comingFrom = 'MLE';
  goingTo = escapeHtml(goingTo);
  comingFrom = escapeHtml(comingFrom);

  const meterOpen = escapeHtml(typeof log.meterOpen === 'number' ? log.meterOpen.toLocaleString() : (log.meterOpen || '-'));
  const meterClose = escapeHtml(typeof log.meterClose === 'number' ? log.meterClose.toLocaleString() : (log.meterClose || '-'));

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Jet A-1 Fuel Delivery Invoice - ${escapeHtml(deliveryNum)}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 14mm 12mm 14mm 12mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 10px;
      line-height: 1.3;
      color: #000;
      background-color: #fff;
      margin: 0;
      padding: 0;
    }
    .invoice-wrapper {
      width: 100%;
      max-width: 186mm;
      min-height: 258mm;
      margin: 0 auto;
      border: 2px solid #000;
      padding: 14px 16px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      gap: 10px;
    }

    /* Header */
    .header-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #000;
      padding-bottom: 8px;
    }
    .brand-section {
      display: flex;
      gap: 10px;
      align-items: center;
    }
    .brand-section img {
      height: 38px;
      object-fit: contain;
    }
    .company-titles h1 {
      font-size: 13px;
      font-weight: 900;
      margin: 0;
      letter-spacing: -0.01em;
      text-transform: uppercase;
    }
    .company-titles h2 {
      font-size: 10px;
      font-weight: 800;
      color: #333;
      margin: 2px 0 0 0;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .company-titles p {
      font-size: 9px;
      font-weight: bold;
      color: #555;
      margin: 2px 0 0 0;
    }

    .header-right {
      text-align: right;
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 4px;
    }
    .product-badge {
      background: #000;
      color: #fff;
      font-size: 16px;
      font-weight: 900;
      letter-spacing: 0.15em;
      padding: 4px 16px;
      border-radius: 4px;
      display: inline-block;
    }
    .ticket-label {
      font-size: 8px;
      font-weight: 900;
      color: #666;
      letter-spacing: 0.1em;
      text-transform: uppercase;
    }
    .ticket-num {
      font-size: 15px;
      font-weight: 900;
      color: #dc2626;
      letter-spacing: 0.05em;
    }

    /* Meta Badges Row */
    .meta-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background-color: #f8fafc;
      border: 1px solid #000;
      padding: 6px 10px;
      font-weight: bold;
      font-size: 10px;
    }
    .check-group {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .check-item {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 9px;
      font-weight: 900;
      text-transform: uppercase;
    }
    .box {
      display: inline-block;
      width: 12px;
      height: 12px;
      border: 1.5px solid #000;
      text-align: center;
      line-height: 11px;
      font-size: 10px;
      font-weight: 900;
    }

    /* Grid Details */
    .grid-table {
      width: 100%;
      border-collapse: collapse;
      border: 1.5px solid #000;
    }
    .grid-table td, .grid-table th {
      border: 1px solid #000;
      padding: 4px 6px;
      vertical-align: middle;
      font-size: 9.5px;
    }
    .grid-table .label {
      font-weight: 900;
      text-transform: uppercase;
      font-size: 8px;
      color: #444;
      display: block;
      margin-bottom: 2px;
    }
    .grid-table .val {
      font-weight: 900;
      font-size: 11px;
      color: #000;
      text-transform: uppercase;
    }

    /* Volume Section */
    .volume-table {
      width: 100%;
      border-collapse: collapse;
      border: 2px solid #000;
      margin-top: 2px;
    }
    .volume-table th {
      background-color: #f1f5f9;
      font-size: 8.5px;
      font-weight: 900;
      text-transform: uppercase;
      border: 1px solid #000;
      padding: 5px;
      text-align: center;
    }
    .volume-table td {
      border: 1px solid #000;
      padding: 6px;
      text-align: center;
      font-size: 10px;
    }
    .words-box {
      text-align: left !important;
      padding: 6px 10px !important;
      background-color: #fff;
    }
    .words-box .in-words {
      font-weight: 900;
      font-size: 11.5px;
      font-style: italic;
      color: #1e3a8a;
    }

    /* QC Checks & Certification */
    .qc-box {
      border: 1.5px solid #000;
      padding: 6px 8px;
      background: #fafafa;
    }
    .qc-title {
      font-size: 8.5px;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      border-bottom: 1px solid #000;
      padding-bottom: 3px;
      margin-bottom: 6px;
      color: #1e3a8a;
    }
    .qc-checks-row {
      display: flex;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 6px;
    }
    .statement-box {
      border-top: 1px dashed #000;
      padding-top: 5px;
      font-size: 8.5px;
      font-weight: 900;
      text-align: center;
      color: #000;
      letter-spacing: 0.03em;
    }

    /* Signatures Section */
    .signatures-container {
      display: flex;
      gap: 12px;
      margin-top: 2px;
    }
    .sig-col {
      flex: 1;
      border: 1.5px solid #000;
      padding: 6px 8px;
      background: #fff;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    .sig-title {
      font-size: 9px;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      border-bottom: 1.5px solid #000;
      padding-bottom: 3px;
      margin-bottom: 6px;
    }
    .sig-pad-box {
      height: 68px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 6px;
      border-bottom: 1px solid #94a3b8;
      position: relative;
    }
    .sig-pad-box img {
      max-height: 64px;
      max-width: 90%;
      object-fit: contain;
    }
    .sig-fields {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .sig-field-row {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      font-size: 9px;
    }
    .sig-field-row .lbl {
      font-weight: 900;
      text-transform: uppercase;
      font-size: 7.5px;
      color: #555;
    }
    .sig-field-row .val {
      font-weight: 900;
      color: #000;
      text-transform: uppercase;
    }

    /* Footer */
    .footer-note {
      text-align: center;
      font-size: 7.5px;
      border-top: 1.5px solid #000;
      padding-top: 6px;
      margin-top: 4px;
    }
    .compliance-text {
      color: #dc2626;
      font-weight: 900;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 3px;
    }
    .contact-text {
      color: #4b5563;
      font-weight: 600;
      line-height: 1.3;
    }
  </style>
</head>
<body>
  <div class="invoice-wrapper">
    <!-- Header -->
    <div class="header-row">
      <div class="brand-section">
        <img src="https://static.routesonline.com/images/cached/organisation-14252-scaled-300x130.png" alt="MACL Logo" onerror="this.style.display='none'" />
        <div class="company-titles">
          <h1>MALDIVES AIRPORTS COMPANY LIMITED</h1>
          <h2>FUEL SERVICES SECTION</h2>
          <p>VELANA INTERNATIONAL AIRPORT, MALDIVES</p>
        </div>
      </div>
      <div class="header-right">
        <div class="product-badge">${escapeHtml(productName)}</div>
        <div class="ticket-label">DELIVERY TICKET NO</div>
        <div class="ticket-num">${escapeHtml(deliveryNum)}</div>
      </div>
    </div>

    <!-- Meta row: Date, Payment, Refueling Mode -->
    <div class="meta-bar">
      <div>
        <span style="font-size: 8px; color: #555; text-transform: uppercase;">DATE:</span>
        <span style="font-size: 11px; font-weight: 900; margin-left: 6px;">${escapeHtml(dateFormatted)}</span>
      </div>
      <div class="check-group">
        <span style="font-size: 8px; color: #555;">PAYMENT:</span>
        <span class="check-item"><span class="box">${isCash ? '&#10003;' : ''}</span> CASH</span>
        <span class="check-item"><span class="box">${isCredit ? '&#10003;' : ''}</span> CREDIT</span>
      </div>
      <div class="check-group">
        <span style="font-size: 8px; color: #555;">REFUELLING:</span>
        <span class="check-item"><span class="box">${isInternal ? '&#10003;' : ''}</span> INTERNAL</span>
        <span class="check-item"><span class="box">${isInternational ? '&#10003;' : ''}</span> INTERNATIONAL</span>
        <span class="check-item"><span class="box">${isDomestic ? '&#10003;' : ''}</span> DOMESTIC</span>
      </div>
    </div>

    <!-- Flight & Operational Details Table -->
    <table class="grid-table">
      <tr>
        <td style="width: 36%;">
          <span class="label">CUSTOMER / OPERATOR</span>
          <span class="val">${customerDisplay}</span>
          ${operatorDisplay && operatorDisplay !== customerDisplay ? `<div style="font-size: 8.5px; font-weight: 800; color: #475569; margin-top: 2px;">OP: ${operatorDisplay}</div>` : ''}
          ${coDisplay ? `<div style="font-size: 8.5px; font-weight: 800; color: #1e3a8a; margin-top: 2px;">C/O: ${coDisplay}</div>` : ''}
        </td>
        <td style="width: 24%;">
          <span class="label">AIRCRAFT REG</span>
          <span class="val">${escapeHtml(log.aircraftReg || 'N/A')}</span>
        </td>
        <td style="width: 20%;">
          <span class="label">AIRCRAFT TYPE</span>
          <span class="val">${escapeHtml(log.aircraftType || 'N/A')}</span>
        </td>
        <td style="width: 20%;">
          <span class="label">FLIGHT NO.</span>
          <span class="val" style="color: #1e3a8a;">${escapeHtml(log.flightNumber || 'N/A')}</span>
        </td>
      </tr>
      <tr>
        <td>
          <span class="label">COMING FROM</span>
          <span class="val">${comingFrom}</span>
        </td>
        <td>
          <span class="label">GOING TO</span>
          <span class="val">${goingTo}</span>
        </td>
        <td colspan="2">
          <span class="label">STAND / PIT NUMBER</span>
          <span class="val">STAND ${escapeHtml(log.stand || 'N/A')}${log.pitNumber ? ` • PIT ${escapeHtml(log.pitNumber)}` : ''}</span>
        </td>
      </tr>
      <tr>
        <td colspan="4">
          <div style="display: flex; justify-content: space-around; padding: 2px 0;">
            <div>
              <span class="label">TIME REFUELLER ARRIVED</span>
              <span class="val">${escapeHtml(arrivedTime)}</span>
            </div>
            <div>
              <span class="label">TIME COMMENCED</span>
              <span class="val">${escapeHtml(commencedTime)}</span>
            </div>
            <div>
              <span class="label">TIME OVER (CLEARANCE)</span>
              <span class="val">${escapeHtml(overTime)}</span>
            </div>
          </div>
        </td>
      </tr>
    </table>

    <!-- Volume & Meter Readings Table -->
    <table class="volume-table">
      <thead>
        <tr>
          <th style="width: 20%;">EQUIPMENT NO.</th>
          <th style="width: 20%;">OPENING METER</th>
          <th style="width: 20%;">CLOSING METER</th>
          <th style="width: 20%;">NET VOLUME (LITRES)</th>
          <th style="width: 20%;">PRICE / TOTAL</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong style="font-size: 12px;">${escapeHtml(log.vehicleId || 'DF-12')}</strong></td>
          <td>${meterOpen}</td>
          <td>${meterClose}</td>
          <td><strong style="font-size: 13px; color: #000;">${volumeNumber > 0 ? volumeNumber.toLocaleString() : '-'}</strong></td>
          <td>${isCash ? (log.remarks && log.remarks.includes('$') ? escapeHtml(log.remarks) : 'Cash Rate: 1.85') : 'On Account'}</td>
        </tr>
        <tr>
          <td colspan="5" class="words-box">
            <span class="label">VOLUME DELIVERED (LITRES) IN WORDS:</span>
            <div class="in-words">${volumeInWords}</div>
          </td>
        </tr>
      </tbody>
    </table>

    <!-- Quality Control & Pre/Post Refueling Checks -->
    <div class="qc-box">
      <div class="qc-title">PRE / POST REFUELLING CHECKS & JIG COMPLIANCE</div>
      <div class="qc-checks-row">
        <span class="check-item"><span class="box">&#10003;</span> UNLOCK FILLER CAP</span>
        <span class="check-item"><span class="box">&#10003;</span> RESTORE FILLER CAP</span>
        <span class="check-item"><span class="box">&#10003;</span> PANEL CLOSED</span>
        <span class="check-item"><span class="box">&#10003;</span> WALK AROUND CHECK</span>
        <span class="check-item"><span class="box">&#10003;</span> CLEAR & BRIGHT</span>
        <span class="check-item"><span class="box">&#10003;</span> FREE OF WATER</span>
      </div>
      <div class="statement-box">
        THE FUEL DELIVERED WAS CHECKED BY AIRLINE REPRESENTATIVE AND FOUND CLEAR AND BRIGHT AND FREE OF WATER AND SEDIMENTS
      </div>
    </div>

    <!-- Dual Signatures Section -->
    <div class="signatures-container">
      <!-- Delivered By -->
      <div class="sig-col">
        <div class="sig-title">DELIVERED BY (MACL FUEL SERVICES)</div>
        <div class="sig-pad-box">
          <div style="font-family: 'Brush Script MT', cursive, sans-serif; font-size: 24px; color: #1e3a8a; font-style: italic;">
            ${deliveringOfficer}
          </div>
        </div>
        <div class="sig-fields">
          <div class="sig-field-row">
            <span class="lbl">NAME:</span>
            <span class="val">${deliveringOfficer}</span>
          </div>
          <div class="sig-field-row">
            <span class="lbl">DESIGNATION:</span>
            <span class="val">${deliveringDesignation}</span>
          </div>
        </div>
      </div>

      <!-- Received By -->
      <div class="sig-col">
        <div class="sig-title">RECEIVED BY (AIRLINE REPRESENTATIVE)</div>
        <div class="sig-pad-box">
          ${signatureImg 
            ? `<img src="${signatureImg}" alt="Customer Signature" />` 
            : `<span style="font-size: 11px; color: #94a3b8; font-style: italic; font-weight: bold;">Signature on File</span>`
          }
        </div>
        <div class="sig-fields">
          <div class="sig-field-row">
            <span class="lbl">NAME:</span>
            <span class="val">${signerName}</span>
          </div>
          <div class="sig-field-row">
            <span class="lbl">DESIGNATION:</span>
            <span class="val">${signerDesignation}</span>
          </div>
          ${signedAt ? `
          <div class="sig-field-row">
            <span class="lbl">SIGNED AT:</span>
            <span class="val" style="font-size: 8.5px; font-weight: 700;">${formatDateTime(signedAt)}</span>
          </div>` : ''}
        </div>
      </div>
    </div>

    <!-- Official Certification Footer -->
    <div class="footer-note">
      <div class="compliance-text">
        (CERTIFIED THAT THE PRODUCT SUPPLIED HEREIN CONFIRMS TO AFQRJOS, LATEST CHECK LIST) &nbsp;&bull;&nbsp; FORM NO: G-001
      </div>
      <div class="contact-text">
        Maldives Airports Company Limited, Fuel Services, Velana International Airport, Republic of Maldives.<br/>
        Tel: (960) 3337261 &nbsp;|&nbsp; E-mail: fuel@macl.aero &nbsp;|&nbsp; Website: www.macl.aero
      </div>
    </div>
  </div>

  <script>
    window.onload = function() {
      // Small timeout to ensure images are loaded
      setTimeout(function() {
        window.print();
      }, 300);
    };
  </script>
</body>
</html>`;
}

/**
 * Resolves all normalized fields needed to render the G-001 Invoice (HTML or PDF Canvas)
 */
function resolveInvoiceFields(log: Partial<FlightLog>, operatorUser?: Partial<User>) {
  const deliveryNum = log.deliveryNumber || `MLE-${Math.floor(100000 + Math.random() * 900000)}`;
  const dateFormatted = formatDate(log.timestampStart || log.operationalDate || log.created_at);
  const volumeNumber = typeof log.volume === 'number' ? log.volume : parseFloat(String(log.volume || 0));
  const volumeInWords = numberToWords(volumeNumber);

  const isCash = (log.paymentType || '').toUpperCase() === 'CASH';
  const isCredit = !isCash;

  const isMarineOrSeaplane =
    log.logType === 'MARINE' ||
    log.logType === 'SEAPLANE' ||
    (log.flightNumber || '').startsWith('SEAPLANE') ||
    (log.flightNumber || '').startsWith('VESSEL') ||
    ['SEA', 'MARINE'].includes((log.intDom || '').toUpperCase());

  const isDomestic = isMarineOrSeaplane || !!log.isDomestic || ['DOMESTIC', 'DOM', 'DOM.'].includes((log.intDom || '').toUpperCase());
  const isInternal = !isMarineOrSeaplane && (log.intDom || '').toUpperCase() === 'INTERNAL';
  const isInternational = !isDomestic && !isInternal;

  const arrivedTime = formatTime(log.timestampArrived || log.timestampStart);
  const commencedTime = formatTime(log.timestampFinalStart || log.timestampStart);
  const overTime = formatTime(log.timestampFinalEnd || log.timestampClearance);

  let deliveringOfficer =
    log.officer ||
    log.tacticalOperator ||
    (log.operatorId && !log.operatorId.startsWith('st-') ? log.operatorId : '') ||
    operatorUser?.name ||
    'Refuelling Officer';

  let deliveringDesignation = (operatorUser as any)?.designation;
  if (!deliveringDesignation && typeof window !== 'undefined') {
    try {
      const rawStaff = localStorage.getItem('fms_staff_list_v3');
      if (rawStaff) {
        const staffList: any[] = JSON.parse(rawStaff);
        const officerLower = (deliveringOfficer || '').toLowerCase().trim();
        const matched = staffList.find(
          s =>
            (operatorUser?.id && s.id === operatorUser.id) ||
            (s.name && s.name.toLowerCase().trim() === officerLower) ||
            (log.operatorId && (s.id === log.operatorId || s.employeeId?.toLowerCase() === log.operatorId.toLowerCase()))
        );
        if (matched?.designation) {
          deliveringDesignation = matched.designation;
        }
      }
    } catch {}
  }
  if (!deliveringDesignation) {
    deliveringDesignation = operatorUser?.role ? operatorUser.role.replace(/_/g, ' ') : 'Refuelling Officer / Operator';
  }

  let signatureImg = log.signatureDataUrl;
  let signerName = log.signerName;
  let signerDesignation = log.signerDesignation;
  let signerEmail = log.signerEmail;
  let signedAt = log.signedAt;

  if (typeof window !== 'undefined') {
    try {
      const keysToTry = [
        log.deliveryNumber ? `fms_sig_${log.deliveryNumber}` : null,
        log.id ? `fms_sig_${log.id}` : null,
        log.flightNumber ? `fms_sig_${log.flightNumber}` : null,
      ].filter(Boolean) as string[];

      for (const k of keysToTry) {
        const raw = localStorage.getItem(k);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed.signatureDataUrl) {
            signatureImg = signatureImg || parsed.signatureDataUrl;
            signerName = signerName || parsed.signerName;
            signerDesignation = signerDesignation || parsed.signerDesignation;
            signerEmail = signerEmail || parsed.signerEmail;
            signedAt = signedAt || parsed.signedAt;
            break;
          }
        }
      }

      if (!signatureImg) {
        const rawRecent = localStorage.getItem('fms_recent_flight_logs');
        if (rawRecent) {
          const recents: FlightLog[] = JSON.parse(rawRecent);
          const match = recents.find(
            r => (log.deliveryNumber && r.deliveryNumber === log.deliveryNumber) || (log.id && r.id === log.id)
          );
          if (match && match.signatureDataUrl) {
            signatureImg = match.signatureDataUrl;
            signerName = signerName || match.signerName;
            signerDesignation = signerDesignation || match.signerDesignation;
            signerEmail = signerEmail || match.signerEmail;
            signedAt = signedAt || match.signedAt;
          }
        }
      }
    } catch {}
  }

  signerName = signerName ? signerName.toUpperCase() : 'AUTHORIZED FLIGHT CREW REP';
  signerDesignation = signerDesignation || 'Captain / Representative';

  let customerDisplay = '';
  let operatorDisplay = '';

  if (log.isAdhoc) {
    customerDisplay = log.co || (log.airline && log.airline !== 'Maldivian' ? log.airline : '') || 'GENERAL AVIATION';
    operatorDisplay = log.operatorName || (log.airline && log.airline !== customerDisplay && log.airline !== 'Maldivian' ? log.airline : '') || '';
  } else if (log.logType === 'SEAPLANE' || (log.flightNumber || '').startsWith('SEAPLANE')) {
    const spCust = log.airline || log.operatorName || (log.flightNumber ? log.flightNumber.replace('SEAPLANE-', '') : '') || log.co || 'SEAPLANE OPERATOR';
    customerDisplay = spCust;
    operatorDisplay = spCust;
  } else if (log.logType === 'MARINE' || (log.flightNumber || '').startsWith('VESSEL')) {
    const vesselName = (log as any).vesselName || log.operatorName || (log.flightNumber ? log.flightNumber.replace('VESSEL-', '') : '') || log.co || 'MARINE VESSEL';
    customerDisplay = vesselName;
    operatorDisplay = vesselName;
  } else if (log.logType === 'FILLING_STATION' || (log.flightNumber || '').startsWith('GROUND-')) {
    const fsCust = log.airline || (log as any).customer || log.operatorName || 'GROUND OPERATIONS';
    customerDisplay = fsCust;
    operatorDisplay = log.operatorName || log.airline || '';
  } else {
    customerDisplay = log.airline || (log as any).customer || 'Maldivian';
    operatorDisplay = log.operatorName || (log.co && log.co !== customerDisplay ? log.co : '');
  }
  const productName = String(
    (log as any).product ||
    ((log.flightNumber || '').toUpperCase().includes('PETROL') ? 'PETROL' :
     (log.flightNumber || '').toUpperCase().includes('DIESEL') ? 'DIESEL' : 'JET A-1')
  ).toUpperCase();
  const coDisplay = log.co && log.co !== customerDisplay ? log.co : '';

  let goingTo = log.destination || '';
  if (!goingTo && log.route) {
    if (log.route.includes('➔')) {
      goingTo = log.route.split('➔').pop()?.trim() || '';
    } else if (log.route.includes('-')) {
      goingTo = log.route.split('-').pop()?.trim() || '';
    } else {
      goingTo = log.route;
    }
  }
  if (!goingTo) goingTo = 'N/A';

  let comingFrom = (log as any).origin || '';
  if (!comingFrom && log.route && log.route.includes('➔')) {
    const parts = log.route.split('➔').map(p => p.trim());
    if (parts.length > 1) comingFrom = parts[0];
  }
  if (!comingFrom) comingFrom = 'MLE';

  const meterOpen = typeof log.meterOpen === 'number' ? log.meterOpen.toLocaleString() : String(log.meterOpen || '-');
  const meterClose = typeof log.meterClose === 'number' ? log.meterClose.toLocaleString() : String(log.meterClose || '-');
  const priceText = isCash ? (log.remarks && log.remarks.includes('$') ? log.remarks : 'Cash Rate: 1.85') : 'On Account';

  return {
    deliveryNum: String(deliveryNum),
    productName,
    dateFormatted: String(dateFormatted),
    volumeNumber,
    volumeFormatted: volumeNumber > 0 ? volumeNumber.toLocaleString() : '-',
    volumeInWords: String(volumeInWords),
    isCash,
    isCredit,
    isDomestic,
    isInternal,
    isInternational,
    arrivedTime: String(arrivedTime),
    commencedTime: String(commencedTime),
    overTime: String(overTime),
    deliveringOfficer: String(deliveringOfficer),
    deliveringDesignation: String(deliveringDesignation),
    signatureImg,
    signerName: String(signerName),
    signerDesignation: String(signerDesignation),
    signerEmail: signerEmail ? String(signerEmail) : '',
    signedAtFormatted: signedAt ? formatDateTime(signedAt) : '',
    customerDisplay: String(customerDisplay).toUpperCase(),
    operatorDisplay: String(operatorDisplay).toUpperCase(),
    coDisplay: String(coDisplay).toUpperCase(),
    aircraftReg: String(log.aircraftReg || 'N/A').toUpperCase(),
    aircraftType: String(log.aircraftType || 'N/A').toUpperCase(),
    flightNumber: String(log.flightNumber || 'N/A').toUpperCase(),
    comingFrom: String(comingFrom).toUpperCase(),
    goingTo: String(goingTo).toUpperCase(),
    standAndPit: `STAND ${String(log.stand || 'N/A').toUpperCase()}${log.pitNumber ? ` • PIT ${String(log.pitNumber).toUpperCase()}` : ''}`,
    vehicleId: String(log.vehicleId || 'DF-12').toUpperCase(),
    meterOpen,
    meterClose,
    priceText: String(priceText),
  };
}

/**
 * Helper to load a data URL or CORS-safe image with a timeout
 */
function loadImageSafe(src: string, timeoutMs = 400): Promise<HTMLImageElement | null> {
  return new Promise(resolve => {
    if (!src) return resolve(null);
    const img = new Image();
    if (!src.startsWith('data:')) {
      img.crossOrigin = 'anonymous';
    }
    const timer = setTimeout(() => resolve(null), timeoutMs);
    img.onload = () => {
      clearTimeout(timer);
      resolve(img);
    };
    img.onerror = () => {
      clearTimeout(timer);
      resolve(null);
    };
    img.src = src;
  });
}

/**
 * Draws the complete A4 Jet A-1 Delivery Invoice (FORM NO: G-001) onto an HTMLCanvasElement
 */
async function renderInvoiceToCanvas(log: Partial<FlightLog>, operatorUser?: Partial<User>): Promise<HTMLCanvasElement> {
  const d = resolveInvoiceFields(log, operatorUser);
  const canvas = document.createElement('canvas');
  // A4 portrait at ~150 DPI
  const W = 1240;
  const H = 1754;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  // White page background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  // Outer Invoice Box
  const boxX = 72;
  const boxY = 72;
  const boxW = W - 144; // 1096
  const boxH = H - 144; // 1610
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 3;
  ctx.strokeRect(boxX, boxY, boxW, boxH);

  const inX = boxX + 28; // 100
  const inW = boxW - 56; // 1040
  let curY = boxY + 28;  // 100

  // Helper: draw checkbox with optional checkmark
  const drawCheckbox = (x: number, y: number, checked: boolean, label: string) => {
    const size = 18;
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y - size + 3, size, size);
    if (checked) {
      ctx.save();
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(x + 3.5, y - size / 2 + 3);
      ctx.lineTo(x + 7.5, y - 1);
      ctx.lineTo(x + 14.5, y - size + 6);
      ctx.stroke();
      ctx.restore();
    }
    ctx.fillStyle = '#000000';
    ctx.font = '900 13px Arial, Helvetica, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(label, x + size + 6, y);
    return x + size + 6 + ctx.measureText(label).width + 18;
  };

  // Helper: truncate or wrap text to max width
  const fitText = (text: string, maxWidth: number): string => {
    if (ctx.measureText(text).width <= maxWidth) return text;
    let t = text;
    while (t.length > 3 && ctx.measureText(t + '...').width > maxWidth) {
      t = t.slice(0, -1);
    }
    return t + '...';
  };

  // ── 1. HEADER ──
  // Draw MACL Emblem Badge on left
  const logoImg = await loadImageSafe('https://static.routesonline.com/images/cached/organisation-14252-scaled-300x130.png', 250);
  let titleStartX = inX;
  if (logoImg) {
    try {
      const lw = 110;
      const lh = 52;
      ctx.drawImage(logoImg, inX, curY + 4, lw, lh);
      titleStartX = inX + lw + 16;
    } catch {
      titleStartX = inX;
    }
  } else {
    // Crisp vector MACL emblem badge fallback
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(inX, curY + 4, 76, 54);
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 20px Arial, Helvetica, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('MACL', inX + 38, curY + 36);
    ctx.fillStyle = '#06b6d4';
    ctx.fillRect(inX, curY + 52, 76, 6);
    titleStartX = inX + 92;
  }

  ctx.textAlign = 'left';
  ctx.fillStyle = '#000000';
  ctx.font = '900 20px Arial, Helvetica, sans-serif';
  ctx.fillText('MALDIVES AIRPORTS COMPANY LIMITED', titleStartX, curY + 22);

  ctx.fillStyle = '#333333';
  ctx.font = '800 15px Arial, Helvetica, sans-serif';
  ctx.fillText('FUEL SERVICES SECTION', titleStartX, curY + 43);

  ctx.fillStyle = '#555555';
  ctx.font = 'bold 13px Arial, Helvetica, sans-serif';
  ctx.fillText('VELANA INTERNATIONAL AIRPORT, MALDIVES', titleStartX, curY + 62);

  // Right side: JET A-1 badge + Delivery Ticket No
  const rightX = inX + inW;
  const badgeW = 156;
  const badgeH = 38;
  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.roundRect(rightX - badgeW, curY, badgeW, badgeH, 6);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.font = '900 23px Arial, Helvetica, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(d.productName || 'JET A-1', rightX - badgeW / 2, curY + 27);

  ctx.textAlign = 'right';
  ctx.fillStyle = '#666666';
  ctx.font = '900 12px Arial, Helvetica, sans-serif';
  ctx.fillText('DELIVERY TICKET NO', rightX, curY + 56);

  ctx.fillStyle = '#dc2626';
  ctx.font = '900 24px Arial, Helvetica, sans-serif';
  ctx.fillText(d.deliveryNum, rightX, curY + 82);

  curY += 98;
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(inX, curY);
  ctx.lineTo(inX + inW, curY);
  ctx.stroke();

  curY += 18;

  // ── 2. META BAR ──
  const metaH = 48;
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(inX, curY, inW, metaH);
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(inX, curY, inW, metaH);

  const metaTextY = curY + 30;
  ctx.textAlign = 'left';
  ctx.fillStyle = '#555555';
  ctx.font = 'bold 12px Arial, Helvetica, sans-serif';
  ctx.fillText('DATE:', inX + 14, metaTextY);

  ctx.fillStyle = '#000000';
  ctx.font = '900 16px Arial, Helvetica, sans-serif';
  ctx.fillText(d.dateFormatted, inX + 60, metaTextY);

  // Payment Checkboxes
  let chkX = inX + 250;
  ctx.fillStyle = '#555555';
  ctx.font = 'bold 12px Arial, Helvetica, sans-serif';
  ctx.fillText('PAYMENT:', chkX, metaTextY);
  chkX += 74;
  chkX = drawCheckbox(chkX, metaTextY, d.isCash, 'CASH');
  chkX = drawCheckbox(chkX, metaTextY, d.isCredit, 'CREDIT');

  // Refuelling Checkboxes
  let refX = inX + 565;
  ctx.fillStyle = '#555555';
  ctx.font = 'bold 12px Arial, Helvetica, sans-serif';
  ctx.fillText('REFUELLING:', refX, metaTextY);
  refX += 92;
  refX = drawCheckbox(refX, metaTextY, d.isInternal, 'INTERNAL');
  refX = drawCheckbox(refX, metaTextY, d.isInternational, 'INTERNATIONAL');
  drawCheckbox(refX, metaTextY, d.isDomestic, 'DOMESTIC');

  curY += metaH + 18;

  // ── 3. FLIGHT & OPERATIONAL DETAILS TABLE ──
  const r1H = 92;
  const r2H = 68;
  const r3H = 68;
  const gridH = r1H + r2H + r3H;

  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 2;
  ctx.strokeRect(inX, curY, inW, gridH);

  // Column widths: 36%, 24%, 20%, 20%
  const c1W = Math.round(inW * 0.36);
  const c2W = Math.round(inW * 0.24);
  const c3W = Math.round(inW * 0.20);
  const c4W = inW - c1W - c2W - c3W;

  const x1 = inX;
  const x2 = x1 + c1W;
  const x3 = x2 + c2W;
  const x4 = x3 + c3W;

  // Horizontal dividers
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(inX, curY + r1H);
  ctx.lineTo(inX + inW, curY + r1H);
  ctx.moveTo(inX, curY + r1H + r2H);
  ctx.lineTo(inX + inW, curY + r1H + r2H);
  // Vertical dividers for Row 1
  ctx.moveTo(x2, curY);
  ctx.lineTo(x2, curY + r1H + r2H);
  ctx.moveTo(x3, curY);
  ctx.lineTo(x3, curY + r1H + r2H);
  ctx.moveTo(x4, curY);
  ctx.lineTo(x4, curY + r1H);
  ctx.stroke();

  const drawCellLabelVal = (cx: number, cy: number, cw: number, label: string, val: string, valColor = '#000000') => {
    ctx.textAlign = 'left';
    ctx.fillStyle = '#444444';
    ctx.font = '900 11.5px Arial, Helvetica, sans-serif';
    ctx.fillText(label, cx + 12, cy + 20);

    ctx.fillStyle = valColor;
    ctx.font = '900 16px Arial, Helvetica, sans-serif';
    ctx.fillText(fitText(val, cw - 24), cx + 12, cy + 44);
  };

  // Row 1 cells
  drawCellLabelVal(x1, curY, c1W, 'CUSTOMER / OPERATOR', d.customerDisplay);
  let subY = curY + 64;
  if (d.operatorDisplay && d.operatorDisplay !== d.customerDisplay) {
    ctx.fillStyle = '#475569';
    ctx.font = '800 12px Arial, Helvetica, sans-serif';
    ctx.fillText(fitText(`OP: ${d.operatorDisplay}`, c1W - 24), x1 + 12, subY);
    subY += 16;
  }
  if (d.coDisplay) {
    ctx.fillStyle = '#1e3a8a';
    ctx.font = '800 12px Arial, Helvetica, sans-serif';
    ctx.fillText(fitText(`C/O: ${d.coDisplay}`, c1W - 24), x1 + 12, subY);
  }

  drawCellLabelVal(x2, curY, c2W, 'AIRCRAFT REG', d.aircraftReg);
  drawCellLabelVal(x3, curY, c3W, 'AIRCRAFT TYPE', d.aircraftType);
  drawCellLabelVal(x4, curY, c4W, 'FLIGHT NO.', d.flightNumber, '#1e3a8a');

  // Row 2 cells
  const r2Y = curY + r1H;
  drawCellLabelVal(x1, r2Y, c1W, 'COMING FROM', d.comingFrom);
  drawCellLabelVal(x2, r2Y, c2W, 'GOING TO', d.goingTo);
  drawCellLabelVal(x3, r2Y, c3W + c4W, 'STAND / PIT NUMBER', d.standAndPit);

  // Row 3: Timings (3 evenly spaced blocks)
  const r3Y = curY + r1H + r2H;
  const tColW = inW / 3;
  drawCellLabelVal(inX + 20, r3Y, tColW - 20, 'TIME REFUELLER ARRIVED', d.arrivedTime);
  drawCellLabelVal(inX + tColW + 20, r3Y, tColW - 20, 'TIME COMMENCED', d.commencedTime);
  drawCellLabelVal(inX + tColW * 2 + 20, r3Y, tColW - 20, 'TIME OVER (CLEARANCE)', d.overTime);

  curY += gridH + 18;

  // ── 4. VOLUME & METER READINGS TABLE ──
  const vHeadH = 42;
  const vRowH = 54;
  const vWordsH = 74;
  const volTableH = vHeadH + vRowH + vWordsH;

  // Header fill
  ctx.fillStyle = '#f1f5f9';
  ctx.fillRect(inX, curY, inW, vHeadH);

  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 2.5;
  ctx.strokeRect(inX, curY, inW, volTableH);

  const vColW = inW / 5;
  const vHeaders = ['EQUIPMENT NO.', 'OPENING METER', 'CLOSING METER', 'NET VOLUME (LITRES)', 'PRICE / TOTAL'];
  const vValues = [d.vehicleId, d.meterOpen, d.meterClose, d.volumeFormatted, d.priceText];

  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(inX, curY + vHeadH);
  ctx.lineTo(inX + inW, curY + vHeadH);
  ctx.moveTo(inX, curY + vHeadH + vRowH);
  ctx.lineTo(inX + inW, curY + vHeadH + vRowH);

  for (let i = 0; i < 5; i++) {
    const vx = inX + i * vColW;
    if (i > 0) {
      ctx.moveTo(vx, curY);
      ctx.lineTo(vx, curY + vHeadH + vRowH);
    }
    ctx.textAlign = 'center';
    ctx.fillStyle = '#000000';
    ctx.font = '900 12.5px Arial, Helvetica, sans-serif';
    ctx.fillText(vHeaders[i], vx + vColW / 2, curY + 26);

    ctx.font = i === 3 ? '900 20px Arial, Helvetica, sans-serif' : 'bold 16px Arial, Helvetica, sans-serif';
    ctx.fillText(fitText(vValues[i], vColW - 14), vx + vColW / 2, curY + vHeadH + 34);
  }
  ctx.stroke();

  // Volume in words row
  const wordsY = curY + vHeadH + vRowH;
  ctx.textAlign = 'left';
  ctx.fillStyle = '#444444';
  ctx.font = '900 11.5px Arial, Helvetica, sans-serif';
  ctx.fillText('VOLUME DELIVERED (LITRES) IN WORDS:', inX + 14, wordsY + 22);

  ctx.fillStyle = '#1e3a8a';
  ctx.font = 'italic 900 17px Arial, Helvetica, sans-serif';
  ctx.fillText(fitText(d.volumeInWords, inW - 28), inX + 14, wordsY + 50);

  curY += volTableH + 18;

  // ── 5. PRE / POST REFUELLING CHECKS & JIG COMPLIANCE ──
  const qcH = 132;
  ctx.fillStyle = '#fafafa';
  ctx.fillRect(inX, curY, inW, qcH);
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 2;
  ctx.strokeRect(inX, curY, inW, qcH);

  ctx.fillStyle = '#1e3a8a';
  ctx.font = '900 13px Arial, Helvetica, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('PRE / POST REFUELLING CHECKS & JIG COMPLIANCE', inX + 14, curY + 24);

  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(inX + 14, curY + 34);
  ctx.lineTo(inX + inW - 14, curY + 34);
  ctx.stroke();

  const qcItems = [
    'UNLOCK FILLER CAP',
    'RESTORE FILLER CAP',
    'PANEL CLOSED',
    'WALK AROUND CHECK',
    'CLEAR & BRIGHT',
    'FREE OF WATER',
  ];
  let qx = inX + 14;
  const qy = curY + 66;
  for (const item of qcItems) {
    qx = drawCheckbox(qx, qy, true, item);
  }

  // Dashed divider
  ctx.save();
  ctx.setLineDash([6, 4]);
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(inX + 14, curY + 86);
  ctx.lineTo(inX + inW - 14, curY + 86);
  ctx.stroke();
  ctx.restore();

  ctx.textAlign = 'center';
  ctx.fillStyle = '#000000';
  ctx.font = '900 12.5px Arial, Helvetica, sans-serif';
  ctx.fillText(
    'THE FUEL DELIVERED WAS CHECKED BY AIRLINE REPRESENTATIVE AND FOUND CLEAR AND BRIGHT AND FREE OF WATER AND SEDIMENTS',
    inX + inW / 2,
    curY + 112
  );

  curY += qcH + 18;

  // ── 6. DUAL SIGNATURES SECTION ──
  const sigGap = 20;
  const sigColW = (inW - sigGap) / 2;
  const sigH = 310;

  const leftSigX = inX;
  const rightSigX = inX + sigColW + sigGap;

  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 2;
  ctx.strokeRect(leftSigX, curY, sigColW, sigH);
  ctx.strokeRect(rightSigX, curY, sigColW, sigH);

  // Titles
  ctx.textAlign = 'left';
  ctx.fillStyle = '#000000';
  ctx.font = '900 13.5px Arial, Helvetica, sans-serif';
  ctx.fillText('DELIVERED BY (MACL FUEL SERVICES)', leftSigX + 14, curY + 26);
  ctx.fillText('RECEIVED BY (AIRLINE REPRESENTATIVE)', rightSigX + 14, curY + 26);

  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(leftSigX + 14, curY + 36);
  ctx.lineTo(leftSigX + sigColW - 14, curY + 36);
  ctx.moveTo(rightSigX + 14, curY + 36);
  ctx.lineTo(rightSigX + sigColW - 14, curY + 36);
  ctx.stroke();

  // Signature Pads
  const padBottomY = curY + 186;
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(leftSigX + 14, padBottomY);
  ctx.lineTo(leftSigX + sigColW - 14, padBottomY);
  ctx.moveTo(rightSigX + 14, padBottomY);
  ctx.lineTo(rightSigX + sigColW - 14, padBottomY);
  ctx.stroke();

  // Left signature (Delivering Officer cursive)
  ctx.textAlign = 'center';
  ctx.fillStyle = '#1e3a8a';
  ctx.font = 'italic bold 32px Georgia, "Times New Roman", serif';
  ctx.fillText(fitText(d.deliveringOfficer, sigColW - 40), leftSigX + sigColW / 2, curY + 125);

  // Right signature (Customer Signature image)
  if (d.signatureImg) {
    const sigImgEl = await loadImageSafe(d.signatureImg, 400);
    if (sigImgEl) {
      const maxW = sigColW - 48;
      const maxH = 128;
      const scale = Math.min(maxW / (sigImgEl.width || 400), maxH / (sigImgEl.height || 150));
      const dw = (sigImgEl.width || 400) * scale;
      const dh = (sigImgEl.height || 150) * scale;
      const dx = rightSigX + (sigColW - dw) / 2;
      const dy = curY + 46 + (maxH - dh) / 2;
      ctx.drawImage(sigImgEl, dx, dy, dw, dh);
    }
  } else {
    ctx.fillStyle = '#94a3b8';
    ctx.font = 'italic bold 16px Arial, Helvetica, sans-serif';
    ctx.fillText('Signature on File', rightSigX + sigColW / 2, curY + 120);
  }

  // Signature metadata rows
  const drawSigFieldRow = (colX: number, rowY: number, lbl: string, val: string) => {
    ctx.textAlign = 'left';
    ctx.fillStyle = '#555555';
    ctx.font = '900 12px Arial, Helvetica, sans-serif';
    ctx.fillText(lbl, colX + 14, rowY);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#000000';
    ctx.font = '900 13.5px Arial, Helvetica, sans-serif';
    ctx.fillText(fitText(val.toUpperCase(), sigColW - 130), colX + sigColW - 14, rowY);
  };

  drawSigFieldRow(leftSigX, curY + 222, 'NAME:', d.deliveringOfficer);
  drawSigFieldRow(leftSigX, curY + 258, 'DESIGNATION:', d.deliveringDesignation);

  drawSigFieldRow(rightSigX, curY + 222, 'NAME:', d.signerName);
  drawSigFieldRow(rightSigX, curY + 258, 'DESIGNATION:', d.signerDesignation);
  if (d.signedAtFormatted) {
    drawSigFieldRow(rightSigX, curY + 292, 'SIGNED AT:', d.signedAtFormatted);
  }

  // ── 7. OFFICIAL CERTIFICATION FOOTER ──
  const footerY = boxY + boxH - 86;
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(inX, footerY);
  ctx.lineTo(inX + inW, footerY);
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.fillStyle = '#dc2626';
  ctx.font = '900 12.5px Arial, Helvetica, sans-serif';
  ctx.fillText(
    '(CERTIFIED THAT THE PRODUCT SUPPLIED HEREIN CONFIRMS TO AFQRJOS, LATEST CHECK LIST)  •  FORM NO: G-001',
    inX + inW / 2,
    footerY + 24
  );

  ctx.fillStyle = '#4b5563';
  ctx.font = 'bold 11.5px Arial, Helvetica, sans-serif';
  ctx.fillText(
    'Maldives Airports Company Limited, Fuel Services, Velana International Airport, Republic of Maldives.',
    inX + inW / 2,
    footerY + 46
  );
  ctx.fillText(
    'Tel: (960) 3337261   |   E-mail: fuel@macl.aero   |   Website: www.macl.aero',
    inX + inW / 2,
    footerY + 64
  );

  return canvas;
}

/**
 * Wraps a JPEG byte array into a valid single-page A4 PDF 1.4 document binary
 */
function buildPdfFromJpegBytes(jpegBytes: Uint8Array, imgWidth: number, imgHeight: number): Uint8Array {
  const enc = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [0];
  let currentOffset = 0;

  const pushStr = (str: string) => {
    const bytes = enc.encode(str);
    chunks.push(bytes);
    currentOffset += bytes.length;
  };

  const pushBytes = (bytes: Uint8Array) => {
    chunks.push(bytes);
    currentOffset += bytes.length;
  };

  // %PDF-1.4 header + binary marker
  pushBytes(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a, 0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]));

  // 1: Catalog
  offsets[1] = currentOffset;
  pushStr(`1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`);

  // 2: Pages
  offsets[2] = currentOffset;
  pushStr(`2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n`);

  // 3: Page (A4 portrait: 595.28 x 841.89 pt)
  offsets[3] = currentOffset;
  pushStr(
    `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>\nendobj\n`
  );

  // 4: Image XObject (/DCTDecode JPEG)
  offsets[4] = currentOffset;
  pushStr(
    `4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${imgWidth} /Height ${imgHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.length} >>\nstream\n`
  );
  pushBytes(jpegBytes);
  pushStr(`\nendstream\nendobj\n`);

  // 5: Content Stream
  const contentStream = `q\n595.28 0 0 841.89 0 0 cm\n/Im0 Do\nQ\n`;
  const contentBytes = enc.encode(contentStream);
  offsets[5] = currentOffset;
  pushStr(`5 0 obj\n<< /Length ${contentBytes.length} >>\nstream\n`);
  pushBytes(contentBytes);
  pushStr(`\nendstream\nendobj\n`);

  // Xref
  const xrefOffset = currentOffset;
  pushStr(`xref\n0 6\n0000000000 65535 f \n`);
  for (let i = 1; i <= 5; i++) {
    const offStr = String(offsets[i]).padStart(10, '0');
    pushStr(`${offStr} 00000 n \n`);
  }

  // Trailer
  pushStr(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`);

  const out = new Uint8Array(currentOffset);
  let pos = 0;
  for (const chunk of chunks) {
    out.set(chunk, pos);
    pos += chunk.length;
  }
  return out;
}

/**
 * Generates an actual A4 .pdf File object for the given FlightLog delivery invoice
 */
export async function generateInvoicePdfFile(log: Partial<FlightLog>, operatorUser?: Partial<User>): Promise<File> {
  const canvas = await renderInvoiceToCanvas(log, operatorUser);
  const jpegDataUrl = canvas.toDataURL('image/jpeg', 0.92);
  const base64Data = jpegDataUrl.split(',')[1] || '';
  const binaryStr = atob(base64Data);
  const jpegBytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    jpegBytes[i] = binaryStr.charCodeAt(i);
  }

  const pdfBytes = buildPdfFromJpegBytes(jpegBytes, canvas.width, canvas.height);
  const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' });
  const cleanTicket = (log.deliveryNumber || 'MLE-INVOICE').replace(/[^A-Za-z0-9_-]/g, '_');
  const fileName = `MACL_Invoice_${cleanTicket}.pdf`;
  return new File([pdfBlob], fileName, { type: 'application/pdf', lastModified: Date.now() });
}

/**
 * Triggers a direct browser download of the generated .pdf Invoice File
 */
export async function downloadInvoicePdf(
  log: Partial<FlightLog>,
  operatorUser?: Partial<User>,
  prebuiltFile?: File | null
): Promise<File> {
  const pdfFile = prebuiltFile || (await generateInvoicePdfFile(log, operatorUser));
  const url = URL.createObjectURL(pdfFile);
  const a = document.createElement('a');
  a.href = url;
  a.download = pdfFile.name;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    try {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {}
  }, 1500);
  return pdfFile;
}

/**
 * Opens a print dialog popup window for the given flight log invoice (falls back to PDF download if popup blocked)
 */
export function openPrintInvoice(log: Partial<FlightLog>, operatorUser?: Partial<User>): boolean {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    // Fallback on mobile WebViews/PWAs where window.open is blocked: download the PDF directly
    downloadInvoicePdf(log, operatorUser).catch(() => {});
    return false;
  }

  const html = generateInvoiceHtml(log, operatorUser);
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  return true;
}

/**
 * Extracts and formats the structured email parameters for an Invoice dispatch
 */
export function getInvoiceEmailDetails(log: Partial<FlightLog>, recipientEmail?: string) {
  const deliveryNum = log.deliveryNumber || 'MLE-INVOICE';
  const flightNo = log.flightNumber || 'FLIGHT';
  const volume = typeof log.volume === 'number' ? log.volume.toLocaleString() : (log.volume || '0');
  const dateStr = formatDate(log.timestampStart || log.operationalDate || log.created_at);
  const aircraftReg = log.aircraftReg || 'N/A';
  const stand = log.stand || 'N/A';

  let goingTo = log.destination || '';
  if (!goingTo && log.route) {
    if (log.route.includes('➔')) {
      goingTo = log.route.split('➔').pop()?.trim() || '';
    } else if (log.route.includes('-')) {
      goingTo = log.route.split('-').pop()?.trim() || '';
    } else {
      goingTo = log.route;
    }
  }

  let signerName = log.signerName;
  let signerDesignation = log.signerDesignation;
  let signerEmail = recipientEmail ?? log.signerEmail;

  if ((!signerName || !signerEmail) && typeof window !== 'undefined') {
    try {
      const keysToTry = [
        log.deliveryNumber ? `fms_sig_${log.deliveryNumber}` : null,
        log.id ? `fms_sig_${log.id}` : null,
        log.flightNumber ? `fms_sig_${log.flightNumber}` : null,
      ].filter(Boolean) as string[];

      for (const k of keysToTry) {
        const raw = localStorage.getItem(k);
        if (raw) {
          const parsed = JSON.parse(raw);
          signerName = signerName || parsed.signerName;
          signerDesignation = signerDesignation || parsed.signerDesignation;
          signerEmail = signerEmail || parsed.signerEmail;
          if (signerName && signerEmail) break;
        }
      }
    } catch (e) {}
  }

  const cleanTo = (signerEmail || '').trim().replace(/\s+/g, '');
  const subject = `[MACL Fuel Services] Jet A-1 Delivery Invoice - ${deliveryNum} (${flightNo} / ${aircraftReg})`;

  const bodyText = `Dear Customer / Representative,

Please find the details of your official MACL Jet A-1 Fuel Delivery Invoice below (the signed PDF invoice ${deliveryNum}.pdf has also been generated):

========================================
MALDIVES AIRPORTS COMPANY LIMITED
FUEL SERVICES SECTION - FORM NO: G-001
========================================

Delivery Ticket No: ${deliveryNum}
Date: ${dateStr}
Flight Number: ${flightNo}
Aircraft Reg: ${aircraftReg}
Aircraft Type: ${log.aircraftType || 'N/A'}
Destination: ${goingTo || 'N/A'}
Stand / PIT: Stand ${stand}${log.pitNumber ? ` / Pit ${log.pitNumber}` : ''}

Net Fuel Uplift: ${volume} Litres
Volume in Words: ${numberToWords(log.volume)}
Meter Opening: ${log.meterOpen || '-'}
Meter Closing: ${log.meterClose || '-'}
Equipment: ${log.vehicleId || 'DF-12'}

Quality Control: JIG & AFQRJOS Verified (Clear & Bright, Free of Water)
Signer: ${(signerName || 'Flight Crew').toUpperCase()} (${signerDesignation || 'Authorized Representative'})

Best regards,
MACL Fuel Services Section
Velana International Airport, Republic of Maldives
Tel: (960) 3337261 | Email: fuel@macl.aero
`;

  return {
    to: cleanTo,
    subject,
    bodyText,
    deliveryNum,
    flightNo,
    aircraftReg
  };
}

/**
 * Prepares an instant email dispatch mailto link
 */
export function composeInvoiceEmailUri(log: Partial<FlightLog>, recipientEmail?: string): string {
  const { to, subject, bodyText } = getInvoiceEmailDetails(log, recipientEmail);
  return `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyText)}`;
}

/**
 * Extracts and formats the structured email parameters for a Flight Job dispatch
 */
export function getFlightJobEmailDetails(
  job: {
    flightNumber: string;
    airline?: string;
    aircraftReg?: string;
    aircraftType?: string;
    stand?: string;
    pitNumber?: string;
    estimatedVolume?: number;
    eta?: string;
    etd?: string;
    destination?: string;
    assignedOperator?: string;
    assignedVehicle?: string;
    status?: string;
    customerAccountName?: string;
    classification?: string;
    remainingBalance?: number;
  },
  recipientEmails: string[]
) {
  const to = recipientEmails.filter(Boolean).join(', ');
  const flightNo = job.flightNumber || 'FLIGHT';
  const airlineName = job.airline || job.customerAccountName || 'Airline Partner';
  const subject = `[MACL Fuel Services] Flight Job Dispatch — ${flightNo} (${airlineName}${job.aircraftReg ? ` / ${job.aircraftReg}` : ''})`;

  const estVol = job.estimatedVolume ? `${job.estimatedVolume.toLocaleString()} L` : 'TBD on Apron';
  const balanceLine =
    job.remainingBalance !== undefined
      ? `Account Status: ${job.classification || 'ACTIVE'} (Balance: $${job.remainingBalance.toLocaleString()})`
      : `Account Status: ${job.classification || 'ACTIVE'}`;

  const bodyText = `Dear ${airlineName} Flight Operations / Dispatch Team,

Please find your scheduled Jet A-1 Refuelling Flight Job details from MACL Fuel Services below:

========================================
MACL FUEL SERVICES — FLIGHT JOB DISPATCH
========================================

Customer Account : ${job.customerAccountName || airlineName}
${balanceLine}
Flight Number    : ${flightNo}
Airline          : ${airlineName}
Aircraft Reg     : ${job.aircraftReg || 'TBA'}
Aircraft Type    : ${job.aircraftType || 'TBA'}
Destination      : ${job.destination || 'TBA'}
Stand / Pit      : Stand ${job.stand || 'TBA'}${job.pitNumber ? ` • Pit ${job.pitNumber}` : ''}
ETA / ETD        : ${job.eta || '--:--'} / ${job.etd || '--:--'}
Planned Uplift   : ${estVol}
Assigned Crew    : ${job.assignedOperator || 'Assigned on Apron'} (${job.assignedVehicle || 'Bowser/Dispenser'})
Job Status       : ${job.status || 'DISPATCHED'}

Once refuelling is completed and signed on the apron, the digital Delivery Ticket (Form G-001) and real-time account balance update will be recorded automatically.

Best regards,
MACL Fuel Services Section
Velana International Airport, Republic of Maldives
Tel: (960) 3337261 | Email: fuel@macl.aero
`;

  return {
    to,
    subject,
    bodyText,
    flightNo,
    airlineName
  };
}

/**
 * Composes a mailto URI to send a Flight Job notification to an airline's configured email addresses
 */
export function composeFlightJobEmailUri(
  job: Parameters<typeof getFlightJobEmailDetails>[0],
  recipientEmails: string[]
): string {
  const { to, subject, bodyText } = getFlightJobEmailDetails(job, recipientEmails);
  const cleanTo = to.replace(/\s+/g, '');
  return `mailto:${cleanTo}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyText)}`;
}

/**
 * Opens Microsoft 365 / Outlook on the Web in a new tab with pre-filled fields
 * (Matches MACL's @macl.aero Exchange Online infrastructure)
 */
export function openInOutlookWeb(to: string, subject: string, bodyText: string): void {
  const url = `https://outlook.office.com/mail/deeplink/compose?to=${encodeURIComponent(to)}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyText)}`;
  window.open(url, '_blank', 'noopener,noreferrer');
}

/**
 * Opens Gmail Web in a new tab with pre-filled fields
 */
export function openInGmail(to: string, subject: string, bodyText: string): void {
  const url = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(to)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyText)}`;
  window.open(url, '_blank', 'noopener,noreferrer');
}

/**
 * Opens the device's default mail client via mailto:
 */
export function openSystemMailto(to: string, subject: string, bodyText: string): void {
  const cleanTo = to.replace(/\s+/g, '');
  const uri = `mailto:${cleanTo}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyText)}`;
  const link = document.createElement('a');
  link.href = uri;
  link.target = '_top';
  link.rel = 'noopener noreferrer';
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  setTimeout(() => {
    try {
      document.body.removeChild(link);
    } catch {}
  }, 500);
}

/**
 * Helper to convert a Blob or File to Base64
 */
async function fileToBase64(blobOrFile: Blob | File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(',')[1] || '';
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blobOrFile);
  });
}

/**
 * Generates and downloads a standard RFC 822 MIME .eml email draft file
 * with X-Unsent: 1 so Outlook Desktop immediately opens it as an editable draft
 * with the signed PDF invoice already attached!
 */
export async function downloadEmlDraft({
  filename,
  to,
  subject,
  bodyText,
  attachmentFile,
  attachmentFilename
}: {
  filename?: string;
  to: string;
  subject: string;
  bodyText: string;
  attachmentFile?: File | Blob | null;
  attachmentFilename?: string;
}): Promise<void> {
  const boundaryMixed = `----=_Part_MACL_MIXED_${Date.now()}`;
  const boundaryAlt = `----=_Part_MACL_ALT_${Date.now()}`;
  const nowStr = new Date().toUTCString();

  let eml = `From: MACL Fuel Services <fuel@macl.aero>\r\n`;
  eml += `To: ${to}\r\n`;
  eml += `Subject: ${subject}\r\n`;
  eml += `Date: ${nowStr}\r\n`;
  eml += `MIME-Version: 1.0\r\n`;
  eml += `X-Unsent: 1\r\n`;

  if (attachmentFile) {
    const base64Data = await fileToBase64(attachmentFile);
    const attachName = attachmentFilename || (attachmentFile instanceof File ? attachmentFile.name : 'Invoice.pdf');

    eml += `Content-Type: multipart/mixed; boundary="${boundaryMixed}"\r\n\r\n`;
    eml += `--${boundaryMixed}\r\n`;
    eml += `Content-Type: text/plain; charset=UTF-8\r\n`;
    eml += `Content-Transfer-Encoding: 8bit\r\n\r\n`;
    eml += `${bodyText}\r\n\r\n`;

    eml += `--${boundaryMixed}\r\n`;
    eml += `Content-Type: application/pdf; name="${attachName}"\r\n`;
    eml += `Content-Transfer-Encoding: base64\r\n`;
    eml += `Content-Disposition: attachment; filename="${attachName}"\r\n\r\n`;

    const chunks = base64Data.match(/.{1,76}/g) || [];
    eml += chunks.join('\r\n') + '\r\n\r\n';
    eml += `--${boundaryMixed}--\r\n`;
  } else {
    eml += `Content-Type: text/plain; charset=UTF-8\r\n`;
    eml += `Content-Transfer-Encoding: 8bit\r\n\r\n`;
    eml += bodyText;
  }

  const blob = new Blob([eml], { type: 'message/rfc822' });
  const downloadUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = downloadUrl;
  a.download = `${filename || 'Email_Draft'}.eml`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    try {
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);
    } catch {}
  }, 1000);
}

/**
 * Dispatches an email to the representative:
 * Downloads the .pdf invoice file for attachment, checks preferred client (or defaults to Outlook Web / mailto)
 */
export async function sendInvoiceEmail(
  log: Partial<FlightLog>,
  recipientEmail?: string,
  operatorUser?: Partial<User>,
  prebuiltFile?: File | null
): Promise<void> {
  const { to, subject, bodyText, deliveryNum } = getInvoiceEmailDetails(log, recipientEmail);

  // 1. Ensure the .pdf invoice is generated
  let pdfFile: File | null = prebuiltFile || null;
  try {
    if (!pdfFile) {
      pdfFile = await generateInvoicePdfFile(log, operatorUser);
    }
  } catch (err) {
    console.warn('[InvoiceEmail] PDF generation note:', err);
  }

  // 2. Check preferred client in localStorage
  const preferred = (typeof window !== 'undefined' ? localStorage.getItem('fms_preferred_email_client') : null) || 'm365';

  if (preferred === 'eml' && pdfFile) {
    await downloadEmlDraft({
      filename: `${deliveryNum}_Draft`,
      to,
      subject,
      bodyText,
      attachmentFile: pdfFile,
      attachmentFilename: `${deliveryNum}.pdf`
    });
    return;
  }

  if (preferred === 'gmail') {
    openInGmail(to, subject, bodyText);
    return;
  }

  if (preferred === 'm365') {
    // Open official MACL Microsoft 365 webmail compose
    openInOutlookWeb(to, subject, bodyText);
    return;
  }

  // Fallback: System mailto
  openSystemMailto(to, subject, bodyText);
}

/**
 * Dispatches a flight job email based on user preference or Outlook Web
 */
export function sendFlightJobEmail(
  job: Parameters<typeof getFlightJobEmailDetails>[0],
  recipientEmails: string[]
): void {
  const { to, subject, bodyText, flightNo } = getFlightJobEmailDetails(job, recipientEmails);
  const preferred = (typeof window !== 'undefined' ? localStorage.getItem('fms_preferred_email_client') : null) || 'm365';

  if (preferred === 'eml') {
    downloadEmlDraft({
      filename: `FlightJob_${flightNo}_Draft`,
      to,
      subject,
      bodyText
    });
    return;
  }

  if (preferred === 'gmail') {
    openInGmail(to, subject, bodyText);
    return;
  }

  if (preferred === 'm365') {
    openInOutlookWeb(to, subject, bodyText);
    return;
  }

  openSystemMailto(to, subject, bodyText);
}

/**
 * Shares the actual .pdf invoice file using the native Web Share API (no app URL link),
 * falling back to downloading the .pdf file if file sharing is unsupported on the browser.
 */
export async function shareInvoice(
  log: Partial<FlightLog>,
  operatorUser?: Partial<User>,
  prebuiltFile?: File | null
): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const deliveryNum = log.deliveryNumber || 'MLE-INVOICE';
  const flightNo = log.flightNumber || 'FLIGHT';
  const volume = typeof log.volume === 'number' ? log.volume.toLocaleString() : (log.volume || '0');

  const pdfFile = prebuiltFile || (await generateInvoicePdfFile(log, operatorUser));

  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    const canShareFiles =
      typeof navigator.canShare === 'function' ? navigator.canShare({ files: [pdfFile] }) : true;

    if (canShareFiles) {
      try {
        await navigator.share({
          files: [pdfFile],
          title: `MACL Fuel Delivery Invoice - ${deliveryNum}`,
          text: `MACL Jet A-1 Fuel Uplift Invoice for Flight ${flightNo} (${log.aircraftReg || ''}): ${volume} Litres delivered. Form G-001 certified.`,
        });
        return 'shared';
      } catch (err: any) {
        if (err?.name === 'AbortError') {
          return 'cancelled';
        }
        try {
          await navigator.share({
            files: [pdfFile],
            title: `MACL Fuel Delivery Invoice - ${deliveryNum}`,
          });
          return 'shared';
        } catch (err2: any) {
          if (err2?.name === 'AbortError') {
            return 'cancelled';
          }
        }
      }
    }
  }

  await downloadInvoicePdf(log, operatorUser, pdfFile);
  return 'downloaded';
}

