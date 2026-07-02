# 🏰 Sistema Paroquial - Guia de Execução e Troubleshooting

## ✅ Correções Implementadas

Este guia documenta as correções e melhorias realizadas no sistema para resolver os problemas de tela branca e usuário não salvo.

### 🔧 Melhorias Principais

1. **App.tsx - Tela Branca Corrigida**
   - ✅ Adicionado estado de carregamento (`tentandoCarregar`)
   - ✅ Adicionado estado de erro (`erroCarregamento`)
   - ✅ Removido retorno `null` (causa tela branca)
   - ✅ Adicionada tela de erro com opção de recarregar

2. **Autenticação Melhorada**
   - ✅ Logging detalhado em autenticarUsuario()
   - ✅ Validações rigorosas de login/senha
   - ✅ Sanitização de dados de entrada
   - ✅ Tratamento de erro melhorado com mensagens específicas

3. **Setup Inicial Aprimorado**
   - ✅ Validações em cada campo
   - ✅ Suporte a atualização se paróquia já existe
   - ✅ Verificação de usuário duplicado
   - ✅ Logging de cada etapa do setup

4. **Database Robusto**
   - ✅ Melhor tratamento de conexão
   - ✅ Erros mais descritivos
   - ✅ Constraints NOT NULL nas tabelas críticas
   - ✅ Índice UNIQUE na coluna login

5. **Validadores de Dados**
   - ✅ Novo arquivo `validators.ts` com funções de validação
   - ✅ Sanitização de entrada
   - ✅ Formatação de CEP e CNPJ

6. **Debug e Logging**
   - ✅ Novo arquivo `debug.ts` com sistema de logging centralizado
   - ✅ Histórico de logs com limite de 500 entradas
   - ✅ Cores diferentes por nível (info, warn, error, debug)

---

## 🚀 Como Executar

### Pré-requisitos
- Node.js 18+ instalado
- Rust (para Tauri)
- npm ou yarn

### Desenvolvimento

```bash
# Instalar dependências
npm install

# Executar em modo desenvolvimento
npm run dev

# Em outro terminal, executar o Tauri dev
npm run tauri dev
```

### Build para Produção

```bash
# Build e empacotamento
npm run build
npm run tauri build
```

---

## 🐛 Problemas Comuns e Soluções

### ❌ Problema: Tela branca ao iniciar o app

**Causas Possíveis:**
- Banco de dados não inicializado
- Erro ao carregar paróquia
- Estado inválido no React

**Solução:**
1. Abra o console do desenvolvedor (F12)
2. Procure por mensagens de erro vermelhas
3. Se ver "Erro ao carregar dados", clique em "Recarregar página"
4. Se persistir, delete o arquivo `pastoral.db` e reinicie

### ❌ Problema: Usuário não salva após login

**Causas Possíveis:**
- Credenciais incorretas (verificar no banco de dados)
- Erro na autenticação silencioso
- Estado React não atualizado

**Solução:**
1. Abra o console (F12 ou View > Toggle Developer Tools)
2. Procure por "Autenticação bem-sucedida" ou "Falha na autenticação"
3. Se não logar, tente "Esqueci minha senha" para resetar
4. Verifique o banco de dados com ferramentas de SQLite

### ❌ Problema: Erro ao salvar paróquia no setup

**Causas Possíveis:**
- Banco de dados não pode ser escrito
- Campos obrigatórios vazios
- Conflito de dados duplicados

**Solução:**
1. Verifique todos os campos obrigatórios (marcados com *)
2. Nome de paróquia deve ter pelo menos 3 caracteres
3. Login deve conter apenas letras, números, pontos ou hífens
4. Senha deve ter no mínimo 6 caracteres
5. Se erro persistir, delete `pastoral.db` e reconfigure

### ❌ Problema: Erro de conexão ao banco de dados

**Causas Possíveis:**
- Plugin SQLite não carregou
- Arquivo `pastoral.db` corrompido
- Permissões de arquivo incorretas

**Solução:**
```bash
# Delete o banco de dados
rm ~/AppData/Local/paroquia-app/pastoral.db  # Windows
rm ~/Library/Application\ Support/paroquia-app/pastoral.db  # macOS
rm ~/.local/share/paroquia-app/pastoral.db  # Linux

# Reinicie o app - novo banco será criado
```

---

## 🔍 Como Debugar

### Ativar Modo Debug

Abra o console do navegador (F12) e execute:

```javascript
// Ver histórico de logs
window.localStorage.setItem('debug', 'true');

// Recarregar página
window.location.reload();
```

### Consultar Logs do Sistema

```javascript
// Importar debug utils (disponível após correções)
import { getLogs, getErrorSummary } from '@/core/utils/debug';

// Ver todos os logs
console.log(getLogs());

// Ver apenas erros
console.log(getLogs('error'));

// Ver resumo de erros
console.log(getErrorSummary());
```

### Verificar Banco de Dados Diretamente

```bash
# Instalar SQLite CLI (se necessário)
brew install sqlite3  # macOS
sudo apt install sqlite3  # Linux
# Windows: https://www.sqlite.org/download.html

# Abrir banco de dados
sqlite3 ~/Library/Application\ Support/paroquia-app/pastoral.db

# Ver usuários cadastrados
SELECT * FROM usuarios;

# Ver paróquias cadastradas
SELECT * FROM paroquia;

# Sair
.quit
```

---

## 📝 Fluxo de Funcionamento

```
Iniciar App
    ↓
SplashScreen (2.8s)
    ↓
Carregar Paróquia do DB
    ├─ Se não existe → SetupScreen
    └─ Se existe → LoginScreen
        ↓
    Autenticar Usuário
        ├─ Sucesso → MainApp
        └─ Erro → Mostrar mensagem + tentar novamente
```

---

## 🔐 Segurança

### ⚠️ Aviso: Dados Sensíveis

**Importante:** Nunca commite o arquivo `pastoral.db` no Git!

Adicione ao `.gitignore`:
```
*.db
*.db-wal
*.db-shm
pastoral.db
```

### Padrões de Segurança Implementados

1. ✅ Validação de entrada em todos os campos
2. ✅ Sanitização de strings
3. ✅ Login com UNIQUE constraint no DB
4. ✅ Trim de espaços em branco
5. ✅ Comparação case-insensitive para login

---

## 📊 Monitoramento em Produção

### Acessar Logs de Erro

```javascript
// No console do Tauri
import { invoke } from '@tauri-apps/api/core';

// Ler logs do sistema
invoke('read_logs').then(console.log);
```

### Backup de Dados

```bash
# Copiar banco de dados para segurança
cp ~/Library/Application\ Support/paroquia-app/pastoral.db ./backup-$(date +%Y%m%d-%H%M%S).db
```

---

## ✨ Próximos Passos

- [ ] Implementar autosave de dados
- [ ] Adicionar criptografia de senhas (bcrypt)
- [ ] Backup automático do banco de dados
- [ ] Sincronização em nuvem
- [ ] Notificações de erro por email
- [ ] Dashboard de monitoramento

---

## 📞 Suporte

Se encontrar problemas:

1. **Verificar logs** → F12 → Console
2. **Recarregar app** → Ctrl+R ou Cmd+R
3. **Limpar cache** → Delete dados do app
4. **Reinstalar** → npm install && npm run tauri dev

---

**Última atualização:** 15 de maio de 2026
**Versão do Sistema:** 0.1.0
