---
name: standard-header-design
description: Aplica o padrão visual unificado Cons-IA (cabeçalho, bloco de abertura/hero e caixa de pesquisa) em qualquer projeto ou página, mantendo identidade visual consistente com tipografia, espaçamentos e cores via tokens de tema.
---

# Padrão Visual Unificado (Cons-IA)

Este guia define as especificações técnicas e de design para implementar e padronizar as **três seções comuns às páginas de abertura** de todos os projetos da suite:

1. **Cabeçalho** (`Header`/`Navbar`) — topo fixo da página.
2. **Bloco de Abertura / Hero** — título e subtítulo logo abaixo do cabeçalho, antes do conteúdo específico.
3. **Caixa de Pesquisa** — input principal de entrada de texto.

O objetivo é estabelecer uma identidade visual forte e coerente entre aplicações distintas, mantendo variações apenas no conteúdo textual (nomes, títulos, subtítulos, placeholders) e na cor primária (`--primary`) de cada projeto — nunca na estrutura, tipografia, espaçamento ou tokens usados.

---

# 1. Cabeçalho (Header)

## 1.1 Estrutura e Classes CSS (Tailwind CSS)

O cabeçalho deve seguir rigorosamente a seguinte estrutura HTML/React:

```tsx
<nav className="sticky top-0 z-30 border-b border-border/50 bg-card/70 backdrop-blur-xl">
  <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
    {/* Lado Esquerdo: Identidade da Marca (Brand Area) */}
    <a href="index.html" title="Voltar à página inicial" className="group flex items-center gap-3">
      {/* Ícone principal de 48px com micro-animação */}
      <img
        src="/icon.png" /* Ou "/favicon.ico" ou "/favicon.svg" ou "/favicon.png" caso não possua icon.png */
        alt="Logo"
        className="h-12 w-12 transition-transform duration-300 group-hover:scale-110 group-hover:drop-shadow-[0_0_8px_color-mix(in_oklch,var(--primary)_40%,transparent)]"
      />
      {/* Bloco de Texto Alinhado Verticalmente */}
      <span className="flex items-center gap-2">
        {/* Título Principal */}
        <span className="font-display text-3xl font-medium tracking-tight text-foreground truncate max-w-[14rem] sm:max-w-none">
          Nome<span className="italic text-primary">Projeto</span>
        </span>

        {/* Separador Vertical Discreto */}
        <span className="hidden h-4 w-px bg-border sm:inline" />

        {/* Subtítulo / Categoria */}
        <span className="hidden font-sans text-xs uppercase tracking-[0.22em] text-muted-foreground sm:inline">
          Subtítulo do Projeto
        </span>
      </span>
    </a>

    {/* Lado Direito: Ações Globais (Botões de Ação, Theme Toggle, etc.) */}
    <div className="flex items-center gap-2">
      {/* Exemplo de botão de controle de tema */}
      <button
        type="button"
        title="Alternar Tema"
        onClick={toggleTheme}
        className="group inline-flex h-10 w-10 items-center justify-center rounded-full border border-border/60 bg-card/60 text-foreground/60 transition hover:border-primary/40 hover:text-primary"
      >
        {theme === 'dark' ? (
          <Sun className="h-[18px] w-[18px] transition-transform duration-300 group-hover:rotate-45" strokeWidth={1.5} />
        ) : (
          <Moon className="h-[18px] w-[18px] transition-transform duration-300 group-hover:-rotate-12" strokeWidth={1.5} />
        )}
      </button>
    </div>
  </div>
</nav>
```

## 1.2 Detalhes Visuais e Tipografia

1. **Ícone**:
   - Tamanho fixo de **48px** (`h-12 w-12` no Tailwind CSS).
   - Efeito hover com escala leve (`group-hover:scale-110`) e sombra colorida/brilho no hover usando a cor primária do tema (`group-hover:drop-shadow-[0_0_8px_color-mix(in_oklch,var(--primary)_40%,transparent)]`) — nunca uma cor hardcoded, para que o brilho acompanhe automaticamente a paleta de cada projeto e o modo claro/escuro.

2. **Alinhamento**:
   - O container de texto deve usar `flex items-center gap-2` para centralizar verticalmente o título, o separador e o subtítulo, garantindo harmonia.

