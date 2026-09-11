import { useState, useRef } from "react";
import { Upload, X, Loader2, Sparkles, AlertTriangle, Download } from "lucide-react";
import { useIconGenerator, GeneratedIcon } from "@/hooks/useIconGenerator";
import { StyleCard } from "@/components/StyleCard";
import { IconPreviewModal } from "@/components/IconPreviewModal";
import { SvgStyle, STYLE_META } from "@/lib/svgStyle";
import { applyStyleToSvg } from "@/lib/svgStyle";
import { downloadSingleIcon } from "@/lib/zip-utils";

interface GenerateModeProps {
  onUpgrade: (style: SvgStyle) => void;
  projectName: string;
  setProjectName?: (name: string) => void;
}

const PACKS = [12, 24, 36] as const;

export const GenerateMode = ({ projectName, setProjectName }: GenerateModeProps) => {
  const generator = useIconGenerator();
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewIcon, setPreviewIcon] = useState<GeneratedIcon | null>(null);

  const handleFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      return;
    }
    const autoName = file.name.split('.').slice(0, -1).join('.').replace(/[^a-zA-Z0-9_-]/g, '_') || "GridXD_System";
    if (!projectName.trim() && setProjectName) setProjectName(autoName);
    void generator.generateSystem(file, generator.activeStyle, generator.packSize);
  };

  const primaryColor = generator.visualStyle?.color_primary || "#7c3aed";
  const isComplete = generator.generatedIcons.length === generator.packSize && generator.generatedIcons.every((icon) => icon.generated && !!icon.svgContent);

  return (
    <div className="relative glass-card rounded-[2rem] sm:rounded-[3rem] p-6 sm:p-8 md:p-16 text-center overflow-hidden">
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-secondary/10 rounded-full blur-[100px] pointer-events-none" />

      {generator.state === "idle" && (
        <div className="relative z-10">
          <div className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-2xl sm:rounded-3xl bg-primary/10 border border-primary/20 mb-6 sm:mb-8">
            <Sparkles className="w-8 h-8 sm:w-10 sm:h-10 text-primary" />
          </div>
          <h3 className="text-3xl sm:text-4xl font-black text-foreground mb-4 tracking-tight">AI Icon <span className="text-gradient-cyan">Generator</span></h3>
          <p className="text-muted-foreground max-w-lg mx-auto mb-8 sm:mb-12 text-sm sm:text-lg">Analiza una referencia visual y genera un sistema de iconos coherente con el mismo ADN de diseño.</p>

          <div className="max-w-md mx-auto mb-8 grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-3">
              <p className="text-[10px] text-primary font-black uppercase tracking-[0.2em]">Pack</p>
              <div className="flex gap-2 p-1.5 bg-white/5 rounded-2xl border border-white/10">
                {PACKS.map((size) => (
                  <button key={size} onClick={() => generator.setPackSize(size)} className={`flex-1 py-3 text-xs rounded-xl font-black transition-all ${generator.packSize === size ? "bg-primary text-primary-foreground shadow-xl" : "text-muted-foreground hover:bg-white/10 hover:text-foreground"}`} aria-pressed={generator.packSize === size}>
                    {size}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-3">
              <p className="text-[10px] text-secondary font-black uppercase tracking-[0.2em]">Estilo</p>
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/5 rounded-2xl border border-white/10"><span className="text-lg">{STYLE_META.outline.icon}</span><span className="text-xs font-black uppercase tracking-wider">Outline + DNA</span></div>
            </div>
          </div>

          <div className="max-w-md mx-auto mb-8">
            <input type="text" placeholder="Nombre del proyecto (opcional)" value={projectName} onChange={(e) => setProjectName?.(e.target.value)} className="w-full bg-white/5 border border-white/10 p-3 rounded-xl focus:ring-2 focus:ring-primary outline-none font-bold text-foreground text-center" />
          </div>

          <div className="max-w-lg mx-auto">
            <label onDragOver={(e) => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)} onDrop={(e) => { e.preventDefault(); setDragOver(false); const file = e.dataTransfer.files[0]; if (file) handleFile(file); }} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inputRef.current?.click(); } }} tabIndex={0} className={`premium-dropzone group ${dragOver ? "premium-dropzone-active" : "premium-dropzone-idle border-white/10 bg-white/[0.02]"}`}>
              <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden" aria-label="Subir referencia visual" onChange={(e) => { const file = e.target.files?.[0]; if (file) handleFile(file); }} />
              <div className="relative w-14 h-14 sm:w-16 sm:h-16 mx-auto mb-4 bg-white/5 rounded-2xl flex items-center justify-center border border-white/10"><Upload className="w-6 h-6 sm:w-8 sm:h-8 text-muted-foreground group-hover:text-primary" /></div>
              <p className="text-foreground font-black text-base sm:text-lg mb-1">Carga tu referencia</p>
              <p className="text-muted-foreground text-xs font-medium">PNG, JPG, WEBP o SVG</p>
            </label>
          </div>
        </div>
      )}

      {(generator.state === "analyzing" || generator.state === "generating") && (
        <div className="py-16 sm:py-24 relative z-10">
          <div className="relative w-24 h-24 sm:w-32 sm:h-32 mx-auto mb-8"><div className="absolute inset-0 bg-primary/20 rounded-full animate-ping" /><div className="relative bg-card/80 backdrop-blur-xl border-2 border-primary/50 rounded-[2rem] w-full h-full flex items-center justify-center"><Loader2 className="w-10 h-10 text-primary animate-spin" /></div></div>
          <h3 className="text-2xl sm:text-3xl font-black text-foreground mb-4">{generator.state === "analyzing" ? "Analizando ADN Visual" : "Generando sistema real"}</h3>
          <p className="text-muted-foreground font-bold text-xs sm:text-sm uppercase tracking-wide">{generator.state === "analyzing" ? "Interpretando trazos, color y proporciones" : `Generando ${generator.packSize} iconos mediante IA`}</p>
        </div>
      )}

      {generator.state === "error" && (
        <div className="relative z-10 py-12">
          <AlertTriangle className="w-10 h-10 text-destructive mx-auto mb-4" />
          <h3 className="text-2xl font-black text-foreground mb-3">Generación detenida</h3>
          <p className="max-w-xl mx-auto text-sm text-muted-foreground mb-6">{generator.error}</p>
          <button onClick={generator.reset} className="premium-button premium-button-outline px-5 py-3"><X className="w-4 h-4 inline mr-2" /> Nuevo proyecto</button>
        </div>
      )}

      {generator.state === "done" && generator.visualStyle && (
        <div className="relative z-10 text-left">
          <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 mb-8">
            <div><p className="text-[10px] text-primary font-black uppercase tracking-[0.3em] mb-2">Generate real · {generator.packSize} / {generator.packSize}</p><h3 className="text-3xl sm:text-4xl font-black text-foreground">Sistema <span className="text-gradient-cyan">GridXD</span></h3></div>
            <button onClick={generator.reset} className="px-5 py-2 rounded-xl bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2"><X className="w-4 h-4" /> Nuevo Proyecto</button>
          </div>

          <StyleCard style={generator.visualStyle} className="mb-8" />

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 sm:gap-6">
            {generator.generatedIcons.map((icon) => {
              const previewSvg = icon.svgContent ? applyStyleToSvg(icon.svgContent, generator.activeStyle, primaryColor) : null;
              return (
                <div key={icon.id} className="group relative flex flex-col items-center gap-3">
                  <div className="relative w-full aspect-square glass-panel rounded-2xl flex items-center justify-center overflow-hidden hover:border-primary/40 transition-all">
                    <button onClick={() => setPreviewIcon(icon)} className="absolute inset-0 z-10" aria-label={`Preview ${icon.name}`} />
                    {icon.generated && previewSvg ? <div className="w-12 h-12 sm:w-16 sm:h-16 icon-glow-preview" dangerouslySetInnerHTML={{ __html: previewSvg }} aria-hidden="true" /> : <div className="text-xs text-destructive">Sin SVG IA</div>}
                    <span className="absolute top-2 right-2 px-2 py-0.5 bg-primary text-[6px] font-black text-primary-foreground rounded-full tracking-widest">AI</span>
                    <button onClick={(e) => { e.stopPropagation(); void downloadSingleIcon({ svgContent: icon.svgContent, name: icon.name }, generator.activeStyle, primaryColor); }} className="absolute bottom-2 right-2 z-20 w-7 h-7 rounded-lg bg-primary text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all" aria-label={`Descargar ${icon.name}`}><Download className="w-3.5 h-3.5" /></button>
                  </div>
                  <span className="text-[8px] sm:text-[9px] font-black tracking-[0.15em] text-muted-foreground uppercase truncate max-w-full">{icon.name}</span>
                </div>
              );
            })}
          </div>

          <div className="mt-8 p-6 rounded-3xl glass-panel border-primary/20 flex flex-col lg:flex-row items-center justify-between gap-5">
            <div><p className="text-xs font-black uppercase tracking-widest">Pack validado</p><p className="text-sm text-muted-foreground mt-1">{isComplete ? `Los ${generator.packSize} SVG han sido generados realmente por el backend IA.` : "El pack no está completo."}</p></div>
            <button disabled={!isComplete} onClick={() => void generator.downloadPack(projectName)} className="premium-button premium-button-primary px-6 py-3 flex items-center gap-2 disabled:opacity-40"><Download className="w-4 h-4" /> Download ZIP</button>
          </div>

          <IconPreviewModal icon={previewIcon} onClose={() => setPreviewIcon(null)} activeStyle={generator.activeStyle} primaryColor={primaryColor} visualStyle={generator.visualStyle} />
        </div>
      )}
    </div>
  );
};
