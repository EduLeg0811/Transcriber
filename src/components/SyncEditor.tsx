import { useEffect, useMemo, useRef, useState } from "react";
import { Play, Pause, Rewind, FastForward, Music2, Film, Youtube } from "lucide-react";

type Segment = { idx: number; text: string; start: number; end: number };

function splitIntoSegments(text: string): { text: string; offset: number }[] {
  // Split on sentence boundaries, keep punctuation. Fallback to line breaks.
  const raw = text.replace(/\r\n/g, "\n");
  const parts: { text: string; offset: number }[] = [];
  const re = /[^.!?\n]+[.!?]+["')\]]*|\S[^\n]*$/g;
  let m: RegExpExecArray | null;
  let last = 0;
  while ((m = re.exec(raw)) !== null) {
    const t = m[0].trim();
    if (t.length === 0) continue;
    parts.push({ text: t, offset: m.index });
    last = m.index + m[0].length;
  }
  if (parts.length === 0 && raw.trim().length > 0) {
    parts.push({ text: raw.trim(), offset: 0 });
  }
  void last;
  return parts;
}

function timestamp(s: number): string {
  if (!isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const ss = Math.floor(s % 60).toString().padStart(2, "0");
  return `${m}:${ss}`;
}



function getWords(text: string): Set<string> {
  const words = text.toLowerCase().match(/\w+/g) ?? [];
  return new Set(words);
}

function jaccardSimilarity(s1: Set<string>, s2: Set<string>): number {
  if (s1.size === 0 && s2.size === 0) return 1;
  let intersection = 0;
  for (const w of s1) {
    if (s2.has(w)) intersection++;
  }
  const union = s1.size + s2.size - intersection;
  return union > 0 ? intersection / union : 0;
}

function alignAndInterpolate(
  originalSegments: Segment[],
  polishedText: string,
  duration: number
): Segment[] {
  const newParts = splitIntoSegments(polishedText);
  if (originalSegments.length === 0) {
    const totalChars = Math.max(1, newParts.reduce((acc, p) => acc + p.text.length, 0));
    let acc = 0;
    return newParts.map((p, i) => {
      const start = (acc / totalChars) * duration;
      acc += p.text.length;
      const end = (acc / totalChars) * duration;
      return { idx: i, text: p.text, start, end };
    });
  }

  const N = originalSegments.length;
  const M = newParts.length;

  const aWords = originalSegments.map(s => getWords(s.text));
  const bWords = newParts.map(p => getWords(p.text));

  // DP table
  const dp: number[][] = Array.from({ length: N + 1 }, () => Array(M + 1).fill(0));
  // Backpointer: 0=Match/Diag, 1=Skip A/Up, 2=Skip B/Left
  const bp: number[][] = Array.from({ length: N + 1 }, () => Array(M + 1).fill(0));

  const GAP_PENALTY = -0.1;
  for (let i = 1; i <= N; i++) {
    dp[i][0] = i * GAP_PENALTY;
    bp[i][0] = 1;
  }
  for (let j = 1; j <= M; j++) {
    dp[0][j] = j * GAP_PENALTY;
    bp[0][j] = 2;
  }

  for (let i = 1; i <= N; i++) {
    for (let j = 1; j <= M; j++) {
      const matchScore = jaccardSimilarity(aWords[i - 1], bWords[j - 1]);

      const sMatch = dp[i - 1][j - 1] + matchScore;
      const sSkipA = dp[i - 1][j] + GAP_PENALTY;
      const sSkipB = dp[i][j - 1] + GAP_PENALTY;

      if (sMatch >= sSkipA && sMatch >= sSkipB) {
        dp[i][j] = sMatch;
        bp[i][j] = 0;
      } else if (sSkipA >= sSkipB) {
        dp[i][j] = sSkipA;
        bp[i][j] = 1;
      } else {
        dp[i][j] = sSkipB;
        bp[i][j] = 2;
      }
    }
  }

  let i = N;
  let j = M;
  const matches = new Map<number, number>(); // key: bIdx (new), value: aIdx (original)
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && bp[i][j] === 0) {
      matches.set(j - 1, i - 1);
      i--;
      j--;
    } else if (i > 0 && (j === 0 || bp[i][j] === 1)) {
      i--;
    } else {
      j--;
    }
  }

  // Build the aligned segments
  return newParts.map((part, bIdx) => {
    const matchedAIdx = matches.get(bIdx);

    if (matchedAIdx !== undefined) {
      const orig = originalSegments[matchedAIdx];
      return { idx: bIdx, text: part.text, start: orig.start, end: orig.end };
    }

    // Unmatched segment: interpolate between nearest matched segments
    let prevBIdx = -1;
    for (let k = bIdx - 1; k >= 0; k--) {
      if (matches.has(k)) {
        prevBIdx = k;
        break;
      }
    }

    let nextBIdx = -1;
    for (let k = bIdx + 1; k < M; k++) {
      if (matches.has(k)) {
        nextBIdx = k;
        break;
      }
    }

    const tBefore = prevBIdx !== -1 ? originalSegments[matches.get(prevBIdx)!].end : 0;
    const tAfter = nextBIdx !== -1 ? originalSegments[matches.get(nextBIdx)!].start : duration;

    // Count how many consecutive unmatched segments are in this gap
    const gapStartBIdx = prevBIdx + 1;
    const gapEndBIdx = nextBIdx !== -1 ? nextBIdx - 1 : M - 1;
    const gapSize = gapEndBIdx - gapStartBIdx + 1;
    const kInGap = bIdx - gapStartBIdx + 1; // 1-indexed position in gap

    const start = tBefore + ((kInGap - 1) / gapSize) * (tAfter - tBefore);
    const end = tBefore + (kInGap / gapSize) * (tAfter - tBefore);

    return { idx: bIdx, text: part.text, start, end };
  });
}

