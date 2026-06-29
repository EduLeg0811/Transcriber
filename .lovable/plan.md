# Plano: App de Transcrição PT-BR (ajustado)

## Observações importantes sobre nomes de modelos

Dois modelos que você citou **não existem com esse nome exato** na API da OpenAI. Vou usar os equivalentes mais próximos e atuais — me avise se quiser trocar:

- **"Whisper v3 turbo"** → a OpenAI não hospeda esse nome. Equivalentes na API OpenAI:
  - `gpt-4o-mini-transcribe` (rápido, barato — **vou usar como padrão**)
  - `gpt-4o-transcribe` (mais preciso, opcional via toggle)
  - `whisper-1` (legado)

  _Whisper-large-v3-turbo open-source só existe via Groq/self-host. Se quiser esse exato, precisa de outra chave (Groq)._

- **"GPT-5.4-mini"** → não existe. Vou usar **`gpt-5-mini`** (modelo mini mais recente da OpenAI) para o Ajuste.

## Funcionalidades

1. **Upload MP3/MP4** com drag & drop
2. **Split client-side de arquivos > 25MB** usando **ffmpeg.wasm** no navegador (extrai áudio do MP4, divide em pedaços ≤ 24MB, transcreve cada um sequencialmente, concatena resultado). Tudo local — arquivo nunca sai inteiro para o servidor.
3. **Link do YouTube**:
   - Tenta primeiro extrair legendas oficiais (rápido, grátis)
   - Se não houver legenda, baixa o áudio do vídeo no servidor e transcreve via Whisper (mesmo pipeline do upload, com split se necessário)
4. **Vocabulário customizado** (Conscienciologia): textarea com termos, salvo em `localStorage`, enviado como `prompt` na chamada Whisper para guiar reconhecimento
5. **Toggle "Polir transcrição"** (desligado por padrão): pós-processa com `gpt-5.4-mini` para corrigir pontuação, parágrafos e reforçar termos do vocabulário
6. **Resultado**:
   - Copiar para clipboard
   - Baixar `.txt`
   - Baixar `.docx` (gerado client-side com `docx` npm package)
7. **Histórico local** das últimas 20 transcrições (localStorage), página `/historico`

## Stack técnico

- TanStack Start (já configurado)
- **Secret**: `OPENAI_API_KEY` (você cola via add_secret quando eu pedir)
- **Server functions** (`src/lib/transcribe.functions.ts`):
  - `transcribeAudioChunk({ audioBase64, vocabulary, model })` — chama OpenAI `/v1/audio/transcriptions`
  - `polishTranscript({ text, vocabulary })` — chama OpenAI `/v1/chat/completions` com gpt-5-mini
  - `fetchYoutubeCaptions({ url })` — tenta pegar legendas oficiais via timedtext API
  - `downloadYoutubeAudio({ url })` — baixa áudio (pode falhar em Workers por restrições; explico abaixo)
- **Client utils** (`src/lib/audio-split.ts`): ffmpeg.wasm para split de arquivos grandes
- **Geração DOCX** (`src/lib/docx-export.ts`): pacote `docx`

### Ponto de atenção: YouTube no Cloudflare Worker

O runtime serverless da Lovable (Workers) **não permite spawn de processos** (ytdl-core puro JS funciona, mas YouTube bloqueia frequentemente IPs de data center). Estratégia:

1. Tentar legendas oficiais primeiro (funciona bem)
2. Se não houver, usar `@distube/ytdl-core` ou similar para baixar áudio direto via fetch
3. Se YouTube bloquear, retornar mensagem clara pedindo upload manual

Vou implementar e testar; se YouTube bloquear consistentemente, documento isso na UI.

## Telas

- **`/`** — Hero centrado, tabs "Arquivo" / "YouTube", painel collapsible "Vocabulário customizado", toggle "Polir transcrição", botão grande "Transcrever". Resultado aparece abaixo com ações (copiar, .txt, .docx)
- **`/historico`** — Lista de transcrições anteriores

## Design

Profissional, moderno, sofisticado:

- **Tema escuro** (com toggle light opcional)
- **Tipografia**:
  - Display: **Instrument Serif** (elegante, editorial)
  - Body/UI: **Geist** (técnica, ultra-moderna)
- **Paleta**: preto profundo (#0A0A0A), grafite, branco quebrado; **accent verde-elétrico** (#C7F284) para ações primárias
- **Composição**: muito espaço negativo, hero único com área de drop generosa, micro-interações sutis com Motion (fade/slide/scale)
- **Detalhes**: gradientes sutis em borders, blur backgrounds, transições suaves, indicador de progresso da transcrição (com etapas: dividindo → transcrevendo X/Y → polindo)
- Sem ícones genéricos do Lucide — uso ícones mais distintivos ou customizo

## Fluxo de implementação

1. Pedir secret `OPENAI_API_KEY`
2. Instalar deps: `@ffmpeg/ffmpeg @ffmpeg/util docx motion`
3. Criar server functions + utils client
4. Construir UI (rota `/` + `/historico`)
5. Testar fluxos: upload pequeno, upload grande (split), YouTube com legenda, YouTube sem legenda, Ajuste ligado/desligado, exportar .txt/.docx

**Confirma os ajustes nos nomes de modelo (`gpt-4o-mini-transcribe` + `gpt-5-mini`) e eu já começo.**
