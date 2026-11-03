import jsPDF from 'jspdf';
import type { Receipt, Payment, Student, AppSettings, StudentFieldDefinition } from '../../types';
import notoSansBold from '../../assets/fonts/NotoSans-Bold.ttf?inline';
import notoSansRegular from '../../assets/fonts/NotoSans-Regular.ttf?inline';

// ── Receipt data bundle ───────────────────────────────────────────────────────

export interface ReceiptData {
  receipt:   Receipt;
  payment:   Payment;
  student:   Student;
  settings:  AppSettings;
  fields:    StudentFieldDefinition[];
  batchName?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatAmount(amount: number, currency = 'INR') {
  const symbol = currency === 'INR' ? '₹' : currency;
  return `${symbol} ${amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
}

function addReceiptFonts(doc: jsPDF): void {
  const addFont = (file: string, dataUrl: string, family: string, style: 'normal' | 'bold') => {
    doc.addFileToVFS(file, dataUrl.slice(dataUrl.indexOf(',') + 1));
    doc.addFont(file, family, style);
  };
  addFont('NotoSans-Regular.ttf', notoSansRegular, 'NotoSans', 'normal');
  addFont('NotoSans-Bold.ttf', notoSansBold, 'NotoSans', 'bold');
}

function setTextFont(doc: jsPDF): void {
  const style = doc.getFont().fontStyle === 'bold' ? 'bold' : 'normal';
  doc.setFont('NotoSans', style);
}

function writeText(
  doc: jsPDF,
  text: string | string[],
  x: number,
  y: number,
  options?: { align?: 'left' | 'center' | 'right' | 'justify'; maxWidth?: number },
): void {
  setTextFont(doc);
  doc.text(text, x, y, options);
}

function splitTextToSize(doc: jsPDF, text: string, maxWidth: number): string[] {
  setTextFont(doc);
  return doc.splitTextToSize(text, maxWidth);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

function getStudentFieldValue(
  student: Student,
  fields: StudentFieldDefinition[],
  fieldId: string
): string {
  const val = student.values[fieldId];
  if (val === undefined || val === null || val === '') return '';
  const field = fields.find(f => f.id === fieldId);
  if (!field) return String(val);
  if (field.type === 'select') {
    return field.options?.find(o => o.value === val)?.label ?? String(val);
  }
  if (field.type === 'multiselect' && Array.isArray(val)) {
    return (val as string[]).join(', ');
  }
  if (field.type === 'date' && typeof val === 'string') {
    return formatDate(val);
  }
  return String(val);
}

// ── PDF generator ─────────────────────────────────────────────────────────────

export async function generateReceiptPDF(data: ReceiptData): Promise<jsPDF> {
  const { receipt, payment, student, settings, fields, batchName } = data;

  const doc = new jsPDF({
    unit: 'mm',
    format: 'a5',        // A5 is a common receipt size — compact and printable
    orientation: 'portrait',
  });
  addReceiptFonts(doc);

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentW = pageW - margin * 2;
  const currency = settings.defaultCurrency ?? 'INR';

  // ── Colour palette ───────────────────────────────────────────────────────────
  const inkRGB:    [number, number, number] = [20, 20, 19];
  const slateRGB:  [number, number, number] = [105, 105, 105];
  const dustRGB:   [number, number, number] = [209, 205, 199];
  const signalRGB: [number, number, number] = [243, 115, 56];
  const canvasRGB: [number, number, number] = [243, 240, 238];

  let y = 0;

  // ── Header band ──────────────────────────────────────────────────────────────
  doc.setFillColor(...inkRGB);
  doc.rect(0, 0, pageW, 38, 'F');

  // Business name
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(243, 240, 238);
  const bizName = settings.business.businessName || 'COLLECT-AG';
  writeText(doc, splitTextToSize(doc, bizName, contentW * 0.62), margin, 14);

  // Receipt number label
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...signalRGB);
  writeText(doc, 'PAYMENT RECEIPT', pageW - margin, 10, { align: 'right' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(243, 240, 238);
  writeText(doc, receipt.receiptNumber, pageW - margin, 16, { align: 'right' });

  // Business sub-info
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(180, 175, 170);
  const subLines: string[] = [];
  if (settings.business.phone) subLines.push(settings.business.phone);
  if (settings.business.email) subLines.push(settings.business.email);
  if (settings.business.gstin) subLines.push(`GSTIN: ${settings.business.gstin}`);
  if (subLines.length > 0) writeText(doc, subLines.join('  |  '), margin, 22);
  if (settings.business.address) {
    writeText(doc, settings.business.address, margin, 28, { maxWidth: contentW * 0.65 });
  }

  y = 44;

  // ── Date line ────────────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...slateRGB);
  writeText(doc, `Date: ${formatDate(payment.paymentDate)}`, margin, y);
  writeText(doc, `Issued: ${formatDate(receipt.issuedAt)}`, pageW - margin, y, { align: 'right' });
  y += 8;

  // ── Divider ──────────────────────────────────────────────────────────────────
  doc.setDrawColor(...dustRGB);
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageW - margin, y);
  y += 6;

  // ── Member section ───────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...slateRGB);
  writeText(doc, 'MEMBER', margin, y);
  y += 4;

  const studentName = String(student.values['student_name'] ?? 'Unknown');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...inkRGB);
  const studentNameLines = splitTextToSize(doc, studentName, contentW);
  writeText(doc, studentNameLines, margin, y);
  y += studentNameLines.length * 5;

  // Receipt-visible student fields
  const receiptFields = fields.filter(f => f.enabled && f.showOnReceipt && f.id !== 'student_name');
  if (receiptFields.length > 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...slateRGB);
    const detailParts = receiptFields
      .map(f => `${f.label}: ${getStudentFieldValue(student, fields, f.id)}`)
      .filter(s => !s.endsWith(': '));
    if (detailParts.length > 0) {
      const detailLines = splitTextToSize(doc, detailParts.join('   '), contentW);
      writeText(doc, detailLines, margin, y);
      y += detailLines.length * 4;
    }
  }

  if (batchName) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...slateRGB);
    const batchLines = splitTextToSize(doc, `Batch: ${batchName}`, contentW);
    writeText(doc, batchLines, margin, y);
    y += batchLines.length * 4;
  }

  y += 2;
  doc.setDrawColor(...dustRGB);
  doc.line(margin, y, pageW - margin, y);
  y += 6;

  // ── Payment details ───────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...slateRGB);
  writeText(doc, 'PAYMENT DETAILS', margin, y);
  y += 5;

  const details: [string, string][] = [
    ['Payment Mode', payment.paymentMode],
    ['Payment Date', formatDate(payment.paymentDate)],
  ];
  if (payment.purpose) details.push(['Purpose / Period', payment.purpose]);
  if (payment.notes)   details.push(['Notes', payment.notes]);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  for (const [label, value] of details) {
    doc.setTextColor(...slateRGB);
    writeText(doc, label, margin, y);
    doc.setTextColor(...inkRGB);
    const valueLines = splitTextToSize(doc, value, contentW * 0.62);
    writeText(doc, valueLines, pageW - margin, y, { align: 'right' });
    y += Math.max(1, valueLines.length) * 6;
  }

  y += 2;
  doc.setDrawColor(...dustRGB);
  doc.line(margin, y, pageW - margin, y);
  y += 4;

  // ── Tax breakdown — read from the payment's own snapshot, never guessed ──────
  // This is what was actually applied at the time of payment, so historical
  // receipts stay correct even if tax rates are edited/removed later.
  const taxLines = payment.taxLines ?? [];
  const hasTax = taxLines.length > 0;
  const baseAmount = hasTax ? (payment.baseAmount ?? payment.amount) : payment.amount;
  const totalAmount = payment.amount; // payment.amount is always the total collected

  // ── Amount box ───────────────────────────────────────────────────────────────
  const lineRowH = 6;
  const boxH = hasTax ? (14 + taxLines.length * lineRowH + 12) : 18;
  doc.setFillColor(...canvasRGB);
  doc.roundedRect(margin, y, contentW, boxH, 3, 3, 'F');

  if (hasTax) {
    let ty = y + 7;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...slateRGB);
    writeText(doc, 'SUBTOTAL', margin + 5, ty);
    writeText(doc, formatAmount(baseAmount, currency), pageW - margin - 5, ty, { align: 'right' });
    ty += lineRowH;

    for (const line of taxLines) {
      writeText(doc, `${line.name} (${line.rate}%)`, margin + 5, ty);
      writeText(doc, formatAmount(line.amount, currency), pageW - margin - 5, ty, { align: 'right' });
      ty += lineRowH;
    }

    ty += 2;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...inkRGB);
    writeText(doc, 'TOTAL PAID', margin + 5, ty);
    doc.setFontSize(14);
    writeText(doc, formatAmount(totalAmount, currency), pageW - margin - 5, ty + 2, { align: 'right' });
  } else {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...slateRGB);
    writeText(doc, 'AMOUNT PAID', margin + 5, y + 7);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(...inkRGB);
    writeText(doc, formatAmount(payment.amount, currency), pageW - margin - 5, y + 14, { align: 'right' });
  }

  y += boxH + 6;

  // ── Footer ───────────────────────────────────────────────────────────────────
  const footerY = pageH - 14;
  doc.setDrawColor(...dustRGB);
  doc.setLineWidth(0.2);
  doc.line(margin, footerY - 6, pageW - margin, footerY - 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(...slateRGB);
  writeText(doc, 'Thank you for your payment.', margin, footerY - 2);
  writeText(doc, `COLLECT-AG · ${receipt.receiptNumber}`, pageW - margin, footerY - 2, { align: 'right' });

  return doc;
}

// ── Download helper ───────────────────────────────────────────────────────────

export async function downloadReceiptPDF(data: ReceiptData): Promise<void> {
  const doc = await generateReceiptPDF(data);
  doc.save(`${data.receipt.receiptNumber}.pdf`);
}

// ── Get PDF as Blob (for Drive upload in Phase 10) ────────────────────────────

export async function getReceiptPDFBlob(data: ReceiptData): Promise<Blob> {
  const doc = await generateReceiptPDF(data);
  return doc.output('blob');
}
