import { getDb } from "@core/database";
import { registrarAuditoria } from "@core/services/auditoria.service";

let _currentUserId = 0;
export function setCurrentUserId(id: number): void { _currentUserId = id; }
export function getCurrentUserId(): number { return _currentUserId; }

export interface FindAllOptions {
  includeDeleted?: boolean;
  orderBy?: string;
  where?: string;
  params?: unknown[];
  limit?: number;
  offset?: number;
}

export class BaseRepository<T extends { id?: number | null }> {
  constructor(
    protected readonly tableName: string,
    protected readonly hasSoftDelete: boolean = true
  ) {}

  async findAll(options: FindAllOptions = {}): Promise<T[]> {
    const db = await getDb();
    const {
      includeDeleted = false,
      orderBy = "id DESC",
      where,
      params = [],
      limit,
      offset,
    } = options;

    const conditions: string[] = [];
    if (this.hasSoftDelete && !includeDeleted) {
      conditions.push("deleted_at IS NULL");
    }
    if (where) {
      if (/;\s*(DROP|ALTER|DELETE|INSERT|UPDATE|CREATE)\b/i.test(where)) {
        throw new Error("BaseRepository.findAll: cláusula where contém SQL potencialmente perigoso");
      }
      conditions.push(`(${where})`);
    }

    let sql = `SELECT * FROM "${this.tableName}"`;
    if (conditions.length > 0) {
      sql += ` WHERE ${conditions.join(" AND ")}`;
    }
    if (/;\s*(DROP|ALTER|DELETE|INSERT|UPDATE|CREATE)\b/i.test(orderBy)) {
      throw new Error("BaseRepository.findAll: orderBy contém SQL potencialmente perigoso");
    }
    sql += ` ORDER BY ${orderBy}`;
    if (limit !== undefined) sql += ` LIMIT ${Number(limit)}`;
    if (offset !== undefined) sql += ` OFFSET ${Number(offset)}`;

    return db.select<T[]>(sql, params);
  }

  async findById(id: number): Promise<T | null> {
    const db = await getDb();
    const conditions = ["id = $1"];
    if (this.hasSoftDelete) conditions.push("deleted_at IS NULL");

    const rows = await db.select<T[]>(
      `SELECT * FROM "${this.tableName}" WHERE ${conditions.join(" AND ")}`,
      [id]
    );
    return rows[0] ?? null;
  }

  async create(data: Omit<T, "id">): Promise<number> {
    const db = await getDb();
    const entries = Object.entries(data as Record<string, unknown>).filter(
      ([, v]) => v !== undefined
    );
    if (entries.length === 0) {
      throw new Error(`BaseRepository.create: sem dados para ${this.tableName}`);
    }

    const cols = entries.map(([k]) => `"${k}"`).join(", ");
    const placeholders = entries.map((_, i) => `$${i + 1}`).join(", ");
    const values = entries.map(([, v]) => v);

    const result = await db.execute(
      `INSERT INTO "${this.tableName}" (${cols}) VALUES (${placeholders})`,
      values
    );
    const newId = result.lastInsertId ?? 0;

    registrarAuditoria({
      usuario_id: _currentUserId,
      acao: "INCLUSAO",
      tabela: this.tableName,
      registro_id: newId,
      descricao: `Novo registro em ${this.tableName}`,
      valor_novo: JSON.stringify(Object.fromEntries(entries)),
    }).catch((err) => console.warn("Falha ao registrar auditoria:", err));

    return newId;
  }

  async update(id: number, data: Partial<Omit<T, "id">>): Promise<void> {
    const db = await getDb();
    const entries = Object.entries(data as Record<string, unknown>).filter(
      ([, v]) => v !== undefined
    );
    if (entries.length === 0) return;

    const sets = entries.map(([k], i) => `"${k}" = $${i + 1}`).join(", ");
    const values = [...entries.map(([, v]) => v), id];

    await db.execute(
      `UPDATE "${this.tableName}" SET ${sets} WHERE id = $${entries.length + 1}`,
      values
    );

    registrarAuditoria({
      usuario_id: _currentUserId,
      acao: "ALTERACAO",
      tabela: this.tableName,
      registro_id: id,
      descricao: `Alteração em ${this.tableName} #${id}`,
      valor_novo: JSON.stringify(Object.fromEntries(entries)),
    }).catch((err) => console.warn("Falha ao registrar auditoria:", err));
  }

  async softDelete(id: number): Promise<void> {
    if (!this.hasSoftDelete) {
      throw new Error(`BaseRepository.softDelete: ${this.tableName} não possui deleted_at`);
    }
    const db = await getDb();
    await db.execute(
      `UPDATE "${this.tableName}" SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [id]
    );

    registrarAuditoria({
      usuario_id: _currentUserId,
      acao: "EXCLUSAO",
      tabela: this.tableName,
      registro_id: id,
      descricao: `Exclusão em ${this.tableName} #${id}`,
    }).catch((err) => console.warn("Falha ao registrar auditoria:", err));
  }

  async hardDelete(id: number): Promise<void> {
    const db = await getDb();
    await db.execute(
      `DELETE FROM "${this.tableName}" WHERE id = $1`,
      [id]
    );

    registrarAuditoria({
      usuario_id: _currentUserId,
      acao: "EXCLUSAO",
      tabela: this.tableName,
      registro_id: id,
      descricao: `Exclusão permanente em ${this.tableName} #${id}`,
    }).catch((err) => console.warn("Falha ao registrar auditoria:", err));
  }

  async restore(id: number): Promise<void> {
    if (!this.hasSoftDelete) {
      throw new Error(`BaseRepository.restore: ${this.tableName} não possui deleted_at`);
    }
    const db = await getDb();
    await db.execute(
      `UPDATE "${this.tableName}" SET deleted_at = NULL WHERE id = $1`,
      [id]
    );

    registrarAuditoria({
      usuario_id: _currentUserId,
      acao: "ALTERACAO",
      tabela: this.tableName,
      registro_id: id,
      descricao: `Restauração em ${this.tableName} #${id}`,
    }).catch((err) => console.warn("Falha ao registrar auditoria:", err));
  }
}
