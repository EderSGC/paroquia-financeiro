
import React, { useEffect, useState } from 'react';
import { getDb } from '@core/database';

type TipoConta = "caixa_matriz" | "caixa_comunidade" | "conta_bancaria" | "cofre" | "carteira" | "fundo_especifico" | "conta_obra" | "conta_festa" | "conta_pastoral";

interface Conta {
  id: number;
  nome: string;
  tipo: TipoConta;
  saldo: number;
  descricao?: string;
  ativo: boolean;
}

const tiposConta: { value: TipoConta; label: string }[] = [
  { value: 'caixa_matriz', label: 'Caixa da Matriz' },
  { value: 'caixa_comunidade', label: 'Caixa de Comunidade' },
  { value: 'conta_bancaria', label: 'Conta Bancária' },
  { value: 'cofre', label: 'Cofre' },
  { value: 'carteira', label: 'Carteira' },
  { value: 'fundo_especifico', label: 'Fundo Específico' },
  { value: 'conta_obra', label: 'Conta de Obra' },
  { value: 'conta_festa', label: 'Conta de Festa' },
  { value: 'conta_pastoral', label: 'Conta de Pastoral' },
];

export const CaixasContas: React.FC = () => {
  const [contas, setContas] = useState<Conta[]>([]);
  const [nome, setNome] = useState('');
  const [tipo, setTipo] = useState<TipoConta>('caixa_matriz');
  const [descricao, setDescricao] = useState('');
  const [erro, setErro] = useState('');

  async function carregarContas() {
    try {
      const db = await getDb();
      const lista = await db.select<Conta[]>("SELECT * FROM contas WHERE ativo = 1 ORDER BY nome ASC");
      setContas(lista);
    } catch (e) {
      setErro('Erro ao carregar contas.');
    }
  }

  async function cadastrarConta(e: React.FormEvent) {
    e.preventDefault();
    if (!nome) return setErro('Nome obrigatório.');
    try {
      const db = await getDb();
      await db.execute(
        'INSERT INTO contas (nome, tipo, saldo, descricao, ativo, created_at, updated_at) VALUES ($1, $2, 0, $3, 1, $4, $4)',
        [nome, tipo, descricao, new Date().toISOString()]
      );
      setNome(''); setDescricao(''); setTipo('caixa_matriz');
      setErro('');
      carregarContas();
    } catch (e) {
      setErro('Erro ao cadastrar conta.');
    }
  }

  useEffect(() => { carregarContas(); }, []);

  return (
    <div>
      <h2>Caixas e Contas</h2>

      <form onSubmit={cadastrarConta} style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <input value={nome} onChange={e => setNome(e.target.value)} placeholder="Nome da conta" style={{ flex: 2, padding: 8 }} />
        <select value={tipo} onChange={e => setTipo(e.target.value as TipoConta)} style={{ flex: 1, padding: 8 }}>
          {tiposConta.map(tc => <option key={tc.value} value={tc.value}>{tc.label}</option>)}
        </select>
        <input value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Descrição" style={{ flex: 2, padding: 8 }} />
        <button type="submit" style={{ padding: 8, background: '#059669', color: 'white', border: 'none', borderRadius: 6 }}>Cadastrar</button>
      </form>
      {erro && <div style={{ color: 'red', marginBottom: 8 }}>{erro}</div>}

      <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff' }}>
        <thead>
          <tr style={{ background: '#f3f4f6' }}>
            <th style={{ padding: 8 }}>Nome</th>
            <th style={{ padding: 8 }}>Tipo</th>
            <th style={{ padding: 8 }}>Descrição</th>
            <th style={{ padding: 8 }}>Saldo</th>
          </tr>
        </thead>
        <tbody>
          {contas.map(conta => (
            <tr key={conta.id}>
              <td style={{ padding: 8 }}>{conta.nome}</td>
              <td style={{ padding: 8 }}>{tiposConta.find(tc => tc.value === conta.tipo)?.label || conta.tipo}</td>
              <td style={{ padding: 8 }}>{conta.descricao}</td>
              <td style={{ padding: 8, color: conta.saldo < 0 ? 'red' : '#166534', fontWeight: 'bold' }}>R$ {conta.saldo.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
