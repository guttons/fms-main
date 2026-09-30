import { FlightLog, User } from '../types';
import { numberToWords } from '../utils/numberToWords';

/**
 * Formats an ISO string or time string into HH:MM or HHMM
 */
function formatTime(isoString?: string | null): string {
  if (!isoString) return '-';
  try {
    const d = new Date(isoString);
    if (!isNaN(d.getTime())) {
      const h = String(d.getHours()).padStart(2, '0');
      const m = String(d.getMinutes()).padStart(2, '0');
      return `${h}:${m}`;
    }
    // If it's already HH:MM
    if (/^\d{2}:\d{2}/.test(isoString)) {
      return isoString.substring(0, 5);
    }
  } catch {}
  return isoString || '-';
}

/**
 * Formats an operational date to DD/MM/YYYY
 */
function formatDate(dateStr?: string | null): string {
  if (!dateStr) return new Date().toLocaleDateString('en-GB');
  try {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    }
  } catch {}
  return dateStr;
}

/**
 * Generates high-fidelity HTML for Jet A-1 FORM NO: G-001 Delivery Invoice
 */
export function generateInvoiceHtml(log: Partial<FlightLog>, operatorUser?: Partial<User>): string {
  const deliveryNum = log.deliveryNumber || `MLE-${Math.floor(100000 + Math.random() * 900000)}`;
  const dateFormatted = formatDate(log.timestampStart || log.created_at);
  const volumeNumber = typeof log.volume === 'number' ? log.volume : parseFloat(String(log.volume || 0));
  const volumeInWords = numberToWords(volumeNumber);
  
  const isCash = (log.paymentType || '').toUpperCase() === 'CASH';
  const isCredit = !isCash;

  const isDomestic = !!log.isDomestic || (log.intDom || '').toUpperCase() === 'DOMESTIC';
  const isInternal = (log.intDom || '').toUpperCase() === 'INTERNAL';
  const isInternational = !isDomestic && !isInternal;

  const arrivedTime = formatTime(log.timestampArrived || log.timestampStart);
  const commencedTime = formatTime(log.timestampFinalStart || log.timestampStart);
  const overTime = formatTime(log.timestampFinalEnd || log.timestampClearance);

  const operatorName = log.operatorName || operatorUser?.name || 'AFSAH';
  const operatorDesignation = operatorUser?.role ? operatorUser.role.replace(/_/g, ' ') : 'Refuelling Officer / Operator';

  const signerName = log.signerName || 'Authorized Flight Crew Rep';
  const signerDesignation = log.signerDesignation || 'Captain / Rep';
  const signatureImg = log.signatureDataUrl;

  const meterOpen = typeof log.meterOpen === 'number' ? log.meterOpen.toLocaleString() : (log.meterOpen || '-');
  const meterClose = typeof log.meterClose === 'number' ? log.meterClose.toLocaleString() : (log.meterClose || '-');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Jet A-1 Fuel Delivery Invoice - ${deliveryNum}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 8mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 10px;
      line-height: 1.25;
      color: #000;
      background-color: #fff;
      margin: 0;
      padding: 0;
    }
    .invoice-wrapper {
      width: 100%;
      max-width: 194mm;
      margin: 0 auto;
      border: 2px solid #000;
      padding: 10px 12px;
      display: flex;
      flex-direction: column;
      gap: 8px;
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
      height: 52px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 6px;
      border-bottom: 1px solid #94a3b8;
      position: relative;
    }
    .sig-pad-box img {
      max-height: 48px;
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
        <div class="product-badge">JET A-1</div>
        <div class="ticket-label">DELIVERY TICKET NO</div>
        <div class="ticket-num">${deliveryNum}</div>
      </div>
    </div>

    <!-- Meta row: Date, Payment, Refueling Mode -->
    <div class="meta-bar">
      <div>
        <span style="font-size: 8px; color: #555; text-transform: uppercase;">DATE:</span>
        <span style="font-size: 11px; font-weight: 900; margin-left: 6px;">${dateFormatted}</span>
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
        <td style="width: 35%;">
          <span class="label">CUSTOMER / OPERATOR</span>
          <span class="val">${log.airline || (log as any).customer || 'Maldivian'}</span>
        </td>
        <td style="width: 25%;">
          <span class="label">AIRCRAFT REG</span>
          <span class="val">${log.aircraftReg || 'N/A'}</span>
        </td>
        <td style="width: 20%;">
          <span class="label">AIRCRAFT TYPE</span>
          <span class="val">${log.aircraftType || 'N/A'}</span>
        </td>
        <td style="width: 20%;">
          <span class="label">FLIGHT NO.</span>
          <span class="val" style="color: #1e3a8a;">${log.flightNumber || 'N/A'}</span>
        </td>
      </tr>
      <tr>
        <td>
          <span class="label">COMING FROM</span>
          <span class="val">${(log as any).origin || 'MLE'}</span>
        </td>
        <td>
          <span class="label">GOING TO</span>
          <span class="val">${log.destination || 'N/A'}</span>
        </td>
        <td colspan="2">
          <span class="label">STAND / PIT NUMBER</span>
          <span class="val">STAND ${log.stand || 'N/A'}${log.pitNumber ? ` • PIT ${log.pitNumber}` : ''}</span>
        </td>
      </tr>
      <tr>
        <td colspan="4">
          <div style="display: flex; justify-content: space-around; padding: 2px 0;">
            <div>
              <span class="label">TIME REFUELLER ARRIVED</span>
              <span class="val">${arrivedTime}</span>
            </div>
            <div>
              <span class="label">TIME COMMENCED</span>
              <span class="val">${commencedTime}</span>
            </div>
            <div>
              <span class="label">TIME OVER (CLEARANCE)</span>
              <span class="val">${overTime}</span>
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
          <td><strong style="font-size: 12px;">${log.vehicleId || 'DF-12'}</strong></td>
          <td>${meterOpen}</td>
          <td>${meterClose}</td>
          <td><strong style="font-size: 13px; color: #000;">${volumeNumber > 0 ? volumeNumber.toLocaleString() : '-'}</strong></td>
          <td>${isCash ? (log.remarks && log.remarks.includes('$') ? log.remarks : 'Cash Rate: 1.85') : 'On Account'}</td>
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
          <div style="font-family: 'Brush Script MT', cursive, sans-serif; font-size: 22px; color: #1e3a8a; font-style: italic;">
            ${operatorName}
          </div>
        </div>
        <div class="sig-fields">
          <div class="sig-field-row">
            <span class="lbl">NAME:</span>
            <span class="val">${operatorName}</span>
          </div>
          <div class="sig-field-row">
            <span class="lbl">DESIGNATION:</span>
            <span class="val">${operatorDesignation}</span>
          </div>
        </div>
      </div>

      <!-- Received By -->
      <div class="sig-col">
        <div class="sig-title">RECEIVED BY (AIRLINE REPRESENTATIVE)</div>
        <div class="sig-pad-box">
          ${signatureImg 
            ? `<img src="${signatureImg}" alt="Customer Signature" />` 
            : `<span style="font-size: 10px; color: #94a3b8; font-style: italic;">Signature on File</span>`
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
          ${log.signedAt ? `
          <div class="sig-field-row">
            <span class="lbl">SIGNED AT:</span>
            <span class="val" style="font-size: 8px;">${new Date(log.signedAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</span>
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
 * Opens a print dialog popup window for the given flight log invoice
 */
export function openPrintInvoice(log: Partial<FlightLog>, operatorUser?: Partial<User>): boolean {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    return false;
  }

  const html = generateInvoiceHtml(log, operatorUser);
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  return true;
}

/**
 * Prepares an instant email dispatch mailto link
 */
export function composeInvoiceEmailUri(log: Partial<FlightLog>, recipientEmail?: string): string {
  const deliveryNum = log.deliveryNumber || 'MLE-INVOICE';
  const flightNo = log.flightNumber || 'FLIGHT';
  const volume = typeof log.volume === 'number' ? log.volume.toLocaleString() : (log.volume || '0');
  const dateStr = formatDate(log.timestampStart || log.created_at);
  const aircraftReg = log.aircraftReg || 'N/A';
  const stand = log.stand || 'N/A';

  const to = recipientEmail || log.signerEmail || '';
  const subject = encodeURIComponent(`[MACL Fuel Services] Jet A-1 Delivery Invoice - ${deliveryNum} (${flightNo} / ${aircraftReg})`);
  
  const bodyText = `Dear Customer / Representative,

Please find the details of your official MACL Jet A-1 Fuel Delivery Invoice below:

========================================
MALDIVES AIRPORTS COMPANY LIMITED
FUEL SERVICES SECTION - FORM NO: G-001
========================================

Delivery Ticket No: ${deliveryNum}
Date: ${dateStr}
Flight Number: ${flightNo}
Aircraft Reg: ${aircraftReg}
Aircraft Type: ${log.aircraftType || 'N/A'}
Stand / PIT: Stand ${stand}${log.pitNumber ? ` / Pit ${log.pitNumber}` : ''}

Net Fuel Uplift: ${volume} Litres
Volume in Words: ${numberToWords(log.volume)}
Meter Opening: ${log.meterOpen || '-'}
Meter Closing: ${log.meterClose || '-'}
Equipment: ${log.vehicleId || 'DF-12'}

Quality Control: JIG & AFQRJOS Verified (Clear & Bright, Free of Water)
Signer: ${log.signerName || 'Flight Crew'} (${log.signerDesignation || 'Authorized Representative'})

A signed physical copy has been registered in the MACL Operational System.

Best regards,
MACL Fuel Services Section
Velana International Airport, Republic of Maldives
Tel: (960) 3337261 | Email: fuel@macl.aero
`;

  return `mailto:${encodeURIComponent(to)}?subject=${subject}&body=${encodeURIComponent(bodyText)}`;
}

/**
 * Dispatches the email to the representative
 */
export function sendInvoiceEmail(log: Partial<FlightLog>, recipientEmail?: string): void {
  const mailtoUri = composeInvoiceEmailUri(log, recipientEmail);
  window.open(mailtoUri, '_self');
}

/**
 * Shares invoice using mobile native Web Share API
 */
export async function shareInvoice(log: Partial<FlightLog>): Promise<boolean> {
  const deliveryNum = log.deliveryNumber || 'MLE-INVOICE';
  const flightNo = log.flightNumber || 'FLIGHT';
  const volume = typeof log.volume === 'number' ? log.volume.toLocaleString() : (log.volume || '0');

  if (navigator.share) {
    try {
      await navigator.share({
        title: `MACL Fuel Delivery Invoice - ${deliveryNum}`,
        text: `MACL Jet A-1 Fuel Uplift Invoice for Flight ${flightNo} (${log.aircraftReg || ''}): ${volume} Litres delivered. Form G-001 certified.`,
        url: window.location.href
      });
      return true;
    } catch {
      return false;
    }
  }
  return false;
}