3. **Título Principal**:
   - **Família de Fonte**: `font-display` (Lora).
   - **Tamanho**: `text-3xl` (30px / 1.875rem).
   - **Peso**: `font-medium` (500) — obrigatório declarar explicitamente; nunca deixar o peso implícito/herdado, pois o reset do Tailwind (`preflight`) zera o `font-weight` de headings para `inherit`, e o resultado fica dependente do contexto onde o cabeçalho é inserido.
   - **Espaçamento**: `tracking-tight` (-0.025em) para um visual moderno e limpo.
   - **Cor base**: `text-foreground` (token de tema, claro/escuro automático) — nunca `text-gray-900`/`dark:text-gray-100` hardcoded.
   - **Destaque da Cor**: O sufixo ou elemento em destaque deve vir em itálico (`italic`) usando `text-primary` (token de tema que mapeia a cor característica de cada projeto via `--primary` em `styles.css`). Convenção: o destaque recai sobre a segunda metade/palavra do nome do projeto (ex.: `Lexi` + `Cons` em itálico).
   - **Overflow**: `truncate` com `max-w-[14rem] sm:max-w-none` — nomes de projeto mais longos não podem quebrar o layout horizontal do cabeçalho em telas pequenas.

4. **Separador Vertical**:
   - Altura de `16px` (`h-4`), largura de `1px` (`w-px`).
   - Cor: `bg-border` (token de tema, equivalente a `--border` em `styles.css`) — nunca `bg-gray-300`/`dark:bg-gray-600` hardcoded.
   - Responsividade: Deve sumir em telas pequenas (`hidden sm:inline`).

5. **Subtítulo / Categoria** (ex.: "Agregador Léxico", após o separador vertical):
   - **Família de Fonte**: `font-sans` (Nunito Sans) — declarar a classe explicitamente no elemento, nunca confiar em herança. Não existe classe `.font-body` no projeto; `font-sans` é a classe Tailwind real mapeada para `--font-sans` em `styles.css`. Sem declaração explícita, se o subtítulo for aninhado dentro de um elemento com `font-display`, ele herdaria a fonte serifada do título por engano.
   - **Tamanho**: Extra pequeno, `text-xs` (`0.75rem` / `12px`).
   - **Espaçamento entre letras**: Customizado e amplo, `0.22em` (`tracking-[0.22em]`).
   - **Formatação**: Caixa alta (`uppercase`).
   - **Cor**: `text-muted-foreground`, o tom cinza/esmaecido do tema (definido em `styles.css` via `--muted-foreground`), que varia conforme o modo:
     - Modo claro: `oklch(0.55 0.025 280)`
     - Modo escuro: `oklch(0.68 0.02 280)`
     - Nunca a cor de destaque do projeto, que fica reservada ao título.
   - **Alinhamento**: dentro do mesmo container flex do bloco de texto (`flex items-center gap-2`), na sequência: título → separador vertical → subtítulo.
   - **Responsividade**: Oculto por padrão em telas muito pequenas (`hidden`) e exibido em linha (`sm:inline`) a partir de `≥640px`, junto com o separador vertical.

   Classes Tailwind de referência:
   ```
   hidden font-sans text-xs uppercase tracking-[0.22em] text-muted-foreground sm:inline
   ```

6. **Botões de Ação (lado direito)** — obrigatório, não apenas exemplo ilustrativo:
   - **Tamanho do botão**: `h-10 w-10`, círculo perfeito (`rounded-full`).
   - **Borda**: `border border-border/60` (token de tema).
   - **Fundo**: `bg-card/60`.
   - **Cor do ícone**: `text-foreground/60` em repouso, `hover:text-primary` no hover, com `hover:border-primary/40` na borda.
   - **Ícone interno**: `18px` (`h-[18px] w-[18px]`), `strokeWidth={1.5}`, com micro-animação no hover (`transition-transform`, ex.: `group-hover:rotate-45` ou `group-hover:-rotate-12`).
   - **Agrupamento**: todos os botões de ação ficam dentro de `flex items-center gap-2`, à direita do cabeçalho.

   Classes Tailwind de referência:
   ```
   group inline-flex h-10 w-10 items-center justify-center rounded-full border border-border/60 bg-card/60 text-foreground/60 transition hover:border-primary/40 hover:text-primary
   ```

## 1.3 Fundo, Altura e Linha Divisória do Cabeçalho

O cabeçalho tem um plano de fundo **próprio**, distinto do fundo do restante da página — nunca reutilizar `bg-background` (cor de fundo geral da página).

