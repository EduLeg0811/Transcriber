import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Trash2, FileText, Copy, Youtube, FileAudio } from "lucide-react";
import { toast, Toaster } from "sonner";

import { Button } from "@/components/ui/button";
import {
  clearHistory,
  deleteHistoryItem,
  loadHistory,
  type TranscriptionRecord,
} from "@/lib/history";
import { ThemeToggle } from "@/components/ThemeToggle";

export const Route = createFileRoute("/historico")({
  head: () => ({
    meta: [
      { title: "Histórico · Transcreve" },
      { name: "description", content: "Suas transcrições recentes salvas neste dispositivo." },
    ],
  }),
  component: HistoryPage,
});

function HistoryPage() {
  const [items, setItems] = useState<TranscriptionRecord[]>([]);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    setItems(loadHistory());
  }, []);

  return (
    <div className="min-h-screen">
      <Toaster theme="dark" position="top-center" richColors />
      <header className="mx-auto flex max-w-none w-full items-center justify-between px-6 py-6 md:px-12">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Link>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          {items.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                clearHistory();
                setItems([]);
                toast.success("Histórico limpo.");
              }}
              className="text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" /> Limpar tudo
            </Button>
          )}
        </div>
      </header>

      <main className="mx-auto w-full max-w-none px-6 pb-24 md:px-12">
        <h1 className="font-serif text-4xl tracking-tight sm:text-5xl">Histórico</h1>
        <p className="mt-2 text-muted-foreground">
          Últimas 20 transcrições, salvas neste dispositivo.
        </p>

        <div className="mt-10 space-y-3">
          {items.length === 0 && (
            <div className="rounded-2xl border border-dashed border-border bg-card/30 p-10 text-center text-sm text-muted-foreground">
              Nenhuma transcrição ainda.{" "}
              <Link to="/" className="text-primary hover:underline">
                Criar a primeira
              </Link>
              .
            </div>
          )}
          {items.map((r) => {
            const isOpen = open === r.id;
            return (
              <article
                key={r.id}
                className="rounded-2xl border border-border bg-card/50 backdrop-blur transition-colors hover:border-primary/30"
              >
                <header className="flex flex-wrap items-center gap-3 px-5 py-4">
                  <div className="grid h-9 w-9 place-items-center rounded-lg bg-secondary text-muted-foreground">
                    {r.kind === "youtube" ? (
                      <Youtube className="h-4 w-4" />
                    ) : (
                      <FileAudio className="h-4 w-4" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{r.source}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(r.createdAt).toLocaleString("pt-BR")} ·{" "}
                      {r.text.length.toLocaleString("pt-BR")} chars
                      {r.polished && " · polido"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(r.text);
                        toast.success("Copiado.");
                      }}
                      className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
                    >
                      <Copy className="h-3.5 w-3.5" /> Copiar
                    </button>
                    <button
                      onClick={() => setOpen(isOpen ? null : r.id)}
                      className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
                    >
                      <FileText className="h-3.5 w-3.5" /> {isOpen ? "Fechar" : "Ver"}
                    </button>
                    <button
                      onClick={() => {
                        deleteHistoryItem(r.id);
                        setItems(loadHistory());
                      }}
                      className="grid h-7 w-7 place-items-center rounded-full text-muted-foreground hover:text-destructive"
                      aria-label="Excluir"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </header>
                {isOpen && (
                  <div className="max-h-[50vh] overflow-y-auto whitespace-pre-wrap border-t border-border px-5 py-5 text-sm leading-relaxed text-foreground/90">
                    {r.text}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </main>
    </div>
  );
}
