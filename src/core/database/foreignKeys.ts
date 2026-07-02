import Database from "@tauri-apps/plugin-sql";
import { logger } from "@core/utils/logger";

/** Verifica se uma tabela já possui FK constraints definidas. */
async function hasForeignKeys(db: Database, tableName: string): Promise<boolean> {
  const rows = await db.select<{ id: number }[]>(
    `PRAGMA foreign_key_list("${tableName}")`
  ).catch(() => []);
  return rows.length > 0;
}

/** Verifica se uma tabela possui constraint UNIQUE sobre exatamente as colunas informadas. */
async function hasUniqueIndex(db: Database, tableName: string, cols: string[]): Promise<boolean> {
  const indexes = await db.select<{ name: string; unique: number }[]>(
    `PRAGMA index_list("${tableName}")`
  ).catch(() => [] as { name: string; unique: number }[]);

  for (const idx of indexes.filter(i => i.unique === 1)) {
    const info = await db.select<{ name: string }[]>(
      `PRAGMA index_info("${idx.name}")`
    ).catch(() => [] as { name: string }[]);
    const idxCols = info.map(c => c.name).sort();
    if (JSON.stringify(idxCols) === JSON.stringify([...cols].sort())) return true;
  }
  return false;
}

/** Anula FKs órfãs (registros referenciando IDs inexistentes). Retorna quantos foram limpos. */
async function nullifyOrphans(
  db: Database, tableName: string, column: string, refTable: string
): Promise<number> {
  const orphans = await db.select<{ id: number }[]>(`
    SELECT t.id FROM "${tableName}" t
    WHERE t."${column}" IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM "${refTable}" r WHERE r.id = t."${column}")
  `).catch(() => [] as { id: number }[]);

  if (orphans.length > 0) {
    const placeholders = orphans.map((_, i) => `$${i + 1}`).join(",");
    const ids = orphans.map(o => o.id);
    await db.execute(`UPDATE "${tableName}" SET "${column}" = NULL WHERE id IN (${placeholders})`, ids);
    logger.warn(`  ⚠️  ${tableName}.${column}: ${orphans.length} órfão(s) → NULL`);
  }
  return orphans.length;
}

interface RecreateConfig {
  tableName: string;
  /** CREATE TABLE com FK/UNIQUE constraints. Deve incluir TODAS as colunas desejadas. */
  createSQL: string;
  /**
   * Colunas que estarão na nova tabela após recreação.
   * Usadas para calcular a interseção com as colunas da tabela existente
   * para o INSERT...SELECT, evitando qualquer db.select() dentro da sequência de rename.
   */
  newColumns: string[];
  /** Colunas FK a verificar/limpar órfãos antes de criar a constraint. */
  nullifyOrphans?: { column: string; refTable: string }[];
  /** Índices a recriar após a migration (idempotente via IF NOT EXISTS). */
  indexesSQL?: string[];
}

/**
 * Recria uma tabela adicionando FK/UNIQUE constraints de forma segura.
 *
 * NOTA IMPORTANTE — Tauri SQLite plugin usa pool de conexões:
 *   Cada execute()/select() pode usar uma conexão diferente do pool SQLite.
 *   Por isso, BEGIN/COMMIT explícito não funciona (a transação fica em uma
 *   conexão e as operações subsequentes vão para outras conexões).
 *
 *   Solução: calcular tudo que precisamos (lista de colunas, dados de órfãos)
 *   ANTES da sequência de rename. Cada operação de rename é auto-committed
 *   individualmente, o que é seguro em SQLite WAL mode.
 *
 * Sequência de operações (cada uma auto-committed):
 *   1. Nullify orphans (fora da sequência crítica)
 *   2. Ler colunas da tabela atual via PRAGMA (fora da sequência crítica)
 *   3. Recuperar de crash anterior se necessário (_old table presente)
 *   4. RENAME original → _old
 *   5. CREATE nova tabela com FK constraints
 *   6. INSERT dados (interseção de colunas, orphans já nullificados)
 *   7. DROP _old
 */
