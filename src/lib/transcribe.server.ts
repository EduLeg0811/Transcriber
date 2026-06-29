// Server-only helpers for transcription. Never import from client code.

const OPENAI_URL = "https://api.openai.com/v1";

export type TranscribeModel = "gpt-4o-mini-transcribe" | "gpt-4o-transcribe" | "whisper-1";

export async function callWhisper(opts: {
  file: File;
  vocabulary?: string;
  model?: TranscribeModel;
}): Promise<{ text: string; segments: Array<{ start: number; end: number; text: string }> }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY não configurada.");

  const form = new FormData();
  form.append("file", opts.file);
  form.append("model", opts.model ?? "gpt-4o-mini-transcribe");
  form.append("language", "pt");
  const isWhisper = opts.model === "whisper-1";
  form.append("response_format", isWhisper ? "verbose_json" : "json");
  if (opts.vocabulary && opts.vocabulary.trim()) {
    // Whisper "prompt" guides recognition; cap at ~224 tokens worth (~900 chars).
    const prompt = opts.vocabulary.trim().slice(0, 900);
    form.append("prompt", prompt);
  }

  const res = await fetch(`${OPENAI_URL}/audio/transcriptions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenAI transcrição falhou (${res.status}): ${errText.slice(0, 300)}`);
  }
  const data = (await res.json()) as {
    text?: string;
    segments?: Array<{ start: number; end: number; text: string }>;
  };
  return {
    text: data.text ?? "",
    segments:
      data.segments?.map((s) => ({
        start: s.start,
        end: s.end,
        text: s.text ?? "",
      })) ?? [],
  };
}

export async function callPolish(opts: {
  text: string;
  vocabulary?: string;
  model?: string;
  temperature?: number;
  reasoningEffort?: string;
}): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY não configurada.");

  const vocabBlock = opts.vocabulary?.trim()
    ? `\n\nVocabulário a preservar exatamente (Conscienciologia):\n${opts.vocabulary.trim()}`
    : "";

  const system = `Você é um revisor especializado em transcrições em português do Brasil.
Sua tarefa: melhorar legibilidade SEM alterar o conteúdo.
Regras:
- Corrija pontuação, capitalização e parágrafos.
- Não invente, não resuma, não traduza, não adicione comentários.
- Mantenha gírias, marcas e nomes próprios como aparecem.
- Se um termo se assemelha a uma palavra do vocabulário fornecido, prefira a grafia do vocabulário.
- Devolva APENAS o texto polido, sem cabeçalho.${vocabBlock}`;

  const polishModel = opts.model || "gpt-5.4-mini";

  const requestBody: any = {
    model: polishModel,
    messages: [
      { role: "system", content: system },
      { role: "user", content: opts.text },
    ],
  };

  // Only pass temperature if specified and not using a reasoning-only model (like o1/o3/gpt-5/reasoning)
  const isReasoning =
    polishModel.startsWith("o1") ||
    polishModel.startsWith("o3") ||
    polishModel.includes("gpt-5") ||
    polishModel.includes("reasoning");

  if (opts.temperature !== undefined && !isReasoning) {
    requestBody.temperature = opts.temperature;
  }

  if (opts.reasoningEffort && opts.reasoningEffort !== "default") {
    requestBody.reasoning_effort = opts.reasoningEffort;
  }

  const res = await fetch(`${OPENAI_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenAI polimento falhou (${res.status}): ${errText.slice(0, 300)}`);
  }
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return data.choices?.[0]?.message?.content?.trim() ?? opts.text;
}

// Parse YouTube ID from common URL shapes.
export function parseYouTubeId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname === "youtu.be") return u.pathname.slice(1) || null;
    if (u.hostname.endsWith("youtube.com")) {
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

// Decode HTML entities commonly seen in YouTube caption XML.
function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)));
}

// Fetch official YouTube captions (PT first, then any). Returns null if unavailable.
export async function fetchYouTubeCaptions(videoId: string): Promise<string | null> {
  // 1) Parse watch page to find caption tracks.
  const watch = await fetch(`https://www.youtube.com/watch?v=${videoId}&hl=pt-BR`, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
      "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
    },
  });
  if (!watch.ok) return null;
  const html = await watch.text();

  const match = html.match(/"captionTracks":(\[.*?\])/);
  if (!match) return null;
  let tracks: Array<{
    baseUrl: string;
    languageCode?: string;
    kind?: string;
    name?: { simpleText?: string };
  }>;
  try {
    tracks = JSON.parse(
      match[1]
        .replace(/\\u0026/g, "&")
        .replace(/\\"/g, '"')
        .replace(/\\\//g, "/"),
    );
  } catch {
    return null;
  }
  if (!tracks?.length) return null;

  const pick =
    tracks.find((t) => t.languageCode === "pt-BR") ||
    tracks.find((t) => t.languageCode?.startsWith("pt")) ||
    tracks[0];
  if (!pick?.baseUrl) return null;

  const capRes = await fetch(pick.baseUrl);
  if (!capRes.ok) return null;
  const xml = await capRes.text();

  // Extract <text ...>content</text>
  const out: string[] = [];
  const re = /<text[^>]*>([\s\S]*?)<\/text>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    const t = decodeEntities(m[1].replace(/<[^>]+>/g, "")).trim();
    if (t) out.push(t);
  }
  if (!out.length) return null;
  return out.join(" ").replace(/\s+/g, " ").trim();
}

export async function fetchYouTubeMetadata(
  videoId: string,
): Promise<{ title: string; author: string } | null> {
  try {
    const watch = await fetch(`https://www.youtube.com/watch?v=${videoId}&hl=pt-BR`, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
        "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
      },
    });
    if (!watch.ok) return null;
    const html = await watch.text();

    const titleMatch =
      html.match(/<meta name="title" content="([^"]+)"/) || html.match(/<title>([^<]+)<\/title>/);
    const title = titleMatch
      ? decodeEntities(titleMatch[1]).replace(" - YouTube", "")
      : "Vídeo do YouTube";

    const authorMatch =
      html.match(/<link itemprop="name" content="([^"]+)"/) || html.match(/"author":"([^"]+)"/);
    const author = authorMatch ? decodeEntities(authorMatch[1]) : "";

    return { title, author };
  } catch {
    return null;
  }
}
