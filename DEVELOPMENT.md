# 📖 Guia de Boas Práticas - Sistema Paroquial

## 🎯 Objetivo

Este documento padroniza o desenvolvimento do Sistema Paroquial, garantindo código profissional, manutenível e escalável.

---

## 🏗️ Arquitetura

### Estrutura de Pastas

```
src/
├── core/                    # Lógica compartilhada
│   ├── config/             # Configurações centralizadas
│   │   └── constants.ts    # Todas as constantes
│   ├── types/              # TypeScript interfaces
│   │   └── app.types.ts    # Tipos da aplicação
│   ├── ui/                 # Componentes UI compartilhados
│   └── utils/              # Funções utilitárias
│       ├── debug.ts        # Logging centralizado
│       ├── errorHandler.ts # Tratamento de erros
│       ├── validators.ts   # Validações
│       └── image.ts        # Manipulação de imagens
├── modules/                # Módulos funcionais
│   ├── auth/              # Autenticação
│   ├── documentos/        # Documentos
│   ├── agenda/            # Agenda
│   └── ...
└── routes/                # Roteamento (futuro)
```

### Padrões de Nomenclatura

| Tipo | Padrão | Exemplo |
|------|--------|---------|
| Arquivos | `camelCase.ts` | `authService.ts` |
| Pastas | `kebab-case` | `auth-service/` |
| Componentes React | `PascalCase.tsx` | `LoginScreen.tsx` |
| Funções | `camelCase` | `autenticarUsuario()` |
| Variáveis | `camelCase` | `usuarioAtual` |
| Constantes | `UPPER_SNAKE_CASE` | `MIN_PASSWORD_LENGTH` |
| Interfaces | `PascalCase` | `Usuario`, `LoginProps` |
| Type | `PascalCase` | `Tela`, `Modulo` |

---

## ✅ Checklist de Qualidade

Antes de commitar, verifique:

- [ ] **TypeScript**: Sem erros de compilação
- [ ] **Linting**: Sem warnings desnecessários
- [ ] **Teste Manual**: Funcionalidade testada localmente
- [ ] **Console Limpo**: Sem erros/warnings no console
- [ ] **Logging**: Eventos importantes registrados
- [ ] **Erro**: Tratamento de erro apropriado
- [ ] **Validação**: Todas as entradas validadas
- [ ] **Performance**: Sem n+1 queries, sem renders desnecessários
- [ ] **Acessibilidade**: Labels para inputs, ARIA quando necessário
- [ ] **Mobile**: Testado em diferentes tamanhos

---

## 🔐 Padrões de Segurança

### 1. Validação de Entrada

```typescript
// ❌ ERRADO
const usuario = await autenticarUsuario(loginInput);

// ✅ CORRETO
if (!loginInput || !loginInput.trim()) {
  throw new ValidationError("Login obrigatório");
}
const usuario = await autenticarUsuario(loginInput.trim());
```

### 2. Tratamento de Erro

```typescript
// ❌ ERRADO
try {
  await operacaoCritica();
} catch {
  console.log("erro");
}

// ✅ CORRETO
try {
  await operacaoCritica();
} catch (error) {
  logger.error("Modulo", "Erro na operação", error);
  throw handleError(error, "Modulo");
}
```

### 3. Sanitização de Dados

```typescript
// ❌ ERRADO
const nome = formData.nome;

// ✅ CORRETO
import { sanitizarTexto } from '@/core/utils/validators';
const nome = sanitizarTexto(formData.nome);
```

### 4. Configurações Sensíveis

```typescript
// ❌ ERRADO
const API_KEY = "sk_prod_12345";

// ✅ CORRETO
const API_KEY = process.env.VITE_API_KEY || "";
// Adicionar ao .env.local (não commitar)
```

---

## 🎯 Padrões de Código

### Componentes React

```typescript
// ✅ BOM
interface LoginScreenProps {
  paroquia: Paroquia;
  onLogin: (usuario: Usuario) => void;
}

export function LoginScreen({ paroquia, onLogin }: LoginScreenProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin() {
    try {
      setLoading(true);
      setError("");
      const usuario = await autenticarUsuario(login, senha);
      if (usuario) onLogin(usuario);
    } catch (err) {
      setError(handleError(err, "LoginScreen").message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); handleLogin(); }}>
      {/* ... */}
    </form>
  );
}
```

### Funções Assíncronas

