import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { motion, AnimatePresence } from "motion/react";
import { toast, Toaster } from "sonner";
import {
  Upload,
  Youtube,
  Sparkles,
  Copy,
  FileText,
  FileDown,
  History,
  Loader2,
  CheckCircle2,
  ChevronDown,
  X,
  Wand2,
  Mic,
  Film,
  Download,
  WrapText,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  transcribeChunkFn,
  polishFn,
  mergeParagraphsFn,
  youtubeCaptionsFn,
  youtubeMetadataFn,
  launchLocalConverterFn,
  downloadYoutubeAudioFn,
} from "@/lib/transcribe.functions";
import { splitMediaIntoAudioChunks } from "@/lib/audio-split";
import { buildTranscriptDocx, downloadBlob } from "@/lib/docx-export";
import { loadVocabulary, saveVocabulary, saveHistoryItem } from "@/lib/history";
import { SyncEditor } from "@/components/SyncEditor";
import { ThemeToggle } from "@/components/ThemeToggle";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Transcreve áudio e vídeo para texto em PT-BR" },
      {
        name: "description",
        content:
          "Transcrição precisa de áudio e vídeo em português do Brasil, com vocabulário customizado e polimento por IA.",
      },
      { property: "og:title", content: "Transcreve" },
      {
        property: "og:description",
        content:
          "Transcrição de áudio e vídeo em PT-BR com vocabulário customizado da Conscienciologia.",
      },
    ],
  }),
  component: Index,
});

type Phase =
  | { kind: "idle" }
  | { kind: "splitting"; message: string }
  | { kind: "transcribing"; current: number; total: number }
  | { kind: "polishing" }
  | { kind: "fetching-captions" }
  | { kind: "done" }
  | { kind: "error"; message: string };

const MODELS = [
  { value: "gpt-4o-mini-transcribe", label: "Rápido — gpt-4o-mini-transcribe" },
  { value: "gpt-4o-transcribe", label: "Preciso — gpt-4o-transcribe" },
] as const;

const POLISH_MODELS = [
  { value: "gpt-5.4-mini", label: "gpt-5.4-mini (Padrão)" },
  { value: "gpt-5.4-nano", label: "gpt-5.4-nano" },
] as const;


const REASONING_EFFORT_OPTIONS = [
  { value: "default", label: "default" },
  { value: "low", label: "low" },
  { value: "medium", label: "medium" },
  { value: "high", label: "high" },
] as const;

function getMediaDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") return resolve(0);
    const url = URL.createObjectURL(file);
    const media = file.type.startsWith("video/")
      ? document.createElement("video")
      : document.createElement("audio");
    media.src = url;
    media.preload = "metadata";
    media.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(media.duration);
    };
    media.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(0);
    };
  });
}

function parseYoutubeIdClient(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtu.be")) return u.pathname.slice(1) || null;
    if (u.hostname.includes("youtube.com")) {
      const v = u.searchParams.get("v");
      if (v) return v;
      const parts = u.pathname.split("/").filter(Boolean);
      const idx = parts.findIndex((p) => p === "embed" || p === "shorts" || p === "live");
      if (idx >= 0 && parts[idx + 1]) return parts[idx + 1];
    }
    return null;
  } catch {
    return null;
  }
}