async function recreateTableWithFKs(db: Database, cfg: RecreateConfig): Promise<boolean> {
  try {
    if (await hasForeignKeys(db, cfg.tableName)) {
      logger.log(`  ✔  ${cfg.tableName}: FK já existe, pulando`);
      return true;
    }

    // Recuperação de crash: se _old existir de uma execução anterior interrompida,
    // restaura a tabela original antes de tentar novamente.
    const hasOldTable = await db.select<Record<string, unknown>[]>(
      `SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='${cfg.tableName}_old'`
    ).then(r => Number(Object.values(r[0] ?? {})[0] ?? 0) > 0).catch(() => false);

    if (hasOldTable) {
      const hasNewTable = await db.select<Record<string, unknown>[]>(
        `SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='${cfg.tableName}'`
      ).then(r => Number(Object.values(r[0] ?? {})[0] ?? 0) > 0).catch(() => false);

      if (hasNewTable) {
        const newCount = await db.select<Record<string, unknown>[]>(
          `SELECT COUNT(*) FROM "${cfg.tableName}"`
        ).then(r => Number(Object.values(r[0] ?? {})[0] ?? 0)).catch(() => 0);
        const oldCount = await db.select<Record<string, unknown>[]>(
          `SELECT COUNT(*) FROM "${cfg.tableName}_old"`
        ).then(r => Number(Object.values(r[0] ?? {})[0] ?? 0)).catch(() => 0);

        if (newCount >= oldCount) {
          logger.warn(`  ♻️  ${cfg.tableName}: nova tabela tem dados (${newCount} registros), removendo _old`);
          await db.execute(`DROP TABLE "${cfg.tableName}_old"`).catch(() => {});
          return true;
        }
      }

      logger.warn(`  ♻️  ${cfg.tableName}: restaurando de execução anterior interrompida`);
      await db.execute(`DROP TABLE IF EXISTS "${cfg.tableName}"`).catch(() => {});
      await db.execute(`ALTER TABLE "${cfg.tableName}_old" RENAME TO "${cfg.tableName}"`).catch(() => {});
    }

    // Nullify orphans (antes de qualquer rename, usando conexão normal)
    let totalOrphans = 0;
    for (const { column, refTable } of (cfg.nullifyOrphans ?? [])) {
      totalOrphans += await nullifyOrphans(db, cfg.tableName, column, refTable);
    }

    // Ler colunas ATUAIS da tabela ANTES do rename (fora da sequência crítica)
    const existingCols = await db.select<{ name: string }[]>(
      `PRAGMA table_info("${cfg.tableName}")`
    ).catch(() => [] as { name: string }[]);
    const existingSet = new Set(existingCols.map(c => c.name));

    // Interseção: colunas que existem tanto na tabela atual quanto na nova DDL
    const colList = cfg.newColumns
      .filter(n => existingSet.has(n))
      .map(c => `"${c}"`)
      .join(", ");

    if (!colList) {
      throw new Error(`Nenhuma coluna em comum para ${cfg.tableName}`);
    }

    // Sequência crítica de rename — cada operação é auto-committed individualmente
    // (não usamos BEGIN/COMMIT pois o plugin-sql pode usar conexões diferentes do pool)
    await db.execute("PRAGMA foreign_keys = OFF");
    try {
      await db.execute(`ALTER TABLE "${cfg.tableName}" RENAME TO "${cfg.tableName}_old"`);
      await db.execute(cfg.createSQL);
      await db.execute(
        `INSERT INTO "${cfg.tableName}" (${colList}) SELECT ${colList} FROM "${cfg.tableName}_old"`
      );
      await db.execute(`DROP TABLE "${cfg.tableName}_old"`);

      for (const sql of (cfg.indexesSQL ?? [])) {
        await db.execute(sql).catch(() => {});
      }
      logger.log(
        `  ✅ ${cfg.tableName}: FK criada` +
        (totalOrphans ? ` (${totalOrphans} órfão(s) limpos)` : "")
      );
    } catch (e) {
      // Tenta restaurar estado original em caso de falha parcial
      await db.execute(`ALTER TABLE "${cfg.tableName}_old" RENAME TO "${cfg.tableName}"`).catch(() => {});
      throw e;
    } finally {
      await db.execute("PRAGMA foreign_keys = ON");
    }
    return true;
  } catch (e) {
    console.error(`  ❌ ${cfg.tableName}: ${e}`);
    return false;
  }
}

