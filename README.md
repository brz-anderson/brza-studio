<h1 align="center">
  <img src="resources/build/icon.png" alt="BrzA Studio" width="96" valign="middle" /> BrzA Studio
</h1>

<p align="center">
  <strong>ADE — ambiente de desenvolvimento para agentes de IA em paralelo.</strong><br/>
  Rode Claude Code, Codex, OpenCode e outros lado a lado, cada um no seu worktree, acompanhados num só lugar.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/license-MIT-F26B1D?style=flat" alt="Licença: MIT" />
  <img src="https://img.shields.io/badge/macOS%20%7C%20Windows%20%7C%20Linux-F26B1D?style=flat-square" alt="Plataformas: macOS, Windows e Linux" />
</p>

## Requisitos

- Node.js 24
- pnpm 12 (via `corepack`: `corepack enable pnpm`)

## Desenvolvimento

```sh
pnpm install
pnpm dev
```

Antes de entregar uma mudança, rode `pnpm check:changed --maxWorkers=2` (formatação, lint, typecheck, testes afetados e ratchets). Os comandos e as convenções do projeto estão em [AGENTS.md](AGENTS.md) e em [CONTRIBUTING](.github/CONTRIBUTING.md).

## Build local

| Plataforma  | Comando            | Saída                                             |
| ----------- | ------------------ | ------------------------------------------------- |
| Windows x64 | `pnpm build:win`   | `dist/brza-studio-windows-setup.exe`              |
| macOS       | `pnpm build:mac`   | `dist/brza-studio-macos-<arch>.dmg`               |
| Linux       | `pnpm build:linux` | `dist/brza-studio-linux.AppImage`, `.deb`, `.rpm` |

Builds locais não procuram atualizações automáticas.

## Origem e licença

O BrzA Studio é um fork do [Orca](https://github.com/stablyai/orca), distribuído sob a licença MIT. Veja [LICENSE](LICENSE).
