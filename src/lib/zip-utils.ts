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
  return (value || "GridXD_Export")
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64) || "GridXD_Export";
}

function normaliseSvg(svg: string, color = "currentColor") {
  if (!svg) return "";
  const styled = applyStyleToSvg(svg, "outline", color);
  if (!styled.includes("<svg")) return svg;
  return styled;
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
  } catch {
    return null;
  }
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function downloadAssetsZip(icons: ExtractedIcon[], options: ZipExportOptions) {
  try {
    if (!icons.length) {
      toast.error("No hay iconos para exportar.");
      return;
    }

    toast.info("Preparando ZIP...");
    const zip = new JSZip();
    const projectName = safeName(options.projectName);
    const styles = options.exportStyles.length ? options.exportStyles : ["outline"] as SvgStyle[];
    const primaryColor = options.visualStyle?.color_primary || "#7c3aed";
    const exported: string[] = [];

    const pngFolder = zip.folder("png");
    const svgFolder = zip.folder("svg");
    if (!pngFolder || !svgFolder) throw new Error("No se pudieron crear las carpetas de exportación");

    for (const icon of icons) {
      const base = safeName(icon.name.replace(/\.(png|svg)$/i, ""));
      if (icon.dataUrl) {
        const bytes = dataUrlToBytes(icon.dataUrl);
        if (bytes) {
          const pngName = `${base}.png`;
          pngFolder.file(pngName, bytes);
          exported.push(`png/${pngName}`);
        }
      }
      if (icon.svgContent) {
        for (const style of styles) {
          const svgName = `${base}.${style}.svg`;
          const svg = style === "outline" ? normaliseSvg(icon.svgContent, primaryColor) : icon.svgContent;
          if (svg) {
            svgFolder.file(svgName, svg);
            exported.push(`svg/${svgName}`);
          }
        }
      }
    }

    if (!exported.length) throw new Error("No se pudieron generar archivos exportables");

    const manifest = {
      product: "GridXD",
      projectName,
      generatedAt: new Date().toISOString(),
      iconCount: icons.length,
      files: exported,
      visualStyle: options.visualStyle || null,
      exportStyles: styles,
    };

    zip.file("manifest.json", JSON.stringify(manifest, null, 2));
    zip.file("README.md", `# ${projectName}\n\nExportación generada por GridXD.\n\n- Iconos: ${icons.length}\n- Formatos: PNG + SVG\n- Estilos SVG: ${styles.join(", ")}\n`);

    const content = await zip.generateAsync({
      type: "blob",
      compression: "DEFLATE",
      compressionOptions: { level: options.compress ? 9 : 6 },
    });

    triggerDownload(content, `${projectName}-assets.zip`);
    toast.success(`ZIP listo: ${exported.length} archivos`);
  } catch (error) {
    logger.error("Error generating ZIP: %o", error);
    toast.error(error instanceof Error ? error.message : "No se pudo generar el ZIP");
  }
}

export async function downloadSingleIcon(
  data: { svgContent?: string; dataUrl?: string; name: string },
  style: SvgStyle,
  primaryColor = "#7c3aed",
) {
  const baseName = safeName(data.name.replace(/\.(png|svg)$/i, ""));
  if (data.svgContent) {
    const svg = applyStyleToSvg(data.svgContent, style, primaryColor);
    triggerDownload(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }), `${baseName}.${style}.svg`);
    return;
  }
  if (data.dataUrl) {
    const bytes = dataUrlToBytes(data.dataUrl);
    if (bytes) triggerDownload(new Blob([bytes], { type: "image/png" }), `${baseName}.png`);
  }
}

export async function downloadGeneratorPack(
  icons: GeneratedIcon[],
  visualStyle: VisualStyle,
  options: ZipExportOptions,
) {
  try {
    if (!icons.length) {
      toast.error("No hay iconos para exportar.");
      return;
    }
    const zip = new JSZip();
    const projectName = safeName(options.projectName);
    const styles = options.exportStyles.length ? options.exportStyles : ["outline"] as SvgStyle[];
    const folder = zip.folder("icons");
    if (!folder) throw new Error("No se pudo crear la carpeta de iconos");

    for (const style of styles) {
      const styleFolder = folder.folder(style);
      if (!styleFolder) continue;
      for (const icon of icons) {
        if (!icon.svgContent) continue;
        styleFolder.file(icon.name.endsWith(".svg") ? icon.name : `${icon.name}.svg`, applyStyleToSvg(icon.svgContent, style, visualStyle.color_primary));
      }
    }

    zip.file("style-dna.json", JSON.stringify({ projectName, dna: visualStyle, styles, icons: icons.map((i) => i.name) }, null, 2));
    const content = await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: options.compress ? 9 : 6 } });
    triggerDownload(content, `${projectName}-system-pack.zip`);
    toast.success("Descarga del sistema completada");
  } catch (error) {
    logger.error("Error generating generator pack: %o", error);
    toast.error("No se pudo generar el pack");
  }
}
