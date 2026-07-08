#!/bin/bash
# Instalador do Financeiro Paroquial para macOS.
#
# Por que este script existe: o app não é assinado/notarizado pela Apple,
# então o .dmg baixado pelo navegador recebe a marca de quarentena e o
# Gatekeeper bloqueia com "está danificado e não pode ser aberto".
# Downloads feitos via curl não recebem quarentena — este script baixa a
# versão mais recente, instala em /Applications e abre o app.
#
# Uso (cole no Terminal):
#   curl -fsSL https://raw.githubusercontent.com/EderSGC/paroquia-financeiro/main/scripts/instalar-mac.sh | bash
set -euo pipefail

REPO="EderSGC/paroquia-financeiro"

ARCH=$(uname -m)
if [ "$ARCH" = "arm64" ]; then
  PADRAO="aarch64.dmg"
else
  PADRAO="x64.dmg"
fi

echo "🔎 Buscando a versão mais recente do Financeiro Paroquial ($ARCH)..."
URL=$(curl -fsSL "https://api.github.com/repos/$REPO/releases/latest" \
  | grep -o "https://[^\"]*_$PADRAO" | head -1)

if [ -z "$URL" ]; then
  echo "❌ Não foi possível encontrar o instalador para $ARCH na última release." >&2
  exit 1
fi

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

echo "⬇️  Baixando $(basename "$URL")..."
curl -fL --progress-bar "$URL" -o "$TMP/app.dmg"

# curl não marca quarentena, mas remove por garantia (ex.: proxies corporativos)
xattr -d com.apple.quarantine "$TMP/app.dmg" 2>/dev/null || true

echo "📦 Instalando em /Applications..."
MNT=$(hdiutil attach "$TMP/app.dmg" -nobrowse | grep -o "/Volumes/.*" | head -1)
APP_ORIGEM=$(ls -d "$MNT"/*.app | head -1)
APP_NOME=$(basename "$APP_ORIGEM")

# Fecha o app se estiver aberto e substitui a versão antiga
osascript -e "quit app \"${APP_NOME%.app}\"" 2>/dev/null || true
rm -rf "/Applications/$APP_NOME"
ditto "$APP_ORIGEM" "/Applications/$APP_NOME"
hdiutil detach "$MNT" -quiet

echo "✅ Instalado com sucesso!"
open "/Applications/$APP_NOME"
