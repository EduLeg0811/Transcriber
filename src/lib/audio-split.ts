// Client-only utility: split a large media file (>25MB) into smaller audio
// chunks using ffmpeg.wasm. Extracts MP3 audio at 64 kbps mono (good for
// speech) and segments to ~5 minutes each.

import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";

const MAX_BYTES = 24 * 1024 * 1024; // safety under OpenAI's 25MB limit
const SEGMENT_SECONDS = 300; // 5 min @ 64kbps mono ≈ 2.4MB per chunk

let ffmpegInstance: FFmpeg | null = null;
let loadPromise: Promise<FFmpeg> | null = null;

async function getFFmpeg(onLog?: (m: string) => void): Promise<FFmpeg> {
  if (ffmpegInstance) return ffmpegInstance;
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    const ff = new FFmpeg();
    ff.on("log", ({ message }) => console.log("[FFmpeg]", message));
    if (onLog) ff.on("log", ({ message }) => onLog(message));
    // @ffmpeg/ffmpeg runs its loader in a module worker. In that context
    // importScripts() is unavailable, so the core must be the ESM build;
    // the UMD build loads over the network but has no default export and
    // triggers "failed to import ffmpeg-core.js".
    const baseURL = "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.9/dist/esm";
    await ff.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
    });
    ffmpegInstance = ff;
    return ff;
  })();
  return loadPromise;
}

export type SplitProgress = (info: {
  phase: "loading" | "decoding" | "ready";
  message?: string;
}) => void;

function getAudioDuration(file: File): Promise<number> {
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

/**
 * Splits a media file into MP3 chunks safe to send to Whisper.
 * Files <= 24MB and already audio (mp3) are returned as-is (single chunk).
 */
export async function splitMediaIntoAudioChunks(
  file: File,
  onProgress?: SplitProgress,
  segmentSeconds: number = SEGMENT_SECONDS,
  maxSeconds?: number,
): Promise<File[]> {
  // Small mp3 → no work needed (only if no clipping is requested).
  if (file.size <= MAX_BYTES && file.type.includes("mpeg") && (!maxSeconds || maxSeconds <= 0)) {
    return [file];
  }

  onProgress?.({ phase: "loading", message: "Carregando processador de áudio…" });
  const ff = await getFFmpeg();

  const inputName = "input" + guessExt(file.name);
  onProgress?.({ phase: "decoding", message: "Carregando arquivo de mídia…" });
  await ff.writeFile(inputName, await fetchFile(file));

  const duration = await getAudioDuration(file);
  const effectiveDuration =
    maxSeconds && maxSeconds > 0 ? Math.min(duration, maxSeconds) : duration;
  const estimatedSize = effectiveDuration * 8 * 1024; // 64kbps mono ≈ 8KB/s
  const shouldSegment =
    estimatedSize > MAX_BYTES || (segmentSeconds < 120 && effectiveDuration > segmentSeconds);

  let chunks: File[] = [];

  if (shouldSegment) {
    onProgress?.({
      phase: "decoding",
      message: "Fatiando áudio em partes (etapa única e otimizada)…",
    });

    const args = [];
    if (maxSeconds && maxSeconds > 0) {
      args.push("-t", String(maxSeconds));
    }
    args.push(
      "-i",
      inputName,
      "-vn",
      "-ac",
      "1",
      "-ar",
      "16000",
      "-b:a",
      "64k",
      "-f",
      "segment",
      "-segment_time",
      String(segmentSeconds),
      "out_%03d.mp3",
    );

    // Executamos o FFMpeg apenas UMA vez para todo o fatiamento, evitando OOM
    await ff.exec(args);

    // Removemos o arquivo original gigante imediatamente para liberar RAM
    try {
      await ff.deleteFile(inputName);
    } catch (e) {
      console.warn("Failed to delete input file:", e);
    }

    const numSegments = Math.ceil(effectiveDuration / segmentSeconds);
    for (let i = 0; i < numSegments + 5; i++) {
      const outName = `out_${String(i).padStart(3, "0")}.mp3`;
      try {
        const data = (await ff.readFile(outName)) as Uint8Array;
        if (data && data.length > 8192) {
          const buf = new Uint8Array(data);
          chunks.push(new File([buf], outName, { type: "audio/mpeg" }));
          await ff.deleteFile(outName);
        } else if (data) {
          console.log(`[FFmpeg] Descartando chunk insignificante/corrompido: ${outName} (${data.length} bytes)`);
          await ff.deleteFile(outName);
        }
      } catch (err) {
        // Interrompe quando não houver mais arquivos subsequentes
        break;
      }
    }
  } else {
    onProgress?.({ phase: "decoding", message: "Convertendo áudio…" });
    const outName = "out_000.mp3";
    const args = [];
    if (maxSeconds && maxSeconds > 0) {
      args.push("-t", String(maxSeconds));
    }
    args.push("-i", inputName, "-vn", "-ac", "1", "-ar", "16000", "-b:a", "64k", outName);
    await ff.exec(args);

    const data = (await ff.readFile(outName)) as Uint8Array;
    const buf = new Uint8Array(data);
    const finalName = file.name.replace(/\.[^/.]+$/, "") + ".mp3";
    chunks.push(new File([buf], finalName, { type: "audio/mpeg" }));
    try {
      await ff.deleteFile(outName);
      await ff.deleteFile(inputName);
    } catch {}
  }

  onProgress?.({ phase: "ready", message: `${chunks.length} pedaço(s) pronto(s).` });
  return chunks;
}

function guessExt(name: string): string {
  const m = name.toLowerCase().match(/\.(mp3|mp4|m4a|wav|webm|mov|mkv|aac|ogg|flac)$/);
  return m ? "." + m[1] : ".bin";
}
