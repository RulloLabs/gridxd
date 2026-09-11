import { useState } from "react";
import { WandSparkles, Upload, Download, ScanSearch } from "lucide-react";
import { useImageProcessor } from "@/hooks/useImageProcessor";
import { useIconGenerator } from "@/hooks/useIconGenerator";
import { SvgStyle } from "@/lib/svgStyle";
import { ExtractMode } from "./Upload/ExtractMode";
import { GenerateMode } from "./Upload/GenerateMode";
import { downloadAssetsZip } from "@/lib/zip-utils";

const UploadSection = () => {
  const processor = useImageProcessor();
  const generator = useIconGenerator();
  const [mode, setMode] = useState<"extract" | "generate">("extract");
  const [exportStyle, setExportStyle] = useState<SvgStyle>("outline");
  const [projectName, setProjectName] = useState("");

  const handleDownloadZip = async () => {
    const { icons, options, visualStyle } = processor;
    if (icons.length === 0) return;

    const name = options.projectName.trim() || projectName.trim() || "GridXD_Export";
    await downloadAssetsZip(icons, {
      projectName: name,
      exportStyles: [exportStyle],
      visualStyle,
      compress: true,
    });
  };

  return (
    <section id="upload" className="py-24 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-10 sm:mb-14">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-[10px] font-black uppercase tracking-[0.25em] mb-5">
            <WandSparkles className="w-3.5 h-3.5" /> GridXD Studio
          </div>
          <h2 className="text-3xl md:text-5xl font-black text-foreground tracking-tight mb-4">
            Extract. Style. Generate. Export.
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-sm md:text-base">
            Extrae iconos reales desde imágenes o genera un sistema coherente a partir de una referencia visual.
          </p>
        </div>

        <div className="flex justify-center mb-8">
          <div className="inline-flex items-center gap-1 p-1 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-2xl">
            <button
              type="button"
              onClick={() => setMode("extract")}
              className={`inline-flex items-center gap-2 px-5 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${mode === "extract" ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" : "text-muted-foreground hover:text-foreground hover:bg-white/5"}`}
            >
              <ScanSearch className="w-4 h-4" /> Extract
            </button>
            <button
              type="button"
              onClick={() => setMode("generate")}
              className={`inline-flex items-center gap-2 px-5 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${mode === "generate" ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" : "text-muted-foreground hover:text-foreground hover:bg-white/5"}`}
            >
              <WandSparkles className="w-4 h-4" /> Generate
            </button>
          </div>
        </div>

        {mode === "extract" ? (
          <ExtractMode
            processor={processor}
            exportStyle={exportStyle}
            setExportStyle={setExportStyle}
            onUpgrade={() => {}}
            onDownload={handleDownloadZip}
          />
        ) : (
          <GenerateMode
            onUpgrade={() => {}}
            projectName={projectName}
            setProjectName={setProjectName}
          />
        )}

        {mode === "extract" && (
          <div className="mt-6 flex items-center justify-center gap-2 text-[10px] text-muted-foreground font-semibold uppercase tracking-[0.2em]">
            <Upload className="w-3.5 h-3.5" />
            <span>JPG · PNG · Multi-element detection · PNG + SVG · ZIP</span>
            <Download className="w-3.5 h-3.5" />
          </div>
        )}
      </div>
    </section>
  );
};

export default UploadSection;
