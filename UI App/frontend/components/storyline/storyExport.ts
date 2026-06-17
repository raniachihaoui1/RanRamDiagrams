import { mediaUrl } from "@/lib/api";
import type { StoryProject } from "@/store/storyline";
import { cellNumber, captionFont } from "@/store/storyline";

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/** Draw an image with object-cover math (center-crop to fill w×h). */
function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number
) {
  const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const sw = img.naturalWidth * scale;
  const sh = img.naturalHeight * scale;
  ctx.drawImage(img, x + (w - sw) / 2, y + (h - sh) / 2, sw, sh);
}

/** Draw an image with object-contain math (letterbox to fit inside w×h). */
function drawContain(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  fillColor: string,
  x: number,
  y: number,
  w: number,
  h: number
) {
  const scale = Math.min(w / img.naturalWidth, h / img.naturalHeight);
  const sw = img.naturalWidth * scale;
  const sh = img.naturalHeight * scale;
  ctx.fillStyle = fillColor;
  ctx.fillRect(x, y, w, h);
  ctx.drawImage(img, x + (w - sw) / 2, y + (h - sh) / 2, sw, sh);
}

export async function exportStoryPng(project: StoryProject): Promise<void> {
  const {
    cols, rows, cellW, cellH, captionH, gap, padding,
    outerBg, cellBg, autoNumber, numberStyle, numberColor, numberBg,
    captionFontFamily, captionFontSize, captionBold, captionColor,
    captionAlign, captionBg,
    cells, name,
  } = project;

  const totalW = padding * 2 + cols * cellW + (cols - 1) * gap;
  const totalH = padding * 2 + rows * (cellH + captionH) + (rows - 1) * gap;

  const canvas = document.createElement("canvas");
  canvas.width = totalW;
  canvas.height = totalH;
  const ctx = canvas.getContext("2d")!;

  // Background
  ctx.fillStyle = outerBg;
  ctx.fillRect(0, 0, totalW, totalH);

  // Pre-load all images in parallel
  const imageCache = new Map<string, HTMLImageElement>();
  await Promise.all(
    cells
      .filter((c) => c.image)
      .map(async (c) => {
        const url = mediaUrl(c.image!.url);
        if (!imageCache.has(url)) {
          try {
            imageCache.set(url, await loadImage(url));
          } catch {
            // image failed to load — leave cache empty, cell will show bg
          }
        }
      })
  );

  const BADGE_R = 16;
  const BADGE_FONT = Math.round(BADGE_R * 1.1);

  for (const cell of cells) {
    const col = cell.index % cols;
    const row = Math.floor(cell.index / cols);
    const x = padding + col * (cellW + gap);
    const y = padding + row * (cellH + captionH + gap);

    // ── Cell background (image area) ──
    ctx.fillStyle = cellBg;
    ctx.fillRect(x, y, cellW, cellH);

    // ── Image ──
    const imgEl = cell.image ? imageCache.get(mediaUrl(cell.image.url)) : undefined;
    if (imgEl) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(x, y, cellW, cellH);
      ctx.clip();
      if (cell.imageFit === "cover") {
        drawCover(ctx, imgEl, x, y, cellW, cellH);
      } else {
        drawContain(ctx, imgEl, cellBg, x, y, cellW, cellH);
      }
      ctx.restore();
    }

    // ── Number badge ──
    const numText = cellNumber(autoNumber, cell.index, cell.numberOverride);
    if (numText) {
      const bx = x + BADGE_R + 8;
      const by = y + BADGE_R + 8;
      if (numberStyle === "circle") {
        ctx.beginPath();
        ctx.arc(bx, by, BADGE_R, 0, Math.PI * 2);
        ctx.fillStyle = numberBg;
        ctx.fill();
      }
      ctx.fillStyle = numberStyle === "circle" ? numberColor : numberBg;
      ctx.font = `bold ${BADGE_FONT}px ui-sans-serif, system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(numText, bx, by);
    }

    // ── Caption area ──
    if (captionH > 0) {
      ctx.fillStyle = captionBg;
      ctx.fillRect(x, y + cellH, cellW, captionH);

      if (cell.caption.trim()) {
        const font = captionFont(captionBold, captionFontSize, captionFontFamily);
        ctx.font = font;
        ctx.fillStyle = captionColor;
        ctx.textBaseline = "middle";

        const hPad = 8;
        const maxW = cellW - hPad * 2;

        // Compute x based on alignment
        let tx: number;
        if (captionAlign === "center") {
          ctx.textAlign = "center";
          tx = x + cellW / 2;
        } else if (captionAlign === "right") {
          ctx.textAlign = "right";
          tx = x + cellW - hPad;
        } else {
          ctx.textAlign = "left";
          tx = x + hPad;
        }

        // Truncate to one line if too long
        let txt = cell.caption;
        while (txt.length > 1 && ctx.measureText(txt).width > maxW) {
          txt = txt.slice(0, -1);
        }
        if (txt !== cell.caption) txt += "…";

        ctx.fillText(txt, tx, y + cellH + captionH / 2);
      }
    }
  }

  // Download
  const dataUrl = canvas.toDataURL("image/png");
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = `${name.replace(/[^a-z0-9_-]/gi, "_")}.png`;
  a.click();
}
