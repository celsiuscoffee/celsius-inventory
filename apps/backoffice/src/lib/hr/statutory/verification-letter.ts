// Employment Verification Letter — A4, single page.
// Used by banks (loan applications), embassies (visa applications), and
// landlords (tenancy). Simpler than the confirmation letter: states the
// employee's position, length of service, salary (optional), and that
// they're currently in good standing.
//
// formats: 'standard' | 'with_salary' | 'income_proof'
//   standard      — position + start date + employment status (no salary)
//   with_salary   — adds basic monthly + last 3 months gross
//   income_proof  — bank format: emphasises monthly basic + an explicit
//                    "currently active" statement embassies / banks like
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage, type PDFImage } from "pdf-lib";
import { readFileSync } from "fs";
import { join } from "path";

let _logoBytes: Uint8Array | null | undefined;
function loadLogoBytes(): Uint8Array | null {
  if (_logoBytes !== undefined) return _logoBytes;
  try {
    _logoBytes = readFileSync(join(process.cwd(), "public/images/celsius-logo-sm.jpg"));
  } catch {
    _logoBytes = null;
  }
  return _logoBytes;
}

export type VerificationLetterFormat = "standard" | "with_salary" | "income_proof";

export type VerificationLetterData = {
  employeeFullName: string;
  icNumber: string | null;
  position: string;
  joinDate: string;          // YYYY-MM-DD
  employmentType: string;    // 'Full-time' | 'Part-time' | etc — display string
  basicSalary?: number | null;
  // Optional last-3-months gross (for income_proof) — already summed.
  last3MonthsGross?: number | null;
  recipient?: string | null; // "To Whom It May Concern" if blank
  recipientAddress?: string | null;
  purpose?: string | null;   // optional — "for visa application" etc
  format: VerificationLetterFormat;
  // Letter metadata
  letterDate: string;        // YYYY-MM-DD
  // Company
  companyName: string;
  companySSM: string | null;
  companyAddress: string | null;
  companyEmail?: string | null;
  companyPhone?: string | null;
  // Signatory
  signatoryName: string;
  signatoryTitle: string;
  signatureImageBytes?: Uint8Array | null;
};