- **Cor de fundo**: `bg-card` (token de tema, equivalente a `--card` em `styles.css`).
  - Modo claro: resulta em **branco puro** (`--card: white`).
  - Modo escuro: resulta na superfície elevada do tema (`--card: oklch(0.18 0.02 280)`), que ainda assim se diferencia do `--background` da página.
  - **Nunca** alterar a cor de fundo do `<body>`/restante da página para combinar com o cabeçalho — a distinção de planos é intencional e faz parte da identidade visual.
- **Transparência/blur**: `bg-card/70 backdrop-blur-xl` — leve transparência e desfoque, mantendo o efeito "sticky" translúcido sem se confundir com o conteúdo ao rolar a página.
- **Posicionamento**: `sticky top-0 z-30` — o cabeçalho permanece fixo no topo durante o scroll, acima de todo o conteúdo da página.
- **Linha divisória**: `border-b border-border/50` — uma linha horizontal **discreta** de 1px marca o limite entre o cabeçalho e o corpo da página. É essa borda sutil, e não uma mudança de tonalidade abrupta, que comunica a transição visual.
- **Altura do cabeçalho**: determinada pelo elemento mais alto do conteúdo (o ícone, fixo em 48px) somado ao padding vertical do container interno (`py-5` = 20px em cima + 20px embaixo):
  - Altura do conteúdo: `48px (ícone) + 20px + 20px (py-5) = 88px`
  - Altura total renderizada (incluindo a linha divisória de 1px): **89px**
  - Essa altura é uma **consequência** do padding e do tamanho do ícone especificados acima, não um valor fixo a ser declarado separadamente (ex.: `h-[89px]`) — ao seguir `px-6 py-5` no container e `h-12 w-12` no ícone, a altura de 89px é automática e idêntica em todos os projetos.
  - **⚠️ Erro comum em projetos que não usam Tailwind diretamente** (CSS próprio com classes como `.header-inner`): `py-5` equivale a exatamente `20px 20px` de padding vertical — não `18px`, `19px` ou qualquer aproximação "visualmente parecida". Ao portar este padrão para CSS puro, declare `padding: 20px 24px;` (vertical 20px, horizontal 24px = `px-6`) literalmente, e confira o resultado: `48px (ícone) + 20px + 20px + 1px (borda) = 89px`. Um padding de 18px produz 85px e quebra a paridade de altura entre projetos da suite — sempre validar a soma antes de considerar o cabeçalho concluído.

---

# 2. Bloco de Abertura (Hero — Título e Subtítulo da Página)

Logo abaixo do cabeçalho, antes do conteúdo específico de cada projeto (ex.: resultados de busca, dashboard, etc.), toda página de abertura deve exibir um bloco centralizado com um título de impacto (`h2`) e uma linha de subtítulo/descrição (`p`). No projeto atual, esse bloco aparece apenas **antes da primeira busca** (`!hasSearched`), com o título apenas como exemplo: "A palavra, sob todas as luzes." e o subtítulo "Definição • Etimologia • Sinônimos • Analógicos • Traduções • Cognatos".

## 2.1 Estrutura e Classes CSS (Tailwind CSS)

```tsx
<main className="mx-auto max-w-6xl px-6 py-10">
  <section className="mx-auto w-full max-w-xl pt-20">
    <div className="mb-12 text-center">
      {/* Título de Impacto (Hero) */}
      <h2 className="font-display text-5xl leading-[1.05] text-foreground sm:text-6xl">
        Primeira linha,
        <br />
        <span className="italic text-primary/80">linha de destaque do projeto.</span>
      </h2>

      {/* Subtítulo / Descrição */}
      <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground">
        Categoria 1 • Categoria 2 • Categoria 3 • Categoria 4
      </p>
    </div>

    {/* ...caixa de pesquisa (seção 3) vem em seguida... */}
  </section>
</main>
```

## 2.2 Exemplo de Referência (Projeto Atual: LexiCons)

Trecho real, retirado de `App.tsx`, usado como referência canônica do resultado visual esperado — qualquer novo projeto deve produzir um bloco com a mesma "forma", trocando apenas o conteúdo textual:

