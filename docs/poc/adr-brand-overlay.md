# ADR: o rebrand não vai para um overlay de build

Status: **Proposta**

Data: 2026-11-14

Quem decide: Anderson. Este texto não fecha a decisão. A norma do brza-workspace exige confirmação explícita ("decidido", "fechado" ou "pode aplicar"). A casa de uma decisão lá é `work/decisions/` na branch do workstream, e workstream novo só nasce por pedido. Este rascunho fica ao lado da medição, em [PoC: overlay de marca no build](brand-overlay.md).

## Contexto

O brza-studio é um fork do Orca. O sync é um merge da tag upstream. Na medição de 2026-11-14 a `master` está 142 commits à frente e 897 atrás da `v1.4.259`. A `v1.4.256`, que o fork já integrou, não é ancestral da `v1.4.259`: a base do merge é `f8ffde3837`, anterior ao commit de release.

Contra a `v1.4.256` o fork tem 2.325 arquivos e 58.983 linhas de diff (39.077 inserções, 19.906 remoções). 57,6% dessas linhas são troca de token de marca (`Orca` / `orca` e as formas `BrzA` / `brza`). 78% desse rebrand está nos catálogos de locale, e ali a troca não é pura: artigo, hífen de composto e elisão francesa mudam junto, e há texto funcional do fork. A identidade que precisa conviver com o Orca (userData, Keychain, portas 6868/6869, `~/.brza`, comando `brza`) já está em `src/shared/brand-identity.ts`.

Fundir a `v1.4.259` na `master` produz 277 arquivos em conflito (169 de conteúdo, 103 modify/delete, 5 add/add). Onze catálogos de locale conflitam mesmo num merge só das duas tags upstream.

Uma PoC devolveu ao blob da `v1.4.256` os 894 módulos cujo único desvio é `Orca` → `BrzA Studio`, e um plugin do Electron Vite e do Vitest reescreve o token na carga. O diff contra a `v1.4.256` cai para 1.436 arquivos e 56.746 linhas. Os conflitos caem para 180 arquivos. Os hunks de conteúdo quase não caem (861 → 820). Reverter os catálogos para o blob upstream, num commit que não entrou na PoC, tira mais um arquivo (179).

## Decisão

Não concentrar o rebrand num overlay aplicado no build. O nome visível continua no código commitado. A identidade estrutural continua num módulo só.

Regras que passam a valer se esta proposta for confirmada:

1. `src/shared/brand-identity.ts` segue sendo o único lugar de userData, nome do app para o Keychain, `~/.brza`, comando `brza`, scheme `brza-studio`, portas 6868 e 6869 e o nome do host Windows. Valor novo desse tipo entra ali, não numa troca de string.
2. O texto visível `BrzA Studio` continua escrito no fonte que o git guarda, inclusive nos catálogos de locale. Não se introduz plugin de build cuja função seja repor esse nome.
3. A allowlist `config/brand-overlay-files.json` e o plugin `brza-brand-overlay` são artefato desta PoC. Não entram na `master` como arquitetura. Quem for fundir a branch decide se o experimento fica no histórico ou se a branch se abandona.
4. Sync com o upstream continua sendo merge da tag. Conflito em arquivo cujo diff do fork é só o token do produto se resolve reaplicando `Orca` → `BrzA Studio` na resolução, sem um segundo fonte da verdade.
5. Catálogo de locale continua commitado já com o nome do fork e com o acerto gramatical (`a BrzA Studio`, `BrzA-Studio-Server`, `de BrzA Studio`). A lista `NEVER_TRANSLATE_VALUES` que protege `BrzA Studio` não passa a proteger `Orca` no lugar dele.

## Consequências positivas

- O fonte que a pessoa lê, que o extrator de locale compara e que um `node` carrega fora do Vite diz o nome do produto que roda.
- Não há allowlist para apodrecer, nem source map torto por causa do tamanho diferente dos dois nomes.
- `brand-identity.ts` continua pequeno e estável. É o que garante rodar ao lado do Orca.
- O sync não ganha uma etapa de "rebrandar o que o merge limpou".

## Consequências negativas

- O diff contra a `v1.4.256` segue na ordem de 59 mil linhas, e cerca de 34 mil são token de marca.
- Um sync como o da `v1.4.259` segue na ordem de 277 arquivos em conflito, dos quais a PoC mostraria que 97 saem se o token puro voltar ao upstream. Esse alívio fica na mesa.
- Cada release upstream que editar uma frase com `Orca` pede a mesma troca à mão, ou no conflito.

## Alternativas consideradas

**Troca no transform do Vite, com allowlist.** É a PoC, em `config/brand-overlay.mjs` e `config/build-plugins/brand-overlay.ts`. Ganha 889 arquivos e 2.237 linhas no diff contra a tag já integrada, e 97 arquivos de conflito neste sync. Não mexe no volume de locale, e os catálogos conflitam entre as tags upstream mesmo sem o fork. Custa um fonte que mente até o bundle. Recusada como arquitetura por esse custo, neste tamanho de ganho.

**Overlay de arquivo inteiro.** O build copia a versão marcada por cima do arquivo upstream. O diff cresce (o arquivo inteiro vira adição) e a cópia envelhece sem conflito quando o upstream muda o texto. Recusada.

**Levar cada string visível para `brand-identity.ts`.** Certo para porta, path e comando, e já é assim. Para frase de UI e para JSON de locale a linha do fork continua diferente da linha do upstream, então o conflito não some. Recusada como remédio do sync.

## Gatilhos para revisitar a decisão

- Um sync em que a maioria dos arquivos em conflito tenha diff do fork explicado só por `Orca` → `BrzA Studio`, medido do mesmo jeito que `docs/poc/brand-overlay.md` (normalizar o token e contar o que sobra; `git merge-tree --write-tree` contra a tag).
- O upstream passar a expor um ponto de extensão de nome de produto que o fork possa preencher sem editar a frase.
- A tag de release voltar a ser ancestral da tag seguinte. Enquanto não for, o conflito de catálogo entre as duas tags existe mesmo com o fork zerado naquele arquivo.
