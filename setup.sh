#!/bin/bash
# Script de Setup - Sistema Paroquial

echo "🎉 Bem-vindo ao Sistema Paroquial!"
echo "================================"
echo ""

# Verificar Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js não encontrado. Por favor instale: https://nodejs.org/"
    exit 1
fi

echo "✅ Node.js $(node --version) encontrado"

# Verificar npm
if ! command -v npm &> /dev/null; then
    echo "❌ npm não encontrado"
    exit 1
fi

echo "✅ npm $(npm --version) encontrado"

# Instalar dependências
echo ""
echo "📦 Instalando dependências..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ Erro ao instalar dependências"
    exit 1
fi

echo "✅ Dependências instaladas"

# Aviso de desenvolvimento
echo ""
echo "================================"
echo "🚀 Para iniciar em desenvolvimento:"
echo "================================"
echo ""
echo "Terminal 1 (Vite dev server):"
echo "  npm run dev"
echo ""
echo "Terminal 2 (Tauri app):"
echo "  npm run tauri dev"
echo ""
echo "================================"
echo "📱 Para build de produção:"
echo "================================"
echo ""
echo "  npm run build && npm run tauri build"
echo ""
echo "================================"
echo "📖 Documentação:"
echo "================================"
echo ""
echo "  • TROUBLESHOOTING.md - Problemas comuns e soluções"
echo "  • DEVELOPMENT.md - Guia de desenvolvimento"
echo "  • CHANGELOG_FIXES.md - Todas as correções realizadas"
echo ""
echo "✨ Sistema pronto para ser iniciado!"
