import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export interface ReceiptData {
  receiptNumber: string; // e.g. Payment.id or a formatted invoice number
  paymentDate: Date;
  customerName: string;
  customerPhone?: string;
  kabadiwalaName: string;
  weightKg: number;
  amount: number;
  paymentMethod: string; // "CASH" | "UPI" | "BANK_TRANSFER" (display label)
  transactionRef?: string | null;
}

const PAGE_WIDTH = 595.28; // A4 in points
const PAGE_HEIGHT = 841.89;
const MARGIN = 50;

/**
 * Generates a single-page PDF payment receipt as a Buffer, ready to be
 * returned from an API route, emailed, or written to disk/Cloudinary.
 *
 * Usage:
 *   const pdfBuffer = await generatePaymentReceiptPdf({ ... });
 *   return new NextResponse(pdfBuffer, {
 *     headers: {
 *       "Content-Type": "application/pdf",
 *       "Content-Disposition": `attachment; filename="receipt-${data.receiptNumber}.pdf"`,
 *     },
 *   });
 */
export async function generatePaymentReceiptPdf(
  data: ReceiptData
): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);

  const fontRegular = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  const green = rgb(0.11, 0.45, 0.24); // ElectroFine brand-ish green
  const dark = rgb(0.15, 0.15, 0.15);
  const gray = rgb(0.45, 0.45, 0.45);

  let cursorY = PAGE_HEIGHT - MARGIN;

  // --- Header ---
  page.drawText("ElectroFine", {
    x: MARGIN,
    y: cursorY,
    size: 24,
    font: fontBold,
    color: green,
  });
  cursorY -= 20;
  page.drawText("Payment Receipt", {
    x: MARGIN,
    y: cursorY,
    size: 12,
    font: fontRegular,
    color: gray,
  });

  cursorY -= 10;
  page.drawLine({
    start: { x: MARGIN, y: cursorY },
    end: { x: PAGE_WIDTH - MARGIN, y: cursorY },
    thickness: 1,
    color: rgb(0.85, 0.85, 0.85),
  });

  // --- Receipt meta (number + date) ---
  cursorY -= 30;
  page.drawText(`Receipt No: ${data.receiptNumber}`, {
    x: MARGIN,
    y: cursorY,
    size: 11,
    font: fontRegular,
    color: dark,
  });
  page.drawText(
    `Date: ${data.paymentDate.toLocaleDateString("en-IN", {
      year: "numeric",
      month: "long",
      day: "numeric",
    })}`,
    {
      x: PAGE_WIDTH - MARGIN - 160,
      y: cursorY,
      size: 11,
      font: fontRegular,
      color: dark,
    }
  );

  // --- Row helper ---
  const drawRow = (label: string, value: string) => {
    cursorY -= 28;
    page.drawText(label, {
      x: MARGIN,
      y: cursorY,
      size: 11,
      font: fontRegular,
      color: gray,
    });
    page.drawText(value, {
      x: MARGIN + 180,
      y: cursorY,
      size: 11,
      font: fontBold,
      color: dark,
    });
  };

  cursorY -= 20;
  page.drawText("Details", {
    x: MARGIN,
    y: cursorY,
    size: 13,
    font: fontBold,
    color: green,
  });

  drawRow("Customer", data.customerName);
  if (data.customerPhone) drawRow("Customer Phone", data.customerPhone);
  drawRow("Kabadiwala", data.kabadiwalaName);
  drawRow("Weight Collected", `${data.weightKg.toFixed(2)} kg`);
  drawRow("Payment Method", data.paymentMethod);
  if (data.transactionRef) drawRow("Transaction Ref", data.transactionRef);

  // --- Amount highlight box ---
  cursorY -= 45;
  page.drawRectangle({
    x: MARGIN,
    y: cursorY - 10,
    width: PAGE_WIDTH - MARGIN * 2,
    height: 45,
    color: rgb(0.94, 0.98, 0.95),
  });
  page.drawText("Total Amount Paid", {
    x: MARGIN + 15,
    y: cursorY + 15,
    size: 12,
    font: fontRegular,
    color: gray,
  });
  page.drawText(`Rs. ${data.amount.toFixed(2)}`, {
    x: MARGIN + 15,
    y: cursorY - 5,
    size: 20,
    font: fontBold,
    color: green,
  });

  // --- Footer ---
  page.drawText(
    "This is a system-generated receipt from ElectroFine and does not require a signature.",
    {
      x: MARGIN,
      y: MARGIN,
      size: 9,
      font: fontRegular,
      color: gray,
    }
  );

  const pdfBytes = await doc.save();
  return Buffer.from(pdfBytes);
}
