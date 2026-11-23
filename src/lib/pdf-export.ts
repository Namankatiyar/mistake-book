import { jsPDF } from "jspdf";
import type { Question, Source } from "./model";
import { mistakeById } from "./model";
import { chapterById, subjectById, subjectOfChapter } from "./syllabus";

export type ColumnFormat = "1" | "2";

export type MetadataOptions = {
  showSubject: boolean;
  showChapter: boolean;
  showMistake: boolean;
  showSource: boolean;
  showAnswerKey?: boolean;
};

export type ExportProgress = {
  stage: "analyzing" | "processing" | "rendering" | "done" | "error";
  current: number;
  total: number;
  message: string;
};

export type ProcessedImage = {
  questionId: string;
  dataUrl: string;
  width: number;
  height: number;
  isDark: boolean;
};

/**
 * Loads a Blob into an HTMLImageElement safely in the browser.
 */
function loadImageFromBlob(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (err) => {
      URL.revokeObjectURL(url);
      reject(err);
    };
    img.src = url;
  });
}

/**
 * Detects whether an image is dark mode by sampling background & border pixels.
 * Uses standard luminance formula: 0.299*R + 0.587*G + 0.114*B.
 */
export async function detectDarkMode(blob: Blob): Promise<{ isDark: boolean; width: number; height: number; previewUrl: string }> {
  const img = await loadImageFromBlob(blob);
  const canvas = document.createElement("canvas");
  // Downscale for lightning fast analysis
  const maxDim = 300;
  let sampleW = img.naturalWidth || img.width;
  let sampleH = img.naturalHeight || img.height;
  if (sampleW > maxDim || sampleH > maxDim) {
    if (sampleW > sampleH) {
      sampleH = Math.round((sampleH * maxDim) / sampleW);
      sampleW = maxDim;
    } else {
      sampleW = Math.round((sampleW * maxDim) / sampleH);
      sampleH = maxDim;
    }
  }

  canvas.width = sampleW;
  canvas.height = sampleH;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    return {
      isDark: false,
      width: img.naturalWidth || img.width,
      height: img.naturalHeight || img.height,
      previewUrl: canvas.toDataURL("image/jpeg", 0.7),
    };
  }

  ctx.drawImage(img, 0, 0, sampleW, sampleH);
  const imgData = ctx.getImageData(0, 0, sampleW, sampleH);
  const data = imgData.data;

  // Sample corner & border pixels which usually contain the background
  let totalLuminance = 0;
  let sampleCount = 0;

  const samplePixel = (x: number, y: number) => {
    const idx = (y * sampleW + x) * 4;
    const r = data[idx];
    const g = data[idx + 1];
    const b = data[idx + 2];
    const a = data[idx + 3];
    if (a > 50) {
      totalLuminance += 0.299 * r + 0.587 * g + 0.114 * b;
      sampleCount++;
    }
  };

  // Sample perimeter and corners
  const step = Math.max(1, Math.floor(sampleW / 25));
  for (let x = 0; x < sampleW; x += step) {
    samplePixel(x, 0); // top border
    samplePixel(x, sampleH - 1); // bottom border
    samplePixel(x, Math.floor(sampleH * 0.1)); // near top
  }
  for (let y = 0; y < sampleH; y += step) {
    samplePixel(0, y); // left border
    samplePixel(sampleW - 1, y); // right border
  }

  // Also sample top 10% corners
  for (let x = 0; x < Math.min(20, sampleW); x += 4) {
    for (let y = 0; y < Math.min(20, sampleH); y += 4) {
      samplePixel(x, y);
    }
  }

  const avgLuminance = sampleCount > 0 ? totalLuminance / sampleCount : 255;
  // If avg luminance is below 128 (out of 255), it's a dark mode screenshot
  const isDark = avgLuminance < 125;

  return {
    isDark,
    width: img.naturalWidth || img.width,
    height: img.naturalHeight || img.height,
    previewUrl: canvas.toDataURL("image/jpeg", 0.7),
  };
}

/**
 * Pre-processes an image for the PDF.
 * If invert=true, inverts RGB values so dark backgrounds become white paper backgrounds.
 */
