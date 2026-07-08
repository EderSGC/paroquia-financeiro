// src/modules/cadastros/pages/CadastrosPage.tsx
// Cadastros básicos do app financeiro: Comunidades, Fiéis e Dizimistas.
// As comunidades alimentam o seletor de unidade do Movimento do Caixa;
// os fiéis/dizimistas alimentam os lançamentos de dízimo.
import { useCallback, useEffect, useState } from 'react';
import { PastoralRepository } from '@core/repository/pastoral.repository';
import { FielService } from '@core/services/fiel.service';
import { useToast } from '@core/ui/Toast';
import { ModalConfirm } from '@core/ui/Modal';
import type { Comunidade, Fiel } from '@core/types/entities';
import { hasPermission } from '@core/auth/permissions';
import type { Usuario } from '@core/types/app.types';

export type AbaCadastro = 'comunidades' | 'fieis' | 'dizimistas';

const inp: React.CSSProperties = { width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #d0d5dd', fontSize: 13, boxSizing: 'border-box', fontFamily: 'inherit', background: 'white' };
const lbl: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 700, color: '#667085', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.04em' };
const card: React.CSSProperties = { background: 'white', borderRadius: 14, border: '1px solid #e4e7ec', padding: 20 };
const th: React.CSSProperties = { textAlign: 'left', padding: '9px 12px', fontSize: 11, fontWeight: 700, color: '#667085', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid #e4e7ec' };
const td: React.CSSProperties = { padding: '9px 12px', fontSize: 13, color: '#344054', borderBottom: '1px solid #f2f4f7' };

const btnPrimario: React.CSSProperties = { padding: '9px 20px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, background: '#1f3b73', color: 'white' };
const btnAcao: React.CSSProperties = { padding: '5px 10px', borderRadius: 6, border: '1px solid #d0d5dd', cursor: 'pointer', fontSize: 12, background: 'white', color: '#344054' };
const btnPerigo: React.CSSProperties = { ...btnAcao, color: '#b42318', borderColor: '#fda29b' };

/** Máscara de telefone BR: (00) 0000-0000 (fixo) ou (00) 00000-0000 (celular). */
function maskTelefone(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length === 0) return '';
  if (d.length <= 2)  return `(${d}`;
  if (d.length <= 6)  return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

const TITULOS: Record<AbaCadastro, { titulo: string; subtitulo: string }> = {
  comunidades: { titulo: 'Comunidades', subtitulo: 'As comunidades cadastradas aparecem no seletor de unidade do Movimento do Caixa.' },
  fieis:       { titulo: 'Fiéis',        subtitulo: 'Cadastro de fiéis para vínculo com lançamentos de dízimo.' },
  dizimistas:  { titulo: 'Dizimistas',   subtitulo: 'Fiéis marcados como dizimistas ativos.' },
};

/* ─── Comunidades ─────────────────────────────────────────────── */
function CadastroComunidades({ comunidadeFiltro }: { comunidadeFiltro: string | null }) {
  const { showToast } = useToast();
  const somenteLeitura = !!comunidadeFiltro; // membro não cria/edita/exclui comunidades
  const [lista, setLista] = useState<Comunidade[]>([]);
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [nome, setNome] = useState('');
  const [endereco, setEndereco] = useState('');
  const [coordNome, setCoordNome] = useState('');
  const [coordTel, setCoordTel] = useState('');
  const [idExcluir, setIdExcluir] = useState<number | null>(null);

  const carregar = useCallback(async () => {
    try {
      const todas = await PastoralRepository.comunidades.findAllOrdenadas();
      setLista(comunidadeFiltro ? todas.filter(c => c.nome === comunidadeFiltro) : todas);
    }
    catch (e) { console.error(e); showToast('Erro ao carregar comunidades.', 'error'); }
  }, [showToast, comunidadeFiltro]);

  useEffect(() => { carregar(); }, [carregar]);

  function limpar() {
    setEditandoId(null); setNome(''); setEndereco(''); setCoordNome(''); setCoordTel('');
  }

  function editar(c: Comunidade) {
    setEditandoId(c.id);
    setNome(c.nome);
    setEndereco(c.endereco ?? '');
    setCoordNome(c.coordenador_nome ?? '');
    setCoordTel(maskTelefone(c.coordenador_tel ?? ''));
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim()) { showToast('Informe o nome da comunidade.', 'error'); return; }
    const dados = { nome: nome.trim(), endereco: endereco.trim() || null, coordenador_nome: coordNome.trim() || null, coordenador_tel: coordTel.trim() || null };
    try {
      if (editandoId) {
        await PastoralRepository.comunidades.update(editandoId, dados);
        showToast('Comunidade atualizada!', 'success');
      } else {
        await PastoralRepository.comunidades.create(dados as Omit<Comunidade, 'id'>);
        showToast('Comunidade cadastrada!', 'success');
      }
      limpar();
      await carregar();
    } catch (err) { console.error(err); showToast('Erro ao salvar comunidade.', 'error'); }
  }

  async function excluir() {
    if (!idExcluir) return;
    try {
      await PastoralRepository.comunidades.softDelete(idExcluir);
      showToast('Comunidade excluída.', 'success');
      if (editandoId === idExcluir) limpar();
      await carregar();
    } catch (err) { console.error(err); showToast('Erro ao excluir comunidade.', 'error'); }
    finally { setIdExcluir(null); }
  }

  return (
    <>
      {!somenteLeitura && (
      <form onSubmit={salvar} style={{ ...card, marginBottom: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 2fr', gap: 12, marginBottom: 12 }}>
          <div>
            <label style={lbl}>Nome da Comunidade *</label>
            <input style={inp} value={nome} onChange={e => setNome(e.target.value)} placeholder="Ex.: Comunidade São José" />
          </div>
          <div>
            <label style={lbl}>Endereço</label>
            <input style={inp} value={endereco} onChange={e => setEndereco(e.target.value)} placeholder="Rua, número, bairro" />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto auto', gap: 12, alignItems: 'end' }}>
          <div>
            <label style={lbl}>Tesoureiro(a)</label>
            <input style={inp} value={coordNome} onChange={e => setCoordNome(e.target.value)} />
          </div>
          <div>
            <label style={lbl}>Telefone</label>
            <input style={inp} type="tel" inputMode="tel" value={coordTel} onChange={e => setCoordTel(maskTelefone(e.target.value))} placeholder="(00) 00000-0000" />
          </div>
          <button type="submit" style={btnPrimario}>{editandoId ? 'Salvar Alterações' : 'Cadastrar'}</button>
          {editandoId && <button type="button" style={btnAcao} onClick={limpar}>Cancelar</button>}
        </div>
      </form>
      )}

      <div style={card}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={th}>Nome</th>
              <th style={th}>Endereço</th>
              <th style={th}>Tesoureiro(a)</th>
              {!somenteLeitura && <th style={{ ...th, width: 140 }}>Ações</th>}
            </tr>
          </thead>
          <tbody>
            {lista.length === 0 && (
              <tr><td style={{ ...td, color: '#98a2b3', textAlign: 'center' }} colSpan={somenteLeitura ? 3 : 4}>Nenhuma comunidade cadastrada ainda.</td></tr>
            )}
            {lista.map(c => (
              <tr key={c.id}>
                <td style={{ ...td, fontWeight: 600 }}>{c.nome}</td>
                <td style={td}>{c.endereco || '—'}</td>
                <td style={td}>{c.coordenador_nome ? `${c.coordenador_nome}${c.coordenador_tel ? ` · ${c.coordenador_tel}` : ''}` : '—'}</td>
                {!somenteLeitura && (
                <td style={td}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button style={btnAcao} onClick={() => editar(c)}>Editar</button>
                    <button style={btnPerigo} onClick={() => setIdExcluir(c.id)}>Excluir</button>
                  </div>
                </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ModalConfirm
        aberto={idExcluir !== null}
        titulo="Excluir comunidade"
        mensagem="Excluir esta comunidade? Os lançamentos existentes não serão apagados."
        cor="danger"
        onConfirmar={excluir}
        onCancelar={() => setIdExcluir(null)}
      />
    </>
  );
}

/* ─── Fiéis / Dizimistas ──────────────────────────────────────── */
function CadastroFieis({ somenteDizimistas, comunidadeFiltro }: { somenteDizimistas: boolean; comunidadeFiltro: string | null }) {
  const { showToast } = useToast();
  const [lista, setLista] = useState<Fiel[]>([]);
  const [comunidades, setComunidades] = useState<{ id: number; nome: string }[]>([]);
  const [busca, setBusca] = useState('');
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [comunidade, setComunidade] = useState(comunidadeFiltro ?? '');
  const [dizimista, setDizimista] = useState(somenteDizimistas);
  const [idExcluir, setIdExcluir] = useState<number | null>(null);

  const carregar = useCallback(async () => {
    try {
      const [fs, cs] = await Promise.all([
        PastoralRepository.fieis.findAllOrdenados(1000),
        PastoralRepository.comunidades.findNomes(),
      ]);
      // Membro só vê os fiéis/dizimistas da própria comunidade
      const visiveis = comunidadeFiltro ? fs.filter(f => f.comunidade === comunidadeFiltro) : fs;
      setLista(somenteDizimistas ? visiveis.filter(f => f.isDizimista === 1) : visiveis);
      setComunidades(cs);
    } catch (e) { console.error(e); showToast('Erro ao carregar fiéis.', 'error'); }
  }, [somenteDizimistas, showToast, comunidadeFiltro]);

  useEffect(() => { carregar(); }, [carregar]);

  function limpar() {
    setEditandoId(null); setNome(''); setTelefone(''); setComunidade(comunidadeFiltro ?? ''); setDizimista(somenteDizimistas);
  }

  function editar(f: Fiel) {
    setEditandoId(f.id);
    setNome(f.nome);
    setTelefone(maskTelefone(f.telefone ?? ''));
    setComunidade(f.comunidade ?? '');
    setDizimista(f.isDizimista === 1);
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim()) { showToast('Informe o nome.', 'error'); return; }
    try {
      if (editandoId) {
        await PastoralRepository.fieis.update(editandoId, {
          nome: nome.trim(),
          telefone: telefone.trim() || null,
          comunidade: comunidade || null,
          isDizimista: dizimista ? 1 : 0,
        });
        showToast('Cadastro atualizado!', 'success');
      } else {
        const { id, created } = await FielService.findOrCreate({
          nome: nome.trim(),
          telefone: telefone.trim() || undefined,
          comunidade: comunidade || undefined,
          isDizimista: dizimista,
        });
        if (!created && dizimista) {
          await PastoralRepository.fieis.update(id, { isDizimista: 1 });
        }
        showToast(created ? 'Fiel cadastrado!' : 'Fiel já existia — cadastro reaproveitado.', 'success');
      }
      limpar();
      await carregar();
    } catch (err) { console.error(err); showToast('Erro ao salvar cadastro.', 'error'); }
  }

  async function alternarDizimista(f: Fiel) {
    try {
      await PastoralRepository.fieis.update(f.id, { isDizimista: f.isDizimista === 1 ? 0 : 1 });
      await carregar();
    } catch (err) { console.error(err); showToast('Erro ao atualizar dizimista.', 'error'); }
  }

  async function excluir() {
    if (!idExcluir) return;
    try {
      await PastoralRepository.fieis.softDelete(idExcluir);
      showToast('Cadastro excluído.', 'success');
      if (editandoId === idExcluir) limpar();
      await carregar();
    } catch (err) { console.error(err); showToast('Erro ao excluir cadastro.', 'error'); }
    finally { setIdExcluir(null); }
  }

  const filtrados = busca.trim()
    ? lista.filter(f => f.nome.toLowerCase().includes(busca.trim().toLowerCase()))
    : lista;

  return (
    <>
      <form onSubmit={salvar} style={{ ...card, marginBottom: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div>
            <label style={lbl}>Nome Completo *</label>
            <input style={inp} value={nome} onChange={e => setNome(e.target.value)} />
          </div>
          <div>
            <label style={lbl}>Telefone</label>
            <input style={inp} type="tel" inputMode="tel" value={telefone} onChange={e => setTelefone(maskTelefone(e.target.value))} placeholder="(00) 00000-0000" />
          </div>
          <div>
            <label style={lbl}>Comunidade</label>
            {comunidadeFiltro ? (
              <div style={{ ...inp, background: '#f5f7fa', color: '#344054', fontWeight: 700 }}>{comunidadeFiltro}</div>
            ) : (
              <select style={inp} value={comunidade} onChange={e => setComunidade(e.target.value)}>
                <option value="">— Selecione —</option>
                {comunidades.map(c => <option key={c.id} value={c.nome}>{c.nome}</option>)}
              </select>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, color: '#344054', cursor: 'pointer', fontWeight: 600 }}>
            <input type="checkbox" checked={dizimista} onChange={e => setDizimista(e.target.checked)} />
            Dizimista
          </label>
          <div style={{ flex: 1 }} />
          <button type="submit" style={btnPrimario}>{editandoId ? 'Salvar Alterações' : 'Cadastrar'}</button>
          {editandoId && <button type="button" style={btnAcao} onClick={limpar}>Cancelar</button>}
        </div>
      </form>

      <div style={card}>
        <input
          style={{ ...inp, maxWidth: 320, marginBottom: 12 }}
          value={busca}
          onChange={e => setBusca(e.target.value)}
          placeholder={somenteDizimistas ? 'Buscar dizimista...' : 'Buscar fiel...'}
        />
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={th}>Nome</th>
              <th style={th}>Telefone</th>
              <th style={th}>Comunidade</th>
              <th style={th}>Dízimo</th>
              <th style={{ ...th, width: 220 }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtrados.length === 0 && (
              <tr>
                <td style={{ ...td, color: '#98a2b3', textAlign: 'center' }} colSpan={5}>
                  {somenteDizimistas ? 'Nenhum dizimista ativo. Cadastre acima ou marque um fiel como dizimista.' : 'Nenhum fiel encontrado.'}
                </td>
              </tr>
            )}
            {filtrados.map(f => (
              <tr key={f.id}>
                <td style={{ ...td, fontWeight: 600 }}>{f.nome}</td>
                <td style={td}>{f.telefone || '—'}</td>
                <td style={td}>{f.comunidade || '—'}</td>
                <td style={td}>
                  <span style={{
                    display: 'inline-block', padding: '2px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700,
                    background: f.isDizimista === 1 ? '#ecfdf3' : '#f2f4f7',
                    color: f.isDizimista === 1 ? '#027a48' : '#667085',
                  }}>
                    {f.isDizimista === 1 ? 'Dizimista' : '—'}
                  </span>
                </td>
                <td style={td}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button style={btnAcao} onClick={() => editar(f)}>Editar</button>
                    <button style={btnAcao} onClick={() => alternarDizimista(f)}>
                      {f.isDizimista === 1 ? 'Remover dízimo' : 'Tornar dizimista'}
                    </button>
                    {!somenteDizimistas && <button style={btnPerigo} onClick={() => setIdExcluir(f.id)}>Excluir</button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ModalConfirm
        aberto={idExcluir !== null}
        titulo="Excluir cadastro"
        mensagem="Excluir este fiel? Os lançamentos de dízimo vinculados não serão apagados."
        cor="danger"
        onConfirmar={excluir}
        onCancelar={() => setIdExcluir(null)}
      />
    </>
  );
}

/* ─── Página ──────────────────────────────────────────────────── */
export function CadastrosPage({ aba, usuario }: { aba: AbaCadastro; usuario?: Usuario }) {
  const { titulo, subtitulo } = TITULOS[aba];
  // Mesma regra do módulo financeiro: membro de comunidade só vê a própria comunidade
  const isMembro = usuario ? !hasPermission(usuario.papel, 'financeiro', 'acessar_configuracoes') : false;
  const comunidadeFiltro = isMembro ? (usuario?.comunidade_nome ?? null) : null;
  return (
    <div style={{ padding: 24, maxWidth: 1100 }}>
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#1d2939' }}>{titulo}</h1>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: '#667085' }}>{subtitulo}</p>
      </div>
      {aba === 'comunidades' && <CadastroComunidades comunidadeFiltro={comunidadeFiltro} />}
      {aba === 'fieis' && <CadastroFieis somenteDizimistas={false} comunidadeFiltro={comunidadeFiltro} />}
      {aba === 'dizimistas' && <CadastroFieis key="diz" somenteDizimistas={true} comunidadeFiltro={comunidadeFiltro} />}
    </div>
  );
}
