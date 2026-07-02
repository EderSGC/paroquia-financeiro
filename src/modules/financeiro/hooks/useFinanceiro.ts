import { useState, useEffect, useCallback, useMemo } from 'react';
import { useFinanceiroStore, Lancamento } from '../services';
import { getDb } from '@core/database';
import { FinanceiroRepository } from '../repository/financeiro.repository';
import { save, ask } from '@tauri-apps/plugin-dialog';
import { writeTextFile } from '@tauri-apps/plugin-fs';
import { carregarPartilha, type ConfigPartilha } from '../../auth/services/auth.service';
import { calcularRepasse } from '../services/repasse.service';
import { registrarAuditoria } from '@core/services/auditoria.service';
import { useToast } from '@core/ui/Toast';

interface ComunidadeDB {
  id: number;
  nome: string;
}

interface UseFinanceiroOptions {
  /** Quando definido, bloqueia o filtro de unidade a essa comunidade */
  comunidadeNomeFiltro?: string | null;
  /** ID do usuário logado — necessário para registrar auditoria de exclusão */
  usuarioId?: number;
}

export const useFinanceiro = (options: UseFinanceiroOptions = {}) => {
  const { comunidadeNomeFiltro, usuarioId } = options;
  const bloqueado = !!comunidadeNomeFiltro;
  const { showToast } = useToast();

  const [abaAtiva, setAbaAtiva] = useState('dizimo');
  const { dizimos, setDizimos } = useFinanceiroStore();

  const [nome, setNome] = useState('');
  const [valor, setValor] = useState('');
  const [data, setData] = useState(new Date().toISOString().split('T')[0]);
  const [metodo, setMetodo] = useState('DINHEIRO');
  const [tipoFluxo, setTipoFluxo] = useState('ENTRADA');
  const [busca, setBusca] = useState('');

  const [unidadeRegistro, setUnidadeRegistro] = useState(comunidadeNomeFiltro ?? 'PAROQUIA');
  const [filtroUnidade, setFiltroUnidadeInternal] = useState(comunidadeNomeFiltro ?? 'TODOS');
  const [comunidades, setComunidades] = useState<ComunidadeDB[]>([]);
  const [fieis, setFieis] = useState<{ id: number; nome: string }[]>([]);
  const [fielId, setFielId] = useState<string | number>('');

  const [configPartilha, setConfigPartilha] = useState<ConfigPartilha>({
    comunidade: 30, areaMissionaria: 40, arquidiocese: 29, fundoMissionario: 1,
  });

  // Se o filtro estiver bloqueado, não permite mudar
  function setFiltroUnidade(v: string) {
    if (bloqueado) return;
    setFiltroUnidadeInternal(v);
  }

  const carregarDados = useCallback(async () => {
    try {
      const db = await getDb();

      // Carrega apenas os 2 anos mais recentes em memória — evita degradação com anos de uso.
      // Registros mais antigos continuam acessíveis via queries diretas no módulo Histórico.
      const cutoff = `${new Date().getFullYear() - 1}-01-01`;
      const comFilter = comunidadeNomeFiltro ? " AND l.origem = ?" : "";
      const comParams = comunidadeNomeFiltro ? [cutoff, comunidadeNomeFiltro] : [cutoff];
      const dados = await db.select<Lancamento[]>(`
        SELECT l.*, f.nome AS nome_fiel
        FROM lancamentos l
        LEFT JOIN fieis f ON l.fiel_id = f.id
        WHERE l.data >= ? AND l.deleted_at IS NULL${comFilter}
        ORDER BY l.data DESC
      `, comParams);
      setDizimos(dados);

      const listaComunidades = await FinanceiroRepository.findComunidades();
      setComunidades(listaComunidades);

      const listaFieis = await db.select<{ id: number; nome: string }[]>("SELECT id, nome FROM fieis WHERE deleted_at IS NULL ORDER BY nome ASC");
      setFieis(listaFieis);

      const cfg = await carregarPartilha();
      setConfigPartilha(cfg);
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
    }
  }, [setDizimos, comunidadeNomeFiltro]);

  const registrar = async () => {
    if (!valor || (!nome && !fielId)) { showToast("Preencha os campos obrigatórios.", "error"); return; }
    const valorNumerico = parseFloat(valor.replace(',', '.'));
    try {
      const tipoFinal = abaAtiva === 'fluxo' ? tipoFluxo : 'ENTRADA';
      const fielIdNum = fielId ? Number(fielId) : null;
      const descricaoFinal = fielIdNum
        ? (fieis.find(f => Number(f.id) === fielIdNum)?.nome || nome)
        : nome;
      await FinanceiroRepository.lancamentos.create({
        fiel_id: fielIdNum,
        categoria: abaAtiva,
        descricao: descricaoFinal,
        valor: valorNumerico,
        metodo,
        data,
        tipo: tipoFinal,
        origem: unidadeRegistro,
      });
      setNome(''); setValor(''); setFielId('');
      await carregarDados();
      showToast("Lançamento registrado com sucesso!", "success");
    } catch (e) {
      console.error("Erro SQL:", e);
      showToast("Erro ao salvar. Verifique os dados e tente novamente.", "error");
    }
  };

  const calcularResumo = () => {
    const lista = filtroUnidade === 'TODOS' ? dizimos : dizimos.filter(i => i.origem === filtroUnidade);
    const entradas = lista.reduce((acc, cur) => cur.tipo === 'ENTRADA' ? acc + cur.valor : acc, 0);
    const saidas   = lista.reduce((acc, cur) => cur.tipo === 'SAIDA'   ? acc + cur.valor : acc, 0);
    return { entradas, saidas, saldo: entradas - saidas };
  };

  // Usa repasse.service.ts como fonte única da cascata — não duplicar a lógica aqui.
  const calcularPartilha = (saldoBase?: number) => {
    let entradas = 0, saidas = 0, base: number;
    if (saldoBase !== undefined) {
      base = Math.max(0, saldoBase);
    } else {
      const lista = filtroUnidade === 'TODOS' ? dizimos : dizimos.filter(i => i.origem === filtroUnidade);
      entradas = lista.reduce((acc, cur) => cur.tipo === 'ENTRADA' ? acc + cur.valor : acc, 0);
      saidas   = lista.reduce((acc, cur) => cur.tipo === 'SAIDA'   ? acc + cur.valor : acc, 0);
      base = Math.max(0, entradas - saidas);
    }
    const r = calcularRepasse(base, configPartilha);
    return {
      saldoFinal: base, entradas, saidas,
      comunidade:       r.comunidade,
      areaMissionaria:  r.areaMissionaria,
      arquidiocese:     r.arquidiocese,
      fundoMissionario: r.fundoMissionario,
      saldoDisponivel:  r.saldoDisponivel,
    };
  };

  // ── Conferência Física e Saldo Anterior ────────────────────────────────────
  const buscarFechamento = useCallback(async (data_: string, unidade: string) => {
    return FinanceiroRepository.caixas.findByDataUnidade(data_, unidade).catch(() => null);
  }, []);

  const salvarFechamento = useCallback(async (data_: string, unidade: string, dinheiro: number, pix: number, saldoAnterior: number, observacao: string, saldoDisponivel?: number) => {
    try {
      await FinanceiroRepository.caixas.upsert(data_, unidade, dinheiro, pix, saldoAnterior, observacao, saldoDisponivel ?? 0);
    } catch(e) { console.error(e); }
  }, []);

  // Lançamentos filtrados por data E unidade (para a visão diária)
  const getLancamentosDia = (data_: string, unidade: string) => {
    return dizimos.filter(i =>
      i.data === data_ &&
      (unidade === 'TODOS' || i.origem === unidade)
    ).sort((a, b) => a.id - b.id);
  };

  const apagarRegistro = async (id: number) => {
    const ok = await ask("Deseja apagar este registro?", { title: "Confirmar exclusão", kind: "warning" });
    if (!ok) return;
    const db = await getDb();
    const regs = await db.select<Lancamento[]>("SELECT * FROM lancamentos WHERE id=$1 AND deleted_at IS NULL", [id]);
    await FinanceiroRepository.lancamentos.softDelete(id);
    const reg = regs[0];
    if (usuarioId && reg) {
      await registrarAuditoria({
        usuario_id: usuarioId,
        acao: 'EXCLUSAO',
        tabela: 'lancamentos',
        registro_id: id,
        descricao: `Excluído (soft-delete): ${reg.tipo} "${reg.descricao}" R$${Number(reg.valor).toFixed(2)} em ${reg.data} (${reg.origem})`,
      }).catch(() => {});
    }
    await carregarDados();
  };

  const exportarCSV = async (lista: Lancamento[], titulo: string) => {
    let conteudo = `RELATÓRIO:;${titulo.toUpperCase()}\nData;Descrição;Valor;Origem\n`;
    lista.forEach(d => { conteudo += `${d.data};${d.descricao};${d.valor};${d.origem}\n`; });
    const caminho = await save({ filters: [{ name: 'CSV', extensions: ['csv'] }] });
    if (caminho) await writeTextFile(caminho, conteudo);
  };

  useEffect(() => { carregarDados(); }, [carregarDados]);

  const dadosFiltradosMemo = useMemo(() =>
    dizimos.filter(i => i.categoria === abaAtiva && (filtroUnidade === 'TODOS' || i.origem === filtroUnidade)),
    [dizimos, abaAtiva, filtroUnidade]
  );
  const resumoMemo = useMemo(() => calcularResumo(), [dizimos, configPartilha]);
  const partilhaMemo = useMemo(() => calcularPartilha(), [dizimos, configPartilha]);

  return {
    abaAtiva, setAbaAtiva, busca, setBusca, unidadeRegistro, setUnidadeRegistro,
    filtroUnidade, setFiltroUnidade, bloqueado,
    comunidades, fieis, fielId, setFielId, registrar, apagarRegistro,
    exportarCSV, totalGeral: dizimos, nome, setNome, valor, setValor,
    data, setData, metodo, setMetodo, tipoFluxo, setTipoFluxo,
    dadosFiltrados: dadosFiltradosMemo,
    resumo: resumoMemo,
    partilha: partilhaMemo,
    calcularPartilha,
    configPartilha,
    buscarFechamento,
    salvarFechamento,
    getLancamentosDia,
    carregarDados,
  };
};
