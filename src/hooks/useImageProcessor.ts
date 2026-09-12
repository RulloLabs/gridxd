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

function revokeObjectUrl(url: string | null) {
  if (url?.startsWith("blob:")) URL.revokeObjectURL(url);
}

async function detectRegionsViaWorker(imgEl: HTMLImageElement): Promise<Region[]> {
  const width = imgEl.naturalWidth || imgEl.width;
  const height = imgEl.naturalHeight || imgEl.height;
  if (!width || !height) throw new Error("No se han podido leer las dimensiones de la imagen.");

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("Canvas 2D no disponible para detectar regiones.");
  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(imgEl, 0, 0, width, height);
  const imageData = ctx.getImageData(0, 0, width, height);

  const workerPromise = new Promise<Region[]>((resolve, reject) => {
    let settled = false;
    const worker = new Worker(new URL("../workers/regionDetector.worker.ts", import.meta.url), { type: "module" });
    const finish = (regions: Region[], error?: string) => {
      if (settled) return;
      settled = true;
      worker.terminate();
      if (error) reject(new Error(error));
      else resolve(regions as Region[]);
    };

    worker.onmessage = (e: MessageEvent<{ regions: WorkerRegion[]; error: string | null }>) => {
      if (e.data.error) finish([], e.data.error);
      else finish(e.data.regions || []);
    };
    worker.onerror = () => finish([], "El detector de regiones no pudo procesar la imagen.");
    worker.postMessage({ imageData, width, height });
  });

  const timeoutPromise = new Promise<Region[]>((_, reject) => {
    setTimeout(() => reject(new Error("La detección ha tardado demasiado. Puedes seleccionar las regiones manualmente.")), 15000);
  });

  return Promise.race([workerPromise, timeoutPromise]);
}

function regionArea(r: Region) {
  return Math.max(0, r.maxX - r.minX + 1) * Math.max(0, r.maxY - r.minY + 1);
}

function regionOverlap(a: Region, b: Region) {
  const x1 = Math.max(a.minX, b.minX);
  const y1 = Math.max(a.minY, b.minY);
  const x2 = Math.min(a.maxX, b.maxX);
  const y2 = Math.min(a.maxY, b.maxY);
  const inter = Math.max(0, x2 - x1 + 1) * Math.max(0, y2 - y1 + 1);
  if (!inter) return 0;
  return inter / Math.min(regionArea(a) || 1, regionArea(b) || 1);
}

function clampRegion(r: Region, width: number, height: number): Region | null {
  const minX = Math.max(0, Math.min(width - 1, Math.round(r.minX)));
  const minY = Math.max(0, Math.min(height - 1, Math.round(r.minY)));
  const maxX = Math.max(minX, Math.min(width - 1, Math.round(r.maxX)));
  const maxY = Math.max(minY, Math.min(height - 1, Math.round(r.maxY)));
  if (maxX - minX < 2 || maxY - minY < 2) return null;
  return { id: r.id, minX, minY, maxX, maxY };
}

function dedupeRegions(regions: Region[], width?: number, height?: number): Region[] {
  const normalized = regions
    .map((region) => (width && height ? clampRegion(region, width, height) : region))
    .filter((r): r is Region => Boolean(r))
    .sort((a, b) => regionArea(b) - regionArea(a));

  const kept: Region[] = [];
  for (const candidate of normalized) {
    const duplicate = kept.some((existing) => regionOverlap(candidate, existing) > 0.84);
    if (!duplicate) kept.push(candidate);
  }
  return kept.sort((a, b) => (a.minY - b.minY) || (a.minX - b.minX));
}

