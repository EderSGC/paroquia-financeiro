import { useEffect, useState } from "react";
import { getDb } from "@db";

type RecordType = Record<string, any>;

const ALLOWED_TABLES = new Set([
  "comunidades", "familias", "membros_familia",
  "catequese_turmas", "catequistas", "catequese_fichas",
  "catequese_matriculas", "catequese_encontros", "catequese_presencas",
  "pastorais", "grupos", "grupo_membros",
  "patrimonio_bens", "patrimonio_manutencoes",
  "agenda_compromissos", "documentos_registros",
  "contas", "caixa_fechamento", "configuracoes_partilha",
  "sacramentos_registros", "obitos_exequias",
  "lancamentos",
]);

function assertValidTable(table: string): void {
  if (!ALLOWED_TABLES.has(table)) {
    throw new Error(`useCrud: tabela "${table}" não permitida. Use o repository/service específico.`);
  }
}

export function useCrud<T extends RecordType>(table: string) {
  assertValidTable(table);

  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function list() {
    setLoading(true);
    try {
      const db = await getDb();
      const result = await db.select<T[]>(
        `SELECT * FROM "${table}" WHERE CASE WHEN EXISTS(SELECT 1 FROM pragma_table_info('${table}') WHERE name='deleted_at') THEN deleted_at IS NULL ELSE 1 END ORDER BY id DESC LIMIT 5000`
      );
      setData(result);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function create(item: Partial<T>) {
    try {
      const db = await getDb();
      const keys = Object.keys(item);
      const values = Object.values(item);
      const placeholders = keys.map((_, i) => `$${i + 1}`).join(",");
      const quotedKeys = keys.map(k => `"${k}"`).join(",");

      await db.execute(
        `INSERT INTO "${table}" (${quotedKeys}) VALUES (${placeholders})`,
        values
      );

      await list();
    } catch (err) {
      setError((err as Error).message);
      throw err;
    }
  }

  async function update(id: number, item: Partial<T>) {
    try {
      const db = await getDb();
      const keys = Object.keys(item);
      const set = keys.map((k, i) => `"${k}" = $${i + 1}`).join(", ");

      await db.execute(
        `UPDATE "${table}" SET ${set} WHERE id = $${keys.length + 1}`,
        [...Object.values(item), id]
      );

      await list();
    } catch (err) {
      setError((err as Error).message);
      throw err;
    }
  }

  async function remove(id: number) {
    try {
      const db = await getDb();
      await db.execute(`DELETE FROM "${table}" WHERE id = $1`, [id]);
      await list();
    } catch (err) {
      setError((err as Error).message);
      throw err;
    }
  }

  async function findById(id: number): Promise<T | null> {
    try {
      const db = await getDb();
      const result = await db.select<T[]>(
        `SELECT * FROM "${table}" WHERE id = $1`,
        [id]
      );
      return result?.[0] ?? null;
    } catch (err) {
      setError((err as Error).message);
      return null;
    }
  }

  useEffect(() => {
    list();
  }, [table]);

  return { data, loading, error, list, create, update, remove, findById };
}
