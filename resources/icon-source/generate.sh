#!/bin/bash
# Generate the BrzA app icons from the SVG sources in resources/brand/ (PLN-007, D7)
# Produces: resources/build/icon.icns (macOS), resources/build/icon.png (fallback and Windows source),
# resources/build/icon.ico, resources/icon.png, resources/icon-dev.png, resources/app-icons/*.png,
# resources/tray/*Template.png
# Requires: rsvg-convert (brew install librsvg) and iconutil (macOS). The brand SVGs come from
# config/scripts/brza-brand-build.mjs; resources/icon-source/icon.icon is no longer read.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$(dirname "$SCRIPT_DIR")")"
BUILD_DIR="$PROJECT_DIR/resources/build"
RESOURCES_DIR="$PROJECT_DIR/resources"
TMP_DIR=$(mktemp -d)

trap 'rm -rf "$TMP_DIR"' EXIT

RSVG_BIN=$(command -v rsvg-convert || true)
if [ -z "$RSVG_BIN" ]; then
  echo "Error: rsvg-convert is required to render the BrzA icons." >&2
  echo "Install with: brew install librsvg" >&2
  exit 1
fi

BRAND_DIR="$RESOURCES_DIR/brand"
ICONSET_DIR="$TMP_DIR/icon.iconset"
mkdir -p "$ICONSET_DIR"
render() { "$RSVG_BIN" -w "$2" -h "$3" "$BRAND_DIR/$1" -o "$4"; }

echo "Rendering icons from $BRAND_DIR..."

# The small slots show the tile and the flame without the seal.
for spec in 16:icon_16x16 32:icon_16x16@2x 32:icon_32x32 64:icon_32x32@2x; do
  render brza-symbol.svg "${spec%%:*}" "${spec%%:*}" "$ICONSET_DIR/${spec#*:}.png"
done
for spec in 128:icon_128x128 256:icon_128x128@2x 256:icon_256x256 512:icon_256x256@2x 512:icon_512x512 1024:icon_512x512@2x; do
  render brza-app-icon.svg "${spec%%:*}" "${spec%%:*}" "$ICONSET_DIR/${spec#*:}.png"
done
iconutil -c icns "$ICONSET_DIR" -o "$BUILD_DIR/icon.icns"
echo "  -> resources/build/icon.icns"

cp "$ICONSET_DIR/icon_512x512@2x.png" "$BUILD_DIR/icon.png"
echo "  -> resources/build/icon.png (1024x1024)"

render brza-symbol.svg 256 256 "$RESOURCES_DIR/icon.png"
echo "  -> resources/icon.png (256x256)"
render brza-symbol-dev.svg 256 256 "$RESOURCES_DIR/icon-dev.png"
echo "  -> resources/icon-dev.png (256x256)"

# The file names keep the upstream orca-* ids because the app-icon picker imports them.
cp "$BUILD_DIR/icon.png" "$RESOURCES_DIR/app-icons/orca-watercolor.png"
render brza-symbol-light.svg 1024 1024 "$RESOURCES_DIR/app-icons/orca-blue.png"
echo "  -> resources/app-icons/orca-watercolor.png, orca-blue.png"

render brza-tray-template.svg 22 14 "$RESOURCES_DIR/tray/orca-menu-barTemplate.png"
render brza-tray-template.svg 44 28 "$RESOURCES_DIR/tray/orca-menu-barTemplate@2x.png"
echo "  -> resources/tray/orca-menu-barTemplate.png, @2x"

# #5357: Windows scales the 1024px render with its 100px margin into undersized taskbar/Open-with icons.
# Use the repo's pngjs trim script to remove the margin, re-square with 2% margin and emit multi-size ICO,
# keeping committed output reproducible without ImageMagick.
node "$PROJECT_DIR/config/scripts/trim-windows-icon-source.mjs"
echo "  -> resources/build/icon.ico (trimmed, filled multi-size ICO)"

echo "Done! Icons generated in resources/build/ and resources/"
