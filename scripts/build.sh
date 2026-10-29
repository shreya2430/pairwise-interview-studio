#!/bin/sh
# Builds two outputs from src/:
#   index.html          standalone page for GitHub Pages (or any static host)
#   build/artifact.html page fragment for a claude.ai Artifact (the host adds the document skeleton)
set -e
cd "$(dirname "$0")/.."
CM=https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.16
mkdir -p build
{
  echo '<title>Pairwise Interview Studio</title>'
  echo '<meta name="claude:viewport-fit-sides" content="cover">'
  echo '<meta name="description" content="Practice AI-assisted coding interviews: a coding assistant, a fixed token budget, real tests and a structured scorecard.">'
  echo '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
  echo '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&family=Schibsted+Grotesk:wght@400;500;600;700&display=swap">'
  echo '<style>'; cat src/vendor/codemirror-5.65.16.min.css; echo; cat src/style.css; echo '</style>'
  cat src/body.html
  for f in codemirror.min.js mode/javascript/javascript.min.js addon/edit/closebrackets.min.js addon/edit/matchbrackets.min.js; do echo "<script src=\"$CM/$f\"></script>"; done
  echo '<script>'; cat src/problems.js; echo '</script>'
  echo '<script>'; cat src/app.js; echo '</script>'
} > build/artifact.html
{
  printf '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n'
  printf '<link rel="icon" href="data:image/svg+xml,%%3Csvg xmlns=%%27http://www.w3.org/2000/svg%%27 viewBox=%%270 0 24 24%%27%%3E%%3Crect x=%%272%%27 y=%%272%%27 width=%%2720%%27 height=%%2720%%27 rx=%%274%%27 fill=%%27%%23141a22%%27/%%3E%%3Cpath d=%%27M7 8.5 10 12l-3 3.5%%27 fill=%%27none%%27 stroke=%%27white%%27 stroke-width=%%272%%27 stroke-linecap=%%27round%%27/%%3E%%3Cpath d=%%27M12.5 15.5H17%%27 stroke=%%27%%232b48c9%%27 stroke-width=%%272%%27 stroke-linecap=%%27round%%27/%%3E%%3C/svg%%3E">\n'
  printf '<style>:root{color-scheme:light;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0;font:14px system-ui}img{max-width:100%%}[hidden]{display:none!important}</style>\n</head>\n<body>\n'
  cat build/artifact.html
  printf '\n</body>\n</html>\n'
} > index.html
echo "Built index.html ($(wc -c < index.html) bytes) and build/artifact.html"
