import { useState } from "react";
import { Upload } from "lucide-react";
import { useImageProcessor } from "@/hooks/useImageProcessor";
import { SvgStyle } from "@/lib/svgStyle";
import { ExtractMode } from "./Upload/ExtractMode";
import { downloadAssetsZip } from "@/lib/zip-utils";

const UploadSection = () => {
  const processor = useImageProcessor();
  const [exportStyle, setExportStyle] = useState<SvgStyle>("outline");

  const handleDownloadZip = async () => {
    const { icons, options, visualStyle } = processor;

    if (icons.length === 0) return;

    const name = options.projectName.trim() || "GridXD_Export";

    // Always export the assets currently present in the browser.
    // This keeps the free/local extraction path independent from backend storage.
    await downloadAssetsZip(icons, {
      projectName: name,
      exportStyles: [exportStyle],
      visualStyle,
      compress: true,
    });
  };

  return (
    <section id="upload" className="py-24 px-4">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">
          Crea tu Design System
        </h2>
        <p className="text-muted-foreground text-center mb-8 max-w-lg mx-auto">
          Extrae iconos listos para producción desde mockups o genera un pack completo desde cero basándote en tu logo.
        </p>

        <div className="flex justify-center mb-10 sm:mb-16">
          <div className="bg-foreground/5 p-2 rounded-[2rem] inline-flex items-center gap-3 px-6 py-4 border border-border shadow-2xl backdrop-blur-xl">
            <Upload className="w-5 h-5 text-primary" />
            <div className="text-left">
              <p className="text-[10px] font-black uppercase tracking-widest leading-none mb-1">Extraer Iconos</p>
              <p className="text-sm font-bold">Sube tu Mockup</p>
            </div>
          </div>
        </div>

        <ExtractMode
          processor={processor}
          exportStyle={exportStyle}
          setExportStyle={setExportStyle}
          onUpgrade={() => {}}
          onDownload={handleDownloadZip}
        />
      </div>
    </section>
  );
};

export default UploadSection;