/**
 * Garante UNIQUE(data, unidade) em caixa_fechamento.
 * Remove duplicatas (mantendo o maior id) antes de criar a constraint.
 */
async function ensureCaixaFechamentoUnique(db: Database): Promise<void> {
  if (await hasUniqueIndex(db, "caixa_fechamento", ["data", "unidade"])) {
    logger.log("  ✔  caixa_fechamento: UNIQUE(data, unidade) já existe");
    return;
  }

  // Remove duplicatas — mantém o id maior por par (data, unidade)
  await db.execute(`
    DELETE FROM caixa_fechamento
    WHERE id NOT IN (
      SELECT MAX(id) FROM caixa_fechamento GROUP BY data, unidade
    )
  `).catch(() => {});

  await recreateTableWithFKs(db, {
    tableName: "caixa_fechamento",
    newColumns: ["id","data","unidade","dinheiro","pix","saldo_anterior","saldo_disponivel","observacao","uuid","created_at","updated_at"],
    createSQL: `
      CREATE TABLE "caixa_fechamento" (
        id               INTEGER PRIMARY KEY AUTOINCREMENT,
        data             TEXT    NOT NULL,
        unidade          TEXT    NOT NULL,
        dinheiro         REAL    DEFAULT 0,
        pix              REAL    DEFAULT 0,
        saldo_anterior   REAL    DEFAULT 0,
        saldo_disponivel REAL    DEFAULT 0,
        observacao       TEXT,
        uuid             TEXT,
        created_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at       DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(data, unidade)
      )`,
    indexesSQL: [
      "CREATE INDEX IF NOT EXISTS idx_fech_unidade_data ON caixa_fechamento(unidade, data)",
      "CREATE INDEX IF NOT EXISTS idx_fech_uuid         ON caixa_fechamento(uuid)",
    ],
  });
}

/**
 * Ponto de entrada — cria todas as Foreign Keys do banco.
 *
 * Ordem: tabelas pai antes de tabelas filha.
 * Cada operação é idempotente: hasForeignKeys() pula se FK já existe.
 */
