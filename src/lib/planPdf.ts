/**
 * «تحميل PDF» for a trip plan: a real file saved to the device, not the
 * browser's print window (owner, 13 Oct 2026).
 *
 * PDF libraries cannot shape Arabic (letters come out separated and in the
 * wrong order), so the browser draws the plan as pictures that are laid on
 * A4 pages. Rebuilt 15 Nov 2026 (E round 2, owner's PDF findings):
 * - a cover page: the plan's title block (dates, route ribbon) and the
 *   route image under it;
 * - the days then flow across pages at full width, never shrunk; a page
 *   breaks only between two stops (a day header always keeps its first stop);
 * - the plan is drawn from a copy laid out with the print rules (buttons
 *   and links gone for real), at a fixed width, so no blank gaps are left
 *   where hidden rows were and the file looks the same from a phone.
 * Loaded only on click.
 */

const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 12;
const FOOT = 8; // room for the page number line
const GAP = 4;
/** CSS width the copy is laid out at (A4 text width ≈ 186 mm → ~9 pt body text). */
const SHEET_PX = 760;
const RATIO = 2;

const PRINT_RULES = `
.pdf-mode .print\\:hidden{display:none!important}
.pdf-mode .print\\:block{display:block!important}
.pdf-mode [data-pdf]{box-shadow:none!important}
.pdf-mode [data-pdf].print\\:hidden{display:block!important}
`;

type Slice = { canvas: HTMLCanvasElement; cuts: number[] };

/** Positions (canvas px, from the block's top) where a page may break. */
function cutPoints(el: HTMLElement, scale: number): number[] {
  const top = el.getBoundingClientRect().top;
  const marks = [...el.querySelectorAll<HTMLElement>("[data-pdf-cut]")];
  const out = marks
    // The first stop stays with the day's header.
    .slice(1)
    .map((m) => Math.round((m.getBoundingClientRect().top - top) * scale))
    .filter((y) => y > 0);
  return [...new Set(out)].sort((a, b) => a - b);
}

function crop(src: HTMLCanvasElement, y0: number, y1: number): string {
  const c = document.createElement("canvas");
  c.width = src.width;
  c.height = Math.max(1, y1 - y0);
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("no canvas");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(src, 0, y0, src.width, c.height, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.86);
}

function blobToDataUrl(b: Blob): Promise<string> {
  return new Promise((ok, fail) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result));
    r.onerror = () => fail(r.error);
    r.readAsDataURL(b);
  });
}

async function imageSize(url: string): Promise<{ w: number; h: number }> {
  const img = new Image();
  img.src = url;
  await img.decode();
  return { w: img.naturalWidth, h: img.naturalHeight };
}

