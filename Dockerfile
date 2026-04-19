FROM oven/bun:1 AS base

WORKDIR /app

# Install dependencies only when needed
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Copy source
COPY src ./src

# Production image
FROM base AS runner
RUN apt-get update && apt-get install -y ffmpeg && rm -rf /var/lib/apt/lists/*

EXPOSE 3000

CMD ["bun", "run", "src/index.ts"]
