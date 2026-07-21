FROM oven/bun:1.3.14@sha256:e10577f0db68676a7024391c6e5cb4b879ebd17188ab750cf10024a6d700e5c4

ARG YT_DLP_VERSION=2026.07.04
ARG YT_DLP_SHA256=495be29ff4d9d4e9be7eabdfef225221e5d5282e77f2f505abc6dca80349f3fd

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      ca-certificates \
      curl \
      ffmpeg \
      python3 && \
    ln -sf /usr/bin/python3 /usr/bin/python && \
    curl --fail --location --retry 3 --proto '=https' \
      "https://github.com/yt-dlp/yt-dlp/releases/download/${YT_DLP_VERSION}/yt-dlp" \
      -o /tmp/yt-dlp && \
    echo "${YT_DLP_SHA256}  /tmp/yt-dlp" | sha256sum --check --strict && \
    install -m 0755 /tmp/yt-dlp /usr/local/bin/yt-dlp && \
    rm /tmp/yt-dlp && \
    apt-get purge -y --auto-remove curl && \
    rm -rf /var/lib/apt/lists/*

ENV YOUTUBE_DL_DIR=/usr/local/bin \
    YOUTUBE_DL_FILENAME=yt-dlp \
    YOUTUBE_DL_SKIP_DOWNLOAD=1 \
    YOUTUBE_DL_SKIP_PYTHON_CHECK=1

RUN mkdir -p /app && chown bun:bun /app
WORKDIR /app
USER bun

COPY --chown=bun:bun package.json bun.lock ./
RUN bun install --production --frozen-lockfile --omit=optional

COPY --chown=bun:bun src ./src

ENV NODE_ENV=production \
    HOME=/tmp \
    XDG_CACHE_HOME=/tmp/.cache \
    HEALTH_HOST=0.0.0.0 \
    HEALTH_PORT=3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD ["bun", "-e", "try { const port = process.env.HEALTH_PORT ?? '3000'; const response = await fetch('http://127.0.0.1:' + port + '/health/ready'); process.exit(response.ok ? 0 : 1); } catch { process.exit(1); }"]

CMD ["bun", "run", "src/index.ts"]