```typescript
// ✅ BOM
export async function autenticarUsuario(
  login: string,
  senha: string
): Promise<Usuario | null> {
  try {
    // Validar entrada
    if (!login?.trim() || !senha?.trim()) {
      logger.warn("Auth", "Credenciais vazias");
      return null;
    }

    // Executar lógica
    const db = await getDb();
    const res = await db.select<Usuario[]>(
      "SELECT * FROM usuarios WHERE login = ?",
      [login.trim()]
    );

    // Validar resultado
    if (res.length === 0) {
      logger.warn("Auth", "Usuário não encontrado");
      return null;
    }

    // Retornar sucesso
    logger.info("Auth", "Autenticação bem-sucedida", { usuario: res[0].nome });
    return res[0];
  } catch (error) {
    logger.error("Auth", "Erro na autenticação", error);
    return null;
  }
}
```

---

## 🧪 Testes Manuais

### Fluxo de Login

1. [ ] Abrir app → Mostra splash screen
2. [ ] Splash desaparece → Mostra login ou setup
3. [ ] Login inválido → Mostra erro
4. [ ] Login válido → Abre app
5. [ ] Refresh → Mantém sessão? (future)

### Fluxo de Setup

1. [ ] Preencher paróquia
2. [ ] Validar campos obrigatórios
3. [ ] Criar administrador
4. [ ] Validar senha
5. [ ] Criar com sucesso
6. [ ] Redirecionar para login

---

## 📝 Logging

### Níveis Apropriados

```typescript
// INFO - Eventos normais
logger.info("Auth", "Usuário fez login", { usuario: "padre.eder" });

// DEBUG - Dados detalhados (desenvolvimento)
logger.debug("Database", "Query executada", { sql, params });

// WARN - Avisos (mas não crítico)
logger.warn("Auth", "Tentativa de login com usuário inexistente");

// ERROR - Erros que precisam atenção
logger.error("Database", "Falha ao conectar", { originalError });
```

### Boas Práticas

- ✅ Sempre incluir contexto (módulo/função)
- ✅ Incluir dados relevantes (IDs, nomes)
- ✅ Não logar dados sensíveis (senhas)
- ✅ Usar níveis apropriados
- ✅ Revisar logs em produção

---

## 🚀 Performance

### Otimizações Recomendadas

1. **Lazy Loading de Módulos**
   ```typescript
   const DocumentosModule = lazy(() => import('./modules/documentos'));
   ```

2. **Memoização de Componentes**
   ```typescript
   export const MenuItem = memo(({ item, active }) => {
     return <div>{item.label}</div>;
   });
   ```

3. **useMemo para Cálculos Pesados**
   ```typescript
   const usuarios = useMemo(
     () => usuarios.filter(u => u.ativo),
     [usuarios]
   );
   ```

4. **useCallback para Callbacks**
   ```typescript
   const handleClick = useCallback(() => {
     atualizarDados();
   }, [atualizarDados]);
   ```

---

## 🐛 Debugging

### Ativar Modo Debug

```javascript
// No console do navegador
localStorage.setItem('debug', 'true');
window.location.reload();
```

### Acessar Logs

```javascript
// Ver histórico completo
import { getLogs } from '@/core/utils/debug';
console.log(getLogs());

// Ver apenas erros
console.log(getLogs('error'));

// Exportar logs
import { exportLogs } from '@/core/utils/debug';
console.log(exportLogs());
```

---

## 📦 Versionamento

### Formato Semântico

- `MAJOR.MINOR.PATCH` (ex: 1.2.3)
- **MAJOR**: Mudanças incompatíveis
- **MINOR**: Novas funcionalidades
- **PATCH**: Correção de bugs

---

## 🔄 Git Workflow

### Commits

```bash
# ✅ BOM
git commit -m "feat: adicionar autenticação com banco de dados"
git commit -m "fix: corrigir tela branca no App.tsx"
git commit -m "docs: adicionar guia de boas práticas"

# ❌ RUIM
git commit -m "alteracoes"
git commit -m "fix bug"
```

### Branches

```bash
# Feature
git checkout -b feature/autenticacao-melhorada

# Fix
git checkout -b fix/tela-branca

# Docs
git checkout -b docs/guia-setup
```

---

## 🎓 Recursos Úteis

- [React Docs](https://react.dev)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Tauri Docs](https://tauri.app/docs)
- [SQLite Docs](https://www.sqlite.org/docs.html)

---

**Última atualização:** 15 de maio de 2026
**Versão:** 1.0.0
