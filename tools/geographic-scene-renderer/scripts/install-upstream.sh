#!/usr/bin/env bash
set -euo pipefail
repo_root="$(git rev-parse --show-toplevel)"
runtime_root="$repo_root/runtime/geographic-scene-renderer"
checkout="$runtime_root/upstream/gods-eye-view"
commit="aa16b7c3b0166a89d8c7a6089e0aff53a22faaee"
mkdir -p "$runtime_root/upstream" "$runtime_root/browser-cache"
if [[ ! -d "$checkout/.git" ]]; then
  git clone https://github.com/bilawalsidhu/gods-eye-view "$checkout"
fi
git -C "$checkout" fetch origin "$commit"
git -C "$checkout" checkout --detach "$commit"
env PUPPETEER_CACHE_DIR="$runtime_root/browser-cache" npm --prefix "$checkout" ci
env PUPPETEER_CACHE_DIR="$runtime_root/browser-cache" "$checkout/node_modules/.bin/puppeteer" browsers install chrome
printf 'Installed God\x27s Eye View %s under ignored lab runtime.\n' "$commit"
