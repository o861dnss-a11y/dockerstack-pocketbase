#!/bin/sh
# ================================================================
#  entrypoint.sh — PocketBase + Litestream startup
#
#  Litestream v0.3.x dùng -exec "cmd" (không phải -- cmd)
#
#  Modes:
#    LITESTREAM_INIT_MODE=false (default)
#      → bắt buộc restore data.db từ S3 trước khi khởi động
#      → exit 1 nếu không tìm thấy backup (bảo vệ dữ liệu)
#
#    LITESTREAM_INIT_MODE=true
#      → bỏ qua restore, tạo database mới (chạy lần đầu tiên)
#      → PocketBase sẽ tự khởi tạo pb_data/data.db
#      → Cấu hình xong → dừng container → tắt INIT_MODE
# ================================================================
set -e

DATA_DIR="${DATA_DIR:-/pb/pb_data}"
DB_PATH="${DATA_DIR}/data.db"

mkdir -p "$DATA_DIR"

if [ "${LITESTREAM_INIT_MODE:-false}" = "true" ]; then
  echo "🟡 [INIT MODE] Bỏ qua restore S3."
  echo "   PocketBase sẽ tạo database mới tại: $DB_PATH"
  echo "   Data sẽ được Litestream replicate lên S3 sau khi khởi động."
  echo "   → Truy cập /_/ để setup admin, sau đó dừng container"
  echo "   → Tắt LITESTREAM_INIT_MODE để chạy mode bình thường"
else
  echo "🔄 [RESTORE] Đang restore data.db từ S3..."

  if ! litestream restore \
      -config /etc/litestream.yml \
      -if-replica-exists \
      "$DB_PATH"; then
    echo ""
    echo "❌ [ERROR] Lỗi khi restore từ S3."
    echo "   Kiểm tra: LITESTREAM_S3_ENDPOINT, LITESTREAM_S3_BUCKET,"
    echo "             LITESTREAM_S3_ACCESS_KEY_ID, LITESTREAM_S3_SECRET_ACCESS_KEY"
    echo "   Nếu chạy lần đầu: set LITESTREAM_INIT_MODE=true"
    exit 1
  fi

  if [ ! -f "$DB_PATH" ]; then
    echo ""
    echo "❌ [ERROR] Không tìm thấy backup trên S3 (replica không tồn tại)."
    echo "   PocketBase không khởi động để tránh mất dữ liệu."
    echo "   → Chạy lần đầu: đặt LITESTREAM_INIT_MODE=true để khởi tạo"
    exit 1
  fi

  echo "✅ [RESTORE] Xong: $DB_PATH ($(du -sh "$DB_PATH" | cut -f1))"
fi

echo "🚀 Khởi động PocketBase + Litestream replication..."
echo "   → DB path  : $DB_PATH"
echo "   → S3 bucket: ${LITESTREAM_S3_BUCKET}"
echo "   → S3 path  : ${LITESTREAM_S3_PATH}"

# Litestream v0.3.x: dùng -exec "cmd args" để spawn subprocess
# $@ = CMD từ Docker = ./pocketbase serve --http=0.0.0.0:PORT --dir=/pb/pb_data
if [ $# -gt 0 ]; then
  PB_CMD="$*"
else
  PB_CMD="./pocketbase serve --http=0.0.0.0:8090 --dir=/pb/pb_data"
fi

echo "   → exec: $PB_CMD"
exec litestream replicate -config /etc/litestream.yml -exec "$PB_CMD"
