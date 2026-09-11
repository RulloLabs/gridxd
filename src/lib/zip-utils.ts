import { ExtractedIcon } from "@/hooks/useImageProcessor";
import { GeneratedIcon } from "@/hooks/useIconGenerator";
import { applyStyleToSvg, SvgStyle } from "@/lib/svgStyle";
import { VisualStyle } from "@/lib/api";
import JSZip from "jszip";
import { toast } from "sonner";
import { logger } from "@/lib/logger";

export interface ZipExportOptions {
  projectName: string;
  exportStyles: SvgStyle[];
  visualStyle?: VisualStyle | null;
  compress?: boolean;
}

function safeName(value: string) {
  return (value || "GridXD_Export").trim().replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 64) || "GridXD_Export";
}

function dataUrlToBytes(dataUrl: string): Uint8Array | null {
  if (!dataUrl?.startsWith("data:")) return null;
  const comma = dataUrl.indexOf(",");
  if (comma < 0) return null;
  const meta = dataUrl.slice(0, comma);
  const payload = dataUrl.slice(comma + 1);
  try {
    if (meta.includes(";base64")) {
      const binary = atob(payload);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      return bytes;
    }
    return new TextEncoder().encode(decodeURIComponent(payload));
  } catch { return null; }
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename; a.rel = "noopener";
  document.body.appendChild(a); a.click(); a.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function downloadAssetsZip(icons: ExtractedIcon[], options: ZipExportOptions) {
  try {
    if (!icons.length) throw new Error("No hay iconos para exportar.");
    const zip = new JSZip(); const projectName = safeName(options.projectName);
    const styles = options.exportStyles.length ? options.exportStyles : ["outline" as SvgStyle];
    const primaryColor = options.visualStyle?.color_primary || "#7c3aed";
    const pngFolder = zip.folder("png"); const svgFolder = zip.folder("svg");
    if (!pngFolder || !svgFolder) throw new Error("No se pudieron crear las carpetas de exportación.");
    const files: string[] = [];
    for (const icon of icons) {
      const base = safeName(icon.name.replace(/\.(png|svg)$/i, ""));
      if (icon.dataUrl) { const bytes = dataUrlToBytes(icon.dataUrl); if (bytes) { pngFolder.file(`${base}.png`, bytes); files.push(`png/${base}.png`); } }
      if (icon.svgContent) for (const style of styles) {
        const svg = applyStyleToSvg(icon.svgContent, style, primaryColor);
        const filename = `${base}.${style}.svg`; svgFolder.file(filename, svg); files.push(`svg/${filename}`);
      }
    }
    if (!files.length) throw new Error("No se pudieron generar archivos exportables.");
    zip.file("manifest.json", JSON.stringify({ product: "GridXD", projectName, generatedAt: new Date().toISOString(), iconCount: icons.length, files, visualStyle: options.visualStyle || null, exportStyles: styles }, null, 2));
    zip.file("README.md", `# ${projectName}\n\nExportación generada por GridXD.\n\n- Iconos: ${icons.length}\n- Formatos: PNG + SVG\n- Estilos: ${styles.join(", ")}\n`);
    const content = await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: options.compress ? 9 : 6 } });
    triggerDownload(content, `${projectName}-assets.zip`);
    toast.success(`ZIP listo: ${files.length} archivos`);
  } catch (error) { logger.error("Error generating ZIP: %o", error); toast.error(error instanceof Error ? error.message : "No se pudo generar el ZIP"); }
}

export async function downloadSingleIcon(data: { svgContent?: string; dataUrl?: string; name: string }, style: SvgStyle, primaryColor = "#7c3aed") {
  const base = safeName(data.name.replace(/\.(png|svg)$/i, ""));
  if (data.svgContent) { const svg = applyStyleToSvg(data.svgContent, style, primaryColor); triggerDownload(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }), `${base}.${style}.svg`); return; }
  if (data.dataUrl) { const bytes = dataUrlToBytes(data.dataUrl); if (bytes) triggerDownload(new Blob([bytes], { type: "image/png" }), `${base}.png`); }
}

export async function downloadGeneratorPack(icons: GeneratedIcon[], visualStyle: VisualStyle, options: ZipExportOptions) {
  try {
    const size = icons.length;
    if (![12, 24, 36].includes(size) || icons.some((icon) => !icon.generated || !icon.svgContent)) throw new Error(`Pack inválido: se requiere un pack completo de 12, 24 o 36 SVG generados.`);
    const zip = new JSZip(); const projectName = safeName(options.projectName); const styles = options.exportStyles.length ? options.exportStyles : ["outline" as SvgStyle];
    const folder = zip.folder("icons"); if (!folder) throw new Error("No se pudo crear la carpeta de iconos.");
    for (const style of styles) {
      const styleFolder = folder.folder(style); if (!styleFolder) continue;
      for (const icon of icons) styleFolder.file(icon.name.endsWith(".svg") ? icon.name : `${icon.name}.svg`, applyStyleToSvg(icon.svgContent!, style, visualStyle.color_primary));
    }
    zip.file("style-dna.json", JSON.stringify({ product: "GridXD", projectName, packSize: size, generated: true, dna: visualStyle, styles, icons: icons.map((i) => i.name) }, null, 2));
    zip.file("README.md", `# ${projectName}\n\nGridXD AI icon system.\n\n- Pack: ${size} icons\n- Generated SVG: ${icons.every((i) => i.generated && i.svgContent) ? "yes" : "no"}\n- Styles: ${styles.join(", ")}\n`);
    const content = await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: options.compress ? 9 : 6 } });
    triggerDownload(content, `${projectName}-system-${size}.zip`); toast.success(`ZIP del pack ${size} listo`);
  } catch (error) { logger.error("Error generating generator pack: %o", error); toast.error(error instanceof Error ? error.message : "No se pudo generar el pack"); }
}
