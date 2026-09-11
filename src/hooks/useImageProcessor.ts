import { useState, useCallback, useRef } from "react";
import {
  incrementUsage,
  extractStyleFromBackend,
  ProcessingOptions,
  VisualStyle,
  DEFAULT_VISUAL_STYLE,
} from "@/lib/api";
import { logger } from "@/lib/logger";
import { useAuth } from "@/contexts/AuthContext";
import type { WorkerRegion } from "@/workers/regionDetector.worker";

import ImageTracer from "imagetracerjs";

export type ProcessingState =
  | "idle"
  | "uploading"
  | "detecting"
  | "editing"
  | "removing-bg"
  | "vectorizing"
  | "generating"
  | "done";

export interface Region {
  id: string;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface ExtractedIcon {
  id: number;
  dataUrl: string;
  svgContent: string;
  name: string;
}

function sanitizeProjectName(value: string) {
  return (value || "Asset")
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "Asset";
}

export function getIconName(id: number, projectName: string, resLabel: string, date: string) {
  const paddedId = id.toString().padStart(2, "0");
  return `GRIDXD_${sanitizeProjectName(projectName)}_${paddedId}_${resLabel}_${date}.png`;
}

export const statusMessages: Record<ProcessingState, string> = {
  idle: "",
  uploading: "Subiendo imagen...",
  detecting: "Detectando iconos...",
  editing: "Revisando regiones...",
  "removing-bg": "Eliminando fondos...",
  vectorizing: "Vectorizando (SVG)...",
  generating: "Generando archivos...",
  done: "¡Listo!",
};

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function detectRegionsViaWorker(imgEl: HTMLImageElement): Promise<Region[]> {
  const canvas = document.createElement("canvas");
  canvas.width = imgEl.naturalWidth || imgEl.width;
  canvas.height = imgEl.naturalHeight || imgEl.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return [{ id: "fallback", minX: 0, minY: 0, maxX: canvas.width, maxY: canvas.height }];
  ctx.drawImage(imgEl, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

  const fallbackRegion: Region = {
    id: "region-0-fallback",
    minX: 0,
    minY: 0,
    maxX: canvas.width,
    maxY: canvas.height,
  };

  const workerPromise = new Promise<Region[]>((resolve) => {
    const worker = new Worker(new URL("../workers/regionDetector.worker.ts", import.meta.url), { type: "module" });
    const finish = (regions: Region[]) => {
      worker.terminate();
      resolve(regions.length ? regions : [fallbackRegion]);
    };
    worker.onmessage = (e: MessageEvent<{ regions: WorkerRegion[]; error: string | null }>) => {
      if (e.data.error) {
        logger.warn("Worker region detection error: %s", e.data.error);
        finish([fallbackRegion]);
        return;
      }
      finish(e.data.regions as Region[]);
    };
    worker.onerror = () => finish([fallbackRegion]);
    worker.postMessage({ imageData, width: canvas.width, height: canvas.height });
  });

  const timeoutPromise = new Promise<Region[]>((resolve) => {
    setTimeout(() => resolve([fallbackRegion]), 15000);
  });

  return Promise.race([workerPromise, timeoutPromise]);
}

function regionArea(r: Region) {
  return Math.max(0, r.maxX - r.minX) * Math.max(0, r.maxY - r.minY);
}

function regionOverlap(a: Region, b: Region) {
  const x1 = Math.max(a.minX, b.minX);
  const y1 = Math.max(a.minY, b.minY);
  const x2 = Math.min(a.maxX, b.maxX);
  const y2 = Math.min(a.maxY, b.maxY);
  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  if (!inter) return 0;
  return inter / Math.min(regionArea(a) || 1, regionArea(b) || 1);
}

function dedupeRegions(regions: Region[]): Region[] {
  const sorted = [...regions]
    .filter((r) => r.maxX - r.minX > 5 && r.maxY - r.minY > 5)
    .sort((a, b) => regionArea(a) - regionArea(b));
  const kept: Region[] = [];
  for (const candidate of sorted) {
    if (kept.some((existing) => regionOverlap(candidate, existing) > 0.6)) continue;
    kept.push(candidate);
  }
  return kept.sort((a, b) => (a.minY - b.minY) || (a.minX - b.minX));
}

function trimRegionAgainstLargeNeighbors(regions: Region[], width: number, height: number): Region[] {
  const maxReasonableArea = width * height * 0.7;
  const large = regions.filter((r) => regionArea(r) >= maxReasonableArea);
  if (!large.length || regions.length <= 1) return regions;

  // If an all-image/huge region exists together with smaller candidates,
  // prefer the actual smaller candidates instead of exporting the whole sheet.
  const filtered = regions.filter((r) => regionArea(r) < maxReasonableArea);
  return filtered.length ? filtered : regions;
}

export async function extractIconsFromRegions(
  imgEl: HTMLImageElement,
  regions: Region[],
  options: ProcessingOptions,
  maxIcons = Infinity,
): Promise<ExtractedIcon[]> {
  const width = imgEl.naturalWidth || imgEl.width;
  const height = imgEl.naturalHeight || imgEl.height;
  if (!width || !height) throw new Error("Invalid image dimensions");
  if (width > 10000 || height > 10000) throw new Error("Image too large (>10000px)");

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  ctx.drawImage(imgEl, 0, 0);

  const today = new Date().toISOString().split("T")[0].replace(/-/g, "");
  const proj = options.projectName || "Project";
  const deduped = trimRegionAgainstLargeNeighbors(dedupeRegions(regions), width, height);
  const regionsToProcess = maxIcons < Infinity ? deduped.slice(0, maxIcons) : deduped;
  const results: ExtractedIcon[] = [];

  for (let i = 0; i < regionsToProcess.length; i++) {
    const r = regionsToProcess[i];
    const padding = Math.max(8, Math.round(Math.max(r.maxX - r.minX, r.maxY - r.minY) * 0.08));
    const sx = Math.max(0, Math.floor(r.minX - padding));
    const sy = Math.max(0, Math.floor(r.minY - padding));
    const ex = Math.min(width, Math.ceil(r.maxX + padding));
    const ey = Math.min(height, Math.ceil(r.maxY + padding));
    const sw = Math.max(1, ex - sx);
    const sh = Math.max(1, ey - sy);
    if (sw < 2 || sh < 2) continue;

    const resolution = options.upscale ? 2048 : 1024;
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = sw;
    tempCanvas.height = sh;
    const tempCtx = tempCanvas.getContext("2d", { willReadFrequently: true });
    if (!tempCtx) throw new Error("Canvas 2D context unavailable for temp");
    tempCtx.drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh);

    if (options.removeBackground) {
      const cropData = tempCtx.getImageData(0, 0, sw, sh);
      const pixels = cropData.data;
      const corners = [[0, 0], [sw - 1, 0], [0, sh - 1], [sw - 1, sh - 1]];
      const colorFreq: Record<string, number> = {};
      for (const [cx, cy] of corners) {
        const cp = (cy * sw + cx) * 4;
        const key = `${pixels[cp]},${pixels[cp + 1]},${pixels[cp + 2]}`;
        colorFreq[key] = (colorFreq[key] || 0) + 1;
      }
      let dominantColor = "255,255,255";
      let maxF = 0;
      for (const key in colorFreq) {
        if (colorFreq[key] > maxF) {
          maxF = colorFreq[key];
          dominantColor = key;
        }
      }
      const [bgR, bgG, bgB] = dominantColor.split(",").map(Number);
      const luminance = 0.299 * bgR + 0.587 * bgG + 0.114 * bgB;
      if (luminance > 220 || luminance < 35) {
        for (let p = 0; p < pixels.length; p += 4) {
          const dist = Math.abs(pixels[p] - bgR) + Math.abs(pixels[p + 1] - bgG) + Math.abs(pixels[p + 2] - bgB);
          if (dist < 45) pixels[p + 3] = 0;
        }
        tempCtx.putImageData(cropData, 0, 0);
      }
    }

    const outCanvas = document.createElement("canvas");
    outCanvas.width = resolution;
    outCanvas.height = resolution;
    const outCtx = outCanvas.getContext("2d");
    if (!outCtx) throw new Error("Canvas 2D context unavailable for output");
    const scale = Math.min((resolution * 0.9) / sw, (resolution * 0.9) / sh);
    const dw = sw * scale;
    const dh = sh * scale;
    const dx = (resolution - dw) / 2;
    const dy = (resolution - dh) / 2;
    outCtx.drawImage(tempCanvas, 0, 0, sw, sh, dx, dy, dw, dh);

    const imageData = tempCtx.getImageData(0, 0, sw, sh);
    const tracer = (self as Record<string, unknown>).ImageTracer || ImageTracer;
    if (!tracer || typeof (tracer as { imagedataToSVG?: unknown }).imagedataToSVG !== "function") {
      throw new Error("SVG vectorizer unavailable");
    }
    const svgString = (tracer as { imagedataToSVG: (data: ImageData, opts: Record<string, unknown>) => string }).imagedataToSVG(imageData, {
      ltres: 0.1,
      qtres: 1,
      pathomit: 8,
      colorsampling: 1,
      numberofcolors: 2,
      mincolorratio: 0.5,
    });

    const id = i + 1;
    results.push({
      id,
      dataUrl: outCanvas.toDataURL("image/png"),
      svgContent: svgString,
      name: `GRIDXD_${proj}_${id.toString().padStart(2, "0")}_${options.upscale ? "2K" : "HD"}_${today}.png`,
    });
  }

  return results;
}

export function useImageProcessor() {
  const [state, setState] = useState<ProcessingState>("idle");
  const [preview, setPreview] = useState<string | null>(null);
  const [icons, setIcons] = useState<ExtractedIcon[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [usedBackend, setUsedBackend] = useState(false);
  const [detectedRegions, setDetectedRegions] = useState<Region[]>([]);
  const [pendingImgEl, setPendingImgEl] = useState<HTMLImageElement | null>(null);
  const [pendingOptions, setPendingOptions] = useState<ProcessingOptions | null>(null);
  const [visualStyle, setVisualStyle] = useState<VisualStyle>(DEFAULT_VISUAL_STYLE);
  const [removeBackground, setRemoveBackground] = useState(true);
  const [upscale, setUpscale] = useState(true);
  const [projectName, setProjectName] = useState("");
  const { plan: authPlan } = useAuth();

  const updateIconNames = useCallback(() => {
    if (!icons.length) return;
    const today = new Date().toISOString().split("T")[0].replace(/-/g, "");
    const resLabel = upscale ? "2K" : "HD";
    setIcons((prev) => prev.map((icon) => ({ ...icon, name: getIconName(icon.id, projectName, resLabel, today) })));
  }, [projectName, upscale, icons.length]);

  const confirmRegions = useCallback(async (editedRegions: Region[]) => {
    if (!pendingImgEl || !pendingOptions) return;
    const valid = dedupeRegions(editedRegions);
    if (!valid.length) {
      setError("Mantén al menos una región para continuar.");
      return;
    }
    try {
      if (pendingOptions.removeBackground) {
        setState("removing-bg");
        await delay(250);
      }
      setState("vectorizing");
      await delay(150);
      setState("generating");
      const maxIcons = authPlan === "free" ? 3 : Infinity;
      const extracted = await extractIconsFromRegions(pendingImgEl, valid, pendingOptions, maxIcons);
      setIcons(extracted);
      setState("done");
      // Usage accounting must never block the result.
      void incrementUsage().catch((err) => logger.warn("Usage increment skipped: %o", err));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error("Extraction error: %s", msg);
      setError(msg);
      setState("idle");
    }
  }, [pendingImgEl, pendingOptions, authPlan]);

  const processClientSide = useCallback(async (file: File, options: ProcessingOptions) => {
    setState("uploading");
    await delay(200);
    setState("detecting");
    const stylePromise = extractStyleFromBackend(file);
    const imgEl = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
    const regions = await detectRegionsViaWorker(imgEl);
    const style = await stylePromise;
    setVisualStyle(style);
    setPendingImgEl(imgEl);
    setPendingOptions(options);
    setDetectedRegions(regions);
    setState("editing");
  }, []);

  const processImages = useCallback(async (files: File[]) => {
    if (!files.length) return;
    const validFiles = files.filter((file) => {
      if (file.size > 10 * 1024 * 1024) {
        setError(`${file.name} supera los 10MB`);
        return false;
      }
      if (!["image/jpeg", "image/png"].includes(file.type)) {
        setError(`Formato no compatible: ${file.name}. Usa JPG o PNG.`);
        return false;
      }
      return true;
    });
    if (!validFiles.length) return;

    setError(null);
    setIcons([]);
    setUsedBackend(false);

    if (validFiles.length === 1) {
      const file = validFiles[0];
      const url = URL.createObjectURL(file);
      setPreview(url);
      await processClientSide(file, {
        removeBackground,
        upscale,
        projectName: projectName || undefined,
      });
      return;
    }

    setState("uploading");
    const maxIcons = authPlan === "free" ? 3 : Infinity;
    const allExtracted: ExtractedIcon[] = [];
    for (let i = 0; i < validFiles.length; i++) {
      const file = validFiles[i];
      try {
        const imgEl = await new Promise<HTMLImageElement>((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = reject;
          img.src = URL.createObjectURL(file);
        });
        const regions = await detectRegionsViaWorker(imgEl);
        const extracted = await extractIconsFromRegions(imgEl, regions, {
          removeBackground,
          upscale,
          projectName: `${projectName || "Batch"}_${i + 1}`,
        }, maxIcons);
        allExtracted.push(...extracted.map((icon) => ({
          ...icon,
          id: allExtracted.length + 1,
        })));
        setIcons([...allExtracted]);
        setPreview(URL.createObjectURL(file));
      } catch (err) {
        logger.warn("Batch extraction skipped: %o", err);
      }
    }
    setState(allExtracted.length ? "done" : "idle");
    if (allExtracted.length) void incrementUsage().catch(() => undefined);
  }, [removeBackground, upscale, projectName, processClientSide, authPlan]);

  const reset = () => {
    if (preview?.startsWith("blob:")) URL.revokeObjectURL(preview);
    setState("idle");
    setPreview(null);
    setIcons([]);
    setError(null);
    setUsedBackend(false);
    setDetectedRegions([]);
    setPendingImgEl(null);
    setPendingOptions(null);
    setVisualStyle(DEFAULT_VISUAL_STYLE);
  };

  const injectGeneratedIcon = useCallback((svgContent: string, conceptName: string) => {
    const today = new Date().toISOString().split("T")[0].replace(/-/g, "");
    const resLabel = upscale ? "2K" : "HD";
    setIcons((prev) => {
      const newId = prev.length + 1;
      return [...prev, {
        id: newId,
        dataUrl: "",
        svgContent,
        name: `GRIDXD_GEN_${sanitizeProjectName(conceptName).toUpperCase()}_${newId.toString().padStart(2, "0")}_${resLabel}_${today}.svg`,
      }];
    });
  }, [upscale]);

  const renameIcon = useCallback((id: number, newName: string) => {
    const clean = sanitizeProjectName(newName).replace(/\.(png|svg)$/i, "");
    setIcons((prev) => prev.map((icon) => icon.id === id ? { ...icon, name: `${clean}.png` } : icon));
  }, []);

  return {
    state,
    preview,
    icons,
    error,
    usedBackend,
    visualStyle,
    processImages,
    reset,
    injectGeneratedIcon,
    renameIcon,
    detectedRegions,
    confirmRegions,
    pendingImgEl,
    options: {
      removeBackground,
      setRemoveBackground,
      upscale,
      setUpscale,
      projectName,
      setProjectName,
      updateIconNames,
    },
  };
}