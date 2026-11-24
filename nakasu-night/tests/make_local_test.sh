#!/usr/bin/env bash
# CDNのthree.jsをnode_modulesに差し替えた web/test.html を作る（オフラインでの自動テスト用）
cd "$(dirname "$0")/.."
sed -e 's#https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js#../node_modules/three/build/three.min.js#' \
    -e 's#https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/#../node_modules/three/examples/js/#g' \
    web/index.html > web/test.html
echo "web/test.html を作成しました"