function Index() {
  const [tab, setTab] = useState<"file" | "youtube">("file");
  const [file, setFile] = useState<File | null>(null);
  const [ytUrl, setYtUrl] = useState("");
  const [vocab, setVocab] = useState("");
  const [model, setModel] = useState<(typeof MODELS)[number]["value"]>("gpt-4o-mini-transcribe");
  const [polishModel, setPolishModel] =
    useState<(typeof POLISH_MODELS)[number]["value"]>("gpt-5.4-mini");
  const [temperature, setTemperature] = useState<number>(0.3);
  const [reasoningEffort, setReasoningEffort] = useState<string>("low");
  const [isPolishingResult, setIsPolishingResult] = useState(false);
  const [isMergingParagraphs, setIsMergingParagraphs] = useState(false);
  const [hasPolished, setHasPolished] = useState(false);
  const [hasMergedParagraphs, setHasMergedParagraphs] = useState(false);
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [result, setResult] = useState<{
    text: string;
    originalText: string;
    sourceLabel: string;
    kind: "file" | "youtube";
    durationMs: number;
    initialSegments?: Array<{ start: number; end: number; text: string }>;
  } | null>(null);
  const [viewMode, setViewMode] = useState<"original" | "corrected">("original");
  const [vocabOpen, setVocabOpen] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const [limitEnabled, setLimitEnabled] = useState(true);
  const [limitMinutes, setLimitMinutes] = useState("5");

  const [fileDuration, setFileDuration] = useState<number | null>(null);
  const [ytMetadata, setYtMetadata] = useState<{
    title: string;
    author: string;
    thumbnail: string;
  } | null>(null);

  const [isReviewer, setIsReviewer] = useState(false);
  const [reviewText, setReviewText] = useState("");
  const [reviewTextFile, setReviewTextFile] = useState<File | null>(null);

  const transcribeChunk = useServerFn(transcribeChunkFn);
  const polishCall = useServerFn(polishFn);
  const mergeParagraphsCall = useServerFn(mergeParagraphsFn);
  const fetchYTCaptions = useServerFn(youtubeCaptionsFn);
  const downloadYTAudio = useServerFn(downloadYoutubeAudioFn);

  useEffect(() => {
    setVocab(loadVocabulary());
  }, []);
  useEffect(() => {
    saveVocabulary(vocab);
  }, [vocab]);

  useEffect(() => {
    if (!file) {
      setFileDuration(null);
      return;
    }
    getMediaDuration(file).then((d) => setFileDuration(d));
  }, [file]);

  const ytId = useMemo(() => parseYoutubeIdClient(ytUrl), [ytUrl]);

  useEffect(() => {
    if (!ytId) {
      setYtMetadata(null);
      return;
    }
    setYtMetadata({
      title: "Carregando informações do vídeo...",
      author: "",
      thumbnail: `https://img.youtube.com/vi/${ytId}/mqdefault.jpg`,
    });

    youtubeMetadataFn({ data: { url: ytUrl } })
      .then((res) => {
        if (res.ok) {
          setYtMetadata({
            title: res.title,
            author: res.author,
            thumbnail: res.thumbnail,
          });
        }
      })
      .catch(() => {
        setYtMetadata({
          title: "Vídeo do YouTube",
          author: "",
          thumbnail: `https://img.youtube.com/vi/${ytId}/mqdefault.jpg`,
        });
      });
  }, [ytId, ytUrl]);

  const busy = phase.kind !== "idle" && phase.kind !== "done" && phase.kind !== "error";

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) setFile(f);
  }, []);

  async function runFile() {
    if (!file) {
      toast.error("Selecione um arquivo primeiro.");
      return;
    }
    if (file.size > 200 * 1024 * 1024) {
      const isLocal =
        typeof window !== "undefined" &&
        (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
      if (isLocal) {
        toast.warning("Vídeo muito grande!", {
          duration: 15000,
          action: {
            label: "Abrir Conversor Local (Terminal)",
            onClick: async () => {
              try {
                const res = await launchLocalConverterFn();
                if (res.ok) {
                  toast.success(
                    "PowerShell aberto! Coloque o vídeo na pasta e siga as instruções.",
                  );
                } else {
                  toast.error(res.reason);
                }
              } catch (e) {
                toast.error("Não foi possível acionar o PowerShell automaticamente.");
              }
            },
          },
        });
      } else {
        toast.warning(
          "Vídeo muito grande! Recomendamos extrair o áudio (.mp3) localmente antes do envio.",
          { duration: 5000 },
        );
      }
    }
    const started = performance.now();
    setResult(null);
    setHasPolished(false);
    setHasMergedParagraphs(false);
    setViewMode("original");
    try {
      const totalDuration = await getMediaDuration(file);
      const segmentSeconds = model.includes("gpt-4o") ? 60 : 300;
      let maxSeconds: number | undefined;
      if (limitEnabled) {
        const mins = parseFloat(limitMinutes);
        if (!isNaN(mins) && mins > 0) {
          const limitSecs = mins * 60;
          if (totalDuration > 0 && limitSecs < totalDuration) {
            maxSeconds = limitSecs;
          }
        }
      }
      setPhase({ kind: "splitting", message: "Preparando áudio…" });
      const chunks = await splitMediaIntoAudioChunks(
        file,
        ({ message }) => {
          if (message) setPhase({ kind: "splitting", message });
        },
        segmentSeconds,
        maxSeconds,
      );

      const texts: string[] = [];
      const allSegments: Array<{ start: number; end: number; text: string }> = [];
      let accumulatedOffset = 0;
      for (let i = 0; i < chunks.length; i++) {
        const currentChunkDuration = await getMediaDuration(chunks[i]);
        if (currentChunkDuration < 1.0 && chunks.length > 1) {
          accumulatedOffset += currentChunkDuration;
          continue;
        }

        setPhase({ kind: "transcribing", current: i + 1, total: chunks.length });
        const fd = new FormData();
        fd.append("file", chunks[i]);
        fd.append("vocabulary", vocab);
        fd.append("model", model);
        const { text, segments } = await transcribeChunk({ data: fd });
        texts.push(text);

        if (segments && segments.length > 0) {
          for (const s of segments) {
            allSegments.push({
              start: s.start + accumulatedOffset,
              end: s.end + accumulatedOffset,
              text: s.text,
            });
          }
        } else if (text.trim()) {
          // Fallback segment splitting for models that do not return segment timestamps (like GPT-4o custom endpoints)
          const sentences = text
            .replace(/\r\n/g, "\n")
            .split(/(?<=[.!?])\s+|\n+/)
            .map((s) => s.trim())
            .filter(Boolean);
          if (sentences.length > 0) {
            const totalChars = Math.max(
              1,
              sentences.reduce((acc, s) => acc + s.length, 0),
            );
            let acc = 0;
            for (const s of sentences) {
              const start = (acc / totalChars) * currentChunkDuration;
              acc += s.length;
              const textEnd = (acc / totalChars) * currentChunkDuration;
              allSegments.push({
                start: start + accumulatedOffset,
                end: textEnd + accumulatedOffset,
                text: s,
              });
            }
          }
        }
        accumulatedOffset += currentChunkDuration;
      }
      let full = texts.join("\n\n").trim();

      const durationMs = Math.round(performance.now() - started);
      setResult({
        text: full,
        originalText: full,
        sourceLabel: file.name,
        kind: "file",
        durationMs,
        initialSegments: allSegments,
      });
      saveHistoryItem({
        id: crypto.randomUUID(),
        createdAt: Date.now(),
        source: file.name,
        kind: "file",
        text: full,
        polished: false,
        model,
        durationMs,
        initialSegments: allSegments,
      });
      setPhase({ kind: "done" });
      toast.success("Transcrição concluída.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setPhase({ kind: "error", message: msg });
      toast.error(msg);
    }
  }

  async function runYoutube() {
    if (!ytUrl.trim()) {
      toast.error("Cole o link do YouTube.");
      return;
    }
    const started = performance.now();
    setResult(null);
    setHasPolished(false);
    setHasMergedParagraphs(false);
    setViewMode("original");
    try {
      setPhase({ kind: "fetching-captions" });
      const res = await fetchYTCaptions({ data: { url: ytUrl.trim() } });
      if (!res.ok) {
        setPhase({ kind: "error", message: res.reason });
        toast.error(res.reason);
        return;
      }
      let full = res.text;
      const durationMs = Math.round(performance.now() - started);
      setResult({
        text: full,
        originalText: full,
        sourceLabel: ytUrl.trim(),
        kind: "youtube",
        durationMs,
        initialSegments: res.segments || [],
      });
      saveHistoryItem({
        id: crypto.randomUUID(),
        createdAt: Date.now(),
        source: ytUrl.trim(),
        kind: "youtube",
        text: full,
        polished: false,
        model: "youtube-captions",
        durationMs,
        initialSegments: res.segments || [],
      });
      setPhase({ kind: "done" });
      toast.success("Legenda capturada.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setPhase({ kind: "error", message: msg });
      toast.error(msg);
    }
  }

  async function runDownloadYoutubeAudio() {
    if (!ytUrl.trim()) {
      toast.error("Cole o link do YouTube.");
      return;
    }
    setPhase({ kind: "splitting", message: "Iniciando download do áudio..." });
    try {
      const res = await downloadYTAudio({ data: { url: ytUrl.trim() } });
      if (!res.ok) {
        throw new Error(res.reason);
      }

      setPhase({ kind: "splitting", message: "Carregando áudio no aplicativo..." });

      const fileRes = await fetch(res.path);
      const blob = await fileRes.blob();
      const ext = res.path.split('.').pop() || 'mp3';
      const filename = ytMetadata?.title
        ? `${ytMetadata.title.slice(0, 50).replace(/[\\/:*?"<>|]/g, "")}.${ext}`
        : `${res.id}.${ext}`;

      const downloadedFile = new File([blob], filename, { type: blob.type || `audio/${ext}` });
      setFile(downloadedFile);

      setTab("file");
      setPhase({ kind: "done" });
      toast.success("Áudio baixado e carregado com sucesso!");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setPhase({ kind: "error", message: msg });
      toast.error(`Falha no download: ${msg}`);
    }
  }

  async function runReview() {
    if (!file) {
      toast.error("Selecione um arquivo de mídia primeiro.");
      return;
    }
    if (!reviewText.trim()) {
      toast.error("Selecione um arquivo de texto (.txt) para revisar.");
      return;
    }
    const started = performance.now();
    setResult(null);
    setHasPolished(false);
    setHasMergedParagraphs(false);
    setViewMode("original");
    try {
      setPhase({ kind: "splitting", message: "Carregando arquivos de revisão…" });
      await new Promise((resolve) => setTimeout(resolve, 800));
      const durationMs = Math.round(performance.now() - started);
      setResult({
        text: reviewText,
        originalText: reviewText,
        sourceLabel: file.name,
        kind: "file",
        durationMs,
        initialSegments: [],
      });
      setPhase({ kind: "done" });
      toast.success("Pronto para revisão.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setPhase({ kind: "error", message: msg });
      toast.error(msg);
    }
  }

  async function runReviewYoutube() {
    if (!ytUrl.trim()) {
      toast.error("Cole o link do YouTube.");
      return;
    }
    if (!reviewText.trim()) {
      toast.error("Selecione um arquivo de texto (.txt) para revisar.");
      return;
    }
    const started = performance.now();
    setResult(null);
    setHasPolished(false);
    setHasMergedParagraphs(false);
    setViewMode("original");
    try {
      setPhase({ kind: "fetching-captions" });
      await new Promise((resolve) => setTimeout(resolve, 800));
      const durationMs = Math.round(performance.now() - started);
      setResult({
        text: reviewText,
        originalText: reviewText,
        sourceLabel: ytUrl.trim(),
        kind: "youtube",
        durationMs,
        initialSegments: [],
      });
      setPhase({ kind: "done" });
      toast.success("Pronto para revisão.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setPhase({ kind: "error", message: msg });
      toast.error(msg);
    }
  }

  async function runPostPolish() {
    if (!result?.text) return;
    setIsPolishingResult(true);
    const toastId = toast.loading("Polindo transcrição com IA...");
    try {
      const { text } = await polishCall({
        data: {
          text: result.text,
          vocabulary: vocab,
          model: polishModel,
          temperature,
          reasoningEffort,
        },
      });
      setResult((r) => (r ? { ...r, text } : r));
      setHasPolished(true);
      setViewMode("corrected");
      toast.success("Polimento concluído!", { id: toastId });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`Falha no polimento: ${msg}`, { id: toastId });
    } finally {
      setIsPolishingResult(false);
    }
  }

  async function runMergeParagraphs() {
    if (!result?.text) return;
    setIsMergingParagraphs(true);
    const toastId = toast.loading("Combinando parágrafos com IA...");
    try {
      const { text } = await mergeParagraphsCall({
        data: {
          text: result.text,
          model: polishModel,
          temperature,
          reasoningEffort,
        },
      });
      setResult((r) => (r ? { ...r, text } : r));
      setHasMergedParagraphs(true);
      setViewMode("corrected");
      toast.success("Parágrafos combinados!", { id: toastId });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`Falha ao combinar parágrafos: ${msg}`, { id: toastId });
    } finally {
      setIsMergingParagraphs(false);
    }
  }

  return (
    <div className="min-h-screen">
      <Toaster theme="dark" position="top-center" richColors />

      {/* Nav */}
      <header className="mx-auto flex max-w-[65%] w-full items-center justify-between px-6 py-6 md:px-12">
        <Link to="/" className="group flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary/15 text-primary ring-1 ring-primary/30">
            <Mic className="h-4 w-4" />
          </div>
          <span className="font-serif text-xl tracking-tight">Escriba IA</span>
        </Link>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Link
            to="/historico"
            className="inline-flex items-center gap-2 rounded-full border border-border bg-card/40 px-3.5 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <History className="h-4 w-4" /> Histórico
          </Link>
        </div>
      </header>

      {/* Hero */}
      <main className="mx-auto w-full max-w-[65%] px-6 pb-4 pt-0 md:px-12">
        <div className="mx-auto w-full max-w-none">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="text-center"
          >
            <h1 className="font-serif text-5xl leading-[1.05] sm:text-58xl md:text-5xl">
              <span className="italic text-primary text-8xl">Fala,</span>

              <br />
              <span className="font-serif text-xl tracking-tight text-xl md:text-6xl">
                que eu transcrevo.
              </span>
            </h1>
            {/* <p className="mx-auto mt-5 max-w-xl text-pretty text-muted-foreground">
              Transcrição precisa para conferências, palestras e estudos da Conscienciologia — com jargões reconhecidos automaticamente.
            </p> */}
            {/* 
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-border bg-card/40 px-3 py-1 text-xs text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              Escriba AI · Neologismos da Conscienciologia
            </div> */}
          </motion.div>

          {/* Card */}
          <motion.section
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1, ease: "easeOut" }}
            className="mt-12 overflow-hidden rounded-2xl border border-border bg-card/60 shadow-2xl shadow-black/40 backdrop-blur-xl"
          >
            <Tabs
              value={tab}
              onValueChange={(v) => {
                setTab(v as "file" | "youtube");
                if (phase.kind === "error") {
                  setPhase({ kind: "idle" });
                }
              }}
              className="w-full"
            >
              <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-3">
                <TabsList className="bg-transparent p-0">
                  <TabsTrigger value="file" className="gap-2 data-[state=active]:bg-secondary">
                    <Upload className="h-4 w-4" /> Arquivo
                  </TabsTrigger>
                  <TabsTrigger value="youtube" className="gap-2 data-[state=active]:bg-secondary">
                    <Youtube className="h-4 w-4" /> YouTube
                  </TabsTrigger>
                </TabsList>

                {/* Botões Transcrever / Revisor */}
                <div className="flex items-center gap-1 bg-background/30 border border-border rounded-full p-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      setIsReviewer(false);
                      if (phase.kind === "error") {
                        setPhase({ kind: "idle" });
                      }
                    }}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition-all border ${!isReviewer
                        ? "bg-primary/10 text-primary border-primary/25 shadow-sm"
                        : "text-muted-foreground border-transparent hover:text-foreground hover:bg-secondary/40"
                      }`}
                  >
                    Transcrever
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsReviewer(true);
                      if (phase.kind === "error") {
                        setPhase({ kind: "idle" });
                      }
                    }}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition-all border ${isReviewer
                        ? "bg-primary/10 text-primary border-primary/25 shadow-sm"
                        : "text-muted-foreground border-transparent hover:text-foreground hover:bg-secondary/40"
                      }`}
                  >
                    Revisar
                  </button>
                </div>
              </div>

              <TabsContent value="file" className="m-0 p-5">
                {file ? (
                  <div className="flex flex-col lg:flex-row items-center gap-4 w-full">
                    {/* File Details (Left) */}
                    <div className="flex-1 flex items-center gap-3 min-w-0 w-full rounded-xl border border-border bg-secondary/10 p-2.5">
                      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/25">
                        {file.type.startsWith("video/") ? (
                          <Film className="h-4.5 w-4.5" />
                        ) : (
                          <Mic className="h-4.5 w-4.5" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate font-medium text-xs text-foreground/90">
                            {file.name}
                          </p>
                          <button
                            type="button"
                            onClick={() => {
                              setFile(null);
                              setReviewTextFile(null);
                              setReviewText("");
                            }}
                            className="rounded-full p-1 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors shrink-0"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 mt-0.5 text-[10px] text-muted-foreground">
                          <span>{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                          <span>•</span>
                          <span>{file.type.split("/")[1]?.toUpperCase() || "MÍDIA"}</span>
                          {fileDuration !== null && (
                            <>
                              <span>•</span>
                              <span className="text-primary font-medium">
                                {formatDuration(fileDuration * 1000)}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Limit Transcription (Middle-Left) */}
                    {!isReviewer && (
                      <div className="shrink-0 flex items-center gap-2 rounded-xl border border-border bg-secondary/15 px-3 h-[50px] w-full lg:w-auto">
                        <label className="flex items-center gap-2 cursor-pointer text-xs text-muted-foreground select-none">
                          <Switch
                            checked={limitEnabled}
                            onCheckedChange={setLimitEnabled}
                            className="scale-75"
                          />
                          <span>Limitar:</span>
                        </label>
                        {limitEnabled ? (
                          <div className="flex items-center gap-1">
                            <Input
                              type="number"
                              min={1}
                              max={Math.ceil((fileDuration || 0) / 60) || 120}
                              value={limitMinutes}
                              onChange={(e) => setLimitMinutes(e.target.value)}
                              className="h-6 w-12 text-center text-xs p-0 border-border bg-background/50 focus:ring-0 focus-visible:ring-0"
                            />
                            <span className="text-[10px] text-muted-foreground">min</span>
                          </div>
                        ) : (
                          <span className="text-[10px] text-muted-foreground italic">Inteiro</span>
                        )}
                      </div>
                    )}

                    {/* Model Selector (Middle-Right) */}
                    {!isReviewer && (
                      <div className="w-full lg:w-[220px] shrink-0">
                        <Select
                          value={model}
                          onValueChange={(v) => setModel(v as typeof model)}
                          disabled={busy}
                        >
                          <SelectTrigger className="h-[50px] w-full border-border bg-background/40 text-xs">
                            <SelectValue placeholder="Modelo de transcrição" />
                          </SelectTrigger>
                          <SelectContent>
                            {MODELS.map((m) => (
                              <SelectItem key={m.value} value={m.value} className="text-xs">
                                {m.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {/* Seleção do Texto Existente (Somente Revisor) */}
                    {isReviewer && (
                      <label className="flex-1 flex items-center justify-center gap-2 h-[50px] cursor-pointer rounded-xl border border-dashed border-border hover:border-primary/40 hover:bg-secondary/10 px-4 text-center transition-all w-full lg:w-auto">
                        <input
                          type="file"
                          accept=".txt"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) {
                              setReviewTextFile(f);
                              const r = new FileReader();
                              r.onload = (ev) => {
                                setReviewText((ev.target?.result as string) || "");
                              };
                              r.readAsText(f);
                            }
                          }}
                        />
                        <FileText className="h-4 w-4 text-primary shrink-0" />
                        <span className="text-xs font-medium text-muted-foreground truncate">
                          {reviewTextFile ? reviewTextFile.name : "Carregar texto (.txt)"}
                        </span>
                      </label>
                    )}

                    {/* Action Button (Right) */}
                    <div className="w-full lg:w-[130px] shrink-0">
                      <Button
                        size="lg"
                        onClick={isReviewer ? runReview : runFile}
                        disabled={busy}
                        className="h-[50px] w-full text-xs font-medium"
                      >
                        {busy ? (
                          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                        )}
                        {isReviewer ? "Revisar" : "Transcrever"}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col lg:flex-row items-center gap-3">
                    {/* Compact Upload Box */}
                    <label
                      onDragOver={(e) => {
                        e.preventDefault();
                        setDragOver(true);
                      }}
                      onDragLeave={() => setDragOver(false)}
                      onDrop={onDrop}
                      className={`flex-1 flex items-center justify-center gap-3 h-12 w-full cursor-pointer rounded-xl border border-dashed px-4 text-center transition-all ${dragOver ? "border-primary/60 bg-primary/5" : "border-border hover:border-primary/40 hover:bg-secondary/30"}`}
                    >
                      <input
                        type="file"
                        accept="audio/*,video/*,.mp3,.mp4,.m4a,.wav,.webm,.mov"
                        className="hidden"
                        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                      />
                      <Upload className="h-4 w-4 text-primary shrink-0" />
                      <span className="text-xs font-medium truncate text-muted-foreground">
                        Arraste ou clique para selecionar áudio/vídeo
                      </span>
                    </label>

                    {/* Model Selector */}
                    {!isReviewer && (
                      <div className="w-full lg:w-[260px] shrink-0">
                        <Select
                          value={model}
                          onValueChange={(v) => setModel(v as typeof model)}
                          disabled={busy}
                        >
                          <SelectTrigger className="h-12 w-full border-border bg-background/40 text-xs">
                            <SelectValue placeholder="Modelo de transcrição" />
                          </SelectTrigger>
                          <SelectContent>
                            {MODELS.map((m) => (
                              <SelectItem key={m.value} value={m.value} className="text-xs">
                                {m.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {/* Action Button */}
                    <div className="w-full lg:w-[150px] shrink-0">
                      <Button
                        size="lg"
                        onClick={isReviewer ? runReview : runFile}
                        disabled={busy || !file}
                        className="h-12 w-full text-xs font-medium"
                      >
                        {busy ? (
                          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                        )}
                        {isReviewer ? "Revisar" : "Transcrever"}
                      </Button>
                    </div>
                  </div>
                )}

                <Collapsible className="mt-3 text-left">
                  <CollapsibleTrigger className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors select-none">
                    <span>
                      💡 Arquivo muito grande ou lento? Clique aqui para ver como preparar o áudio
                      localmente
                    </span>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-1.5 rounded-lg border border-border/30 bg-secondary/5 p-3 text-[11px] text-muted-foreground space-y-1.5 leading-relaxed">
                    <p>
                      Para arquivos ou vídeos muito grandes, você pode extrair apenas o áudio em
                      segundos no seu computador. Isso economiza internet e tempo de processamento.
                    </p>
                    <p>
                      <strong>Com FFmpeg (via Terminal/Prompt):</strong> Abra a pasta do arquivo e
                      execute o comando:
                    </p>
                    <pre className="bg-background/80 p-2 rounded border border-border/40 font-mono text-[9px] text-foreground select-all overflow-x-auto">
                      ffmpeg -i seu-video.mp4 -vn -ac 1 -ar 16000 -b:a 64k audio.mp3
                    </pre>
                    <p>
                      <strong>Outra opção:</strong> Você também pode usar ferramentas online
                      gratuitas como o{" "}
                      <a
                        href="https://cobalt.tools"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline font-medium"
                      >
                        cobalt.tools
                      </a>{" "}
                      ou Audacity para salvar apenas a faixa de áudio.
                    </p>
                    {typeof window !== "undefined" &&
                      (window.location.hostname === "localhost" ||
                        window.location.hostname === "127.0.0.1") && (
                        <div className="pt-2 border-t border-border/20 flex items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 text-[10px] px-2.5 font-medium border-border hover:bg-secondary/50 text-foreground gap-1"
                            onClick={async (e) => {
                              e.stopPropagation();
                              try {
                                const res = await launchLocalConverterFn();
                                if (res.ok) {
                                  toast.success("PowerShell aberto!");
                                } else {
                                  toast.error(res.reason);
                                }
                              } catch (err) {
                                toast.error(
                                  "Não foi possível acionar o PowerShell automaticamente.",
                                );
                              }
                            }}
                          >
                            🚀 Abrir Conversor Automático (PowerShell)
                          </Button>
                        </div>
                      )}
                  </CollapsibleContent>
                </Collapsible>
              </TabsContent>

              <TabsContent value="youtube" className="m-0 p-5 space-y-4">
                <div className="flex flex-col lg:flex-row items-center gap-3">
                  <div className="flex-1 w-full">
                    <Input
                      placeholder="Cole o link do YouTube (ex: https://youtube.com/watch?v=…)"
                      value={ytUrl}
                      onChange={(e) => setYtUrl(e.target.value)}
                      className="h-12 border-border bg-background/40 text-xs"
                    />
                  </div>

                  {/* Model Selector */}
                  {!isReviewer && (
                    <div className="w-full lg:w-[260px] shrink-0">
                      <Select
                        value={model}
                        onValueChange={(v) => setModel(v as typeof model)}
                        disabled={busy}
                      >
                        <SelectTrigger className="h-12 w-full border-border bg-background/40 text-xs">
                          <SelectValue placeholder="Modelo de transcrição" />
                        </SelectTrigger>
                        <SelectContent>
                          {MODELS.map((m) => (
                            <SelectItem key={m.value} value={m.value} className="text-xs">
                              {m.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Seleção do Texto Existente (Somente Revisor) */}
                  {isReviewer && (
                    <label className="w-full lg:w-[260px] shrink-0 flex items-center justify-center gap-2 h-12 cursor-pointer rounded-xl border border-dashed border-border hover:border-primary/40 hover:bg-secondary/10 px-4 text-center transition-all">
                      <input
                        type="file"
                        accept=".txt"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) {
                            setReviewTextFile(f);
                            const r = new FileReader();
                            r.onload = (ev) => {
                              setReviewText((ev.target?.result as string) || "");
                            };
                            r.readAsText(f);
                          }
                        }}
                      />
                      <FileText className="h-4 w-4 text-primary shrink-0" />
                      <span className="text-xs font-medium text-muted-foreground truncate">
                        {reviewTextFile ? reviewTextFile.name : "Carregar texto (.txt)"}
                      </span>
                    </label>
                  )}

                  {/* Action Button */}
                  <div className="w-full lg:w-[150px] shrink-0">
                    <Button
                      size="lg"
                      onClick={isReviewer ? runReviewYoutube : runYoutube}
                      disabled={busy || !ytUrl.trim()}
                      className="h-12 w-full text-xs font-medium"
                    >
                      {busy ? (
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                      )}
                      {isReviewer ? "Revisar" : "Transcrever"}
                    </Button>
                  </div>
                </div>

                {ytId && ytMetadata && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex gap-4 rounded-xl border border-border bg-secondary/15 p-3.5 backdrop-blur-sm"
                  >
                    <div className="relative aspect-video w-32 shrink-0 overflow-hidden rounded-lg bg-black/40 border border-border">
                      <img
                        src={ytMetadata.thumbnail}
                        alt="Thumbnail"
                        className="h-full w-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                      <span className="absolute bottom-1 right-1 rounded bg-black/80 px-1 py-0.5 font-mono text-[9px] text-white font-medium">
                        YouTube
                      </span>
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-start justify-between gap-3">
                        <h4 className="line-clamp-2 text-sm font-medium leading-snug text-foreground/90">
                          {ytMetadata.title}
                        </h4>
                        <button
                          type="button"
                          onClick={() => setYtUrl("")}
                          className="rounded-full p-1 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      {ytMetadata.author && (
                        <p className="text-xs text-muted-foreground truncate">
                          {ytMetadata.author}
                        </p>
                      )}
                      <div className="pt-1.5">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 text-[10px] px-2.5 font-medium border-border hover:bg-secondary/50 text-foreground gap-1.5"
                          disabled={busy}
                          onClick={runDownloadYoutubeAudio}
                        >
                          <Download className="h-3 w-3" />
                          Baixar Áudio para o App
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                )}

                <p className="text-xs text-muted-foreground">
                  Tenta primeiro as legendas oficiais. Vídeos sem legenda exigem download manual do
                  áudio (cobalt.tools) e upload pela aba Arquivo.
                </p>
              </TabsContent>
            </Tabs>

            <AnimatePresence>
              {phase.kind !== "idle" && phase.kind !== "done" && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="px-5 pb-5 pt-1 border-t border-border/40"
                >
                  <PhaseLine phase={phase} />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.section>
        </div>

        {/* Result */}
        <AnimatePresence>
          {result && (
            <motion.section
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="mt-8 overflow-hidden rounded-2xl border border-border bg-card/60 backdrop-blur-xl"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3">
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  <span className="font-medium">Transcrição</span>
                  <span className="text-muted-foreground">
                    · {formatDuration(result.durationMs)}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1 bg-background/30 border border-border rounded-full p-0.5 mr-1">
                    <button
                      onClick={() => setViewMode("original")}
                      className={`rounded-full px-3.5 py-1 text-xs font-medium transition-all ${viewMode === "original"
                          ? "bg-primary text-primary-foreground shadow-sm scale-102"
                          : "text-muted-foreground hover:text-foreground"
                        }`}
                    >
                      Original
                    </button>
                    <button
                      onClick={() => setViewMode("corrected")}
                      className={`rounded-full px-3.5 py-1 text-xs font-medium transition-all ${viewMode === "corrected"
                          ? "bg-primary text-primary-foreground shadow-sm scale-102"
                          : "text-muted-foreground hover:text-foreground"
                        }`}
                    >
                      Corrigido
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 rounded-full border border-border bg-background/20 px-3 py-1 mr-2">
                    <Select
                      value={polishModel}
                      onValueChange={(v) => setPolishModel(v as typeof polishModel)}
                      disabled={isPolishingResult || isMergingParagraphs}
                    >
                      <SelectTrigger className="h-7 w-[100px] border-none bg-transparent text-xs py-0 focus:ring-0 shadow-none">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {POLISH_MODELS.map((pm) => (
                          <SelectItem key={pm.value} value={pm.value} className="text-xs">
                            {pm.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="h-4 w-px bg-border" />
                    <Select
                      value={reasoningEffort}
                      onValueChange={setReasoningEffort}
                      disabled={isPolishingResult || isMergingParagraphs}
                    >
                      <SelectTrigger className="h-7 w-[100px] border-none bg-transparent text-xs py-0 focus:ring-0 shadow-none">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {REASONING_EFFORT_OPTIONS.map((re) => (
                          <SelectItem key={re.value} value={re.value} className="text-xs">
                            {re.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <button
                      onClick={runPostPolish}
                      disabled={isPolishingResult || isMergingParagraphs || !result.text}
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-50 ${hasPolished
                          ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-900/60"
                          : "bg-primary/10 text-primary hover:bg-primary/20"
                        }`}
                    >
                      {isPolishingResult ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Wand2 className="h-3 w-3" />
                      )}
                      Polir com IA
                    </button>
                    <button
                      onClick={runMergeParagraphs}
                      disabled={isPolishingResult || isMergingParagraphs || !result.text}
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-50 ${hasMergedParagraphs
                          ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-900/60"
                          : "bg-primary/10 text-primary hover:bg-primary/20"
                        }`}
                    >
                      {isMergingParagraphs ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <WrapText className="h-3 w-3" />
                      )}
                      Combinar Parágrafos
                    </button>
                  </div>

                  <ActionButton
                    onClick={() => {
                      const activeText = viewMode === "original" ? result.originalText : result.text;
                      navigator.clipboard.writeText(activeText);
                      toast.success("Copiado.");
                    }}
                    icon={<Copy className="h-3.5 w-3.5" />}
                  >
                    Copiar
                  </ActionButton>
                  <ActionButton
                    onClick={() => {
                      const activeText = viewMode === "original" ? result.originalText : result.text;
                      const blob = new Blob([activeText], { type: "text/plain;charset=utf-8" });
                      downloadBlob(blob, `transcricao-${Date.now()}.txt`);
                    }}
                    icon={<FileText className="h-3.5 w-3.5" />}
                  >
                    .txt
                  </ActionButton>
                  <ActionButton
                    onClick={async () => {
                      const activeText = viewMode === "original" ? result.originalText : result.text;
                      const blob = await buildTranscriptDocx({
                        title: "Transcrição",
                        text: activeText,
                        sourceLabel: result.sourceLabel,
                      });
                      downloadBlob(blob, `transcricao-${Date.now()}.docx`);
                    }}
                    icon={<FileDown className="h-3.5 w-3.5" />}
                  >
                    .docx
                  </ActionButton>
                </div>
              </div>
              <div className="border-b border-border bg-background/10 px-5 py-3">
                <Collapsible open={vocabOpen} onOpenChange={setVocabOpen}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <CollapsibleTrigger className="group inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground">
                      <ChevronDown
                        className={`h-3 w-3 transition-transform ${vocabOpen ? "rotate-180" : ""}`}
                      />
                      Vocabulário customizado{" "}
                      {vocab.trim() && <span className="text-primary">· ativo</span>}
                    </CollapsibleTrigger>
                  </div>
                  <CollapsibleContent className="pt-3">
                    <Textarea
                      placeholder="Ex.: conscienciologia, conscienciometria, projeciologia, holopensene, evoluciólogo, energossoma…"
                      value={vocab}
                      onChange={(e) => setVocab(e.target.value)}
                      rows={3}
                      className="resize-none border-border bg-background/40 text-xs"
                    />
                    <p className="mt-2 text-[10px] text-muted-foreground">
                      Termos enviados como dica ao modelo de polimento (até ~900 caracteres). Salvo
                      localmente neste dispositivo.
                    </p>
                  </CollapsibleContent>
                </Collapsible>
              </div>
              <div className="px-5 py-5">
                <SyncEditor
                  file={result.kind === "file" ? file : null}
                  youtubeUrl={result.kind === "youtube" ? result.sourceLabel : null}
                  text={viewMode === "original" ? result.originalText : result.text}
                  initialSegments={result.initialSegments}
                  onChange={(next) =>
                    setResult((r) =>
                      r
                        ? viewMode === "original"
                          ? { ...r, originalText: next }
                          : { ...r, text: next }
                        : r
                    )
                  }
                  isReviewer={isReviewer}
                  groupByParagraph={viewMode === "original" ? false : hasMergedParagraphs}
                />
              </div>
            </motion.section>
          )}
        </AnimatePresence>

        {/* Footer note */}
        <p className="mt-4 text-center text-xs text-muted-foreground">@2026 ● Cons-IA</p>
      </main>
    </div>
  );
}

function PhaseLine({ phase }: { phase: Phase }) {
  let label = "";
  let value: number | null = null;
  switch (phase.kind) {
    case "splitting":
      label = phase.message ?? "Preparando…";
      break;
    case "transcribing":
      label = `Transcrevendo ${phase.current}/${phase.total}…`;
      value = ((phase.current - 1) / phase.total) * 100;
      break;
    case "polishing":
      label = "Polindo com IA…";
      break;
    case "fetching-captions":
      label = "Buscando legendas do YouTube…";
      break;
    case "error":
      label = phase.message;
      break;
    default:
      break;
  }
  return (
    <div className="flex items-center gap-3 text-sm text-muted-foreground">
      {phase.kind !== "error" && <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />}
      {phase.kind === "error" && <X className="h-3.5 w-3.5 text-destructive" />}
      <div className="flex-1">
        <div className={phase.kind === "error" ? "text-destructive" : ""}>{label}</div>
        {value !== null && <Progress value={value} className="mt-2 h-1" />}
      </div>
    </div>
  );
}

function ActionButton({
  children,
  onClick,
  icon,
}: {
  children: React.ReactNode;
  onClick: () => void;
  icon: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/40 px-3 py-1.5 text-xs text-foreground/90 transition-colors hover:border-primary/40 hover:text-primary"
    >
      {icon} {children}
    </button>
  );
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rs = s % 60;
  return `${m}m ${rs}s`;
}