```tsx
<main className="mx-auto max-w-6xl px-6 py-10">
  <section className={`mx-auto w-full ${hasSearched ? "max-w-2xl" : "max-w-xl pt-20"}`}>
    {!hasSearched && (
      <div className="mb-12 text-center">
        <h2 className="font-display text-5xl leading-[1.05] text-foreground sm:text-6xl">
          A palavra,
          <br />
          <span className="italic text-primary/80">sob todas as luzes.</span>
        </h2>
        <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground">
          Definição • Etimologia • Sinônimos • Analógicos • Traduções • Cognatos
        </p>
      </div>
    )}
```

⚠️ **O texto em si** ("A palavra,", "sob todas as luzes.", a lista de categorias) **é específico do projeto LexiCons — não copiar literalmente em outros projetos.** O que deve se repetir é a estrutura, as classes e a relação entre as partes, descritas abaixo.

Anotações ponto a ponto:

| Trecho | Classe(s) | Fonte | Estilo | Cor |
|---|---|---|---|---|
| `"A palavra,"` (1ª linha do `h2`) | `font-display text-5xl sm:text-6xl leading-[1.05]` | Lora (display) | Regular, sem itálico | `text-foreground` |
| `"sob todas as luzes."` (2ª linha, dentro do `<span>`) | `italic text-primary/80` (herda `font-display text-5xl/6xl` do `h2` pai) | Lora (display) | **Itálico** | `text-primary` a 80% de opacidade |
| `"Definição • Etimologia • Sinônimos • Analógicos • Traduções • Cognatos"` (`p`) | `text-base leading-relaxed text-muted-foreground` | Padrão do corpo (Nunito Sans, herdada) | Regular, sem itálico/negrito | `text-muted-foreground` |

Pontos-chave deste exemplo que devem se repetir em qualquer projeto:
- **Nenhuma parte do hero usa negrito** (`font-bold`/`font-semibold`) — o peso é sempre o padrão da fonte (regular), e o destaque visual vem do **tamanho** (`text-5xl`/`text-6xl` vs `text-base`) e do **itálico + cor**, nunca de negrito.
- O `<br />` força a quebra manual entre a primeira linha (neutra) e a segunda linha (destaque em itálico) — não é um efeito de `text-wrap` automático.
- Apenas a **segunda linha** do título recebe `italic text-primary/80`; a primeira linha permanece `text-foreground` sem itálico, criando contraste hierárquico dentro do próprio `h2`.
- O subtítulo (`p`) nunca herda a fonte serifada do título — fica com a fonte padrão do corpo, reforçando que é uma informação secundária/descritiva, não parte do título.
- Os itens do subtítulo são unidos por `•` (ponto médio, U+2022) com espaço em volta, em uma única linha corrida — não usar vírgulas, hífens ou listas com marcadores (`<ul>`).

**Proporção entre o título do hero e o título do cabeçalho**: o `h2` do hero (`text-5xl`/`text-6xl` = 48px/60px) é cerca de **1,6x a 2x maior** que o título do cabeçalho (`text-3xl` = 30px, seção 1.2 item 3). Essa diferença de escala é intencional — o hero é o ponto focal de maior hierarquia visual da página de abertura; o título do cabeçalho é uma identificação de marca menor e permanente. Não devem ter o mesmo tamanho.

### ❌ Erros comuns a evitar

- **Negrito em vez de itálico** para o destaque (`font-bold text-primary` na 2ª linha) — erra o efeito: negrito comunica ênfase/urgência, itálico comunica um tom mais editorial/elegante, que é a identidade pretendida.
- **Itálico sem redução de opacidade** (`italic text-primary` em vez de `italic text-primary/80`) — fica visualmente mais "pesado"/saturado que o padrão estabelecido; a opacidade de 80% é o que diferencia o destaque do hero do destaque 100% opaco usado no título do cabeçalho.
- **Título do hero do mesmo tamanho que o título do cabeçalho** (ex.: usar `text-3xl` nos dois) — destrói a hierarquia visual entre marca (pequena, permanente) e mensagem de abertura (grande, contextual).
- **Subtítulo com `font-display`** (herdando a fonte serifada do título) — mistura o registro tipográfico; o subtítulo deve sempre usar a fonte padrão do corpo.
- **Lista de categorias com vírgulas ou `<ul>`** em vez de `•` em linha única — quebra o padrão visual minimalista estabelecido para essa linha de descrição.

## 2.3 Detalhes Visuais e Tipografia

