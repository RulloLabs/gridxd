import { useState, useCallback } from "react";
import { extractStyleFromBackend, generateIconSVG, VisualStyle, isBackendConfigured } from "@/lib/api";
import { logger } from "@/lib/logger";
import { type SvgStyle } from "@/lib/svgStyle";
import { downloadGeneratorPack } from "@/lib/zip-utils";
import { Home, User, Settings, Search, Menu, ArrowLeft, Check, AlertTriangle, Bell, Trash, Plus, Download, Phone, Mail, Calendar, MapPin, Heart, Star, Eye, MessageSquare, Upload, Lock, ShoppingCart, FileText, ExternalLink, Share, Edit, Copy, Save, Filter, LogOut, LogIn, UserPlus, UserMinus, Camera, Image, Video, Music, Mic, Volume2, Cloud, Wind, Sun, Moon, Map, Navigation, Briefcase, GraduationCap, type LucideIcon } from "lucide-react";

export type GeneratedIcon = { id: string; name: string; icon: LucideIcon; svgContent?: string; generated: boolean };
export type GeneratorState = "idle" | "analyzing" | "generating" | "done" | "error";
export type PackSize = 12 | 24 | 36;

const ALLOWED_PACK_SIZES: PackSize[] = [12, 24, 36];
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const CORE_ICONS: GeneratedIcon[] = [
  { id: "home", name: "icon-home.svg", icon: Home, generated: false }, { id: "user", name: "icon-user.svg", icon: User, generated: false }, { id: "settings", name: "icon-settings.svg", icon: Settings, generated: false }, { id: "search", name: "icon-search.svg", icon: Search, generated: false }, { id: "menu", name: "icon-menu.svg", icon: Menu, generated: false }, { id: "back", name: "icon-back.svg", icon: ArrowLeft, generated: false }, { id: "check", name: "icon-check.svg", icon: Check, generated: false }, { id: "warning", name: "icon-warning.svg", icon: AlertTriangle, generated: false }, { id: "notif", name: "icon-bell.svg", icon: Bell, generated: false }, { id: "delete", name: "icon-trash.svg", icon: Trash, generated: false }, { id: "add", name: "icon-plus.svg", icon: Plus, generated: false }, { id: "download", name: "icon-download.svg", icon: Download, generated: false }, { id: "phone", name: "icon-phone.svg", icon: Phone, generated: false }, { id: "mail", name: "icon-mail.svg", icon: Mail, generated: false }, { id: "calendar", name: "icon-calendar.svg", icon: Calendar, generated: false }, { id: "pin", name: "icon-pin.svg", icon: MapPin, generated: false }, { id: "heart", name: "icon-heart.svg", icon: Heart, generated: false }, { id: "star", name: "icon-star.svg", icon: Star, generated: false }, { id: "eye", name: "icon-eye.svg", icon: Eye, generated: false }, { id: "chat", name: "icon-chat.svg", icon: MessageSquare, generated: false }, { id: "upload", name: "icon-upload.svg", icon: Upload, generated: false }, { id: "lock", name: "icon-lock.svg", icon: Lock, generated: false }, { id: "cart", name: "icon-cart.svg", icon: ShoppingCart, generated: false }, { id: "file", name: "icon-file.svg", icon: FileText, generated: false }, { id: "external", name: "icon-external.svg", icon: ExternalLink, generated: false }, { id: "share", name: "icon-share.svg", icon: Share, generated: false }, { id: "edit", name: "icon-edit.svg", icon: Edit, generated: false }, { id: "copy", name: "icon-copy.svg", icon: Copy, generated: false }, { id: "save", name: "icon-save.svg", icon: Save, generated: false }, { id: "filter", name: "icon-filter.svg", icon: Filter, generated: false }, { id: "logout", name: "icon-logout.svg", icon: LogOut, generated: false }, { id: "login", name: "icon-login.svg", icon: LogIn, generated: false }, { id: "userplus", name: "icon-user-plus.svg", icon: UserPlus, generated: false }, { id: "userminus", name: "icon-user-minus.svg", icon: UserMinus, generated: false }, { id: "camera", name: "icon-camera.svg", icon: Camera, generated: false }, { id: "image", name: "icon-image.svg", icon: Image, generated: false }, { id: "video", name: "icon-video.svg", icon: Video, generated: false }, { id: "music", name: "icon-music.svg", icon: Music, generated: false }, { id: "mic", name: "icon-mic.svg", icon: Mic, generated: false }, { id: "volume", name: "icon-volume.svg", icon: Volume2, generated: false }, { id: "cloud", name: "icon-cloud.svg", icon: Cloud, generated: false }, { id: "wind", name: "icon-wind.svg", icon: Wind, generated: false }, { id: "sun", name: "icon-sun.svg", icon: Sun, generated: false }, { id: "moon", name: "icon-moon.svg", icon: Moon, generated: false }, { id: "map", name: "icon-map.svg", icon: Map, generated: false }, { id: "navigation", name: "icon-navigation.svg", icon: Navigation, generated: false }, { id: "briefcase", name: "icon-briefcase.svg", icon: Briefcase, generated: false }, { id: "graduation", name: "icon-graduation.svg", icon: GraduationCap, generated: false },
];

