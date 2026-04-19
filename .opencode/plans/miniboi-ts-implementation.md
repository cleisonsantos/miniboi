# Plano: MiniBoi Discord Music Bot

## Contexto

O repositório contém duas tentativas de criar um bot Discord para música:
- `bot.js` (321 linhas) — Bot funcional em JavaScript/Bun com YouTube e Spotify
- `bot.go` (93 linhas) — Protótipo básico em Go (só ping/pong)

## Decisões do Usuário
- **Organização:** Pasta separada `miniboi-ts/` (manter arquivos antigos como referência)
- **Runtime:** Bun
- **Comandos:** Somente slash commands (sem prefixo `!`)
- **Features:** play, pause, resume, skip, stop, queue, nowplaying, volume, shuffle, loop

---

## Fase 1: Bot em TypeScript (Implementação Principal)

### Estrutura de Arquivos

```
miniboi-ts/
├── src/
│   ├── index.ts                    # Entry point
│   ├── config/
│   │   └── env.ts                  # Validação de env vars com zod
│   ├── client.ts                   # Setup do Discord client
│   ├── commands/
│   │   ├── index.ts                # Registry + deploy de slash commands
│   │   ├── play.ts                 # /play <url|query>
│   │   ├── pause.ts                # /pause
│   │   ├── resume.ts               # /resume
│   │   ├── skip.ts                 # /skip
│   │   ├── stop.ts                 # /stop
│   │   ├── queue.ts                # /queue (com paginação)
│   │   ├── nowplaying.ts           # /nowplaying
│   │   ├── volume.ts               # /volume <0-100>
│   │   ├── shuffle.ts              # /shuffle
│   │   └── loop.ts                 # /loop (off|track|queue)
│   ├── music/
│   │   ├── queue.ts                # Queue class tipada
│   │   ├── player.ts               # Player wrapper
│   │   ├── track.ts                # Track types
│   │   └── sources/
│   │       ├── youtube.ts          # YouTube resolver
│   │       ├── spotify.ts          # Spotify resolver + bridge
│   │       └── index.ts            # Source factory/detector
│   ├── utils/
│   │   ├── embed.ts                # Helpers para embeds
│   │   ├── permissions.ts          # Checks de permissão
│   │   └── logger.ts               # Logger estruturado
│   └── types/
│       └── index.ts                # Types globais
├── .env.example
├── tsconfig.json
├── package.json
├── Dockerfile
├── docker-compose.yml
└── README.md
```

### Etapa 1: Setup do projeto

**Arquivo: `package.json`**
```json
{
  "name": "miniboi",
  "version": "1.0.0",
  "description": "Discord music bot - MiniBoi",
  "type": "module",
  "module": "src/index.ts",
  "scripts": {
    "start": "bun run src/index.ts",
    "dev": "bun --watch run src/index.ts"
  },
  "dependencies": {
    "discord.js": "^14.19.3",
    "@discordjs/voice": "^0.18.0",
    "play-dl": "^1.9.7",
    "spotify-web-api-node": "^5.0.2",
    "zod": "^3.23.0",
    "ffmpeg-static": "^5.2.0",
    "libsodium-wrappers": "^0.7.15"
  },
  "devDependencies": {
    "@types/bun": "latest",
    "typescript": "^5.0.0",
    "@types/spotify-web-api-node": "^5.0.11"
  }
}
```

Nota: Removidas 7 dependências não usadas do bot.js original (node-fetch, spotify-web-api-js, youtube-dl-exec, youtube-search-api, yt-search, ytdl-core, ytpl, sanitize-filename). Removido `dotenv` pois Bun carrega `.env` nativamente.