1. **Container externo (`main` → `section`)**:
   - `main`: `mx-auto max-w-6xl px-6 py-10` — mesma largura máxima e padding horizontal do cabeçalho (`max-w-6xl px-6`), garantindo alinhamento vertical entre as seções.
   - `section`: `mx-auto w-full max-w-xl pt-20` — coluna centralizada, mais estreita que o `main` (`max-w-xl`), com respiro generoso no topo (`pt-20` = 80px) para separar visualmente do cabeçalho.
   - **Importante**: o `pt-20` (espaço entre cabeçalho e hero) só se aplica **antes** da primeira interação/busca. Após o usuário interagir, a página normalmente assume um layout mais compacto (sem o hero) — esse comportamento é específico de cada projeto, mas a regra de espaçamento do hero em si (`pt-20`) é fixa enquanto ele estiver visível.

2. **Bloco de texto (`div`)**:
   - `mb-12 text-center` — texto centralizado, com `48px` de margem inferior antes do próximo elemento (ex.: a caixa de pesquisa).

3. **Título de Impacto (`h2`)**:
   - **Família de Fonte**: `font-display` (Lora) — mesma fonte do título do cabeçalho, reforçando a identidade visual entre as duas seções.
   - **Tamanho**: `text-5xl` (48px) por padrão, crescendo para `text-6xl` (60px) em telas `sm:` (`≥640px`).
   - **Altura de linha**: `leading-[1.05]` — bem compacta, characteristic de títulos grandes de display.
   - **Cor base**: `text-foreground` (token de tema) — nunca cor hardcoded.
   - **Quebra de linha**: o título é dividido em duas linhas com `<br />`, sendo a **segunda linha** o destaque.
   - **Destaque da Cor**: a segunda linha (ou trecho final de impacto) vem em itálico (`italic`) com `text-primary/80` (80% de opacidade da cor primária do tema) — note que aqui a opacidade reduzida (`/80`) é diferente do `text-primary` (100%) usado no cabeçalho; é a forma padronizada de dar destaque sem competir visualmente com o restante do título.

4. **Subtítulo / Descrição (`p`)**:
   - **Família de Fonte**: padrão do corpo (`font-sans`/Nunito Sans, herdada do `<body>` — sem necessidade de declarar a classe, pois `p` não está aninhado em elemento `font-display`).
   - **Tamanho**: `text-base` (16px).
   - **Altura de linha**: `leading-relaxed`.
   - **Cor**: `text-muted-foreground` (token de tema) — mesmo tom esmaecido usado no subtítulo do cabeçalho.
   - **Largura e alinhamento**: `mx-auto max-w-2xl` — limita a largura da linha de texto para manter legibilidade, mesmo que o container pai seja mais largo.
   - **Espaçamento**: `mt-5` (20px) de distância do título acima.
   - **Conteúdo**: lista de categorias/funcionalidades separadas por `•` (bullet/ponto médio) — o número e o texto das categorias são específicos de cada projeto, mas o separador `•` e o formato em uma única linha são parte do padrão.

## 2.4 Exceções — Características Específicas de Cada Projeto

- **Texto do título** (as duas linhas do `h2`, incluindo onde a quebra de linha ocorre).
- **Texto do subtítulo** (lista de categorias/funcionalidades e a quantidade de itens separados por `•`).
- **Valor de `--primary`**, que determina a cor do destaque em itálico (`text-primary/80`), seguindo a mesma lógica de toda a suite.

Todos os demais aspectos (família de fonte, tamanhos, `leading`, espaçamentos, alinhamento centralizado, opacidade do destaque) seguem o padrão fixo acima.

---

# 3. Caixa de Pesquisa (Search Input)

A caixa de pesquisa principal aparece logo após o bloco de abertura (seção 2) e segue o mesmo princípio de identidade visual unificada, com tokens de tema em vez de cores hardcoded.

## 3.1 Estrutura e Classes CSS (Tailwind CSS)

```tsx
<form
  onSubmit={handleSubmit}
  className="flex gap-1.5 sm:gap-2 rounded-2xl border border-border/70 bg-card/80 p-1.5 sm:p-2 shadow-[0_4px_24px_-12px_rgba(80,70,120,0.25)] backdrop-blur w-full"
>
  <input
    autoFocus
    value={input}
    onChange={(e) => setInput(e.target.value)}
    placeholder="Texto de placeholder específico do projeto…"
    className="flex-1 min-w-0 rounded-xl bg-transparent px-3 py-2 sm:px-4 sm:py-3 font-display text-base sm:text-lg text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
  />
  <button
    type="submit"
    aria-label="Pesquisar"
    title="Pesquisar"
    className="shrink-0 rounded-xl bg-primary px-5 py-2.5 sm:px-6 sm:py-3 text-primary-foreground transition hover:opacity-90 flex items-center justify-center"
  >
    <Search className="h-6 w-6" strokeWidth={2} />
  </button>
</form>
```