export async function processImageForExport(
  blob: Blob,
  invert: boolean
): Promise<{ dataUrl: string; width: number; height: number }> {
  const img = await loadImageFromBlob(blob);
  const canvas = document.createElement("canvas");
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  canvas.width = w;
  canvas.height = h;

  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    throw new Error("Could not initialize 2D canvas context for PDF generation");
  }

  // Draw original image
  ctx.drawImage(img, 0, 0, w, h);

  if (invert) {
    const imgData = ctx.getImageData(0, 0, w, h);
    const data = imgData.data;
    const len = data.length;

    // Fast pixel color inversion
    for (let i = 0; i < len; i += 4) {
      // Invert R, G, B
      data[i] = 255 - data[i];
      data[i + 1] = 255 - data[i + 1];
      data[i + 2] = 255 - data[i + 2];
      // Keep alpha unchanged
    }

    ctx.putImageData(imgData, 0, 0);
  }

  // JPEG 0.92 gives optimal quality vs memory ratio
  const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
  return {
    dataUrl,
    width: w,
    height: h,
  };
}

export type GeneratePdfOptions = {
  questions: Question[];
  sources: Source[];
  columnFormat: ColumnFormat;
  metadata: MetadataOptions;
  showAnswers?: boolean;
  inversions: Record<string, boolean>; // questionId -> invert
  onProgress: (p: ExportProgress) => void;
};

/**
 * Client-side PDF generation using jsPDF with newspaper 2-column or 1-column layout.
 */
