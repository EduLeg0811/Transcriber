import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  callPolish,
  callMergeParagraphs,
  callWhisper,
  fetchYouTubeCaptions,
  fetchYouTubeMetadata,
  parseYouTubeId,
  type TranscribeModel,
} from "./transcribe.server";

const MAX_AUDIO_BYTES = 25 * 1024 * 1024;
const MAX_TEXT_CHARS = 300_000;
const TRANSCRIBE_MODELS = new Set<TranscribeModel>([
  "gpt-4o-mini-transcribe",
  "gpt-4o-transcribe",
  "whisper-1",
]);
const textOperationSchema = z.object({
  text: z.string().trim().min(1).max(MAX_TEXT_CHARS),
  vocabulary: z.string().max(10_000).optional(),
  model: z.enum(["gpt-5.4-mini", "gpt-5.4-nano"]).optional(),
  temperature: z.number().min(0).max(2).optional(),
  reasoningEffort: z.enum(["default", "none", "low", "medium", "high", "xhigh"]).optional(),
});
const mergeOperationSchema = textOperationSchema.omit({ vocabulary: true });

// Transcribe one audio chunk. Client sends FormData containing:
//  - file: Blob (audio)
//  - vocabulary?: string
//  - model?: TranscribeModel
export const transcribeChunkFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => {
    if (!(data instanceof FormData)) throw new Error("FormData esperado.");
    const file = data.get("file");
    if (!(file instanceof File)) throw new Error("Arquivo de áudio ausente.");
    if (file.size <= 0 || file.size > MAX_AUDIO_BYTES) {
      throw new Error("O trecho de áudio deve ter entre 1 byte e 25 MB.");
    }
    const vocabulary = (data.get("vocabulary") as string | null) ?? "";
    if (vocabulary.length > 10_000) throw new Error("Vocabulário acima do limite permitido.");
    const requestedModel = (data.get("model") as string | null) ?? "gpt-4o-mini-transcribe";
    if (!TRANSCRIBE_MODELS.has(requestedModel as TranscribeModel)) {
      throw new Error("Modelo de transcrição não permitido.");
    }
    const model = requestedModel as TranscribeModel;
    return { file, vocabulary, model };
  })
  .handler(async ({ data }) => {
    const { text, segments } = await callWhisper({
      file: data.file,
      vocabulary: data.vocabulary,
      model: data.model,
    });
    return { text, segments };
  });

export const polishFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => textOperationSchema.parse(data))
  .handler(async ({ data }) => {
    const text = await callPolish({
      text: data.text,
      vocabulary: data.vocabulary,
      model: data.model,
      temperature: data.temperature,
      reasoningEffort: data.reasoningEffort,
    });
    return { text };
  });

export const mergeParagraphsFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => mergeOperationSchema.parse(data))
  .handler(async ({ data }) => {
    const text = await callMergeParagraphs({
      text: data.text,
      model: data.model,
      temperature: data.temperature,
      reasoningEffort: data.reasoningEffort,
    });
    return { text };
  });

export const youtubeCaptionsFn = createServerFn({ method: "POST" })
  .validator((data: { url: string }) => data)
  .handler(async ({ data }) => {
    const id = parseYouTubeId(data.url);
    if (!id) {
      return { ok: false as const, reason: "URL do YouTube inválida." };
    }
    try {
      const captions = await fetchYouTubeCaptions(id);
      if (!captions) {
        return {
          ok: false as const,
          reason:
            "Este vídeo não possui legendas oficiais acessíveis. Baixe o áudio/vídeo manualmente (ex.: via cobalt.tools) e envie pelo upload.",
        };
      }
      return { ok: true as const, text: captions.text, segments: captions.segments };
    } catch (e) {
      return {
        ok: false as const,
        reason:
          "Não foi possível ler as legendas. Baixe o áudio/vídeo e envie pelo upload para transcrever via IA.",
      };
    }
  });

