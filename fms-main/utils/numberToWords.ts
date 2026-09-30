/**
 * Converts a numeric volume (litres) into standard English words for aviation fuel invoices.
 * Example: 2705 -> "Two Thousand Seven Hundred Five Litres only"
 */
export function numberToWords(num: number | string | undefined | null): string {
  if (num === undefined || num === null || num === '') return 'Zero Litres only';
  const val = typeof num === 'string' ? parseFloat(num.replace(/,/g, '')) : num;
  if (isNaN(val) || val === 0) return 'Zero Litres only';

  const ones = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
    'Seventeen', 'Eighteen', 'Nineteen'
  ];

  const tens = [
    '', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'
  ];

  const integerPart = Math.floor(Math.abs(val));
  const decimalPart = Math.round((Math.abs(val) - integerPart) * 100);

  function convertChunk(n: number): string {
    let str = '';
    if (n >= 100) {
      str += ones[Math.floor(n / 100)] + ' Hundred ';
      n %= 100;
    }
    if (n >= 20) {
      str += tens[Math.floor(n / 10)] + (n % 10 > 0 ? '-' + ones[n % 10] : '') + ' ';
    } else if (n > 0) {
      str += ones[n] + ' ';
    }
    return str.trim();
  }

  if (integerPart === 0) {
    return 'Zero Litres only';
  }

  let words = '';
  const billions = Math.floor(integerPart / 1_000_000_000);
  const millions = Math.floor((integerPart % 1_000_000_000) / 1_000_000);
  const thousands = Math.floor((integerPart % 1_000_000) / 1_000);
  const remainder = integerPart % 1_000;

  if (billions > 0) {
    words += convertChunk(billions) + ' Billion ';
  }
  if (millions > 0) {
    words += convertChunk(millions) + ' Million ';
  }
  if (thousands > 0) {
    words += convertChunk(thousands) + ' Thousand ';
  }
  if (remainder > 0) {
    words += convertChunk(remainder) + ' ';
  }

  words = words.trim();

  if (decimalPart > 0) {
    words += ` and ${decimalPart}/100`;
  }

  return `${words} Litres only`;
}
