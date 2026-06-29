import { createServerFn } from "@tanstack/react-start";
import {
  callPolish,
  callWhisper,
  fetchYouTubeCaptions,
  fetchYouTubeMetadata,
  parseYouTubeId,
  type TranscribeModel,
} from "./transcribe.server";

// Transcribe one audio chunk. Client sends FormData containing:
//  - file: Blob (audio)
//  - vocabulary?: string
//  - model?: TranscribeModel
export const transcribeChunkFn = createServerFn({ method: "POST" })
  .validator((data: unknown) => {
    if (!(data instanceof FormData)) throw new Error("FormData esperado.");
    const file = data.get("file");
    if (!(file instanceof File)) throw new Error("Arquivo de áudio ausente.");
    const vocabulary = (data.get("vocabulary") as string | null) ?? "";
    const model = (data.get("model") as TranscribeModel | null) ?? "gpt-4o-mini-transcribe";
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
  .validator(
    (data: {
      text: string;
      vocabulary?: string;
      model?: string;
      temperature?: number;
      reasoningEffort?: string;
    }) => data,
  )
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
      return { ok: true as const, text: captions };
    } catch (e) {
      return {
        ok: false as const,
        reason:
          "Não foi possível ler as legendas. Baixe o áudio/vídeo e envie pelo upload para transcrever via IA.",
      };
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

export const launchLocalConverterFn = createServerFn({ method: "POST" }).handler(async () => {
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
    exec('start powershell -NoExit -Command "python convert_split.py"');
    return { ok: true as const };
  } catch (e) {
    return { ok: false as const, reason: e instanceof Error ? e.message : String(e) };
  }
});