export async function generateContinuousPdf(options: GeneratePdfOptions): Promise<Blob> {
  const { questions, sources, columnFormat, metadata, showAnswers, inversions, onProgress } = options;
  const shouldShowAnswers = showAnswers ?? metadata.showAnswerKey ?? false;
  const total = questions.length;

  if (total === 0) {
    throw new Error("No questions selected for export");
  }

  // Phase 1: Process and invert images asynchronously with progress updates
  const processedList: {
    question: Question;
    dataUrl: string;
    width: number;
    height: number;
  }[] = [];

  for (let i = 0; i < total; i++) {
    const q = questions[i];
    const shouldInvert = !!inversions[q.id];

    onProgress({
      stage: "processing",
      current: i + 1,
      total,
      message: `Processing question ${i + 1} of ${total}${shouldInvert ? " (inverting colors)" : ""}…`,
    });

    // Yield control to let React render progress bar
    await new Promise((r) => setTimeout(r, 0));

    try {
      const processed = await processImageForExport(q.image, shouldInvert);
      processedList.push({
        question: q,
        dataUrl: processed.dataUrl,
        width: processed.width,
        height: processed.height,
      });
    } catch {
      // Fallback: draw directly if canvas export fails
      continue;
    }
  }

  // Phase 2: PDF Page Layout Assembly
  onProgress({
    stage: "rendering",
    current: 0,
    total: processedList.length,
    message: "Assembling PDF layout and pages…",
  });
  await new Promise((r) => setTimeout(r, 0));

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
    compress: true,
  });

  // A4 measurements in mm
  const pageWidth = 210;
  const pageHeight = 297;
  const marginTop = 14;
  const marginBottom = 15;
  const marginLeft = 12;
  const marginRight = 12;
  const usableWidth = pageWidth - marginLeft - marginRight; // 186mm
  const usableHeight = pageHeight - marginTop - marginBottom; // 268mm

  const isTwoCol = columnFormat === "2";
  const colGap = 8;
  const colWidth = isTwoCol ? (usableWidth - colGap) / 2 : usableWidth; // ~89mm or 186mm

  // Layout tracking (newspaper column style)
  let currentCol = 0; // 0 (left) or 1 (right)
  let currentY = marginTop;

  const getColX = (colIdx: number) => {
    return marginLeft + colIdx * (colWidth + colGap);
  };

  // Helper to check if any metadata is enabled
  const hasMetadata =
    metadata.showSubject ||
    metadata.showChapter ||
    metadata.showMistake ||
    metadata.showSource;

  for (let i = 0; i < processedList.length; i++) {
    const item = processedList[i];
    const { question, dataUrl, width: imgW, height: imgH } = item;

    // Check if question has an answer to display
    const hasAnswer =
      shouldShowAnswers &&
      typeof question.answerKey === "string" &&
      question.answerKey.trim().length > 0;

    // Calculate metadata badges height
    const headerHeight = hasMetadata ? 6.5 : 0;
    const separationHeight = 6.5; // space + line + space

    let answerBlockHeight = 0;
    let answerLines: string[] = [];
    if (hasAnswer) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      const ansFullText = `Answer: ${question.answerKey.trim()}`;
      answerLines = doc.splitTextToSize(ansFullText, colWidth - 6);
      const lineH = 3.8;
      answerBlockHeight = 2 + (answerLines.length * lineH + 2.5);
    }

    // Calculate rendered image dimensions preserving aspect ratio
    const aspect = imgH / (imgW || 1);
    let renderedW = colWidth;
    let renderedH = renderedW * aspect;

    // Safety constraint: If a single image + header + answer is taller than the entire printable page,
    // proportionally scale it down so it fits completely on one page
    const maxItemContentH = usableHeight - headerHeight - answerBlockHeight - separationHeight;
    if (renderedH > maxItemContentH) {
      const scale = maxItemContentH / renderedH;
      renderedH = maxItemContentH;
      renderedW = renderedW * scale;
    }

    const totalItemH = headerHeight + renderedH + answerBlockHeight + separationHeight;

    // Check if item fits in current column
    if (currentY + totalItemH > pageHeight - marginBottom) {
      if (isTwoCol && currentCol === 0) {
        // Advance to Column 2 on the SAME page
        currentCol = 1;
        currentY = marginTop;
      } else {
        // Advance to Next Page and start at Column 1
        doc.addPage();
        currentCol = 0;
        currentY = marginTop;
      }
    }

    const currentX = getColX(currentCol);

    // 1. Draw Optional Metadata Header Strip
    if (hasMetadata) {
      let badgeX = currentX;
      const badgeY = currentY;

      doc.setFont("helvetica", "normal");

      // Subject badge
      if (metadata.showSubject) {
        const sub =
          subjectOfChapter(question.chapterId) ??
          (question.subjectId ? subjectById(question.subjectId) : undefined);
        const subName = sub?.name || (question.chapterId ? "Subject" : "Untagged");
        doc.setFontSize(7.5);
        const textW = doc.getTextWidth(subName);
        const pillW = textW + 4;

        doc.setFillColor(243, 244, 246); // light gray
        doc.roundedRect(badgeX, badgeY, pillW, 4.2, 1, 1, "F");
        doc.setTextColor(31, 41, 55); // dark gray
        doc.text(subName, badgeX + 2, badgeY + 3.1);
        badgeX += pillW + 2;
      }

      // Chapter badge
      if (metadata.showChapter) {
        const ch = chapterById(question.chapterId);
        if (ch) {
          doc.setFontSize(7);
          let chName = ch.name;
          if (isTwoCol && chName.length > 18) {
            chName = chName.slice(0, 16) + "…";
          }
          const textW = doc.getTextWidth(chName);
          const pillW = textW + 4;

          doc.setFillColor(249, 250, 251);
          doc.setDrawColor(229, 231, 235);
          doc.roundedRect(badgeX, badgeY, pillW, 4.2, 1, 1, "FD");
          doc.setTextColor(75, 85, 99);
          doc.text(chName, badgeX + 2, badgeY + 3.1);
          badgeX += pillW + 2;
        }
      }

      // Mistake badge
      if (metadata.showMistake && question.mistakeId) {
        const m = mistakeById(question.mistakeId);
        if (m) {
          doc.setFontSize(7);
          let label = m.label;
          if (isTwoCol && label.length > 16) {
            label = label.slice(0, 14) + "…";
          }
          const textW = doc.getTextWidth(label);
          const pillW = textW + 4;

          // Tone colors
          if (m.tone === "red") {
            doc.setFillColor(254, 242, 242);
            doc.setTextColor(185, 28, 28);
          } else if (m.tone === "orange") {
            doc.setFillColor(255, 247, 237);
            doc.setTextColor(194, 65, 12);
          } else {
            doc.setFillColor(254, 252, 232);
            doc.setTextColor(161, 98, 7);
          }

          doc.roundedRect(badgeX, badgeY, pillW, 4.2, 1, 1, "F");
          doc.text(label, badgeX + 2, badgeY + 3.1);
          badgeX += pillW + 2;
        }
      }

      // Source badge
      if (metadata.showSource && question.sourceId) {
        const src = sources.find((s) => s.id === question.sourceId);
        if (src) {
          doc.setFontSize(7);
          let srcName = src.name;
          if (isTwoCol && srcName.length > 14) {
            srcName = srcName.slice(0, 12) + "…";
          }
          const textW = doc.getTextWidth(srcName);
          const pillW = textW + 4;

          doc.setFillColor(243, 244, 246);
          doc.roundedRect(badgeX, badgeY, pillW, 4.2, 1, 1, "F");
          doc.setTextColor(107, 114, 128);
          doc.text(srcName, badgeX + 2, badgeY + 3.1);
          badgeX += pillW + 2;
        }
      }

      currentY += headerHeight;
    }

    // 2. Draw Question Image
    const imgX = currentX + (colWidth - renderedW) / 2;
    doc.addImage(dataUrl, "JPEG", imgX, currentY, renderedW, renderedH, undefined, "FAST");
    currentY += renderedH;

    // 3. Draw Answer Text Below Question Image (if toggled)
    if (hasAnswer && answerLines.length > 0) {
      currentY += 2;
      const lineH = 3.8;
      const badgeH = answerLines.length * lineH + 2.5;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);

      const maxTextLineWidth = Math.max(...answerLines.map((l: string) => doc.getTextWidth(l)));
      const badgeW =
        answerLines.length === 1 ? Math.min(colWidth, maxTextLineWidth + 6) : colWidth;

      // Soft indigo-tinted badge below the question
      doc.setFillColor(238, 242, 255); // #EEF2FF
      doc.setDrawColor(224, 231, 255); // #E0E7FF
      doc.setLineWidth(0.2);
      doc.roundedRect(currentX, currentY, badgeW, badgeH, 1, 1, "FD");

      const prefix = "Answer: ";
      let textY = currentY + 3.4;

      for (let l = 0; l < answerLines.length; l++) {
        const line = answerLines[l];
        if (l === 0 && line.startsWith(prefix)) {
          // Bold "Answer: " prefix in indigo-700
          doc.setFont("helvetica", "bold");
          doc.setTextColor(67, 56, 202); // #4338CA
          doc.text(prefix, currentX + 3, textY);

          // Value in deep indigo-950
          const rest = line.slice(prefix.length);
          if (rest) {
            doc.setFont("helvetica", "bold");
            doc.setTextColor(30, 27, 75); // #1E1B4B
            doc.text(rest, currentX + 3 + doc.getTextWidth(prefix), textY);
          }
        } else {
          doc.setFont("helvetica", "bold");
          doc.setTextColor(30, 27, 75);
          doc.text(line, currentX + 3, textY);
        }
        textY += lineH;
      }

      currentY += badgeH;
    }

    // 4. Draw Thin Separation Line
    currentY += 2.5;
    doc.setDrawColor(229, 231, 235); // line-gray #E5E7EB
    doc.setLineWidth(0.2);
    doc.line(currentX, currentY, currentX + colWidth, currentY);
    currentY += 4;
  }

  // Phase 3: Add Minimalist Page Numbers at Bottom Center
  const totalPages = doc.getNumberOfPages();
  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    doc.setPage(pageNum);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(156, 163, 175); // neutral gray #9CA3AF
    doc.text(`— ${pageNum} —`, pageWidth / 2, pageHeight - 7, { align: "center" });
  }

  onProgress({
    stage: "done",
    current: totalPages,
    total: totalPages,
    message: "PDF generation complete!",
  });

  return doc.output("blob");
}
