FROM oven/bun:1 AS base

# Prevent interactive prompts during build
ENV DEBIAN_FRONTEND=noninteractive

# Install system dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    ffmpeg \
    python3 \
    python3-pip \
    curl \
    ca-certificates && \
    # Manually create symbolic link for python (required by youtube-dl-exec)
    ln -s /usr/bin/python3 /usr/bin/python && \
    # Install yt-dlp directly via curl
    curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp && \
    chmod a+rx /usr/local/bin/yt-dlp && \
    # Cleanup
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy dependency files first
COPY package.json bun.lock ./
# Skip python check and internal binary download during bun install
ENV YOUTUBE_DL_SKIP_PYTHON_CHECK=1
RUN bun install --frozen-lockfile

# Copy source code
COPY src ./src

# Set production environment
ENV NODE_ENV=production

CMD ["bun", "run", "src/index.ts"]
