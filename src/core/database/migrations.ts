import Database from "@tauri-apps/plugin-sql";
import { logger } from "@core/utils/logger";

interface Migration {
  version: number;
  description: string;
  up: (db: Database) => Promise<void>;
}

/**
 * Migrações numeradas e idempotentes.
 * Cada migration roda exatamente uma vez — controlado pela tabela schema_migrations.
 * NUNCA remova uma migration já aplicada; apenas adicione novas ao final.
 */
const MIGRATIONS: Migration[] = [
  {
    version: 20260616001,
    description: "Normalizar fieis.data_nascimento a partir de dataNascimento",
    up: async (db) => {
      await db.execute(`
        UPDATE fieis
           SET data_nascimento = dataNascimento
         WHERE data_nascimento IS NULL
           AND dataNascimento IS NOT NULL
           AND dataNascimento != ''
      `).catch(() => {});
    },
  },
  {
    version: 20260616002,
    description: "Remover tabelas sacramentais legadas vazias (batismos/crismas/matrimonios/uncao_enfermos)",
    up: async (db) => {
      const legacy = ["batismos", "crismas", "matrimonios", "uncao_enfermos"];
      for (const tbl of legacy) {
        try {
          const rows = await db.select<Record<string, unknown>[]>(
            `SELECT COUNT(*) FROM "${tbl}"`
          ).catch(() => null);
          if (!rows) continue;
          const count = Number(Object.values(rows[0] ?? {})[0] ?? 0);
          if (count === 0) {
            await db.execute(`DROP TABLE IF EXISTS "${tbl}"`);
            logger.log(`  🗑  ${tbl}: tabela legada removida`);
          } else {
            logger.warn(`  ⚠️  ${tbl}: ${count} registros — mantida para revisão manual`);
          }
        } catch { /* tabela já não existe */ }
      }
    },
  },
  {
    version: 20260616003,
    description: "Garantir registro padrão (id=1) em configuracoes_partilha",
    up: async (db) => {
      await db.execute(`
        INSERT OR IGNORE INTO configuracoes_partilha
          (id, comunidade, area_missionaria, arquidiocese, fundo_missionario)
        VALUES (1, 30.0, 40.0, 29.0, 1.0)
      `).catch(() => {});
    },
  },
  {
    version: 20260617001,
    description: "Remover índices legados duplicados",
    up: async (db) => {
      // Índices criados por versões anteriores do app; substituídos pelos nomes
      // canônicos definidos em indexes.ts. DROP IF EXISTS é idempotente.
      const legacy = [
        "idx_auditoria_data",
        "idx_auditoria_tabela",
        "idx_auditoria_usuario",
        "idx_caixa_data_unidade",
        "idx_caixa_unidade",
        "idx_lancamentos_data",
        "idx_lancamentos_origem",
        "idx_lancamentos_origem_data",
        "idx_lancamentos_tipo",
        "idx_cat_matriculas_fiel",
        "idx_cat_matriculas_turma",
        "idx_cat_presencas_data",
        "idx_cat_presencas_matricula",
        "idx_patrimonio_comunidade",
      ];
      for (const idx of legacy) {
        await db.execute(`DROP INDEX IF EXISTS "${idx}"`).catch(() => {});
      }
    },
  },
  {
    version: 20260618001,
    description: "Remover índices legados duplicados de sacramentos_registros",
    up: async (db) => {
      // Substituídos pelos nomes canônicos idx_sacr_tipo, idx_sacr_data e
      // idx_sacr_nome definidos em indexes.ts. DROP IF EXISTS é idempotente.
      const legacy = [
        "idx_sacramentos_tipo",
        "idx_sacramentos_data",
        "idx_sacramentos_nome",
      ];
      for (const idx of legacy) {
        await db.execute(`DROP INDEX IF EXISTS "${idx}"`).catch(() => {});
      }
    },
  },
  {
    version: 20260618002,
    description: "Backfill livro/folha/assento em sacramentos_registros a partir do JSON",
    up: async (db) => {
      // BATISMO: batizando.livro / batizando.pagina / batizando.numeroFicha
      await db.execute(`
        UPDATE sacramentos_registros
           SET livro   = json_extract(json_dados, '$.batizando.livro'),
               folha   = json_extract(json_dados, '$.batizando.pagina'),
               assento = json_extract(json_dados, '$.batizando.numeroFicha')
         WHERE tipo = 'BATISMO'
           AND (livro IS NULL OR folha IS NULL OR assento IS NULL)
           AND json_dados IS NOT NULL
      `).catch(() => {});
      // MATRIMONIO: livroReg / folhaReg / numReg
      await db.execute(`
        UPDATE sacramentos_registros
           SET livro   = json_extract(json_dados, '$.livroReg'),
               folha   = json_extract(json_dados, '$.folhaReg'),
               assento = json_extract(json_dados, '$.numReg')
         WHERE tipo = 'MATRIMONIO'
           AND (livro IS NULL OR folha IS NULL OR assento IS NULL)
           AND json_dados IS NOT NULL
      `).catch(() => {});
      // CERT_BATISMO / CERT_CRISMA / CERT_MATRIMONIO: livro / folha / termo
      await db.execute(`
        UPDATE sacramentos_registros
           SET livro   = json_extract(json_dados, '$.livro'),
               folha   = json_extract(json_dados, '$.folha'),
               assento = json_extract(json_dados, '$.termo')
         WHERE tipo IN ('CERT_BATISMO','CERT_CRISMA','CERT_MATRIMONIO')
           AND (livro IS NULL OR folha IS NULL OR assento IS NULL)
           AND json_dados IS NOT NULL
      `).catch(() => {});
    },
  },
  {
    version: 20260619001,
    description: "Normalizar isDizimista TEXT para INTEGER (0/1)",
    up: async (db) => {
      await db.execute(`
        UPDATE fieis
           SET isDizimista = CASE
             WHEN isDizimista IN ('1', '1.0') THEN 1
             ELSE 0
           END
         WHERE typeof(isDizimista) = 'text'
      `).catch(() => {});
    },
  },
  {
    version: 20260620001,
    description: "Vincular liderança de pastorais e grupos a fiéis por nome",
    up: async (db) => {
      for (const table of ['pastorais', 'grupos']) {
        for (const cargo of ['coordenador', 'vice', 'secretario', 'tesoureiro']) {
          await db.execute(`
            UPDATE "${table}" SET ${cargo}_id = (
              SELECT f.id FROM fieis f
              WHERE LOWER(TRIM(f.nome)) = LOWER(TRIM("${table}".${cargo}_nome))
                AND f.deleted_at IS NULL
              LIMIT 1
            )
            WHERE ${cargo}_nome IS NOT NULL
              AND ${cargo}_nome != ''
              AND ${cargo}_id IS NULL
          `).catch(() => {});
        }
      }
    },
  },
  {
    version: 20260620002,
    description: "Popular comunidade_id a partir de comunidade TEXT em fieis, familias, pastorais, grupos",
    up: async (db) => {
      for (const table of ['fieis', 'familias', 'pastorais', 'grupos']) {
        await db.execute(`
          UPDATE "${table}" SET comunidade_id = (
            SELECT c.id FROM comunidades c
            WHERE LOWER(TRIM(c.nome)) = LOWER(TRIM("${table}".comunidade))
              AND c.deleted_at IS NULL
            LIMIT 1
          )
          WHERE comunidade IS NOT NULL
            AND comunidade != ''
            AND comunidade_id IS NULL
        `).catch(() => {});
      }
    },
  },
  {
    version: 20260620003,
    description: "Consolidar dataNascimento → data_nascimento (final) e adicionar índices FK faltantes",
    up: async (db) => {
      // Garantir que qualquer valor restante em dataNascimento seja copiado
      await db.execute(`
        UPDATE fieis
           SET data_nascimento = dataNascimento
         WHERE (data_nascimento IS NULL OR data_nascimento = '')
           AND dataNascimento IS NOT NULL
           AND dataNascimento != ''
      `).catch(() => {});

      // Índices FK faltantes identificados na auditoria
      const indexes = [
        "CREATE INDEX IF NOT EXISTS idx_familias_responsavel_id ON familias(responsavel_id)",
        "CREATE INDEX IF NOT EXISTS idx_familias_comunidade_id ON familias(comunidade_id)",
        "CREATE INDEX IF NOT EXISTS idx_pastorais_coordenador_id ON pastorais(coordenador_id)",
        "CREATE INDEX IF NOT EXISTS idx_pastorais_vice_id ON pastorais(vice_id)",
        "CREATE INDEX IF NOT EXISTS idx_pastorais_secretario_id ON pastorais(secretario_id)",
        "CREATE INDEX IF NOT EXISTS idx_pastorais_tesoureiro_id ON pastorais(tesoureiro_id)",
        "CREATE INDEX IF NOT EXISTS idx_usuarios_comunidade_id ON usuarios(comunidade_id)",
        "CREATE INDEX IF NOT EXISTS idx_catequistas_fiel_id ON catequistas(fiel_id)",
        "CREATE INDEX IF NOT EXISTS idx_fieis_comunidade_id ON fieis(comunidade_id)",
      ];
      for (const sql of indexes) {
        await db.execute(sql).catch(() => {});
      }
    },
  },
  {
    version: 20260620004,
    description: "Garantir UNIQUE index em usuarios.login para logins ativos",
    up: async (db) => {
      await db.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_usuarios_login_unique ON usuarios(login) WHERE login IS NOT NULL AND login != '' AND deleted_at IS NULL"
      ).catch(() => {});
    },
  },
];

