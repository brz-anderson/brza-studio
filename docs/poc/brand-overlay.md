# PoC: overlay de marca no build

Status: medição. A recomendação é **não** adotar o overlay como estratégia de sync. A decisão fica em [ADR: overlay de marca no build](adr-brand-overlay.md), com status Proposta.

O rascunho de ADR está neste diretório, e não em `work/decisions/` do brza-workspace. A norma de lá guarda a decisão na branch `workstream/<nome>`, e workstream novo só nasce por pedido. Este pedido pediu o formato MADR junto da PoC.

## Método

O fork é o `HEAD` da `master` no momento da medição (`c470dda8a4`, `v1.4.256-130`). O upstream é o [Orca](https://github.com/stablyai/orca). As tags locais `upstream-v1.4.256` e `upstream-v1.4.259` foram buscadas desse repositório. A tag `v1.4.256` do fork é o mesmo commit (`6ea47e7342`, `release: v1.4.256`). A `v1.4.259` descasca para `980c002474`.

Distância entre o fork e a `v1.4.259`:

```bash
git rev-list --left-right --count 'upstream-v1.4.259^{commit}...master'
```

Resultado: **897 atrás, 142 à frente**. O “1.000 atrás” não se confirma neste clone. A base do merge também não é a tag que o fork já integrou:

```bash
git merge-base master 'upstream-v1.4.259^{commit}'
git merge-base --is-ancestor 'upstream-v1.4.256^{commit}' 'upstream-v1.4.259^{commit}'
```

A base é `f8ffde3837` (`chore(ratchet): baseline the cached home realpathSync…`, 2026-11-10 00:15 UTC). A `v1.4.256` **não é ancestral** da `v1.4.259`. Há 12 commits só na 256 (o commit de release e vizinhos) e 897 só na 259. Fundir a tag seguinte não é um fast-forward por cima da tag já integrada.

### Tamanho do diff

`git diff --shortstat <upstream> <fork>`, sem renomear à força. Contra a 259 o mesmo comando com `diff.renameLimit=20000`, porque sem isso o Git desiste da detecção de rename e infla delete+add.

### O que conta como rebrand

Uma linha do diff contra a `v1.4.256` é rebrand quando os dois lados ficam iguais depois de trocar estes tokens pelo mesmo marcador: `BrzA Studio`, `brza-studio`, `BrzA`, `BRZA`, `brza`, `Orca`, `ORCA`, `orca`. O pareamento é o `SequenceMatcher` do Python em cima do `git diff -U0 -M`. Linha sem par (inserção, remoção, ou o resto que não normaliza) conta como funcional. Arquivo binário fica de fora das linhas. Isso é de propósito conservador: `an Orca` → `a BrzA Studio` e `Orca-Server` → `BrzA-Studio-Server` **não** contam como rebrand, porque sobra artigo ou hífen.

### Conflitos de um sync para a v1.4.259

```bash
git merge-tree --write-tree --name-only --messages <lado-fork> 'upstream-v1.4.259^{commit}'
```

É o mesmo motor do `git merge` (ort), sem sujar a árvore de trabalho. Contam-se as linhas `CONFLICT (content)`, `CONFLICT (add/add)` e `CONFLICT (modify/delete)`. Hunk é a contagem de `<<<<<<<` que o `git merge-file` produz nos três blobs (base, fork, 259) dos conflitos de conteúdo em que os dois lados têm o arquivo.

Os números 404, 610 e 796 citados como histórico dos syncs anteriores não estão neste clone. Não foram recontados.

## Baseline: o que o fork diverge

### Contra a v1.4.256 (a customização do fork)

|                                  |                |
| :------------------------------- | -------------: |
| Arquivos                         |          2.325 |
| Inserções                        |         39.077 |
| Remoções                         |         19.906 |
| Linhas divergentes classificadas |         58.979 |
| Linhas de rebrand                | 33.954 (57,6%) |
| Linhas funcionais                | 25.025 (42,4%) |
| Arquivos só rebrand              |  1.524 (65,5%) |
| Arquivos mistos                  |            199 |
| Arquivos só funcionais           |            591 |
| Binários                         |             11 |

A hipótese de “cerca de 2/3 das linhas” **não se confirma**. 57,6% é rebrand pelo critério acima. 65,5% dos arquivos são só rebrand, e isso chega perto de dois terços — de arquivos, não de linhas.

O token dominante, nas linhas que normalizam, é `Orca` → `BrzA Studio` (17.117 ocorrências). Quase todo o resto é o mesmo token com pontuação colada (`Orca.`, `Orca-managed`, `non-Orca`). Casos que uma troca global erraria: `orca` → `brza` (29) e `orca` → `brza-studio` (3); `Orca` → `BrzA` (3), sem “Studio”. O fork ainda tem dezenas de milhares de `Orca` de propósito (guias, protocolo, menção ao upstream). Uma troca global não é segura.

Os onze catálogos em `src/renderer/src/i18n/locales/` concentram **26.572** das 33.954 linhas de rebrand (78%). Não são troca pura. Em inglês, `an Orca` virou `a BrzA Studio` (o artigo muda porque o nome novo não começa com vogal). Em alemão, `Orca-Server` virou `BrzA-Studio-Server`. Em francês, `d'Orca` / `qu'Orca` viraram `de BrzA Studio` / `que BrzA Studio`. Além da gramática, os catálogos carregam texto funcional do fork (troca de conta, hand-back, tema do chat) e `~/.orca` → `~/.brza`.

Arquivos novos de marca (SVG, o gerador `config/scripts/brza-brand-build.mjs`) caem em “funcional” nesse critério, porque não existe linha upstream para parear. São 588 linhas em caminhos de asset. Reclassificá-las como rebrand sobe a fração de 57,6% para 58,6%. Não chega a dois terços.

### Contra a v1.4.259

|           |    master |       PoC |
| :-------- | --------: | --------: |
| Arquivos  |    20.945 |    20.535 |
| Inserções |   301.286 |   299.738 |
| Remoções  | 1.287.222 | 1.286.615 |

Esse número **não** é o tamanho da customização. Entre as duas tags o próprio upstream move e apaga muito arquivo (`mobile/rpc-foundation` e os goldens saem; há milhares de renames dentro de `src/`). O diff do fork contra a 259 mistura esse movimento com a customização. A customização medida é a coluna da `v1.4.256`.

### Conflitos ao fundir a v1.4.259 na master

|                                           | master |
| :---------------------------------------- | -----: |
| Arquivos                                  |    277 |
| Conteúdo                                  |    169 |
| modify/delete                             |    103 |
| add/add                                   |      5 |
| Hunks de conteúdo, arquivo nos dois lados |    861 |
| Conteúdo em caminho que falta num lado    |     36 |

Fundir as duas tags upstream entre si, sem o fork, já dá **32** arquivos (25 de conteúdo, 5 add/add, 2 modify/delete). Os onze catálogos `src/renderer/src/i18n/locales/*.json` estão nessa lista. Eles conflitam porque a 256 não é ancestral da 259, não porque o fork reescreveu `Orca`.

## Abordagens

### 1. Troca do nome no transform do Vite e do Vitest

Um plugin `enforce: 'pre'` substitui `Orca` por `BrzA Studio` só numa lista de arquivos cujo diff inteiro é essa troca. O git guarda o texto do upstream. O bundle e o teste veem o nome do fork.

Encaixa no que o repositório já faz: plugin de Vite em `config/build-plugins/`, ao lado do subset de locale e dos `define` de build. A identidade estrutural não entra aqui. Porta, `userData`, Keychain, `~/.brza` e o comando `brza` já têm casa em `src/shared/brand-identity.ts`, e uma troca cega de `orca` quebraria `orca://pair` e o diretório `brza-studio`.

Custo: a lista apodrece (arquivo novo do upstream com `Orca` não entra sozinho); quem lê o fonte vê o nome do upstream; o source map deste plugin não é gerado, porque `Orca` e `BrzA Studio` têm tamanhos diferentes. Ganho: só existe onde a troca é pura.

### 2. Overlay de arquivo inteiro

Um diretório `brand/overlay/` guarda a cópia já marcada e o build a coloca no lugar do arquivo upstream. O caminho upstream funde limpo, e o conflito muda de lugar: a cópia fica velha sem aviso quando o upstream edita a tradução. O diff contra o upstream cresce, porque o arquivo inteiro conta como adição, não como hunk. Pior manutenção que a troca por token, para um diff maior.

### 3. Alargar o `brand-identity.ts` até cada string

É o padrão certo para valor estrutural, e já está feito para esse valor. Não encolhe conflito de texto: a linha do fork continua diferente da linha do upstream (`"Orca"` contra `BRAND_APP_NAME`), e os catálogos JSON não passam a importar uma constante sem deixar de ser catálogo. Custo alto, ganho de sync baixo.

A PoC implementa a abordagem 1, na fatia em que a troca reproduz o fork byte a byte. As outras duas ficam de fora porque uma aumenta o diff e a outra não ataca o conflito que a medição mostra.

## O que a PoC faz

`config/brand-overlay.mjs` lê `config/brand-overlay-files.json` (561 caminhos `src/**/*.ts` e `src/**/*.tsx`). `config/build-plugins/brand-overlay.ts` aplica `Orca` → `BrzA Studio` no Electron Vite (main, preload, renderer) e no Vitest.

Entrou na lista o módulo em que o blob da `v1.4.256` com `Orca` trocado por `BrzA Studio` é igual à `master`, e em que nenhum literal, depois dessa troca, é um valor de `en.json`. O extrator (`pnpm verify:localization-extraction`) compara o fallback no disco com o catálogo. Uma peneira por `translate(` deixou passar outro nome de chamada e string com apóstrofo. A lista final é a que deixa esse comando em zero divergências, 0 de 19.467 chaves. Ficaram de fora 333 arquivos puros que são fallback de catálogo, cinco arquivos puros que não são TypeScript (goldens `.txt`, um `.cjs` e dois `.mjs` lidos fora do Vite) e os catálogos.

Os 561 arquivos voltaram ao blob da `v1.4.256`. Nenhum deles difere dessa tag, e a troca reproduz o texto da `master`. `src/shared/brand-identity.ts` não mudou: `brza-studio`, `brza-dev`, `BrzA Studio`, `.brza`, `brza`, scheme `brza-studio`, portas 6868 e 6869, `BrzA` no host Windows.

## Resultado

### Diff do fork contra o upstream

|                  | master × v1.4.256 | PoC × v1.4.256 |
| :--------------- | ----------------: | -------------: |
| Arquivos         |             2.325 |          1.771 |
| Inserções        |            39.077 |         39.019 |
| Remoções         |            19.906 |         18.982 |
| Linhas (ins+del) |            58.983 |         58.001 |

Menos 554 arquivos (−24%) e menos 982 linhas (−1,7%). A linha cai pouco porque a lista JSON entra como adição e porque o volume grande está nos catálogos, que a PoC não mexe.

Contra a v1.4.259 a queda é de 20.945 para 20.685 arquivos (+300.376 / −1.287.149 no lugar de +301.286 / −1.287.222). O milhão de remoções continua sendo movimento do upstream.

### Conflitos do sync para a v1.4.259

|                                     | master | PoC |
| :---------------------------------- | -----: | --: |
| Arquivos                            |    277 | 197 |
| Conteúdo                            |    169 | 131 |
| modify/delete                       |    103 |  61 |
| add/add                             |      5 |   5 |
| Hunks de conteúdo nos dois lados    |    861 | 829 |
| Conteúdo com blob faltando num lado |     36 |  28 |

Menos 80 arquivos (−29%). Nenhum conflito novo. Os hunks de conteúdo quase não se mexem (861 → 829): o que saiu eram arquivos de conflito pequeno, de uma troca de nome. Os conflitos grandes continuam.

Teto, medido e **não** entregue: por cima dessa PoC, trocar os onze catálogos, `mobile/src/i18n/locales/en.json` e `en-runtime-required.json` pelos blobs da `v1.4.256` ainda deixa **196** arquivos em conflito. Um a menos. Reverter o locale não desarma este sync. Esses arquivos já conflitam entre as duas tags upstream.

### Build

Trocar o token nos 561 arquivos, em Node, levou **6,8 ms**. É o custo do plugin por build completo desses módulos, fora o overhead do Vite de achar o caminho. Não rodei `pnpm build` de ponta a ponta: o pacote desktop puxa nativo e assinatura, e 7 ms não mudam esse tempo.

O Vitest carregou o plugin. `src/cli/runtime/transport.test.ts` e `src/shared/claude-shell-function.test.ts`: 2 arquivos, 28 testes, passando. Prova de que a troca acontece no loader e não só no disco: com `transport.ts` ainda dizendo `Orca closed the connection before responding.` no git, o teste esperou `BrzA Studio closed the connection before responding.` e passou. A asserção foi devolvida ao blob upstream; `transport.ts` continua na lista. A conferência dos 561 ficou em zero divergência contra a tag e contra a troca que reconstrói a `master`.

## Recomendação

Não adotar o overlay como estratégia de sync.

O mecanismo funciona na fatia em que o diff é só `Orca` → `BrzA Studio` e o literal não é fallback de catálogo: o git cola de novo no upstream e o teste vê o nome do fork. Essa fatia é 561 arquivos e cerca de 1,7% das linhas divergentes (982 linhas a menos no `git diff --shortstat` contra a tag). Ela tira 80 dos 277 conflitos deste sync. O resto é funcional (conta no Native Chat, mensagens entre chats, `brza X` no PATH, atualizador de build ad hoc, tema) ou é catálogo de locale, que além de gramática já conflita entre as tags upstream.

O custo de deixar 561 módulos com o nome do upstream no fonte, mais uma allowlist que alguém tem de manter, não se paga neste sync. A identidade que precisa ficar estável ao lado do Orca continua em `brand-identity.ts`.

## Limitações

- A classificação trata como funcional o que não é troca dos tokens listados. Gramática de locale e asset novo de marca ficam desse lado. A fração de 57,6% é piso do rebrand, não teto.
- A allowlist não acompanha sozinha um arquivo novo do upstream.
- Código carregado fora do Vite e do Vitest (um `node` direto num `.ts` da lista) veria `Orca`. Os 561 caminhos estão sob `src/` e o app e o teste passam pelo bundler. Um leitor de disco não passa.
- O plugin não emite source map. Depurar um módulo da lista desalinha coluna.
- O teto dos catálogos joga fora texto funcional do fork. Serviu para contar conflito, não para proposta de implementação.
- Não medi um `pnpm build` completo, nem o extrator de locale numa árvore com fallback revertido. Por isso a lista exclui `translate(`.