export async function generateVerificationLetterPDF(data: VerificationLetterData): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595.28, 841.89]);
  const helv = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const W = 595.28, H = 841.89, M = 50;
  const black = rgb(0, 0, 0);
  const gray = rgb(0.4, 0.4, 0.4);
  const terracotta = rgb(0xC2 / 255, 0x45 / 255, 0x2D / 255);
  const tintBg = rgb(0.985, 0.97, 0.96);

  // Brand bar
  page.drawRectangle({ x: 0, y: H - 3, width: W, height: 3, color: terracotta });

  let y = H - M;

  // ── Letterhead ─────────────────────────────────────────────
  let logo: PDFImage | null = null;
  const logoBytes = loadLogoBytes();
  if (logoBytes) { try { logo = await pdf.embedJpg(logoBytes); } catch { /* ignore */ } }
  if (logo) {
    page.drawImage(logo, { x: M, y: y - 50 + 14, width: 50, height: 50 });
  }
  drawTextRight(page, data.companyName, bold, 11, W - M, y + 8, terracotta);
  let rightY = y - 4;
  if (data.companySSM) {
    drawTextRight(page, `Co. Reg: ${data.companySSM}`, helv, 8, W - M, rightY, gray);
    rightY -= 10;
  }
  if (data.companyAddress) {
    rightY = drawWrappedRight(page, helv, 8, W - M, rightY, 220, 10, gray, data.companyAddress);
  }
  if (data.companyEmail) { drawTextRight(page, data.companyEmail, helv, 8, W - M, rightY, gray); rightY -= 10; }
  if (data.companyPhone) { drawTextRight(page, data.companyPhone, helv, 8, W - M, rightY, gray); rightY -= 10; }

  y -= 70;
  page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.5, color: rgb(0.85, 0.85, 0.85) });
  y -= 20;

  // ── Date + recipient ─────────────────────────────────────────
  page.drawText(formatDate(data.letterDate), { x: M, y, size: 10, font: helv, color: black });
  y -= 24;

  page.drawText(data.recipient || "To Whom It May Concern,", { x: M, y, size: 11, font: bold, color: black });
  y -= 14;
  if (data.recipientAddress) {
    y = wrapText(page, helv, 9, M, y, W - 2 * M, 11, gray, data.recipientAddress);
    y -= 4;
  }
  y -= 8;

  // ── Subject ────────────────────────────────────────────────
  const subject = data.format === "income_proof"
    ? "RE: CONFIRMATION OF EMPLOYMENT & MONTHLY INCOME"
    : "RE: LETTER OF EMPLOYMENT VERIFICATION";
  page.drawText(subject, { x: M, y, size: 11, font: bold, color: terracotta });
  page.drawLine({ start: { x: M, y: y - 3 }, end: { x: M + bold.widthOfTextAtSize(subject, 11), y: y - 3 }, thickness: 0.6, color: terracotta });
  y -= 24;

  // ── Body para 1 ────────────────────────────────────────────
  const introBody = `This is to certify that ${data.employeeFullName}${data.icNumber ? ` (NRIC: ${data.icNumber})` : ""} has been employed with ${data.companyName}${data.companySSM ? ` (${data.companySSM})` : ""} since ${formatDate(data.joinDate)} as our ${data.position}, on a ${data.employmentType.toLowerCase()} basis.`;
  y = wrapText(page, helv, 10, M, y, W - 2 * M, 13, black, introBody);
  y -= 8;

  // ── KEY FACTS box ──────────────────────────────────────────
  const boxTop = y;
  const showSalary = data.format !== "standard" && data.basicSalary != null;
  const showIncome = data.format === "income_proof" && data.last3MonthsGross != null;
  const facts: Array<[string, string]> = [
    ["Full Name", data.employeeFullName],
    ...(data.icNumber ? [["NRIC", data.icNumber] as [string, string]] : []),
    ["Position", data.position],
    ["Employment Type", data.employmentType],
    ["Date of Joining", formatDate(data.joinDate)],
    ["Length of Service", computeTenure(data.joinDate, data.letterDate)],
    ...(showSalary && data.basicSalary != null ? [["Monthly Basic Salary", `RM ${Number(data.basicSalary).toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`] as [string, string]] : []),
    ...(showIncome && data.last3MonthsGross != null ? [["Last 3 Months Gross (incl. allowances)", `RM ${Number(data.last3MonthsGross).toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`] as [string, string]] : []),
    ["Current Status", "Active employee in good standing"],
  ];
  const headerH = 18;
  const rowH = 16;
  const boxH = headerH + facts.length * rowH + 8;
  page.drawRectangle({ x: M, y: boxTop - boxH, width: W - 2 * M, height: boxH, color: tintBg });
  page.drawRectangle({ x: M, y: boxTop - headerH, width: W - 2 * M, height: headerH, color: terracotta });
  page.drawText("EMPLOYMENT DETAILS", { x: M + 10, y: boxTop - headerH + 5, size: 9, font: bold, color: rgb(1, 1, 1) });
  let rowY = boxTop - headerH - 12;
  for (const [k, v] of facts) {
    page.drawText(k, { x: M + 10, y: rowY, size: 9, font: helv, color: gray });
    page.drawText(v, { x: M + 200, y: rowY, size: 9, font: bold, color: black });
    rowY -= rowH;
  }
  y = boxTop - boxH - 18;

  // ── Body para 2 ─────────────────────────────────────────────
  const purposePhrase = data.purpose ? ` for the purpose of ${data.purpose}` : "";
  const middleBody = `This letter is issued at the employee's request${purposePhrase}. We confirm that the above information is accurate as of the date of this letter and that the employee continues to be a valued member of our team.`;
  y = wrapText(page, helv, 10, M, y, W - 2 * M, 13, black, middleBody);
  y -= 6;

  // ── Body para 3 (closing) ──────────────────────────────────
  const closing = "Should you require any further verification, please contact our HR department using the details on the letterhead.";
  y = wrapText(page, helv, 10, M, y, W - 2 * M, 13, black, closing);
  y -= 14;

  // ── Signature block ─────────────────────────────────────────
  page.drawText("Yours sincerely,", { x: M, y, size: 10, font: helv, color: black });
  y -= 50;
  if (data.signatureImageBytes) {
    try {
      const sig = await pdf.embedPng(data.signatureImageBytes);
      const sigDims = sig.scaleToFit(140, 40);
      page.drawImage(sig, { x: M, y: y + 10, width: sigDims.width, height: sigDims.height });
    } catch { /* ignore */ }
  }
  page.drawLine({ start: { x: M, y }, end: { x: M + 220, y }, thickness: 0.5, color: rgb(0.6, 0.6, 0.6) });
  y -= 12;
  page.drawText(data.signatoryName, { x: M, y, size: 10, font: bold, color: black });
  y -= 11;
  page.drawText(data.signatoryTitle, { x: M, y, size: 9, font: helv, color: gray });
  y -= 11;
  page.drawText(data.companyName, { x: M, y, size: 9, font: helv, color: gray });

  // ── Footer ──────────────────────────────────────────────────
  page.drawLine({ start: { x: M, y: 60 }, end: { x: W - M, y: 60 }, thickness: 0.5, color: rgb(0.85, 0.85, 0.85) });
  page.drawText(`${data.companyName}${data.companySSM ? ` · ${data.companySSM}` : ""}${data.companyEmail ? ` · ${data.companyEmail}` : ""}`,
    { x: M, y: 48, size: 7.5, font: helv, color: gray });
  drawTextRight(page, "This letter is computer-generated and bears the company's authorised signature.",
    helv, 7.5, W - M, 48, gray);

  return await pdf.save();
}