**Arquivo: `tsconfig.json`**
```json
{
  "compilerOptions": {
    "lib": ["ESNext"],
    "target": "ESNext",
    "module": "ESNext",
    "moduleDetection": "force",
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true,
    "noEmit": true,
    "strict": true,
    "skipLibCheck": true,
    "noFallthroughCasesInSwitch": true,
    "noUnusedLocals": false,
    "noUnusedParameters": false,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "baseUrl": ".",
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

### Etapa 2: Config e Types

**Arquivo: `src/config/env.ts`**
- Usar `zod` para validar todas as env vars no startup
- Variáveis: `DISCORD_TOKEN`, `DISCORD_CLIENT_ID`, `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`
- `YOUTUBE_API_KEY` é opcional (play-dl não precisa)
- Exportar objeto `env` tipado
- Falhar imediatamente com mensagem clara se alguma var faltar

**Arquivo: `src/types/index.ts`**
```typescript
// Track source types
type TrackSource = 'youtube' | 'spotify';

// Loop modes
type LoopMode = 'off' | 'track' | 'queue';

// Track interface
interface Track {
  title: string;
  url: string;
  duration: number;        // em segundos
  thumbnail?: string;
  source: TrackSource;
  requestedBy: string;     // user tag que pediu
  artist?: string;         // para Spotify
  spotifyUrl?: string;     // URL original do Spotify (para display)
}

