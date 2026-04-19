FROM oven/bun:1 AS base

# Prevent interactive prompts during build
ENV DEBIAN_FRONTEND=noninteractive

# Install system dependencies with better error resilience
# python3-is-python3 provides the 'python' command that youtube-dl-exec looks for
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    ffmpeg \
    python3 \
    python3-is-python3 \
    python3-pip \
    curl \
    ca-certificates && \
    # Install yt-dlp directly via curl (more reliable than pip in slim images)
    curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp && \
    chmod a+rx /usr/local/bin/yt-dlp && \
    # Cleanup to keep image small
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy dependency files first
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Copy source code
COPY src ./src

# Set production environment
ENV NODE_ENV=production

CMD ["bun", "run", "src/index.ts"]
