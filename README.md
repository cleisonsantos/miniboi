# 🎵 MiniBoi - Discord Music Bot

Bot Discord para música moderno e performático, desenvolvido em **TypeScript** e rodando no **Bun**. Suporta **YouTube** e **Spotify**, fila inteligente, slash commands e auto-transcoding.

## 🚀 Features

- **Slash Commands** (`/play`, `/pause`, etc.)
- **YouTube** vídeos, playlists e busca via `yt-dlp`
- **Spotify** tracks e playlists (bridge inteligente para áudio do YouTube)
- **Fila por servidor** com dequeue O(1), auto-advance e persistência em memória
- **Prefetch da próxima faixa** e cache curto de URLs/metadata
- **Playlists limitadas a 500 faixas** para proteger memória e latência
- **Volume dinâmico** 0-100%
- **Modos de Loop** (off/track/queue)
- **Shuffle** robusto (Fisher-Yates)
- **Embeds Visuais** ricos com thumbnails e durações
- **Segurança** com validação de variáveis de ambiente via Zod
- **Runtime Bun** para startup instantâneo e menor consumo de RAM
- **Docker** pronto para produção com FFmpeg incluso

## 📁 Estrutura do Projeto

```
.
├── src/
│   ├── config/env.ts                 # Validação de ambiente (Zod)
│   ├── client.ts                     # Setup do cliente Discord + eventos
│   ├── commands/                     # Implementação dos Slash Commands
│   ├── music/
│   │   ├── queue.ts                  # Gerenciador de fila, player e voz
│   │   ├── player.ts                 # Criação de streams de áudio (yt-dlp + fetch)
│   │   └── sources/                  # Resolvers (YouTube e Spotify)
│   ├── utils/                        # Embed builders, permissões e logger
│   └── types/index.ts                # Interfaces e tipos globais
├── .env.example                      # Template de variáveis de ambiente
├── package.json                      # Dependências e scripts do Bun
├── tsconfig.json                     # Configuração do TypeScript
├── Dockerfile                        # Imagem Bun endurecida com FFmpeg e yt-dlp fixado
├── docker-compose.yml                # Orquestração simples
└── README.md
```

## 🛠️ Configuração e Execução

### Pré-requisitos
- [Bun](https://bun.sh/) instalado
- [FFmpeg](https://ffmpeg.org/) no PATH (ou via Docker)
- [Python 3](https://www.python.org/) (para o yt-dlp)

### Passo a Passo
1. Clone o repositório
2. Configure o ambiente: `cp .env.example .env`
3. Preencha as credenciais no `.env`:
   - `DISCORD_TOKEN`: Token do bot (Developer Portal)
   - `DISCORD_CLIENT_ID`: ID da aplicação
   - `SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET`: App no Spotify Dashboard
4. Instale as dependências: `bun install`
5. Publique comandos slash quando houver mudança: `bun run deploy:commands`
6. Inicie o bot:
   - Desenvolvimento: `bun run dev` (com auto-reload)
   - Produção: `bun run start`

### Configuração operacional

| Variável | Padrão | Uso |
|----------|--------|-----|
| `LOG_LEVEL` | `info` | `debug`, `info`, `warn` ou `error` |
| `LOG_FORMAT` | `pretty`/`json` | JSON automático em produção |
| `HEALTH_HOST` | `0.0.0.0` | Interface do health server |
| `HEALTH_PORT` | `$PORT` ou `3000` | Porta de health/readiness; compatível com Railway |

## 🐳 Docker

A forma mais simples de rodar sem se preocupar com dependências locais (FFmpeg/Python):

```bash
docker compose up --build -d
```

Imagem executa como usuário não-root e possui healthcheck interno:

- `GET /health/live`: processo vivo;
- `GET /health/ready`: runtime, Discord e Spotify prontos.

Porta não é publicada pelo Compose. Para monitoramento externo, publique `HEALTH_PORT` explicitamente.

## 🔄 CI e release

GitHub Actions executa instalação com lock congelado, auditoria, typecheck, testes, bundle e build Docker. Fluxo recomendado:

```bash
bun run ci
bun run deploy:commands  # somente quando comandos slash mudarem
bun run start
```

Falha no deploy de comandos retorna exit code diferente de zero. Startup normal não modifica comandos globais.

## 📋 Comandos Disponíveis

| Comando | Descrição | Opções |
|---------|-----------|--------|
| `/play <query>` | Toca ou adiciona à fila | URL YouTube/Spotify ou texto para busca |
| `/pause` | Pausa a reprodução atual | - |
| `/resume` | Retoma a reprodução | - |
| `/skip` | Pula para a próxima música | - |
| `/stop` | Para o bot e limpa a fila | - |
| `/queue` | Lista as próximas músicas | - |
| `/nowplaying` | Mostra detalhes da música atual | - |
| `/volume <0-100>` | Ajusta o volume do áudio | Nível (0 a 100) |
| `/shuffle` | Embaralha a fila atual | - |
| `/loop <mode>` | Altera o modo de repetição | `off`, `track` ou `queue` |

## 📊 Stack Técnica

- **Linguagem:** TypeScript
- **Runtime:** Bun
- **Biblioteca Discord:** `discord.js` v14
- **Áudio:** `@discordjs/voice`, preferência por WebM/Opus e prefetch
- **Métricas:** agregação em memória com relatório periódico
- **Streaming:** `youtube-dl-exec` (wrapper yt-dlp)
- **Metadata:** Spotify Web API via `fetch` nativo
- **Validação:** `Zod`

## ☁️ Deploy

### Recomendações de Hospedagem
Este bot exige conexão persistente (WebSocket) e suporte a UDP (Voz).

- **VPS (Recomendado):** Oracle Cloud (Plano Free Tier Ampere), Hetzner, DigitalOcean.
- **PaaS com Docker:** Railway, Fly.io, Render (plano pago para evitar sleep).

**Nota sobre Cloudflare Workers:** Incompatível. Workers não suportam conexões TCP/UDP persistentes de longa duração necessárias para bots de voz do Discord.

## 📝 Notas de Versão
- Esta é a versão estável em **TypeScript**.
- Arquivos legados (`bot.js`) e protótipos antigos foram removidos para manter o repositório limpo e focado.

---
**Desenvolvido para ser simples, rápido e funcional. 🎉**
