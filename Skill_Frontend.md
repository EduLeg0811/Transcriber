# Guias de Design e Identidade Visual para Páginas Iniciais

Este documento estabelece as diretrizes de design, tipografia, paletas de cores e componentes interativos para a criação de interfaces consistentes, elegantes e modernas. O objetivo é unificar a identidade visual de múltiplos subprojetos de um mesmo ecossistema, onde cada aplicação adota uma **cor característica única (Cor Primária)**, mas preserva a mesma estrutura, espaçamento e comportamento interativo.

---

## 1. Tipografia e Fontes
Para obter uma atmosfera premium, intelectual e limpa, a tipografia combina duas famílias tipográficas contrastantes:
*   **Fonte Serifada (Títulos e Destaques):** Utilizar `"Lora"` (ou alternativas de alta qualidade como `"Spectral"`, `Georgia` ou `serif`).
    *   **Estilo:** Peso médio (`font-weight: 500`), com espaçamento entre letras levemente reduzido (`letter-spacing: -0.015em`).
    *   **Uso:** Cabeçalho principal do produto, títulos de seções principais (`h1`, `h2`) e elementos marcados com a classe `.font-display`.
*   **Fonte Sans-serif (Interface e Textos de Suporte):** Utilizar `"Nunito Sans"` (ou alternativas limpas como `system-ui`, `-apple-system`, `sans-serif`).
    *   **Estilo:** Otimizada para leitura de dados com suporte a recursos avançados de renderização (`font-feature-settings: "ss01", "cv11"`).
    *   **Uso:** Navegação, subtítulos informativos, botões, campos de entrada e textos explicativos.

---

## 2. Paleta de Cores e Temas (Modelo OKLCH)
A paleta de cores é estruturada em torno de uma **Cor Primária** característica para cada aplicação, definida dinamicamente usando o formato `oklch(Luminosidade Croma Matiz)`. O restante da interface usa tons neutros e pastéis calculados para garantir conforto visual tanto em ambientes claros quanto escuros.

### Modo Claro (Light Mode)
*   **Fundo da Página (`background`):** `oklch(0.975 0.005 Matiz_Base)` — Um tom off-white muito suave e levemente aquecido (papel antigo).
*   **Texto Principal (`foreground`):** `oklch(0.32 0.035 Matiz_Base)` — Um grafite escuro com fundo sutil da matiz base, evitando o preto puro.
*   **Cartões/Módulos (`card`):** Branco Puro (`#ffffff`).
*   **Cor Primária/Destaque (`primary`):** `oklch(0.55 0.09 Matiz_Primaria)` — A cor identificadora da aplicação (por exemplo, `270` para violeta, `150` para verde sálvia, `25` para coral).
*   **Subtextos (`muted-foreground`):** `oklch(0.55 0.025 Matiz_Base)`.
*   **Bordas (`border`):** `oklch(0.92 0.018 Matiz_Base)`.

### Modo Escuro (Dark Mode)
*   **Fundo da Página (`background`):** `oklch(0.14 0.015 Matiz_Base)` — Um cinza-grafite profundo.
*   **Texto Principal (`foreground`):** `oklch(0.92 0.01 Matiz_Base)` — Prata/cinza claro e legível.
*   **Cartões/Módulos (`card`):** `oklch(0.18 0.02 Matiz_Base)` — Ligeiramente mais claro que o fundo para criar relevo visual.
*   **Bordas (`border`):** `oklch(0.26 0.02 Matiz_Base)`.

---

## 3. Cabeçalho Superior (Header)
O cabeçalho superior organiza a identidade da aplicação e as configurações de acessibilidade.

### Layout e Alinhamento
*   **Fixação:** Fixado no topo da janela (`sticky top-0`) com alta prioridade de exibição (`z-index: 30`).
*   **Glassmorphism:** Fundo semi-transparente correspondente ao fundo do tema (`bg-background/70`), borda inferior fina e suave (`border-b border-border/50`) e desfoque intenso no fundo (`backdrop-blur-xl`).
*   **Alinhamento:** Flexbox horizontal (`flex items-center justify-between`) com largura máxima (`max-w-6xl`) e centralizado (`mx-auto px-6 py-5`).

### Componentes Internos
1.  **Grupo da Esquerda (Identidade):**
    *   **Logo/Ícone:** Envolto em link com transições suaves no pairar do mouse (`hover:scale-110 duration-300 hover:filter hover:drop-shadow-[0_0_8px_rgba(Matiz_Primaria,0.4)]`).
    *   **Nome do Projeto:** Texto serifado tamanho grande (`font-display text-3xl tracking-tight text-foreground`), destacando o sufixo ou marca final na cor primária.
    *   **Sufixo de Categoria:** Texto pequeno em caixa alta (`text-xs uppercase tracking-[0.22em] text-muted-foreground`), oculto em telas muito pequenas (`hidden sm:inline`).
2.  **Grupo da Direita (Ações/Configurações):**
    *   Agrupamento horizontal (`flex items-center gap-2`).
    *   Botões de controle com formato circular (`h-10 w-10 rounded-full`), borda cinza fina (`border border-border/60`), fundo translúcido (`bg-card/60`) e transição suave no hover para a cor primária correspondente da aplicação (`hover:border-primary/40 hover:text-primary`).

---

## 4. Seção Hero (Apresentação Inicial)
Posicionada no centro antes de qualquer interação ou busca de dados:
*   **Container:** Alinhado ao centro (`text-center mb-12`) com espaçamento superior confortável (`pt-20`).
*   **Título Principal (`h2`):**
    *   Estilo: `font-display text-5xl leading-[1.05] text-foreground sm:text-6xl`
    *   Estrutura: Duas linhas de texto. A primeira linha em estilo normal; a segunda linha em *itálico* com a cor primária ligeiramente translúcida (`text-primary/80`).
*   **Subtítulo de Funcionalidades:**
    *   Estilo: `mx-auto mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground`.
    *   Estrutura: Lista das principais seções ou módulos do sistema separados por um caractere de ponto centralizado (`•`).

---

## 5. Ícone e Mecanismo de Alternância de Tema (Light/Dark Mode)
O controle de tema é implementado com transições fluidas e micro-animações táteis.

### Implementação Lógica (React + Tailwind)
1.  **Estado:** Inicializa com base nas preferências anteriores armazenadas no navegador:
    ```typescript
    const [theme, setTheme] = useState(() => localStorage.getItem("app-theme") || "light");
    ```
2.  **Sincronização:** Aplica ou remove a classe `.dark` no elemento raiz (`document.documentElement`) e sincroniza com o `localStorage`:
    ```typescript
    useEffect(() => {
      const root = document.documentElement;
      if (theme === "dark") {
        root.classList.add("dark");
      } else {
        root.classList.remove("dark");
      }
      localStorage.setItem("app-theme", theme);
    }, [theme]);
    ```

### Estilo e Animações do Botão
*   O botão circular de controle alterna dinamicamente entre dois ícones de linha fina (`strokeWidth={1.5}`) com tamanho de `18px`:
    *   **Lua (Ativar Modo Escuro):** Visível no modo claro. Ao pairar o mouse (`hover`), realiza uma leve rotação de 12 graus no sentido anti-horário (`transition-transform duration-300 group-hover:-rotate-12`).
    *   **Sol (Ativar Modo Claro):** Visível no modo escuro. Ao pairar o mouse (`hover`), realiza uma rotação de 45 graus no sentido horário (`transition-transform duration-300 group-hover:rotate-45`).