export async function downloadPlanPdf(opts: {
  /** The plan's sheet: blocks marked data-pdf, the title block data-pdf-cover. */
  root: HTMLElement;
  fileName: string;
  /** The route image for the cover, when one could be drawn. */
  routeImage?: Blob | null;
  /** «blob»: hand the file back (the app shares it) instead of downloading it. */
  output?: "save" | "blob";
}): Promise<Blob | null> {
  const [{ toCanvas, getFontEmbedCSS }, { jsPDF }] = await Promise.all([import("html-to-image"), import("jspdf")]);

  // A copy of the sheet, laid out off screen with the print rules.
  const style = document.createElement("style");
  style.textContent = PRINT_RULES;
  const holder = document.createElement("div");
  holder.setAttribute("aria-hidden", "true");
  holder.style.cssText = `position:fixed;left:-20000px;top:0;width:${SHEET_PX}px;background:#fff;pointer-events:none;`;
  const copy = opts.root.cloneNode(true) as HTMLElement;
  copy.classList.add("pdf-mode");
  copy.style.maxWidth = "none";
  copy.style.width = `${SHEET_PX}px`;
  copy.style.margin = "0";
  copy.style.padding = "0";
  holder.appendChild(copy);
  document.head.appendChild(style);
  document.body.appendChild(holder);

  try {
    // Pictures in the copy come from the browser's cache; give them a moment.
    await Promise.all(
      [...copy.querySelectorAll("img")].map((img) =>
        img.complete ? null : Promise.race([img.decode().catch(() => null), new Promise((r) => setTimeout(r, 2500))]),
      ),
    );
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

    const fontEmbedCSS = await getFontEmbedCSS(copy).catch(() => undefined);
    const draw = async (el: HTMLElement): Promise<Slice | null> => {
      const rect = el.getBoundingClientRect();
      if (!rect.width || !rect.height) return null;
      const canvas = await toCanvas(el, {
        pixelRatio: RATIO,
        // No backgroundColor here: html-to-image paints it over the block's
        // own colour (the navy cover came out white). White goes behind the
        // picture in crop() instead.
        fontEmbedCSS,
        // Third-party pictures that refuse to be copied are left blank rather
        // than failing the whole file.
        imagePlaceholder: "data:image/gif;base64,R0lGODlhAQABAAAAACw=",
      });
      return { canvas, cuts: cutPoints(el, canvas.height / rect.height) };
    };

    const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait", compress: true });
    const width = PAGE_W - MARGIN * 2;
    const bottom = PAGE_H - MARGIN - FOOT;
    let y = MARGIN;
    let pageEmpty = true;

    // ── Cover: the title block, then the route image ────────────────
    const coverEl = copy.querySelector<HTMLElement>("[data-pdf-cover]");
    const cover = coverEl ? await draw(coverEl) : null;
    if (cover) {
      const h = (cover.canvas.height / cover.canvas.width) * width;
      pdf.addImage(crop(cover.canvas, 0, cover.canvas.height), "JPEG", MARGIN, y, width, h, undefined, "FAST");
      y += h + 6;
      pageEmpty = false;
    }
    if (opts.routeImage) {
      try {
        const url = await blobToDataUrl(opts.routeImage);
        const { w: iw, h: ih } = await imageSize(url);
        let w = width;
        let h = (ih / iw) * w;
        const room = bottom - y;
        if (h > room) {
          h = room;
          w = (iw / ih) * h;
        }
        if (h > 40) {
          pdf.addImage(url, "PNG", MARGIN + (width - w) / 2, y, w, h, undefined, "FAST");
          pdf.addPage();
          y = MARGIN;
          pageEmpty = true;
        }
      } catch {
        // No picture on the cover rather than no file.
      }
    }
    // With the route image the cover is a page of its own; without it the
    // days follow the title on the same page.

    // ── Days and tips: flowing, broken only between stops ───────────
    const blocks = [...copy.querySelectorAll<HTMLElement>("[data-pdf]")].filter((el) => !el.hasAttribute("data-pdf-cover"));
    for (const el of blocks) {
      const s = await draw(el);
      if (!s) continue;
      const { canvas, cuts } = s;
      const mmPerPx = width / canvas.width;
      let from = 0;
      while (from < canvas.height) {
        const room = (bottom - y) / mmPerPx;
        const rest = canvas.height - from;
        let to: number;
        if (rest <= room) {
          to = canvas.height;
        } else {
          const fit = cuts.filter((c) => c > from && c - from <= room);
          if (fit.length) {
            to = fit[fit.length - 1];
          } else if (!pageEmpty) {
            pdf.addPage();
            y = MARGIN;
            pageEmpty = true;
            continue;
          } else {
            // One stop taller than a whole page: cut it where the page ends.
            to = from + Math.floor(room);
          }
        }
        const h = (to - from) * mmPerPx;
        pdf.addImage(crop(canvas, from, to), "JPEG", MARGIN, y, width, h, undefined, "FAST");
        y += h + GAP;
        pageEmpty = false;
        from = to;
        if (from < canvas.height) {
          pdf.addPage();
          y = MARGIN;
          pageEmpty = true;
        }
      }
    }

    const pages = pdf.getNumberOfPages();
    pdf.setFontSize(8);
    pdf.setTextColor(140);
    for (let i = 1; i <= pages; i++) {
      pdf.setPage(i);
      pdf.text(`sfrtna.com  ·  ${i}/${pages}`, PAGE_W / 2, PAGE_H - 5, { align: "center" });
    }
    if (opts.output === "blob") return pdf.output("blob");
    pdf.save(opts.fileName);
    return null;
  } finally {
    holder.remove();
    style.remove();
  }
}