// Command interface
interface BotCommand {
  data: SlashCommandBuilder;
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
}
```

### Etapa 3: Client Setup

**Arquivo: `src/client.ts`**
- Criar Discord.js Client com intents: Guilds, GuildVoiceStates
- (Não precisa de GuildMessages/MessageContent pois não teremos prefix commands)
- Configurar event listeners: `ready`, `interactionCreate`
- Exportar client instance

### Etapa 4: Music Core

**Arquivo: `src/music/track.ts`**
- Exportar interfaces Track e TrackSource

**Arquivo: `src/music/queue.ts`**
- Classe `MusicQueue` com:
  - `tracks: Track[]`
  - `currentTrack: Track | null`
  - `connection: VoiceConnection | null`
  - `player: AudioPlayer`
  - `volume: number` (default 50)
  - `loopMode: LoopMode` (default 'off')
  - `textChannelId: string` — para enviar notificações
- Métodos: `addTrack()`, `playNext()`, `skip()`, `stop()`, `shuffle()`, `setVolume()`, `setLoop()`
- **Melhoria vs bot.js:** Singleton de conexão por guild — verifica se já está conectado antes de tentar reconectar (corrige race condition)
- **Melhoria vs bot.js:** Quando loop mode = 'track', re-adiciona a track atual ao início; quando 'queue', re-adiciona ao final
- Map global `queues: Map<string, MusicQueue>` exportado

**Arquivo: `src/music/player.ts`**
- Função `createAudioStream(track: Track): Promise<AudioResource>`
  - YouTube: `play-dl.stream(url)` direto
  - Spotify: busca no YouTube por `${track.title} ${track.artist}` e faz stream
  - Usar `createAudioResource` com `inlineVolume: true` para controle de volume
- **Melhoria vs bot.js:** Retorna erros descritivos ao invés de falhar silenciosamente

### Etapa 5: Sources

**Arquivo: `src/music/sources/youtube.ts`**
- `resolveYoutubeVideo(url: string): Promise<Track>`
- `resolveYoutubePlaylist(url: string): Promise<Track[]>`
- `searchYoutube(query: string): Promise<Track>`
- Usa `play-dl` para todas as operações

**Arquivo: `src/music/sources/spotify.ts`**
- Configurar `spotify-web-api-node` com client credentials
- Auto-refresh do token (com `setTimeout` como no bot.js, mas tipado)
- `resolveSpotifyTrack(url: string): Promise<Track>`
- `resolveSpotifyPlaylist(url: string): Promise<Track[]>`
- Nota: Audio vem do YouTube via bridge no momento do play, não no resolve

**Arquivo: `src/music/sources/index.ts`**
- `detectSource(input: string): { type: 'youtube_video' | 'youtube_playlist' | 'spotify_track' | 'spotify_playlist' | 'search', input: string }`
- `resolveTracks(input: string, requestedBy: string): Promise<Track[]>`
- Usa `play-dl.yt_validate()` e `play-dl.sp_validate()` para detecção

### Etapa 6: Utils

**Arquivo: `src/utils/embed.ts`**
- `nowPlayingEmbed(track: Track): EmbedBuilder` — com thumbnail, título, artista, duração formatada, quem pediu
- `queueEmbed(tracks: Track[], page: number): EmbedBuilder` — lista paginada (10 por página)
- `successEmbed(message: string): EmbedBuilder` — verde
- `errorEmbed(message: string): EmbedBuilder` — vermelho
- `infoEmbed(message: string): EmbedBuilder` — azul
- Cores padronizadas e formato consistente

**Arquivo: `src/utils/permissions.ts`**
- `requireVoiceChannel(interaction): GuildMember` — verifica se o user está num voice channel
- `requireSameVoiceChannel(interaction): void` — verifica se user está no mesmo canal que o bot
- `requireQueue(interaction): MusicQueue` — verifica se existe queue ativa
- Retorna mensagens de erro claras via embed

**Arquivo: `src/utils/logger.ts`**
- Logger simples com prefixo de timestamp e nível (info, warn, error)
- `[HH:MM:SS] [LEVEL] mensagem`

### Etapa 7: Slash Commands

Todos os comandos seguem o padrão:
1. Verificar permissões (user no voice channel, etc.)
2. Executar ação
3. Responder com embed

**Arquivo: `src/commands/play.ts`**
- `/play <query>` — parâmetro string obrigatório
- Detecta tipo de input (YouTube video/playlist, Spotify track/playlist, busca)
- Se não há queue, cria e conecta ao voice channel do user
- Adiciona tracks à queue
- Se é a primeira track, começa a tocar
- Responde com embed mostrando o que foi adicionado

**Arquivo: `src/commands/pause.ts`**
- Verifica se há player ativo, pausa
- Responde com embed de confirmação

**Arquivo: `src/commands/resume.ts`**
- Verifica se está pausado, retoma
- Responde com embed de confirmação

**Arquivo: `src/commands/skip.ts`**
- Pula para próxima track (respeitando loop mode)
- Responde com embed mostrando próxima track

**Arquivo: `src/commands/stop.ts`**
- Para player, limpa queue, desconecta do voice
- Responde com embed de confirmação

**Arquivo: `src/commands/queue.ts`**
- Mostra embed com lista de tracks (10 por página)
- Botões de navegação Previous/Next para paginação
- Mostra track atual destacada no topo

**Arquivo: `src/commands/nowplaying.ts`**
- Mostra embed com: título, artista, URL, thumbnail, duração, quem pediu
- Barra de progresso visual (▬▬▬🔘▬▬▬▬▬▬)

**Arquivo: `src/commands/volume.ts`**
- `/volume <level>` — integer 0-100
- Altera volume do AudioResource inline
- Responde com emoji de volume (🔇🔈🔉🔊) baseado no nível

**Arquivo: `src/commands/shuffle.ts`**
- Fisher-Yates shuffle na queue (mantém track atual)
- Responde com confirmação

**Arquivo: `src/commands/loop.ts`**
- `/loop <mode>` — choices: off, track, queue
- Altera loop mode na queue
- Responde com modo selecionado

**Arquivo: `src/commands/index.ts`**
- Coleta todos os comandos
- `deployCommands()` — registra slash commands via REST API no startup
- `handleInteraction()` — roteia interações para o comando correto

### Etapa 8: Entry Point

**Arquivo: `src/index.ts`**
```typescript
// 1. Validar env vars (falha imediatamente se inválido)
// 2. Inicializar Spotify client + auto-refresh
// 3. Registrar slash commands via REST
// 4. Configurar event handlers
// 5. Login do client
// 6. Graceful shutdown handler (SIGINT/SIGTERM)
```

### Etapa 9: Segurança

**Arquivo: `.env.example`**
```
DISCORD_TOKEN=seu_token_aqui
DISCORD_CLIENT_ID=seu_client_id_aqui
SPOTIFY_CLIENT_ID=seu_spotify_client_id
SPOTIFY_CLIENT_SECRET=seu_spotify_client_secret
```

- Remover `.env` do git tracking (`git rm --cached .env`)
- Recomendar rotação de tokens

### Etapa 10: Docker

**Arquivo: `Dockerfile`**
- Base: `oven/bun:latest`
- Multi-stage build para menor imagem
- Instalar ffmpeg via apt
- Copy package.json + bun.lock -> install -> copy src -> run

**Arquivo: `docker-compose.yml`**
- Service `miniboi` com env_file e restart policy

### Etapa 11: README

- Descrição do projeto
- Pré-requisitos (Bun, Discord bot token, Spotify app)
- Instruções de setup (.env, install, run)
- Lista de comandos com descrição
- Instruções Docker

---

## Fase 2: Bot em Go (Futuro — Para Estudos)

### Estrutura

```
miniboi-go/
├── cmd/miniboi/main.go
├── internal/
│   ├── config/config.go
│   ├── bot/bot.go
│   ├── commands/
│   │   ├── handler.go
│   │   ├── play.go
│   │   ├── pause.go
│   │   ├── skip.go
│   │   ├── stop.go
│   │   └── queue.go
│   ├── music/
│   │   ├── queue.go          # Queue com sync.Mutex
│   │   ├── player.go         # DCA encoding via yt-dlp + ffmpeg
│   │   ├── track.go
│   │   └── sources/
│   │       ├── youtube.go    # exec.Command("yt-dlp", ...)
│   │       └── spotify.go    # HTTP client para Spotify API
│   └── utils/logger.go
├── .env.example
├── go.mod
├── Dockerfile
└── README.md
```

### Diferenças e aprendizados em Go
- **Goroutines + channels** para player (goroutine de playback lê de um channel)
- **sync.Mutex** na Queue (thread-safe nativo)
- **Interfaces Go** — definir `TrackResolver` interface implementada por YouTube e Spotify
- **Error handling idiomático** — `if err != nil` pattern
- **exec.Command** para `yt-dlp`/`ffmpeg` (não há lib nativa equivalente ao play-dl)
- **DCA format** — Discord Compatible Audio, evita overhead de encoding em real-time
- **discordgo slash commands** — ApplicationCommand registration

### Será implementado depois da Fase 1 estar completa e funcional.

---

## Melhorias sobre o bot.js Original

| Aspecto | bot.js (atual) | miniboi-ts (novo) |
|---|---|---|
| Tipagem | Nenhuma (JS puro) | TypeScript strict |
| Comandos | Prefix `!` | Slash commands `/` |
| Feedback de erro | Silencioso | Embeds descritivos |
| Validação de env | Nenhuma | zod no startup |
| Permissões | Qualquer user controla | Verifica voice channel |
| Volume | Sem controle | /volume 0-100 |
| Loop | Sem suporte | off/track/queue |
| Shuffle | Sem suporte | Fisher-Yates |
| Now Playing | Sem suporte | Embed com progress bar |
| Queue display | Texto simples, max 10 | Embed com paginação |
| Deps | 15 (7 não usadas) | 7 (todas usadas) |
| Docker | Nenhum | Dockerfile + compose |
| Segurança | .env commitado | .env.example, gitignored |
| Logs | console.log | Logger com timestamp |
| Conexão voice | Race condition | Singleton por guild |

---

## Ordem de Implementação

1. Setup do projeto (package.json, tsconfig, bun install)
2. Config (env.ts + .env.example)
3. Types (types/index.ts)
4. Logger (utils/logger.ts)
5. Client (client.ts)
6. Track types (music/track.ts)
7. Sources: YouTube (music/sources/youtube.ts)
8. Sources: Spotify (music/sources/spotify.ts)
9. Source detector (music/sources/index.ts)
10. Queue (music/queue.ts)
11. Player (music/player.ts)
12. Embed helpers (utils/embed.ts)
13. Permission guards (utils/permissions.ts)
14. Comandos: play, pause, resume, skip, stop
15. Comandos: queue, nowplaying, volume, shuffle, loop
16. Command registry + deploy (commands/index.ts)
17. Entry point (index.ts)
18. Segurança (.env cleanup)
19. Docker (Dockerfile, docker-compose.yml)
20. README.md