function trimOversizedDetection(regions: Region[], width: number, height: number): Region[] {
  const imageArea = Math.max(1, width * height);
  if (regions.length <= 1) return regions;
  const meaningful = regions.filter((region) => regionArea(region) < imageArea * 0.92);
  return meaningful.length ? meaningful : regions;
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
  ctx.drawImage(imgEl, 0, 0, width, height);

  const today = new Date().toISOString().split("T")[0].replace(/-/g, "");
  const proj = options.projectName || "Project";
  const normalized = dedupeRegions(regions, width, height);
  const cleanRegions = trimOversizedDetection(normalized, width, height);
  const regionsToProcess = maxIcons < Infinity ? cleanRegions.slice(0, maxIcons) : cleanRegions;
  const results: ExtractedIcon[] = [];

  for (let i = 0; i < regionsToProcess.length; i++) {
    const r = regionsToProcess[i];
    const rw = r.maxX - r.minX + 1;
    const rh = r.maxY - r.minY + 1;
    const padding = Math.max(6, Math.round(Math.max(rw, rh) * 0.06));
    const sx = Math.max(0, r.minX - padding);
    const sy = Math.max(0, r.minY - padding);
    const ex = Math.min(width - 1, r.maxX + padding);
    const ey = Math.min(height - 1, r.maxY + padding);
    const sw = ex - sx + 1;
    const sh = ey - sy + 1;
    if (sw < 3 || sh < 3) continue;

    const resolution = options.upscale ? 2048 : 1024;
    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = sw;
    tempCanvas.height = sh;
    const tempCtx = tempCanvas.getContext("2d", { willReadFrequently: true });
    if (!tempCtx) throw new Error("Canvas 2D context unavailable for temp");
    tempCtx.clearRect(0, 0, sw, sh);
    tempCtx.drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh);

    if (options.removeBackground) {
      const cropData = tempCtx.getImageData(0, 0, sw, sh);
      const pixels = cropData.data;
      const corners = [[0, 0], [sw - 1, 0], [0, sh - 1], [sw - 1, sh - 1]] as const;
      const samples = corners.map(([cx, cy]) => {
        const p = (cy * sw + cx) * 4;
        return [pixels[p], pixels[p + 1], pixels[p + 2]] as const;
      });
      const bgR = Math.round(samples.reduce((sum, c) => sum + c[0], 0) / samples.length);
      const bgG = Math.round(samples.reduce((sum, c) => sum + c[1], 0) / samples.length);
      const bgB = Math.round(samples.reduce((sum, c) => sum + c[2], 0) / samples.length);
      const bgLum = 0.2126 * bgR + 0.7152 * bgG + 0.0722 * bgB;

      if (bgLum > 220 || bgLum < 35) {
        for (let p = 0; p < pixels.length; p += 4) {
          const dist = Math.abs(pixels[p] - bgR) + Math.abs(pixels[p + 1] - bgG) + Math.abs(pixels[p + 2] - bgB);
          if (dist <= 42) pixels[p + 3] = 0;
        }
        tempCtx.putImageData(cropData, 0, 0);
      }
    }

    const outCanvas = document.createElement("canvas");
    outCanvas.width = resolution;
    outCanvas.height = resolution;
    const outCtx = outCanvas.getContext("2d");
    if (!outCtx) throw new Error("Canvas 2D context unavailable for output");
    outCtx.clearRect(0, 0, resolution, resolution);
    const scale = Math.min((resolution * 0.9) / sw, (resolution * 0.9) / sh);
    const dw = sw * scale;
    const dh = sh * scale;
    const dx = (resolution - dw) / 2;
    const dy = (resolution - dh) / 2;
    outCtx.drawImage(tempCanvas, 0, 0, sw, sh, dx, dy, dw, dh);

    const imageData = tempCtx.getImageData(0, 0, sw, sh);
    const tracer = (ImageTracer as unknown as { imagedataToSVG?: (data: ImageData, opts: Record<string, unknown>) => string });
    if (typeof tracer?.imagedataToSVG !== "function") throw new Error("SVG vectorizer unavailable");

    const svgString = tracer.imagedataToSVG(imageData, {
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
      name: getIconName(id, proj, options.upscale ? "2K" : "HD", today),
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
  const [pendingObjectUrl, setPendingObjectUrl] = useState<string | null>(null);
  const [pendingOptions, setPendingOptions] = useState<ProcessingOptions | null>(null);
  const [visualStyle, setVisualStyle] = useState<VisualStyle>(DEFAULT_VISUAL_STYLE);
  const [removeBackground, setRemoveBackground] = useState(true);
  const [upscale, setUpscale] = useState(true);
  const [projectName, setProjectName] = useState("");
  const detectionTimeoutRef = useRef<number | null>(null);
  const { plan: authPlan } = useAuth();

  const updateIconNames = useCallback(() => {
    if (!icons.length) return;
    const today = new Date().toISOString().split("T")[0].replace(/-/g, "");
    const resLabel = upscale ? "2K" : "HD";
    setIcons((prev) => prev.map((icon) => ({ ...icon, name: getIconName(icon.id, projectName, resLabel, today) })));
  }, [projectName, upscale, icons.length]);

  const confirmRegions = useCallback(async (editedRegions: Region[]) => {
    if (!pendingImgEl || !pendingOptions) return;
    const width = pendingImgEl.naturalWidth || pendingImgEl.width;
    const height = pendingImgEl.naturalHeight || pendingImgEl.height;
    const valid = dedupeRegions(editedRegions, width, height);
    if (!valid.length) {
      setError("Mantén al menos una región para continuar.");
      return;
    }

    try {
      if (pendingOptions.removeBackground) {
        setState("removing-bg");
        await delay(150);
      }
      setState("vectorizing");
      await delay(100);
      setState("generating");
      const maxIcons = authPlan === "free" ? 3 : Infinity;
      const extracted = await extractIconsFromRegions(pendingImgEl, valid, pendingOptions, maxIcons);
      setIcons(extracted);
      setState("done");
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
    setError(null);
    await delay(120);
    setState("detecting");

    const stylePromise = extractStyleFromBackend(file).catch((err) => {
      logger.warn("Style extraction fallback: %o", err);
      return DEFAULT_VISUAL_STYLE;
    });

    const objectUrl = URL.createObjectURL(file);
    try {
      const imgEl = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error("No se ha podido cargar la imagen."));
        img.src = objectUrl;
      });

      if (detectionTimeoutRef.current) window.clearTimeout(detectionTimeoutRef.current);
      const regions = await detectRegionsViaWorker(imgEl);
      const width = imgEl.naturalWidth || imgEl.width;
      const height = imgEl.naturalHeight || imgEl.height;
      const clean = trimOversizedDetection(dedupeRegions(regions, width, height), width, height);
      const style = await stylePromise;
      setVisualStyle(style);
      setPendingImgEl(imgEl);
      setPendingObjectUrl(objectUrl);
      setPendingOptions(options);
      setDetectedRegions(clean);
      setState("editing");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error("Detection error: %s", msg);
      setError(msg);
      setDetectedRegions([]);
      setState("editing");
      setPendingImgEl(await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = objectUrl;
      }).catch(() => null));
      setPendingObjectUrl(objectUrl);
      setPendingOptions(options);
    }
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
      const options: ProcessingOptions = {
        removeBackground,
        upscale,
        projectName: projectName.trim() || file.name.replace(/\.[^.]+$/, ""),
      };
      await processClientSide(file, options);
      return;
    }

    setError("La extracción actual procesa una imagen cada vez para mantener la selección de regiones precisa.");
  }, [processClientSide, projectName, removeBackground, upscale]);

  const options: ProcessingOptions & {
    setProjectName: (name: string) => void;
    setRemoveBackground: (value: boolean) => void;
    setUpscale: (value: boolean) => void;
  } = {
    removeBackground,
    upscale,
    projectName,
    setProjectName,
    setRemoveBackground,
    setUpscale,
  };

  return {
    state,
    setState,
    preview,
    setPreview,
    icons,
    setIcons,
    error,
    setError,
    usedBackend,
    detectedRegions,
    setDetectedRegions,
    pendingImgEl,
    pendingOptions,
    visualStyle,
    removeBackground,
    setRemoveBackground,
    upscale,
    setUpscale,
    projectName,
    setProjectName,
    options,
    processImages,
    processClientSide,
    confirmRegions,
    updateIconNames,
  };
}
