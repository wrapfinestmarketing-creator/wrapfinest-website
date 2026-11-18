#!/usr/bin/env bash
# Turns source clips and stills into the web frame sequences used by src/film.js.
# Usage: tools/build-film.sh <assets-dir>   (expects <assets>/film-src/*.mp4 and <assets>/stills/*.png)
set -euo pipefail
SRC="${1:?assets dir}"; OUT="$(cd "$(dirname "$0")/.." && pwd)/public/film"; N="${FRAMES:-64}"
mkdir -p "$OUT/stills"
seqs=""
for v in "$SRC"/film-src/*.mp4; do
  [ -e "$v" ] || continue
  name="$(basename "$v" .mp4)"
  if [ -n "${ONLY:-}" ] && ! echo " $ONLY " | grep -q " $name "; then continue; fi
  dur="$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$v")"
  fps="$(python3 -c "print(($N-0.5)/float('$dur'))")"
  rm -rf "$OUT/$name"; mkdir -p "$OUT/$name/d" "$OUT/$name/m"
  ffmpeg -v error -y -i "$v" -vf "fps=$fps,scale=1440:-2:flags=lanczos" -frames:v "$N" -c:v libwebp -q:v 60 -compression_level 5 "$OUT/$name/d/%04d.webp"
  ffmpeg -v error -y -i "$v" -vf "fps=$fps,scale=800:-2:flags=lanczos" -frames:v "$N" -c:v libwebp -q:v 58 -compression_level 5 "$OUT/$name/m/%04d.webp"
  echo "$name: $(ls "$OUT/$name/d" | wc -l) frames, $(du -sh "$OUT/$name/d" | cut -f1) desktop, $(du -sh "$OUT/$name/m" | cut -f1) mobile"
done
for d in "$OUT"/*/d; do name="$(basename "$(dirname "$d")")"; n="$(ls "$d" | wc -l)"; seqs="$seqs\"$name\":{\"n\":$n},"; done
stills=""
for s in "$SRC"/stills/*.png; do
  [ -e "$s" ] || continue
  name="$(basename "$s" .png)"
  stills="$stills\"$name\","
  if [ -n "${ONLY:-}" ] && [ -e "$OUT/stills/$name-d.webp" ]; then continue; fi
  ffmpeg -v error -y -i "$s" -vf "scale=1920:-2:flags=lanczos" -c:v libwebp -q:v 80 "$OUT/stills/$name-d.webp"
  ffmpeg -v error -y -i "$s" -vf "scale=1200:-2:flags=lanczos" -c:v libwebp -q:v 72 "$OUT/stills/$name-m.webp"
done
echo "{\"seqs\":{${seqs%,}},\"stills\":[${stills%,}]}" > "$(dirname "$OUT")/../src/film-manifest.json"
echo "stills: $(ls "$OUT/stills" | wc -l) files, $(du -sh "$OUT/stills" | cut -f1)"; du -sh "$OUT"
