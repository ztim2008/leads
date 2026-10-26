#!/usr/bin/env bash
# Веса слоя «Внимание» Рентгена: MSI-Net, дообученная на UEyes (khawkins98/foveacast-training, MIT).
# Вариант «первый взгляд, 1 с», int8. В git не кладём — качаем и сверяем SHA256.
set -euo pipefail
cd "$(dirname "$0")/.."
URL="https://github.com/khawkins98/foveacast-training/releases/download/v0.2.0/foveacast-v3-1s-int8.onnx"
DEST="models/rentgen/foveacast-v3-1s-int8.onnx"
SHA="3d94ce75c9500b61924193a03a098fa1fa704f39fbbf2ea7083ecc00796fab2b"
mkdir -p "$(dirname "$DEST")"
if [ -f "$DEST" ] && echo "$SHA  $DEST" | sha256sum -c --status; then
  echo "ok: $DEST"
  exit 0
fi
curl -fsSL -o "$DEST.part" "$URL"
echo "$SHA  $DEST.part" | sha256sum -c --status || { rm -f "$DEST.part"; echo "SHA256 не совпал"; exit 1; }
mv "$DEST.part" "$DEST"
echo "ok: $DEST"
