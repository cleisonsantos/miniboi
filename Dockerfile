FROM oven/bun:1 AS base

# Install system dependencies (Python and FFmpeg) early
# This is required for the preinstall script of youtube-dl-exec
RUN apt-get update && \
    apt-get install -y ffmpeg python3 python3-pip && \
    pip3 install yt-dlp && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY src ./src

# Set production environment
ENV NODE_ENV=production

CMD ["bun", "run", "src/index.ts"]
