import { useState, useRef } from "react";
import { Upload, X, Loader2, Download, Sparkles, Maximize2, Pencil } from "lucide-react";
import { SvgStyle } from "@/lib/svgStyle";
import { useAuth } from "@/contexts/AuthContext";
import IconEditor from "@/components/IconEditor";
import { StyleCard } from "@/components/StyleCard";
import { IconPreviewModal } from "@/components/IconPreviewModal";
import { useImageProcessor, ExtractedIcon } from "@/hooks/useImageProcessor";
import { downloadSingleIcon } from "@/lib/zip-utils";

interface ExtractModeProps {
  processor: ReturnType<typeof useImageProcessor>;
  exportStyle: SvgStyle;
  setExportStyle: (s: SvgStyle) => void;
  onUpgrade: (s: SvgStyle) => void;
  onDownload: () => void;
}

export const ExtractMode = ({ processor, exportStyle, setExportStyle, onUpgrade, onDownload }: ExtractModeProps) => {
  const { plan } = useAuth();
  const {
    state, preview, icons, error: processorError, visualStyle, processImages, reset,
    detectedRegions, confirmRegions, pendingImgEl, options, renameIcon,
  } = processor;
  const inputRef = useRef<HTMLInputElement>(null);
  const [canvasMode, setCanvasMode] = useState<'grid' | 'white' | 'black' | 'transparent'>('grid');
  const [dragOver, setDragOver] = useState(false);
  const [previewIcon, setPreviewIcon] = useState<ExtractedIcon | null>(null);
  const [editingNameId, setEditingNameId] = useState<number | null>(null);
  const [editNameValue, setEditNameValue] = useState("");
  const primaryColor = visualStyle?.color_primary || "#7c3aed";

  const projectValue = options?.projectName ?? "";
  const removeBg = options?.removeBackground ?? true;
  const upscaleValue = options?.upscale ?? true;
  const setProjectNameSafe = options?.setProjectName ?? (() => undefined);
  const setRemoveBackgroundSafe = options?.setRemoveBackground ?? (() => undefined);
  const setUpscaleSafe = options?.setUpscale ?? (() => undefined);

  if (state === "editing" && pendingImgEl) {
    return <IconEditor imgEl={pendingImgEl} initialRegions={detectedRegions} onConfirm={confirmRegions} onCancel={reset} />;
  }

  if (state !== "idle" && state !== "done") {
    return (
      <div className="text-center py-16">
        {preview && <div className="mb-8 inline-block rounded-2xl overflow-hidden border border-border max-w-md bg-black/30"><img src={preview} alt="Imagen de referencia" className="max-h-[420px] w-auto object-contain" /></div>}
        <div className="flex items-center justify-center gap-3 text-primary"><Loader2 className="w-6 h-6 animate-spin" /><span className="text-lg font-semibold">Procesando imagen…</span></div>
        <p className="mt-2 text-xs text-muted-foreground">Puedes ajustar las regiones antes de exportar.</p>
      </div>
    );
  }

  if (state === "done") {
    return (
      <div>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2"><p className="text-foreground font-semibold text-sm sm:text-base">{icons.length} iconos listos</p><span className="text-[10px] text-primary font-bold bg-primary/10 px-2 py-0.5 rounded-full">PNG + SVG</span></div>
            <p className="text-xs text-muted-foreground mt-1">Los nombres se asignan automáticamente y puedes cambiarlos después.</p>
          </div>
          <div className="flex gap-2 w-full lg:w-auto">
            <button onClick={reset} className="flex-1 lg:flex-none premium-button premium-button-outline !py-2.5 !px-4 text-sm flex items-center justify-center gap-2"><X className="w-4 h-4" /> Nueva imagen</button>
            <button onClick={onDownload} disabled={!icons.length} className="flex-1 lg:flex-none premium-button premium-button-primary !py-2.5 !px-6 text-sm flex items-center justify-center gap-2 animate-shine disabled:opacity-40"><Download className="w-4 h-4" /> Descargar ZIP</button>
          </div>
        </div>

        <div className="grid lg:grid-cols-[minmax(0,1fr)_300px] gap-6 items-start">
          <div className="min-w-0">
            <div className="relative rounded-2xl border border-white/10 overflow-hidden shadow-2xl glass-card">
              <div className="border-b border-white/5 bg-white/5 dark:bg-black/20 backdrop-blur-md px-4 sm:px-6 py-3 flex items-center justify-between sticky top-0 z-10">
                <div className="flex items-center gap-3"><div className="flex gap-1.5"><div className="w-3 h-3 rounded-full bg-red-500/50" /><div className="w-3 h-3 rounded-full bg-amber-500/50" /><div className="w-3 h-3 rounded-full bg-green-500/50" /></div><span className="text-[10px] font-black tracking-[0.2em] text-muted-foreground uppercase opacity-70">Previsualización</span></div>
                <div className="flex items-center gap-1">{(['grid', 'white', 'black', 'transparent'] as const).map(mode => <button key={mode} onClick={() => setCanvasMode(mode)} title={`Fondo: ${mode}`} aria-label={`Fondo ${mode}`} className={`w-7 h-7 rounded-md text-sm font-bold transition-all ${canvasMode === mode ? 'bg-primary text-primary-foreground shadow-sm' : 'bg-muted/60 text-muted-foreground hover:bg-muted'}`}>{mode === 'grid' ? '⊞' : mode === 'white' ? '○' : mode === 'black' ? '●' : '◧'}</button>)}</div>
              </div>
              <div className={`p-4 sm:p-6 lg:p-8 canvas-bg-${canvasMode} max-h-[680px] overflow-y-auto no-scrollbar`}>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4 sm:gap-5">
                  {icons.map((icon: ExtractedIcon) => (
                    <div key={icon.id} className="group rounded-2xl border border-white/10 bg-black/10 p-2.5 sm:p-3 hover:border-primary/30 transition-all">
                      <div className="relative aspect-square rounded-xl overflow-hidden bg-white/5 flex items-center justify-center">
                        <button onClick={() => setPreviewIcon(icon)} className="absolute inset-0 z-10" aria-label={`Previsualizar ${icon.name}`} />
                        <div className="w-full h-full p-3 sm:p-4 flex items-center justify-center pointer-events-none" dangerouslySetInnerHTML={{ __html: icon.svgContent || `<img src="${icon.dataUrl}" alt="" class="w-full h-full object-contain" />` }} aria-hidden="true" />
                        <button onClick={() => downloadSingleIcon(icon, exportStyle, primaryColor)} className="absolute bottom-2 right-2 z-20 w-8 h-8 rounded-lg bg-primary text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all shadow-lg" title="Descargar SVG" aria-label={`Descargar ${icon.name} en SVG`}><Download className="w-3.5 h-3.5" /></button>
                      </div>
                      <div className="pt-2">
                        {editingNameId === icon.id ? (
                          <input autoFocus value={editNameValue} onChange={(e) => setEditNameValue(e.target.value)} onBlur={() => { if (editNameValue.trim()) renameIcon(icon.id, editNameValue.trim()); setEditingNameId(null); }} onKeyDown={(e) => { if (e.key === 'Enter') { if (editNameValue.trim()) renameIcon(icon.id, editNameValue.trim()); setEditingNameId(null); } if (e.key === 'Escape') setEditingNameId(null); }} className="w-full text-[10px] font-bold text-center bg-foreground/10 border border-primary/40 rounded-lg px-2 py-1.5 outline-none" aria-label="Nombre del icono" />
                        ) : (
                          <button onClick={() => { setEditingNameId(icon.id); setEditNameValue(icon.name.replace(/\.(png|svg)$/i, '')); }} className="w-full flex items-center justify-center gap-1 text-[10px] font-bold text-muted-foreground truncate hover:text-foreground transition-colors"><span className="truncate">{icon.name.replace(/\.(png|svg)$/i, '')}</span><Pencil className="w-3 h-3 flex-none opacity-50" /></button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <aside className="space-y-4">
            {visualStyle && <StyleCard style={visualStyle} />}
            <div className="glass-card rounded-2xl border border-primary/20 p-4 sm:p-5">
              <p className="text-[10px] uppercase tracking-[0.25em] font-black text-muted-foreground">Exportación</p>
              <div className="mt-3 flex items-center justify-between text-sm"><span>Formato</span><strong>PNG + SVG</strong></div>
              <div className="mt-2 flex items-center justify-between text-sm"><span>Resolución</span><strong>{upscaleValue ? '2K' : 'HD'}</strong></div>
              <button onClick={onDownload} disabled={!icons.length} className="mt-4 w-full premium-button premium-button-primary py-3 flex items-center justify-center gap-2 disabled:opacity-40"><Download className="w-4 h-4" /> Exportar ZIP</button>
            </div>
          </aside>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="mb-4 flex items-center justify-end gap-2 px-2"><div className="flex items-center gap-1.5 mr-auto"><span className="bg-primary/10 text-primary text-[10px] px-2 py-0.5 rounded-full font-bold">2K UHD</span><span className="bg-green-500/10 text-green-500 text-[10px] px-2 py-0.5 rounded-full font-bold">SVG VECTOR</span></div><div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" /><span className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground hidden sm:inline">Motor local disponible</span></div>
      <div className="mb-16 grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 relative">
        <div className="absolute -inset-4 bg-gradient-to-br from-primary/5 via-transparent to-secondary/5 blur-3xl opacity-50 -z-10" />
        <div className="lg:col-span-4 flex flex-col gap-6 glass-card p-6 sm:p-8 rounded-[2rem] border-white/20 shadow-2xl">
          <div className="space-y-3"><div className="flex items-center gap-2"><div className="w-1.5 h-6 bg-primary rounded-full" /><label htmlFor="project-name-input" className="text-[10px] uppercase tracking-[0.3em] font-black text-muted-foreground">Proyecto</label></div><input id="project-name-input" type="text" placeholder="Ej: Dashboard_Icons" value={projectValue} onChange={(e) => setProjectNameSafe(e.target.value)} className="w-full bg-white/5 border border-white/10 p-4 rounded-2xl focus:ring-2 focus:ring-primary outline-none font-black text-foreground" /><p className="text-[10px] text-muted-foreground">Opcional: se genera un nombre seguro automáticamente.</p></div>
          <div className="space-y-4"><div className="flex items-center gap-2"><div className="w-1.5 h-6 bg-primary rounded-full opacity-50" /><p className="text-[10px] uppercase tracking-[0.3em] font-black text-muted-foreground">Procesado</p></div><div className="grid grid-cols-2 gap-3"><button onClick={() => setRemoveBackgroundSafe(!removeBg)} className={`flex flex-col items-center justify-center gap-2 p-4 rounded-2xl border transition-all ${removeBg ? 'bg-primary/20 border-primary text-primary' : 'bg-white/5 border-white/10 text-muted-foreground'}`}><Sparkles className="w-5 h-5" /><span className="text-[9px] font-black uppercase tracking-widest">Sin fondo</span></button><button onClick={() => setUpscaleSafe(!upscaleValue)} className={`flex flex-col items-center justify-center gap-2 p-4 rounded-2xl border transition-all ${upscaleValue ? 'bg-primary/20 border-primary text-primary' : 'bg-white/5 border-white/10 text-muted-foreground'}`}><Maximize2 className="w-5 h-5" /><span className="text-[9px] font-black uppercase tracking-widest">Ultra 2K</span></button></div></div>
        </div>
        <div className="lg:col-span-8 flex items-center justify-center glass-card p-8 rounded-[2rem] border-white/20 shadow-2xl min-h-[280px]"><div className="text-center max-w-md"><div className="mx-auto w-16 h-16 rounded-2xl border border-primary/20 bg-primary/10 flex items-center justify-center mb-4"><Upload className="w-7 h-7 text-primary" /></div><h3 className="text-xl font-black">Sube una imagen</h3><p className="text-sm text-muted-foreground mt-2">JPG o PNG · hasta 10 MB · una o varias imágenes</p><button onClick={() => inputRef.current?.click()} className="mt-5 premium-button premium-button-primary px-6 py-3">Seleccionar imagen</button></div></div>
      </div>
      {processorError && <div className="mb-6 p-4 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-sm font-semibold text-center">{processorError}</div>}
      <label onDragOver={(e) => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)} onDrop={(e) => { e.preventDefault(); setDragOver(false); const files = Array.from(e.dataTransfer.files); if (files.length) processImages(files); }} tabIndex={0} className={`relative block w-full cursor-pointer rounded-[1.5rem] border-2 border-dashed p-8 text-center transition-all ${dragOver ? 'border-primary bg-primary/10' : 'border-white/10 bg-white/5 hover:border-primary/20'}`}>
        <input ref={inputRef} type="file" accept="image/jpeg,image/png" multiple className="sr-only" title="Seleccionar archivos" aria-label="Subir imágenes" onChange={(e) => { const files = e.target.files ? Array.from(e.target.files) : []; if (files.length) processImages(files); e.target.value = ''; }} />
        <div className="flex items-center justify-center gap-3"><Upload className="w-5 h-5 text-muted-foreground" /><p className="font-bold text-sm sm:text-base">Haz clic o arrastra aquí</p></div>
      </label>
    </>
  );
};