// ── Helpers ─────────────────────────────────────────────────

function drawTextRight(
  page: PDFPage, text: string, font: PDFFont, size: number,
  rightX: number, y: number, c?: ReturnType<typeof rgb>,
) {
  const width = font.widthOfTextAtSize(text, size);
  page.drawText(text, { x: rightX - width, y, size, font, color: c ?? rgb(0, 0, 0) });
}

function drawWrappedRight(
  page: PDFPage, font: PDFFont, size: number,
  rightX: number, y: number, maxWidth: number, lineHeight: number,
  c: ReturnType<typeof rgb>, text: string,
): number {
  const words = text.split(/\s+/);
  let line = "";
  let cursor = y;
  for (const w of words) {
    const trial = line ? `${line} ${w}` : w;
    if (font.widthOfTextAtSize(trial, size) > maxWidth) {
      drawTextRight(page, line, font, size, rightX, cursor, c);
      cursor -= lineHeight;
      line = w;
    } else {
      line = trial;
    }
  }
  if (line) {
    drawTextRight(page, line, font, size, rightX, cursor, c);
    cursor -= lineHeight;
  }
  return cursor;
}

function wrapText(
  page: PDFPage, font: PDFFont, size: number,
  x: number, y: number, maxWidth: number, lineHeight: number,
  c: ReturnType<typeof rgb>, text: string,
): number {
  const words = text.split(/\s+/);
  let line = "";
  let cursor = y;
  for (const w of words) {
    const trial = line ? `${line} ${w}` : w;
    if (font.widthOfTextAtSize(trial, size) > maxWidth) {
      page.drawText(line, { x, y: cursor, size, font, color: c });
      cursor -= lineHeight;
      line = w;
    } else {
      line = trial;
    }
  }
  if (line) {
    page.drawText(line, { x, y: cursor, size, font, color: c });
    cursor -= lineHeight;
  }
  return cursor;
}

function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00.000Z`);
  return d.toLocaleDateString("en-MY", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

// "Y years M months" — given join date and letter date, both YYYY-MM-DD
function computeTenure(joinIso: string, letterIso: string): string {
  const join = new Date(`${joinIso}T00:00:00.000Z`);
  const letter = new Date(`${letterIso}T00:00:00.000Z`);
  let years = letter.getUTCFullYear() - join.getUTCFullYear();
  let months = letter.getUTCMonth() - join.getUTCMonth();
  if (letter.getUTCDate() < join.getUTCDate()) months--;
  if (months < 0) { years--; months += 12; }
  if (years <= 0 && months <= 0) return "Less than a month";
  const yearStr = years > 0 ? `${years} year${years > 1 ? "s" : ""}` : "";
  const monthStr = months > 0 ? `${months} month${months > 1 ? "s" : ""}` : "";
  return [yearStr, monthStr].filter(Boolean).join(" ");
}