export async function createForeignKeys(db: Database): Promise<void> {
  logger.log("════ Foreign Keys ════");

  // 1. membros_familia → familias + fieis
  await recreateTableWithFKs(db, {
    tableName: "membros_familia",
    newColumns: ["id","familia_id","fiel_id","parentesco","situacao_sacramental","participacao_pastoral","uuid","created_at","updated_at","deleted_at"],
    nullifyOrphans: [
      { column: "familia_id", refTable: "familias" },
      { column: "fiel_id",    refTable: "fieis"    },
    ],
    createSQL: `
      CREATE TABLE "membros_familia" (
        id                    INTEGER PRIMARY KEY AUTOINCREMENT,
        familia_id            INTEGER REFERENCES familias(id) ON DELETE CASCADE,
        fiel_id               INTEGER REFERENCES fieis(id)   ON DELETE CASCADE,
        parentesco            TEXT,
        situacao_sacramental  TEXT,
        participacao_pastoral TEXT,
        uuid                  TEXT,
        created_at            DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at            DATETIME DEFAULT CURRENT_TIMESTAMP,
        deleted_at            DATETIME
      )`,
    indexesSQL: [
      "CREATE INDEX IF NOT EXISTS idx_membros_familia_id ON membros_familia(familia_id)",
      "CREATE INDEX IF NOT EXISTS idx_membros_fiel_id    ON membros_familia(fiel_id)",
    ],
  });

  // 2. catequese_fichas → catequese_turmas + fieis  (pai de matriculas)
  await recreateTableWithFKs(db, {
    tableName: "catequese_fichas",
    newColumns: ["id","atividade","nome","nascimento","endereco","telefone","email","responsavel","observacoes","data_inscricao","turma_id","fiel_id","documento_entregue","uuid","created_at","updated_at","deleted_at"],
    nullifyOrphans: [
      { column: "turma_id", refTable: "catequese_turmas" },
      { column: "fiel_id",  refTable: "fieis"            },
    ],
    createSQL: `
      CREATE TABLE "catequese_fichas" (
        id                 INTEGER PRIMARY KEY AUTOINCREMENT,
        atividade          TEXT,
        nome               TEXT,
        nascimento         TEXT,
        endereco           TEXT,
        telefone           TEXT,
        email              TEXT,
        responsavel        TEXT,
        observacoes        TEXT,
        data_inscricao     TEXT,
        turma_id           INTEGER REFERENCES catequese_turmas(id) ON DELETE SET NULL,
        fiel_id            INTEGER REFERENCES fieis(id)            ON DELETE SET NULL,
        documento_entregue INTEGER DEFAULT 0,
        uuid               TEXT,
        created_at         DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at         DATETIME DEFAULT CURRENT_TIMESTAMP,
        deleted_at         DATETIME
      )`,
    indexesSQL: [
      "CREATE INDEX IF NOT EXISTS idx_fichas_turma_id ON catequese_fichas(turma_id)",
      "CREATE INDEX IF NOT EXISTS idx_fichas_fiel_id  ON catequese_fichas(fiel_id)",
    ],
  });

  // 3. catequese_encontros → catequese_turmas  (pai de presencas)
  await recreateTableWithFKs(db, {
    tableName: "catequese_encontros",
    newColumns: ["id","turma_id","tema","data","presencas","uuid","created_at","updated_at"],
    nullifyOrphans: [
      { column: "turma_id", refTable: "catequese_turmas" },
    ],
    createSQL: `
      CREATE TABLE "catequese_encontros" (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        turma_id   INTEGER REFERENCES catequese_turmas(id) ON DELETE CASCADE,
        tema       TEXT,
        data       TEXT,
        presencas  TEXT,
        uuid       TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
    indexesSQL: [
      "CREATE INDEX IF NOT EXISTS idx_encontros_turma_id ON catequese_encontros(turma_id)",
      "CREATE INDEX IF NOT EXISTS idx_encontros_data      ON catequese_encontros(data)",
    ],
  });

  // 4. catequese_matriculas → fieis + catequese_turmas + catequese_fichas
  await recreateTableWithFKs(db, {
    tableName: "catequese_matriculas",
    newColumns: ["id","turma_id","ficha_id","nome_catequizando","fiel_id","situacao","docs_entregues","frequencia","observacoes","uuid","created_at","updated_at","deleted_at"],
    nullifyOrphans: [
      { column: "fiel_id",  refTable: "fieis"             },
      { column: "turma_id", refTable: "catequese_turmas"  },
      { column: "ficha_id", refTable: "catequese_fichas"  },
    ],
    createSQL: `
      CREATE TABLE "catequese_matriculas" (
        id                INTEGER PRIMARY KEY AUTOINCREMENT,
        turma_id          INTEGER REFERENCES catequese_turmas(id) ON DELETE SET NULL,
        ficha_id          INTEGER REFERENCES catequese_fichas(id) ON DELETE SET NULL,
        nome_catequizando TEXT,
        fiel_id           INTEGER REFERENCES fieis(id)            ON DELETE SET NULL,
        situacao          TEXT,
        docs_entregues    TEXT,
        frequencia        TEXT,
        observacoes       TEXT,
        uuid              TEXT,
        created_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
        deleted_at        DATETIME
      )`,
    indexesSQL: [
      "CREATE INDEX IF NOT EXISTS idx_matric_fiel_id  ON catequese_matriculas(fiel_id)",
      "CREATE INDEX IF NOT EXISTS idx_matric_turma_id ON catequese_matriculas(turma_id)",
      "CREATE INDEX IF NOT EXISTS idx_matric_ficha_id ON catequese_matriculas(ficha_id)",
      "CREATE INDEX IF NOT EXISTS idx_matric_uuid     ON catequese_matriculas(uuid)",
    ],
  });

  // 5. catequese_presencas → catequese_matriculas + catequese_encontros
  await recreateTableWithFKs(db, {
    tableName: "catequese_presencas",
    newColumns: ["id","matricula_id","data","presente","justificativa","encontro_id","status","observacao","uuid","created_at","updated_at"],
    nullifyOrphans: [
      { column: "matricula_id", refTable: "catequese_matriculas" },
      { column: "encontro_id",  refTable: "catequese_encontros"  },
    ],
    createSQL: `
      CREATE TABLE "catequese_presencas" (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        matricula_id  INTEGER REFERENCES catequese_matriculas(id) ON DELETE CASCADE,
        data          TEXT,
        presente      INTEGER,
        justificativa TEXT,
        encontro_id   INTEGER REFERENCES catequese_encontros(id)  ON DELETE SET NULL,
        status        TEXT,
        observacao    TEXT,
        uuid          TEXT,
        created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
    indexesSQL: [
      "CREATE INDEX IF NOT EXISTS idx_presenc_matricula_id ON catequese_presencas(matricula_id)",
      "CREATE INDEX IF NOT EXISTS idx_presenc_encontro_id  ON catequese_presencas(encontro_id)",
      "CREATE INDEX IF NOT EXISTS idx_presenc_data         ON catequese_presencas(data)",
    ],
  });

  // 6. patrimonio_manutencoes → patrimonio_bens  (CASCADE)
  await recreateTableWithFKs(db, {
    tableName: "patrimonio_manutencoes",
    newColumns: ["id","bem_id","data_manutencao","descricao","prestador_servico","valor_gasto","observacoes","uuid","created_at","updated_at"],
    nullifyOrphans: [
      { column: "bem_id", refTable: "patrimonio_bens" },
    ],
    createSQL: `
      CREATE TABLE "patrimonio_manutencoes" (
        id                INTEGER PRIMARY KEY AUTOINCREMENT,
        bem_id            INTEGER NOT NULL REFERENCES patrimonio_bens(id) ON DELETE CASCADE,
        data_manutencao   TEXT    NOT NULL,
        descricao         TEXT    NOT NULL,
        prestador_servico TEXT,
        valor_gasto       REAL,
        observacoes       TEXT,
        uuid              TEXT,
        created_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at        DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
    indexesSQL: [
      "CREATE INDEX IF NOT EXISTS idx_manut_bem_id ON patrimonio_manutencoes(bem_id)",
    ],
  });

  // 7. grupos → pastorais (SET NULL)
  await recreateTableWithFKs(db, {
    tableName: "grupos",
    newColumns: ["id","nome","categoria","descricao","objetivos","pastoral_id","comunidade","coordenador_id","coordenador_nome","coordenador_tel","coordenador_email","vice_nome","vice_tel","vice_email","secretario_nome","secretario_tel","secretario_email","tesoureiro_nome","tesoureiro_tel","tesoureiro_email","uuid","created_at","updated_at","deleted_at"],
    nullifyOrphans: [
      { column: "pastoral_id", refTable: "pastorais" },
    ],
    createSQL: `
      CREATE TABLE "grupos" (
        id                INTEGER PRIMARY KEY AUTOINCREMENT,
        nome              TEXT NOT NULL,
        categoria         TEXT,
        descricao         TEXT,
        objetivos         TEXT,
        pastoral_id       INTEGER REFERENCES pastorais(id) ON DELETE SET NULL,
        comunidade        TEXT,
        coordenador_id    INTEGER,
        coordenador_nome  TEXT,
        coordenador_tel   TEXT,
        coordenador_email TEXT,
        vice_nome         TEXT,
        vice_tel          TEXT,
        vice_email        TEXT,
        secretario_nome   TEXT,
        secretario_tel    TEXT,
        secretario_email  TEXT,
        tesoureiro_nome   TEXT,
        tesoureiro_tel    TEXT,
        tesoureiro_email  TEXT,
        uuid              TEXT,
        created_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
        deleted_at        DATETIME
      )`,
    indexesSQL: [
      "CREATE INDEX IF NOT EXISTS idx_grupos_pastoral_id ON grupos(pastoral_id)",
      "CREATE INDEX IF NOT EXISTS idx_grupos_comunidade  ON grupos(comunidade)",
    ],
  });

  // 8. caixa_fechamento → UNIQUE(data, unidade)
  await ensureCaixaFechamentoUnique(db);

  // 9. sacramentos_registros → fieis (SET NULL)
  await recreateTableWithFKs(db, {
    tableName: "sacramentos_registros",
    newColumns: ["id","tipo","fiel_id","nome_principal","data_sacramento","celebrante","comunidade","livro","folha","assento","json_dados","uuid","created_at","updated_at","deleted_at"],
    nullifyOrphans: [
      { column: "fiel_id", refTable: "fieis" },
    ],
    createSQL: `
      CREATE TABLE "sacramentos_registros" (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        tipo            TEXT NOT NULL,
        fiel_id         INTEGER REFERENCES fieis(id) ON DELETE SET NULL,
        nome_principal  TEXT,
        data_sacramento TEXT,
        celebrante      TEXT,
        comunidade      TEXT,
        livro           TEXT,
        folha           TEXT,
        assento         TEXT,
        json_dados      TEXT,
        uuid            TEXT,
        created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
        deleted_at      DATETIME
      )`,
    indexesSQL: [
      "CREATE INDEX IF NOT EXISTS idx_sacr_tipo      ON sacramentos_registros(tipo)",
      "CREATE INDEX IF NOT EXISTS idx_sacr_fiel_id   ON sacramentos_registros(fiel_id)",
      "CREATE INDEX IF NOT EXISTS idx_sacr_tipo_data ON sacramentos_registros(tipo, data_sacramento)",
    ],
  });

  // 10. lancamentos → fieis (SET NULL)
  await recreateTableWithFKs(db, {
    tableName: "lancamentos",
    newColumns: ["id","fiel_id","categoria","descricao","valor","metodo","data","tipo","origem","doc_num","uuid","created_at","updated_at","deleted_at"],
    nullifyOrphans: [
      { column: "fiel_id", refTable: "fieis" },
    ],
    createSQL: `
      CREATE TABLE "lancamentos" (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        fiel_id    INTEGER REFERENCES fieis(id) ON DELETE SET NULL,
        categoria  TEXT,
        descricao  TEXT,
        valor      REAL,
        metodo     TEXT,
        data       TEXT,
        tipo       TEXT,
        origem     TEXT DEFAULT 'PAROQUIA',
        doc_num    TEXT,
        uuid       TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        deleted_at DATETIME
      )`,
    indexesSQL: [
      "CREATE INDEX IF NOT EXISTS idx_lanc_fiel_id      ON lancamentos(fiel_id)",
      "CREATE INDEX IF NOT EXISTS idx_lanc_data_origem   ON lancamentos(data, origem)",
      "CREATE INDEX IF NOT EXISTS idx_lanc_origem_data   ON lancamentos(origem, data)",
    ],
  });

  // 11. agenda_compromissos → fieis (SET NULL)
  await recreateTableWithFKs(db, {
    tableName: "agenda_compromissos",
    newColumns: ["id","titulo","descricao","data","horario","local","categoria","fiel_id","uuid","created_at","updated_at"],
    nullifyOrphans: [
      { column: "fiel_id", refTable: "fieis" },
    ],
    createSQL: `
      CREATE TABLE "agenda_compromissos" (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        titulo     TEXT NOT NULL,
        descricao  TEXT,
        data       TEXT NOT NULL,
        horario    TEXT NOT NULL,
        local      TEXT NOT NULL,
        categoria  TEXT NOT NULL,
        fiel_id    INTEGER REFERENCES fieis(id) ON DELETE SET NULL,
        uuid       TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
    indexesSQL: [
      "CREATE INDEX IF NOT EXISTS idx_agenda_fiel_id   ON agenda_compromissos(fiel_id)",
      "CREATE INDEX IF NOT EXISTS idx_agenda_data      ON agenda_compromissos(data)",
      "CREATE INDEX IF NOT EXISTS idx_agenda_categoria  ON agenda_compromissos(categoria)",
    ],
  });

  // 12. grupo_membros → grupos + fieis (CASCADE)
  await recreateTableWithFKs(db, {
    tableName: "grupo_membros",
    newColumns: ["id","grupo_id","fiel_id","cargo","created_at","updated_at"],
    nullifyOrphans: [
      { column: "grupo_id", refTable: "grupos" },
      { column: "fiel_id",  refTable: "fieis"  },
    ],
    createSQL: `
      CREATE TABLE "grupo_membros" (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        grupo_id   INTEGER REFERENCES grupos(id) ON DELETE CASCADE,
        fiel_id    INTEGER REFERENCES fieis(id)  ON DELETE CASCADE,
        cargo      TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,
    indexesSQL: [
      "CREATE INDEX IF NOT EXISTS idx_grpmem_grupo_id ON grupo_membros(grupo_id)",
      "CREATE INDEX IF NOT EXISTS idx_grpmem_fiel_id  ON grupo_membros(fiel_id)",
    ],
  });

  // 13. obitos_exequias → fieis (SET NULL)
  await recreateTableWithFKs(db, {
    tableName: "obitos_exequias",
    newColumns: ["id","fiel_id","nome","dataNasc","dataFalecimento","dataExequias","local","ministro","cemiterio","obs","comunidade","uuid","created_at","updated_at","deleted_at"],
    nullifyOrphans: [
      { column: "fiel_id", refTable: "fieis" },
    ],
    createSQL: `
      CREATE TABLE "obitos_exequias" (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        fiel_id         INTEGER REFERENCES fieis(id) ON DELETE SET NULL,
        nome            TEXT,
        dataNasc        TEXT,
        dataFalecimento TEXT,
        dataExequias    TEXT,
        local           TEXT,
        ministro        TEXT,
        cemiterio       TEXT,
        obs             TEXT,
        comunidade      TEXT,
        uuid            TEXT,
        created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
        deleted_at      DATETIME
      )`,
    indexesSQL: [
      "CREATE INDEX IF NOT EXISTS idx_obitos_fiel_id    ON obitos_exequias(fiel_id)",
      "CREATE INDEX IF NOT EXISTS idx_obitos_data_falec ON obitos_exequias(dataFalecimento)",
    ],
  });

  // 14. familias → comunidades (SET NULL) + fieis (responsavel_id SET NULL)
  await recreateTableWithFKs(db, {
    tableName: "familias",
    newColumns: ["id","sobrenome","endereco","comunidade_id","comunidade","responsavel_id","recebe_caritas","observacoes","uuid","created_at","updated_at","deleted_at"],
    nullifyOrphans: [
      { column: "comunidade_id",  refTable: "comunidades" },
      { column: "responsavel_id", refTable: "fieis"       },
    ],
    createSQL: `
      CREATE TABLE "familias" (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        sobrenome       TEXT NOT NULL,
        endereco        TEXT,
        comunidade_id   INTEGER REFERENCES comunidades(id) ON DELETE SET NULL,
        comunidade      TEXT,
        responsavel_id  INTEGER REFERENCES fieis(id)       ON DELETE SET NULL,
        recebe_caritas  INTEGER DEFAULT 0,
        observacoes     TEXT,
        uuid            TEXT,
        created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
        deleted_at      DATETIME
      )`,
    indexesSQL: [
      "CREATE INDEX IF NOT EXISTS idx_familias_comunidade_id ON familias(comunidade_id)",
      "CREATE INDEX IF NOT EXISTS idx_familias_responsavel   ON familias(responsavel_id)",
    ],
  });

  // 15. catequistas → fieis (SET NULL)
  await recreateTableWithFKs(db, {
    tableName: "catequistas",
    newColumns: ["id","nome","telefone","comunidade","disponibilidade","fiel_id","nome_fiel","formacao","tel_fiel","email_fiel","endereco_fiel","uuid","created_at","updated_at","deleted_at"],
    nullifyOrphans: [
      { column: "fiel_id", refTable: "fieis" },
    ],
    createSQL: `
      CREATE TABLE "catequistas" (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        nome            TEXT NOT NULL,
        telefone        TEXT,
        comunidade      TEXT,
        disponibilidade TEXT,
        fiel_id         INTEGER REFERENCES fieis(id) ON DELETE SET NULL,
        nome_fiel       TEXT,
        formacao        TEXT,
        tel_fiel        TEXT,
        email_fiel      TEXT,
        endereco_fiel   TEXT,
        uuid            TEXT,
        created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
        deleted_at      DATETIME
      )`,
    indexesSQL: [
      "CREATE INDEX IF NOT EXISTS idx_catequistas_fiel_id ON catequistas(fiel_id)",
    ],
  });

  logger.log("════ FK concluído ════");
}
