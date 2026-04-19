FROM oven/bun:1 AS base

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY src ./src

FROM base AS runner
RUN apt-get update && \
    apt-get install -y ffmpeg python3 python3-pip && \
    pip3 install yt-dlp && \
    rm -rf /var/lib/apt/lists/*

CMD ["bun", "run", "src/index.ts"]