export const downloadYoutubeAudioFn = createServerFn({ method: "POST" })
  .validator((data: { url: string }) => data)
  .handler(async ({ data }) => {
    const id = parseYouTubeId(data.url);
    if (!id) return { ok: false as const, reason: "ID não encontrado" };
    try {
      const fs = await import("fs");
      const path = await import("path");
      const { exec } = await import("child_process");
      const { promisify } = await import("util");
      
      const execPromise = promisify(exec);
      const publicDir = path.join(process.cwd(), "public");
      const downloadsDir = path.join(publicDir, "downloads");
      
      if (!fs.existsSync(publicDir)) {
        fs.mkdirSync(publicDir);
      }
      if (!fs.existsSync(downloadsDir)) {
        fs.mkdirSync(downloadsDir);
      }
      
      const outputFilename = `${id}.mp3`;
      const outputPath = path.join(downloadsDir, outputFilename);
      
      if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0) {
        return { ok: true as const, path: `/downloads/${outputFilename}`, id };
      }
      
      console.log(`Downloading audio for YouTube video ${id} to ${outputPath}`);
      try {
        await execPromise(`python -m yt_dlp -x --audio-format mp3 -o "${outputPath}" "https://www.youtube.com/watch?v=${id}"`);
      } catch (err) {
        console.warn("python -m yt_dlp failed, trying python3:", err);
        try {
          await execPromise(`python3 -m yt_dlp -x --audio-format mp3 -o "${outputPath}" "https://www.youtube.com/watch?v=${id}"`);
        } catch (err3) {
          console.error("python3 -m yt_dlp failed:", err3);
        }
      }
      
      if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0) {
        return { ok: true as const, path: `/downloads/${outputFilename}`, id };
      } else {
        const rawFilename = `${id}.m4a`;
        const rawPath = path.join(downloadsDir, rawFilename);
        if (fs.existsSync(rawPath) && fs.statSync(rawPath).size > 0) {
          return { ok: true as const, path: `/downloads/${rawFilename}`, id };
        }
        
        console.log("MP3 extraction failed/FFmpeg missing on PATH. Fetching raw m4a stream instead...");
        try {
          await execPromise(`python -m yt_dlp -f "ba[ext=m4a]" -o "${rawPath}" "https://www.youtube.com/watch?v=${id}"`);
        } catch (err) {
          await execPromise(`python3 -m yt_dlp -f "ba[ext=m4a]" -o "${rawPath}" "https://www.youtube.com/watch?v=${id}"`);
        }
        
        if (fs.existsSync(rawPath) && fs.statSync(rawPath).size > 0) {
          return { ok: true as const, path: `/downloads/${rawFilename}`, id };
        }
        
        throw new Error("Não foi possível salvar o arquivo de áudio.");
      }
    } catch (e) {
      console.error("Audio download error:", e);
      return { ok: false as const, reason: e instanceof Error ? e.message : String(e) };
    }
  });

export const youtubeMetadataFn = createServerFn({ method: "POST" })
  .validator((data: { url: string }) => data)
  .handler(async ({ data }) => {
    const id = parseYouTubeId(data.url);
    if (!id) return { ok: false as const, reason: "ID não encontrado" };
    const meta = await fetchYouTubeMetadata(id);
    if (!meta) return { ok: false as const, reason: "Metadata não encontrado" };
    return {
      ok: true as const,
      title: meta.title,
      author: meta.author,
      thumbnail: `https://img.youtube.com/vi/${id}/mqdefault.jpg`,
    };
  });

export const launchLocalConverterFn = createServerFn({ method: "POST" })
  .validator((data: { fileName?: string }) => data)
  .handler(async ({ data }) => {
    const isProd = process.env.NODE_ENV === "production" || !!process.env.RENDER;
    if (isProd) {
      return {
        ok: false as const,
        reason:
          "A execução automática só está disponível localmente (localhost). Em produção, use o script python manualmente no seu computador.",
      };
    }
    try {
      const { exec } = await import("child_process");
      const arg = data.fileName ? ` '${data.fileName}'` : "";
      exec(`start powershell -NoExit -Command "python convert_split.py${arg}"`);
      return { ok: true as const };
    } catch (e) {
      return { ok: false as const, reason: e instanceof Error ? e.message : String(e) };
    }
  });
