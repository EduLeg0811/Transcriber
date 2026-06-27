export type TranscriptionRecord = {
  id: string;
  createdAt: number;
  source: string; // file name or YouTube URL
  kind: "file" | "youtube";
  text: string;
  polished: boolean;
  model: string;
  durationMs: number;
  initialSegments?: Array<{ start: number; end: number; text: string }>;
};

const KEY = "transcribe.history.v1";
const MAX = 20;

export function loadHistory(): TranscriptionRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    return JSON.parse(raw) as TranscriptionRecord[];
  } catch {
    return [];
  }
}

export function saveHistoryItem(item: TranscriptionRecord) {
  if (typeof window === "undefined") return;
  const all = [item, ...loadHistory()].slice(0, MAX);
  window.localStorage.setItem(KEY, JSON.stringify(all));
}

export function deleteHistoryItem(id: string) {
  if (typeof window === "undefined") return;
  const all = loadHistory().filter((r) => r.id !== id);
  window.localStorage.setItem(KEY, JSON.stringify(all));
}

export function clearHistory() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KEY);
}

const VOCAB_KEY = "transcribe.vocab.v1";

export function loadVocabulary(): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(VOCAB_KEY) ?? "";
}
export function saveVocabulary(v: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(VOCAB_KEY, v);
}