/**
 * Executa todas as migrações pendentes em ordem.
 *
 * Garante antes que schema_migrations existe — bootstrapped fora da lista
 * para evitar dependência circular.
 */
export async function runMigrations(db: Database): Promise<void> {
  // Bootstrap — cria a tabela de controle se não existir
  await db.execute(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version     INTEGER PRIMARY KEY,
      description TEXT    NOT NULL,
      applied_at  DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Versões já aplicadas
  const applied = await db.select<{ version: number }[]>(
    "SELECT version FROM schema_migrations ORDER BY version"
  ).catch(() => [] as { version: number }[]);
  const appliedSet = new Set(applied.map(r => r.version));

  let ran = 0;
  for (const migration of MIGRATIONS) {
    if (appliedSet.has(migration.version)) continue;

    try {
      logger.log(`  ▶  migration ${migration.version}: ${migration.description}`);
      await migration.up(db);
      await db.execute(
        "INSERT INTO schema_migrations (version, description) VALUES (?, ?)",
        [migration.version, migration.description]
      );
      ran++;
      logger.log(`  ✅ migration ${migration.version} aplicada`);
    } catch (e) {
      console.error(`  ❌ migration ${migration.version} falhou:`, e);
      throw e;
    }
  }

  if (ran === 0) {
    logger.log("  ✔  Nenhuma migration pendente");
  } else {
    logger.log(`  ✅ ${ran} migration(s) aplicada(s)`);
  }
}