export function useIconGenerator() {
  const [state, setState] = useState<GeneratorState>("idle");
  const [visualStyle, setVisualStyle] = useState<VisualStyle | null>(null);
  const [generatedIcons, setGeneratedIcons] = useState<GeneratedIcon[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [activeStyle, setActiveStyle] = useState<SvgStyle>("outline");
  const [packSize, setPackSizeState] = useState<PackSize>(24);

  const setPackSize = useCallback((size: number) => {
    if (ALLOWED_PACK_SIZES.includes(size as PackSize)) setPackSizeState(size as PackSize);
  }, []);

  const generateSystem = useCallback(async (referenceFile: File, variant = "outline", requestedSize: number = packSize) => {
    const size = ALLOWED_PACK_SIZES.includes(requestedSize as PackSize) ? requestedSize as PackSize : 24;
    try {
      setError(null);
      setGeneratedIcons([]);
      setState("analyzing");
      setPackSizeState(size);
      if (!isBackendConfigured()) throw new Error("Generación IA no disponible: falta VITE_GRIDXD_API_URL.");

      const style = await extractStyleFromBackend(referenceFile);
      setVisualStyle(style);
      await delay(600);
      setState("generating");

      const selectedIcons = CORE_ICONS.slice(0, size).map((icon, index) => ({ ...icon, id: `${icon.id}-${index + 1}`, generated: false, svgContent: undefined }));
      const generated: GeneratedIcon[] = [];
      const BATCH_SIZE = 4;

      for (let start = 0; start < selectedIcons.length; start += BATCH_SIZE) {
        const batch = selectedIcons.slice(start, start + BATCH_SIZE);
        const results = await Promise.all(batch.map(async (baseIcon) => ({ baseIcon, svgContent: await generateIconSVG(baseIcon.id.replace(/-\d+$/, ""), style, variant) })));
        for (const { baseIcon, svgContent } of results) {
          if (!svgContent || !svgContent.includes("<svg")) throw new Error(`La IA no pudo generar ${baseIcon.name}. No se permite fallback visual.`);
          generated.push({ ...baseIcon, svgContent, generated: true });
        }
        setGeneratedIcons([...generated]);
      }

      if (generated.length !== size || generated.some((icon) => !icon.generated || !icon.svgContent)) {
        throw new Error(`Pack incompleto: ${generated.length}/${size} iconos.`);
      }
      setState("done");
    } catch (err) {
      logger.error("Generation error:", err);
      setGeneratedIcons([]);
      setState("error");
      setError(err instanceof Error ? err.message : "Error al generar el sistema.");
    }
  }, [packSize]);

  const reset = useCallback(() => {
    setState("idle");
    setVisualStyle(null);
    setGeneratedIcons([]);
    setError(null);
  }, []);

  const downloadPack = useCallback(async (projectName = "gridxd-system") => {
    if (generatedIcons.length !== packSize || generatedIcons.some((icon) => !icon.generated || !icon.svgContent) || !visualStyle) {
      setError(`No se puede exportar: el pack debe estar completo (${packSize} iconos generados).`);
      return;
    }
    try {
      await downloadGeneratorPack(generatedIcons, visualStyle, {
        projectName: projectName.trim() || "GridXD_System",
        exportStyles: [activeStyle],
        compress: true,
      });
    } catch (err) {
      logger.error("Download error: %o", err);
      setError("No se pudo generar el ZIP.");
    }
  }, [activeStyle, generatedIcons, packSize, visualStyle]);

  return { state, visualStyle, generatedIcons, error, activeStyle, setActiveStyle, packSize, setPackSize, generateSystem, reset, downloadPack };
}