export function SyncEditor({
  file,
  youtubeUrl,
  text,
  initialSegments,
  onChange,
}: {
  file: File | null;
  youtubeUrl?: string | null;
  text: string;
  initialSegments?: Array<{ start: number; end: number; text: string }>;
  onChange: (next: string) => void;
}) {
  const mediaRef = useRef<HTMLVideoElement | HTMLAudioElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [isVideo, setIsVideo] = useState(false);
  const [segments, setSegments] = useState<Segment[]>([]);

  const prevFileRef = useRef<File | null>(null);
  const prevYtUrlRef = useRef<string | null>(null);
  const prevDurationRef = useRef<number>(0);
  const lastPropsTextRef = useRef("");

  useEffect(() => {
    if (!file) { setMediaUrl(null); return; }
    const url = URL.createObjectURL(file);
    setMediaUrl(url);
    setIsVideo(file.type.startsWith("video/"));
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    const isNewMedia = file !== prevFileRef.current || youtubeUrl !== prevYtUrlRef.current;
    const durationLoaded = prevDurationRef.current === 0 && duration > 0;
    const durationChanged = prevDurationRef.current !== duration;

    // If the text change matches what we just sent up, and duration didn't change, ignore it to prevent alignment jitter.
    if (text === lastPropsTextRef.current && segments.length > 0 && !durationChanged) {
      return;
    }

    if (isNewMedia || durationLoaded || segments.length === 0) {
      if (initialSegments && initialSegments.length > 0) {
        const initialSegs = initialSegments.map((s, i) => ({
          idx: i,
          text: s.text.trim(),
          start: s.start,
          end: s.end,
        }));
        setSegments(initialSegs);
      } else {
        const parts = splitIntoSegments(text);
        const totalChars = Math.max(1, parts.reduce((acc, p) => acc + p.text.length, 0));
        let acc = 0;
        const initialSegs = parts.map((p, i) => {
          const start = (acc / totalChars) * duration;
          acc += p.text.length;
          const end = (acc / totalChars) * duration;
          return { idx: i, text: p.text, start, end };
        });
        setSegments(initialSegs);
      }
    } else {
      const alignedSegs = alignAndInterpolate(segments, text, duration);
      setSegments(alignedSegs);
    }

    lastPropsTextRef.current = text;
    prevFileRef.current = file;
    prevYtUrlRef.current = youtubeUrl || null;
    prevDurationRef.current = duration;
  }, [text, duration, file, youtubeUrl, initialSegments]);

  const activeIdx = useMemo(() => {
    if (!duration) return -1;
    return segments.findIndex((s) => currentTime >= s.start && currentTime < s.end);
  }, [segments, currentTime, duration]);

  // Auto-scroll active segment into view
  useEffect(() => {
    if (activeIdx < 0 || !containerRef.current) return;
    const el = containerRef.current.querySelector<HTMLElement>(`[data-seg="${activeIdx}"]`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [activeIdx]);

  function togglePlay() {
    const m = mediaRef.current; if (!m) return;
    if (m.paused) m.play(); else m.pause();
  }
  function seekBy(delta: number) {
    const m = mediaRef.current; if (!m) return;
    m.currentTime = Math.max(0, Math.min(duration, m.currentTime + delta));
  }
  function seekTo(t: number) {
    const m = mediaRef.current; if (!m) return;
    m.currentTime = Math.max(0, Math.min(duration, t));
    if (m.paused) m.play();
  }

  function updateSegment(idx: number, next: string) {
    const updated = segments.map((s, i) => (i === idx ? { ...s, text: next } : s));
    setSegments(updated);
    const joinedText = updated.map((s) => s.text).join(" ");
    lastPropsTextRef.current = joinedText;
    onChange(joinedText);
  }

  // YouTube fallback: extract id and embed (no timeupdate available without IFrame API → no sync).
  const ytId = useMemo(() => {
    if (!youtubeUrl) return null;
    try {
      const u = new URL(youtubeUrl);
      if (u.hostname.includes("youtu.be")) return u.pathname.slice(1);
      return u.searchParams.get("v");
    } catch { return null; }
  }, [youtubeUrl]);

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(320px,420px)_1fr]">
      {/* Media panel */}
      <aside className="lg:sticky lg:top-6 lg:self-start">
        <div className="overflow-hidden rounded-xl border border-border bg-background/40">
          <div className="flex items-center gap-2 border-b border-border px-4 py-2.5 text-xs text-muted-foreground">
            {file ? (isVideo ? <Film className="h-3.5 w-3.5" /> : <Music2 className="h-3.5 w-3.5" />) : <Youtube className="h-3.5 w-3.5" />}
            <span className="truncate">{file?.name ?? youtubeUrl ?? "Mídia"}</span>
          </div>

          {file && mediaUrl ? (
            <>
              <div className="bg-black">
                {isVideo ? (
                  <video
                    ref={mediaRef as React.RefObject<HTMLVideoElement>}
                    src={mediaUrl}
                    controls={false}
                    className="aspect-video w-full"
                    onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
                    onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                    onPlay={() => setPlaying(true)}
                    onPause={() => setPlaying(false)}
                  />
                ) : (
                  <div className="grid aspect-[16/7] place-items-center bg-gradient-to-br from-primary/10 to-transparent">
                    <Music2 className="h-12 w-12 text-primary/60" />
                    <audio
                      ref={mediaRef as React.RefObject<HTMLAudioElement>}
                      src={mediaUrl}
                      onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
                      onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                      onPlay={() => setPlaying(true)}
                      onPause={() => setPlaying(false)}
                    />
                  </div>
                )}
              </div>

              {/* Custom transport */}
              <div className="space-y-3 px-4 py-3">
                <div
                  className="group relative h-2 cursor-pointer rounded-full bg-secondary"
                  onClick={(e) => {
                    const r = e.currentTarget.getBoundingClientRect();
                    const ratio = (e.clientX - r.left) / r.width;
                    seekTo(ratio * duration);
                  }}
                >
                  <div
                    className="absolute inset-y-0 left-0 rounded-full bg-primary"
                    style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
                  />
                  <div
                    className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary shadow ring-2 ring-background"
                    style={{ left: `${duration ? (currentTime / duration) * 100 : 0}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] tabular-nums text-muted-foreground">
                  <span>{timestamp(currentTime)}</span>
                  <span>{timestamp(duration)}</span>
                </div>
                <div className="flex items-center justify-center gap-2">
                  <button onClick={() => seekBy(-5)} className="grid h-9 w-9 place-items-center rounded-full border border-border bg-background/40 text-muted-foreground hover:text-foreground" title="-5s">
                    <Rewind className="h-4 w-4" />
                  </button>
                  <button onClick={togglePlay} className="grid h-11 w-11 place-items-center rounded-full bg-primary text-primary-foreground hover:opacity-90">
                    {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                  </button>
                  <button onClick={() => seekBy(5)} className="grid h-9 w-9 place-items-center rounded-full border border-border bg-background/40 text-muted-foreground hover:text-foreground" title="+5s">
                    <FastForward className="h-4 w-4" />
                  </button>
                </div>
                <p className="text-center text-[11px] text-muted-foreground">
                  Clique numa frase para saltar até ela.
                </p>
              </div>
            </>
          ) : ytId ? (
            <div className="aspect-video w-full">
              <iframe
                src={`https://www.youtube.com/embed/${ytId}`}
                title="YouTube"
                className="h-full w-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
              <p className="px-4 py-2 text-[11px] text-muted-foreground">
                Vídeo do YouTube — sincronização por frase não disponível neste modo.
              </p>
            </div>
          ) : (
            <div className="grid aspect-video place-items-center text-sm text-muted-foreground">
              Mídia indisponível
            </div>
          )}
        </div>
      </aside>

      {/* Transcript editor */}
      <div ref={containerRef} className="max-h-[50vh] overflow-y-auto rounded-xl border border-border bg-background/40 p-2">
        <ol className="space-y-1.5">
          {segments.map((seg) => {
            const isActive = seg.idx === activeIdx && duration > 0;
            return (
              <li
                key={seg.idx}
                data-seg={seg.idx}
                className={`group relative flex gap-3 rounded-lg px-3 py-2 transition-colors ${isActive ? "bg-primary/10 ring-1 ring-primary/40" : "hover:bg-secondary/40"
                  }`}
              >
                <button
                  onClick={() => seekTo(seg.start)}
                  className={`mt-1 inline-flex h-5 shrink-0 items-center rounded-full px-2 font-mono text-[10px] tabular-nums transition-colors ${isActive ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground group-hover:text-foreground"
                    }`}
                  title="Saltar para este trecho"
                >
                  {timestamp(seg.start)}
                </button>
                {isActive && (
                  <span className="absolute inset-y-1 left-0 w-0.5 rounded-full bg-primary" />
                )}
                <span
                  contentEditable
                  suppressContentEditableWarning
                  onBlur={(e) => updateSegment(seg.idx, e.currentTarget.textContent ?? "")}
                  className="flex-1 cursor-text whitespace-pre-wrap text-[15px] leading-relaxed text-foreground/90 outline-none focus:text-foreground"
                >
                  {seg.text}
                </span>
              </li>
            );
          })}
          {segments.length === 0 && (
            <li className="px-3 py-6 text-center text-sm text-muted-foreground">Sem texto.</li>
          )}
        </ol>
      </div>
    </div>
  );
}
