/**
 * «تحميل PDF» for a trip plan: a real file saved to the device, not the
 * browser's print window (owner, 13 Oct 2026).
 *
 * PDF libraries cannot shape Arabic (letters come out separated and in the
 * wrong order), so the browser draws each block of the plan exactly as on
 * screen — header, note, one card per day — and those pictures are laid on
 * A4 pages, a block never split across two pages. Loaded only on click.
 */

const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 12;

/** Everything marked print:hidden (buttons, links to maps) stays out of the file. */
const keep = (node: HTMLElement) => !(node.classList && node.classList.contains("print:hidden"));

export async function downloadPlanPdf(blocks: HTMLElement[], fileName: string): Promise<void> {
  const [{ toJpeg }, { jsPDF }] = await Promise.all([import("html-to-image"), import("jspdf")]);
  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait", compress: true });
  const width = PAGE_W - MARGIN * 2;
  let y = MARGIN;
  let first = true;

  for (const el of blocks) {
    const rect = el.getBoundingClientRect();
    if (!rect.width || !rect.height) continue;
    const data = await toJpeg(el, {
      quality: 0.88,
      pixelRatio: 2,
      backgroundColor: "#ffffff",
      filter: (n) => !(n instanceof HTMLElement) || keep(n),
      // Third-party pictures that refuse to be copied are left blank rather
      // than failing the whole file.
      imagePlaceholder: "data:image/gif;base64,R0lGODlhAQABAAAAACw=",
    });
    let h = (rect.height / rect.width) * width;
    // A day longer than a page is shrunk to fit one page.
    let w = width;
    if (h > PAGE_H - MARGIN * 2) {
      w = width * ((PAGE_H - MARGIN * 2) / h);
      h = PAGE_H - MARGIN * 2;
    }
    if (!first && y + h > PAGE_H - MARGIN) {
      pdf.addPage();
      y = MARGIN;
    }
    pdf.addImage(data, "JPEG", MARGIN + (width - w) / 2, y, w, h, undefined, "FAST");
    y += h + 5;
    first = false;
  }

  const pages = pdf.getNumberOfPages();
  pdf.setFontSize(8);
  pdf.setTextColor(140);
  for (let i = 1; i <= pages; i++) {
    pdf.setPage(i);
    pdf.text(`sfrtna.com  ·  ${i}/${pages}`, PAGE_W / 2, PAGE_H - 5, { align: "center" });
  }
  pdf.save(fileName);
}
