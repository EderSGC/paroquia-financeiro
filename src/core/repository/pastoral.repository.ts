import { getDb } from '@core/database';
import { Fiel, Comunidade, Familia, MembroFamilia, Grupo, GrupoMembro, Pastoral } from '@core/types/entities';
import { BaseRepository } from '@core/repository';

interface MembroComFiel extends MembroFamilia {
  nome_fiel?: string | null;
}

class FielRepositoryClass extends BaseRepository<Fiel> {
  constructor() { super('fieis', true); }

  async findAllOrdenados(limit = 500, offset = 0): Promise<Fiel[]> {
    const db = await getDb();
    return db.select<Fiel[]>(
      'SELECT * FROM fieis WHERE deleted_at IS NULL ORDER BY nome ASC LIMIT $1 OFFSET $2',
      [limit, offset]
    );
  }

  async count(filtro?: string): Promise<number> {
    const db = await getDb();
    if (filtro) {
      const rows = await db.select<{ total: number }[]>(
        'SELECT COUNT(*) as total FROM fieis WHERE deleted_at IS NULL AND nome LIKE $1',
        [`%${filtro}%`]
      );
      return rows[0]?.total ?? 0;
    }
    const rows = await db.select<{ total: number }[]>(
      'SELECT COUNT(*) as total FROM fieis WHERE deleted_at IS NULL'
    );
    return rows[0]?.total ?? 0;
  }

  async findByNome(termo: string, limit = 50): Promise<Fiel[]> {
    const db = await getDb();
    return db.select<Fiel[]>(
      'SELECT * FROM fieis WHERE nome LIKE $1 AND deleted_at IS NULL ORDER BY nome ASC LIMIT $2',
      [`%${termo}%`, limit]
    );
  }
}

class ComunidadeRepositoryClass extends BaseRepository<Comunidade> {
  constructor() { super('comunidades', true); }

  async findAllOrdenadas(): Promise<Comunidade[]> {
    const db = await getDb();
    return db.select<Comunidade[]>('SELECT * FROM comunidades WHERE deleted_at IS NULL ORDER BY nome ASC');
  }

  async findNomes(): Promise<{ id: number; nome: string }[]> {
    const db = await getDb();
    return db.select<{ id: number; nome: string }[]>(
      'SELECT id, nome FROM comunidades WHERE deleted_at IS NULL ORDER BY nome ASC'
    );
  }
}

class FamiliaRepositoryClass extends BaseRepository<Familia> {
  constructor() { super('familias', true); }

  async findAllOrdenadas(): Promise<Familia[]> {
    const db = await getDb();
    return db.select<Familia[]>('SELECT * FROM familias WHERE deleted_at IS NULL ORDER BY sobrenome ASC');
  }

  async contagemPorFamilia(): Promise<Record<number, number>> {
    const db = await getDb();
    const rows = await db.select<{ familia_id: number; total: number }[]>(
      'SELECT familia_id, COUNT(*) as total FROM membros_familia WHERE deleted_at IS NULL GROUP BY familia_id'
    ).catch(() => [] as { familia_id: number; total: number }[]);
    const mapa: Record<number, number> = {};
    rows.forEach(r => { mapa[r.familia_id] = r.total; });
    return mapa;
  }
}

class MembroFamiliaRepositoryClass extends BaseRepository<MembroFamilia> {
  constructor() { super('membros_familia', true); }

  async findByFamilia(familiaId: number): Promise<MembroComFiel[]> {
    const db = await getDb();
    return db.select<MembroComFiel[]>(
      `SELECT m.*, f.nome as nome_fiel
       FROM membros_familia m
       JOIN fieis f ON m.fiel_id = f.id
       WHERE m.familia_id = $1 AND m.deleted_at IS NULL AND f.deleted_at IS NULL`,
      [familiaId]
    );
  }

  async vincular(familiaId: number, fielId: number, parentesco: string): Promise<void> {
    const db = await getDb();
    await db.execute(
      'INSERT INTO membros_familia (familia_id, fiel_id, parentesco) VALUES ($1, $2, $3)',
      [familiaId, fielId, parentesco]
    );
  }
}

class GrupoRepositoryClass extends BaseRepository<Grupo> {
  constructor() { super('grupos', true); }

  async findAllOrdenados(): Promise<Grupo[]> {
    const db = await getDb();
    return db.select<Grupo[]>('SELECT * FROM grupos WHERE deleted_at IS NULL ORDER BY nome ASC');
  }
}

interface GrupoMembroComFiel extends GrupoMembro {
  nome_fiel?: string | null;
  telefone_fiel?: string | null;
}

class GrupoMembrosRepositoryClass extends BaseRepository<GrupoMembro> {
  constructor() { super('grupo_membros', false); }

  async findByGrupo(grupoId: number): Promise<GrupoMembroComFiel[]> {
    const db = await getDb();
    return db.select<GrupoMembroComFiel[]>(
      `SELECT gm.*, f.nome as nome_fiel, f.telefone as telefone_fiel
       FROM grupo_membros gm
       JOIN fieis f ON gm.fiel_id = f.id
       WHERE gm.grupo_id = $1 AND f.deleted_at IS NULL
       ORDER BY f.nome ASC`,
      [grupoId]
    );
  }

  async vincular(grupoId: number, fielId: number, cargo: string): Promise<boolean> {
    const db = await getDb();
    const existing = await db.select<{ id: number }[]>(
      'SELECT id FROM grupo_membros WHERE grupo_id=$1 AND fiel_id=$2',
      [grupoId, fielId]
    );
    if (existing.length > 0) return false;
    await db.execute(
      'INSERT INTO grupo_membros (grupo_id, fiel_id, cargo) VALUES ($1, $2, $3)',
      [grupoId, fielId, cargo]
    );
    return true;
  }

  async contagemPorGrupo(): Promise<Record<number, number>> {
    const db = await getDb();
    const rows = await db.select<{ grupo_id: number; total: number }[]>(
      'SELECT gm.grupo_id, COUNT(*) as total FROM grupo_membros gm JOIN fieis f ON f.id = gm.fiel_id AND f.deleted_at IS NULL GROUP BY gm.grupo_id'
    ).catch(() => [] as { grupo_id: number; total: number }[]);
    const mapa: Record<number, number> = {};
    rows.forEach(r => { mapa[r.grupo_id] = r.total; });
    return mapa;
  }
}

class PastoralRepositoryClass extends BaseRepository<Pastoral> {
  constructor() { super('pastorais', true); }

  async findAllOrdenadas(): Promise<Pastoral[]> {
    const db = await getDb();
    return db.select<Pastoral[]>('SELECT * FROM pastorais WHERE deleted_at IS NULL ORDER BY nome ASC');
  }
}

export const PastoralRepository = {
  fieis: new FielRepositoryClass(),
  comunidades: new ComunidadeRepositoryClass(),
  familias: new FamiliaRepositoryClass(),
  membros: new MembroFamiliaRepositoryClass(),
  grupos: new GrupoRepositoryClass(),
  grupoMembros: new GrupoMembrosRepositoryClass(),
  pastorais: new PastoralRepositoryClass(),
};
