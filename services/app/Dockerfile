# ================================================================
#  services/app/Dockerfile
#  PocketBase + Litestream (SQLite → S3 replication)
#
#  Build args:
#    PB_VERSION  — phiên bản PocketBase (default: 0.28.2)
#
#  Startup flow:
#    entrypoint.sh → restore/skip S3 → litestream replicate
#      → pocketbase serve --http=0.0.0.0:${PORT} --dir=/pb/pb_data
# ================================================================

# ── Stage 1: lấy litestream binary ─────────────────────────────
FROM litestream/litestream:0.3.13 AS litestream-bin

# ── Stage 2: PocketBase trên Alpine ────────────────────────────
FROM alpine:3.19

ARG PB_VERSION=0.28.2

# wget + unzip để tải pocketbase; ca-certificates cho HTTPS
RUN apk add --no-cache ca-certificates wget unzip \
    && wget -q \
       "https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_amd64.zip" \
       -O /tmp/pocketbase.zip \
    && unzip /tmp/pocketbase.zip -d /pb \
    && rm /tmp/pocketbase.zip \
    && chmod +x /pb/pocketbase

# Copy litestream binary từ stage 1
COPY --from=litestream-bin /usr/local/bin/litestream /usr/local/bin/litestream

# Copy litestream config và entrypoint
COPY litestream.yml /etc/litestream.yml
COPY entrypoint.sh  /entrypoint.sh
RUN chmod +x /entrypoint.sh

WORKDIR /pb

# PocketBase data
VOLUME ["/pb/pb_data"]

EXPOSE 8090

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:8090/api/health || exit 1

ENTRYPOINT ["/entrypoint.sh"]
# CMD được forward qua $@ vào entrypoint → litestream replicate -exec "CMD"
CMD ["./pocketbase", "serve", "--http=0.0.0.0:8090", "--dir=/pb/pb_data"]
