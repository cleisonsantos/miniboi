# 🎵 MiniBoi - Discord Music Bot

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
- **Embeds bonitos** com thumbnails
- **Permissões** (voice channel check)
- **Error handling** com feedback
- **Bun runtime** (rápido)
- **Docker** ready
- **Validação env** Zod
- **Logger** timestamped

## 📁 Estrutura

```
.
├── src/
│   ├── config/env.ts                 # Zod env validation
│   ├── client.ts                     # Discord client + events
│   ├── commands/                     # Slash commands (play.ts, pause.ts, etc.)
│   ├── music/
│   │   ├── queue.ts                  # Fila + player + conexão voice
│   │   ├── player.ts                 # AudioResource + volume (yt-dlp)
│   │   └── sources/                  # youtube.ts spotify.ts index.ts
│   ├── utils/                        # embed.ts permissions.ts logger.ts
│   └── types/index.ts                # Track, Queue, Command interfaces
├── bot.js                            # Versão original JS (referência)
├── bot.go                            # Protótipo Go (referência)
├── .env.example                      # Template env
├── package.json                      # Bun deps
├── tsconfig.json                     # TS config
├── Dockerfile
├── docker-compose.yml
├── .dockerignore
└── README.md
```

## 🛠️ Setup Local

1. `cp .env.example .env`
2. **Preencha `.env`**:
   ```
   DISCORD_TOKEN=MT... (Discord Developer Portal > Bot)
   DISCORD_CLIENT_ID=123... (Discord Developer Portal > General Information)
   SPOTIFY_CLIENT_ID=abc... (Spotify Developer Dashboard)
   SPOTIFY_CLIENT_SECRET=xyz...
   ```
3. `bun install`
4. **Invite bot**: OAuth2 URL com `bot` + `applications.commands` scopes
5. `bun run start` ou `bun run dev` (watch mode)

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

- **No sound?** FFmpeg + yt-dlp instalados? Docker já inclui.
- **Spotify fail?** Client credentials no Spotify Dashboard (Web API).
- **Commands not appearing?** Global sync leva 1h; use guild commands para teste.
- **Token exposto?** Rotacione antigo do .env root.

## 📊 Dependências

- `discord.js` + `@discordjs/voice` - Discord API e voz
- `youtube-dl-exec` (yt-dlp) - YouTube stream e busca
- `spotify-web-api-node` - Spotify metadata
- `zod` - Env validation
- `opusscript` - Opus codec
- `dotenv` - Env loading
- `ffmpeg-static` - FFmpeg binary

**Sem deps mortas** (limpou 7 do original).

## ☁️ Deploy

### Docker (recomendado)

Use `docker compose up --build -d` em qualquer VPS/container.

### Cloudflare Workers

**Este bot é incompatível com Cloudflare Workers** porque depende de:
- Gateway WebSocket (conexão TCP persistente)
- UDP sockets para voz (RTP)
- `child_process` para yt-dlp
- Binários nativos (ffmpeg, opus)

Para deploy, use uma VM, VPS, ou container com Node.js/Bun.

## 📝 Notas

- `bot.js` e `bot.go` são versões antigas mantidas como referência
- A versão Go será reimplementada futuramente para estudos

**Pronto para produção! 🎉**