## 3.2 Detalhes Visuais e Tipografia

1. **Container (`form`)**:
   - Layout: `flex` com gap responsivo `gap-1.5 sm:gap-2`, ocupando toda a largura disponível (`w-full`).
   - Forma: cantos bem arredondados, `rounded-2xl`.
   - Borda: `border border-border/70` (token de tema).
   - Fundo: `bg-card/80` com `backdrop-blur` — mesma lógica da seção 1.3 (Fundo do Cabeçalho), nunca `bg-background`.
   - Sombra: `shadow-[0_4px_24px_-12px_rgba(80,70,120,0.25)]`, sutil e suspensa, para destacar a caixa do restante da página.
   - Espaçamento interno: `p-1.5 sm:p-2`.

2. **Campo de texto (`input`)**:
   - Família de fonte: `font-display` (Lora) — mesma fonte do título do cabeçalho e do hero, reforçando a identidade.
   - Tamanho: `text-base sm:text-lg`.
   - Fundo: `bg-transparent` (deixa o fundo do container `form` aparecer).
   - Cor do texto: `text-foreground`; placeholder em `placeholder:text-muted-foreground/50`.
   - Cantos: `rounded-xl` (levemente menor que o container externo, mantendo a hierarquia visual).
   - Sem contorno de foco do navegador: `focus:outline-none` (o destaque de foco fica a cargo da borda do `form`, se desejado).
   - Ocupa o espaço restante: `flex-1 min-w-0`.

3. **Botão de envio (ícone)**:
   - Forma: `rounded-xl`, `shrink-0` (não encolhe quando o texto do input cresce).
   - Cor do texto/ícone: `text-primary-foreground` (token de tema, garante contraste com o fundo do botão).
   - Transição: `transition hover:opacity-90`.
   - Ícone interno: `h-6 w-6`, `strokeWidth={2}`.
   - Acessibilidade: `aria-label` e `title` descritivos da ação (ex.: "Pesquisar").

## 3.3 Exceções — Características Específicas de Cada Projeto

- **Texto interno** (`placeholder` do input): cada projeto define seu próprio texto de exemplo (ex.: "Pesquise uma palavra…").
- **Cor de fundo do ícone/botão** (`bg-primary`): embora a *classe* seja sempre `bg-primary` (token de tema, nunca uma cor hardcoded), o *valor* de `--primary` em `styles.css` é o que muda de projeto para projeto, assim como no destaque do título do cabeçalho e do hero.

Todos os demais aspectos (forma, bordas, sombra, tipografia, espaçamento, tamanho do ícone) seguem o padrão fixo acima.

---

# 4. Cores Características de Cada Projeto

Todo o padrão (cabeçalho, hero e caixa de pesquisa) usa tokens de tema (`text-foreground`, `text-primary`, `bg-card`, `bg-border`, `text-muted-foreground`) em vez de cores Tailwind hardcoded (`gray-900`, `gray-300`, etc.). Isso garante que basta redefinir as CSS custom properties em `styles.css` (`--background`, `--foreground`, `--card`, `--primary`, `--muted-foreground`, `--border`, para os modos claro e escuro) para que toda a suite herde automaticamente a identidade visual de cada projeto, sem tocar nos componentes.

*Nota: Ao aplicar o padrão a um novo projeto, basta garantir que `--primary` em `styles.css` aponte para a cor característica do projeto — o destaque do título do cabeçalho (`text-primary`), o destaque do hero (`text-primary/80`), o brilho de hover do ícone e o botão da caixa de pesquisa (`bg-primary`) acompanham essa variável automaticamente.*

---

# 5. Requisito Crítico: Importação de Fontes no HTML

Para que a tipografia funcione perfeitamente e fique idêntica em todas as páginas, **todas as páginas HTML** devem importar obrigatoriamente as fontes do Google Fonts (`Lora` e `Nunito Sans`) na tag `<head>`:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,500;0,600;0,700;1,500&family=Nunito+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
```

Caso contrário, o navegador usará as fontes padrão do sistema (como Times New Roman ou Arial), quebrando a harmonia visual e a identidade única.
