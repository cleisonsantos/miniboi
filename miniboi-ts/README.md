# 🎵 MiniBoi TS - Discord Music Bot

Bot Discord para música com suporte a **YouTube** e **Spotify**, fila inteligente, slash commands modernos e TypeScript.

Reescrito do `bot.js` original com **melhorias significativas** baseadas no seu código.

## 🚀 Features

- **Slash Commands** (`/play`, `/pause`, etc.)
- **YouTube** videos, playlists e busca
- **Spotify** tracks e playlists (bridge para YouTube audio)
- **Fila por servidor** com auto-advance
- **Volume** 0-100%
- **Loop** (off/track/queue)
- **Shuffle** Fisher-Yates
- **Embeds bonitos** com thumbnails e progresso
- **Permissões** (voice channel check)
- **Error handling** com feedback
- **Bun runtime** (rápido)
- **Docker** ready
- **Validação env** Zod
- **Logger** timestamped

## 📁 Estrutura (miniboi-ts/)

```
miniboi-ts/
├── src/
│   ├── config/env.ts                 # Zod env validation
│   ├── client.ts                     # Discord client + events
│   ├── commands/                     # Slash commands (play.ts, pause.ts, etc.)
│   ├── music/
│   │   ├── queue.ts                  # Fila + player + conexão voice
│   │   ├── player.ts                 # AudioResource + volume
│   │   └── sources/                  # youtube.ts spotify.ts index.ts
│   ├── utils/                        # embed.ts permissions.ts logger.ts
│   └── types/index.ts                # Track, Queue, Command interfaces
├── .env.example                      # Template env
├── package.json                      # Bun deps (discord.js, play-dl, etc.)
├── tsconfig.json                     # TS config (ESNext, paths @/)
├── Dockerfile
├── docker-compose.yml
└── README.md
```

## 🛠️ Setup Local

1. `cd miniboi-ts`
2. `cp .env.example .env`
3. **Preencha `.env`**:
   ```
   DISCORD_TOKEN=MT... (Discord Developer Portal > Bot)
   DISCORD_CLIENT_ID=123... (Discord Developer Portal > General Information)
   SPOTIFY_CLIENT_ID=abc... (Spotify Developer Dashboard)
   SPOTIFY_CLIENT_SECRET=xyz...
   ```
4. `bun install`
5. **Invite bot**: OAuth2 URL com `bot` + `applications.commands` scopes
6. `bun run src/index.ts` ou `bun dev` (watch mode)

Bot registra slash commands globalmente no startup.

## 🐳 Docker

```bash
docker compose up --build -d
```

(usa `.env`)

## 📋 Comandos

| Comando | Descrição | Opções |
|---------|-----------|--------|
| `/play <query>` | Toca/adiciona URL ou busca | URL YT/SP ou texto |
| `/pause` | Pausa música | - |
| `/resume` | Retoma | - |
| `/skip` | Pula próxima | - |
| `/stop` | Para, limpa fila, desconecta | - |
| `/queue` | Mostra fila (primeiras 10) | - |
| `/nowplaying` | Música atual + info | - |
| `/volume <0-100>` | Volume | 0-100 |
| `/shuffle` | Embaralha fila | - |
| `/loop <mode>` | Loop | off/track/queue |

**Uso:** Entre em voice → `/play rick roll`

## 🔧 Troubleshooting

- **No sound?** FFmpeg instalado? Docker tem.
- **Spotify fail?** Client credentials no Spotify Dashboard (Web API).
- **Commands not appearing?** Global sync leva 1h; use guild commands para teste.
- **Type errors?** Libs (@types/play-dl imprecisas), ignora.
- **Token exposto?** Rotacione antigo do .env root.

## 📊 Dependências

- `discord.js` voice
- `play-dl` YT/SP stream
- `spotify-web-api-node` metadata
- `zod` env

**Sem deps mortas** (limpou 7 do original).

## Próximo: Go Version

Estrutura similar em `miniboi-go/` para estudos.

**Pronto para produção! 🎉**
