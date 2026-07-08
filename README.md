# Financeiro Paroquial

Aplicativo desktop nativo (Tauri + React + TypeScript) para a gestão financeira de paróquias e comunidades católicas. Versão enxuta do Sistema de Gestão Paroquial, contendo apenas o módulo financeiro e os cadastros de apoio.

## Funcionalidades

- **Movimento do Caixa** — lançamentos de entradas e saídas por comunidade/unidade (dinheiro e PIX), com relatório diário e preview mensal
- **Histórico** — consulta de lançamentos de períodos anteriores
- **Repasses** — cálculo em cascata da partilha (comunidade, área missionária/paróquia, arquidiocese/diocese e fundo missionário)
- **Cadastros** — comunidades, fiéis e dizimistas (alimentam o seletor de unidade e os lançamentos de dízimo)
- **Sistema** — usuários com papéis e permissões, backup/restauração, personalização da paróquia

Os dados são armazenados localmente em SQLite, sem dependência de internet.

## Instalação no macOS

O app ainda não é assinado/notarizado pela Apple, então o `.dmg` baixado pelo navegador é bloqueado pelo Gatekeeper com a mensagem **"está danificado e não pode ser aberto"**. Instale colando este comando no **Terminal** (⌘+Espaço → digite "Terminal"):

```bash
curl -fsSL https://raw.githubusercontent.com/EderSGC/paroquia-financeiro/main/scripts/instalar-mac.sh | bash
```

O comando baixa a versão mais recente correta para o seu Mac (Apple Silicon ou Intel), instala em `/Applications` e abre o app. Como o download é feito pelo Terminal, o macOS não aplica a quarentena e o app abre normalmente.

Alternativa manual: baixe o `.dmg` pela página de releases e, antes de abri-lo, rode `xattr -d com.apple.quarantine ~/Downloads/nome-do-arquivo.dmg`.

As atualizações seguintes chegam automaticamente pelo updater interno do app — o bloqueio só afeta a primeira instalação.

## Stack

- Frontend: React 19 + TypeScript + Vite
- Desktop shell: Tauri 2
- Banco local: SQLite via plugin SQL do Tauri

## Desenvolvimento

- `npm install` — instala as dependências
- `npm run tauri dev` — inicia o app desktop em desenvolvimento
- `npm test` — roda a suíte de testes (Vitest)
- `npx tsc --noEmit` — valida os tipos

## Distribuição

Os instaladores de macOS (Apple Silicon e Intel), Windows e Linux são gerados pelo GitHub Actions ao publicar uma tag `v*` (ver `.github/workflows/release.yml`). O updater automático consome o `latest.json` publicado em cada release.
