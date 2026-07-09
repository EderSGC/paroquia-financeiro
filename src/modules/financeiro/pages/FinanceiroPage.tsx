import { useState, useEffect, useCallback } from 'react';
import { useFinanceiro } from '../hooks/useFinanceiro';
import type { Lancamento } from '../services';
import type { Usuario, Paroquia } from '../../../core/types/app.types';
import { hasPermission } from '@core/auth/permissions';
import type { ConfiguracaoPartilha } from '../../../core/types/entities';
import { getDb } from '@core/database';
import { FinanceiroRepository } from '../repository/financeiro.repository';
import { calcularRepasse, dbRowToPartilha, resolverSaldoAnteriorConciliado, round2 } from '../services/repasse.service';
import { RelatorioMensalPreview } from '../components/RelatorioMensalPreview';
import { RelatorioDiarioPreview } from '../components/RelatorioDiarioPreview';
import { useToast } from '@core/ui/Toast';
import { ask } from '@tauri-apps/plugin-dialog';

interface FinanceiroPageProps {
  paroquia?: Paroquia | null;
  usuario?: Usuario;
  abaPadrao?: string;
}

interface RepasseMes {
  mes: string;
  entradas: number; saidas: number; saldoBruto: number;
  comunidade: number; areaMissionaria: number; arquidiocese: number;
  fundoMissionario: number; totalRepasse: number; saldoDisponivel: number;
}

type AbaFinanceiro = 'caixa' | 'historico' | 'repasses';

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/* Campos monetários digitáveis — máscara pt-BR (1.234,56) */
const fmtMoneyInput = (v: number) => v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
/** Digitos viram centavos: "447135" → "4.471,35". Aceita colar "4471.35" ou "4.471,35". */
const maskMoney = (v: string) => {
  const d = v.replace(/\D/g, '');
  return d ? fmtMoneyInput(parseInt(d, 10) / 100) : '';
};
/** Converte o texto mascarado de volta para número: "4.471,35" → 4471.35 */
const parseMoney = (v: string) => {
  const n = parseFloat(v.replace(/\./g, '').replace(',', '.'));
  return isNaN(n) ? 0 : n;
};
const hoje = () => new Date().toISOString().split('T')[0];

const inp: React.CSSProperties = { width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #d0d5dd', fontSize: 13, boxSizing: 'border-box', fontFamily: 'inherit' };
const lbl: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 700, color: '#667085', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.04em' };
const card: React.CSSProperties = { background: 'white', borderRadius: 14, border: '1px solid #e4e7ec', padding: 20 };

export function FinanceiroPage({ paroquia, usuario }: FinanceiroPageProps) {
  const isMembro = usuario ? !hasPermission(usuario.papel, "financeiro", "acessar_configuracoes") : false;
  const comunidadeNomeFiltro = isMembro ? (usuario?.comunidade_nome ?? null) : null;

  const {
    comunidades, calcularPartilha, configPartilha,
    buscarFechamento, salvarFechamento,
    carregarDados, totalGeral,
  } = useFinanceiro({ comunidadeNomeFiltro, usuarioId: usuario?.id });
  const { showToast } = useToast();

  const [aba, setAba] = useState<AbaFinanceiro>('caixa');
  const [dataSel, setDataSel] = useState(hoje());
  const [dataSelFim, setDataSelFim] = useState(hoje());
  const [unidade, setUnidade] = useState(comunidadeNomeFiltro ?? '');

  // Form de lançamento
  const [dataLanc, setDataLanc] = useState(hoje());
  const [docNum, setDocNum]   = useState('');
  const [hist, setHist]       = useState('');
  const [vlrEntrada, setVlrEntrada] = useState('');
  const [vlrSaida, setVlrSaida]     = useState('');
  const [tipoForm, setTipoForm]     = useState<'ENTRADA'|'SAIDA'>('ENTRADA');
  const [modoEntrada, setModoEntrada] = useState<'DINHEIRO'|'PIX'>('DINHEIRO');

  // Modal de edição de lançamento
  const [editando, setEditando] = useState<Lancamento | null>(null);
  const [editData, setEditData]     = useState('');
  const [editDoc, setEditDoc]       = useState('');
  const [editHist, setEditHist]     = useState('');
  const [editValor, setEditValor]   = useState('');
  const [editTipo, setEditTipo]     = useState<'ENTRADA'|'SAIDA'>('ENTRADA');
  const [editMetodo, setEditMetodo] = useState('DINHEIRO');
  const [editOrigem, setEditOrigem] = useState('');

  function abrirEdicao(l: Lancamento) {
    setEditando(l);
    setEditData(l.data ?? '');
    setEditDoc(l.doc_num ?? '');
    setEditHist(l.descricao ?? '');
    setEditValor(String(l.valor ?? ''));
    setEditTipo((l.tipo ?? 'ENTRADA') as 'ENTRADA' | 'SAIDA');
    setEditMetodo(l.metodo ?? 'DINHEIRO');
    setEditOrigem(l.origem ?? '');
  }

  async function handleSalvarEdicao() {
    if (!editando) return;
    const vlr = parseFloat(editValor.replace(',', '.'));
    if (!editHist.trim() || isNaN(vlr) || vlr <= 0) {
      showToast('Preencha o Histórico e o Valor corretamente.', 'error');
      return;
    }
    try {
      await FinanceiroRepository.lancamentos.update(editando.id, {
        data: editData,
        doc_num: editDoc || null,
        descricao: editHist,
        valor: vlr,
        tipo: editTipo,
        metodo: editMetodo,
        origem: editOrigem,
      });
      setEditando(null);
      await carregarDados();
      await sincronizarConferencia();
      showToast('Lançamento corrigido com sucesso!', 'success');
    } catch (e) {
      console.error(e);
      showToast('Erro ao salvar edição.', 'error');
    }
  }

  // Conferência Física
  const [dinheiro, setDinheiro]       = useState('');
  const [pix, setPix]                 = useState('');
  const [saldoAnterior, setSaldoAnterior] = useState('');
  const [obsConf, setObsConf]         = useState('');
  const [confSalva, setConfSalva]     = useState(false);
  const [saldoAnteriorBloqueado, setSaldoAnteriorBloqueado] = useState(false);

  // Histórico
  const [periodoInicio, setPeriodoInicio] = useState(hoje().slice(0,7) + '-01');
  const [periodoFim, setPeriodoFim]       = useState(hoje());
  const [filtroHist, setFiltroHist]       = useState(comunidadeNomeFiltro ?? 'TODOS');
  const [saldoFinalDisponivel, setSaldoFinalDisponivel] = useState(0);

  // Preview mensal e diário
  const [mostrarPreviewMes, setMostrarPreviewMes] = useState(false);
  const [mostrarPreviewDia, setMostrarPreviewDia] = useState(false);

  // Alerta de fechamento pendente
  const [alertaFechamento, setAlertaFechamento] = useState<string | null>(null);

  // Relatório de repasses
  const [anoRepasse, setAnoRepasse] = useState(new Date().getFullYear());
  const [unidadeRepasse, setUnidadeRepasse] = useState(comunidadeNomeFiltro ?? 'TODOS');
  const [dadosRepasse, setDadosRepasse] = useState<RepasseMes[]>([]);
  const [loadingRepasse, setLoadingRepasse] = useState(false);

  // Lixeira (soft-delete)
  const [showLixeira, setShowLixeira] = useState(false);
  const [lixeiraItems, setLixeiraItems] = useState<Lancamento[]>([]);

  // Soma as ENTRADAS do dia por método — base do auto-preenchimento da Conferência Física
  const somaEntradasPorMetodo = useCallback(async (dia: string, unid: string) => {
    const db = await getDb();
    const rows = await db.select<{ metodo: string; total: number }[]>(
      "SELECT metodo, SUM(valor) AS total FROM lancamentos WHERE data = ? AND origem = ? AND tipo = 'ENTRADA' AND deleted_at IS NULL GROUP BY metodo",
      [dia, unid]
    ).catch(() => [] as { metodo: string; total: number }[]);
    return {
      dinheiroDia: rows.filter(r => r.metodo === 'DINHEIRO').reduce((s, r) => s + (r.total || 0), 0),
      pixDia:      rows.filter(r => r.metodo === 'PIX').reduce((s, r) => s + (r.total || 0), 0),
    };
  }, []);

  // Editar/excluir lançamento invalida o auto-preenchimento da conferência:
  // re-sincroniza Dinheiro/PIX com o livro e, se a conferência do dia já
  // estava salva, marca como pendente para o usuário salvar de novo.
  const sincronizarConferencia = useCallback(async () => {
    if (dataSel !== dataSelFim || !unidade || unidade === 'TODOS') return;
    const { dinheiroDia, pixDia } = await somaEntradasPorMetodo(dataSel, unidade);
    const novoDinheiro = dinheiroDia > 0 ? fmtMoneyInput(dinheiroDia) : '';
    const novoPix      = pixDia > 0 ? fmtMoneyInput(pixDia) : '';
    if (novoDinheiro === dinheiro && novoPix === pix) return;
    setDinheiro(novoDinheiro);
    setPix(novoPix);
    if (confSalva) {
      setConfSalva(false);
      showToast('Lançamentos alterados — Conferência Física re-sincronizada. Confira e salve novamente.', 'info');
    }
  }, [dataSel, dataSelFim, unidade, dinheiro, pix, confSalva, somaEntradasPorMetodo, showToast]);

  // Carregar conferência física e saldo anterior
  const carregarConferencia = useCallback(async () => {
    const isSingleDay = dataSel === dataSelFim;

    // ── Sem fechamento no dia, ou período: limpa conferência física ──────────
    if (isSingleDay) {
      const f = await buscarFechamento(dataSel, unidade);
      if (f) {
        setDinheiro(f.dinheiro != null ? fmtMoneyInput(Number(f.dinheiro)) : '');
        setPix(f.pix != null ? fmtMoneyInput(Number(f.pix)) : '');
        setObsConf(f.observacao ?? '');
        setConfSalva(true);
        // NÃO usa f.saldo_anterior aqui — pode estar desatualizado.
        // O saldo anterior é calculado sempre a partir do mês anterior (abaixo).
      } else {
        setObsConf(''); setConfSalva(false);
        // Sem fechamento salvo: pré-popula Dinheiro/PIX com as entradas já
        // lançadas no dia (por método) — cobre dias retroativos, onde o
        // incremento feito no handleLancar seria perdido ao trocar de data
        if (unidade) {
          const { dinheiroDia, pixDia } = await somaEntradasPorMetodo(dataSel, unidade);
          setDinheiro(dinheiroDia > 0 ? fmtMoneyInput(dinheiroDia) : '');
          setPix(pixDia > 0 ? fmtMoneyInput(pixDia) : '');
        } else {
          setDinheiro(''); setPix('');
        }
      }
    } else {
      setDinheiro(''); setPix(''); setObsConf(''); setConfSalva(false);
    }

    if (!unidade) return; // sem comunidade selecionada ainda

    // ── Saldo Anterior Conciliado: fonte única compartilhada com os relatórios ──
    try {
      const { valor, origem } = await resolverSaldoAnteriorConciliado(dataSel.slice(0, 7), unidade);
      setSaldoAnterior(fmtMoneyInput(valor));
      // Só bloqueia quando o valor foi conciliado de meses anteriores.
      // Valor digitado no próprio mês fica editável — é assim que o usuário
      // corrige um saldo registrado por engano (zera e salva).
      setSaldoAnteriorBloqueado(origem === 'historico');
    } catch (err) { console.error('[carregarConferencia] erro:', err); setSaldoAnterior('0,00'); setSaldoAnteriorBloqueado(false); }
  }, [dataSel, dataSelFim, unidade, buscarFechamento, somaEntradasPorMetodo]);

  useEffect(() => { carregarConferencia(); }, [carregarConferencia]);

  // Saldo Final Disponível em tempo real: último fechamento + movimentos pós-fechamento com repasse
  const calcularSaldoFinalDisponivel = useCallback(async () => {
    try {
      const db = await getDb();
      const toN = (v: unknown) => { const n = Number(v); return isNaN(n) ? 0 : n; };

      const cfgRows = await db.select<Record<string, unknown>[]>(
        "SELECT * FROM configuracoes_partilha WHERE id=1 LIMIT 1"
      ).catch(() => [] as Record<string, unknown>[]);
      const cfg = (cfgRows[0] ?? { comunidade: 30, area_missionaria: 40, arquidiocese: 29, fundo_missionario: 1 }) as Record<string, unknown>;

      const partilhaCfg = dbRowToPartilha(cfg);
      const applyRepasse = (saldo: number) =>
        calcularRepasse(saldo, partilhaCfg).saldoDisponivel;

      let units: string[] = [];
      if (filtroHist === 'TODOS') {
        const res = await db.select<{ origem: string }[]>(
          "SELECT DISTINCT origem FROM lancamentos WHERE origem IS NOT NULL AND origem != '' AND deleted_at IS NULL ORDER BY origem"
        );
        units = res.map(r => r.origem).filter(Boolean);
      } else {
        units = [filtroHist];
      }

      let total = 0;
      for (const unit of units) {
        const closeRows = await db.select<Record<string, unknown>[]>(
          "SELECT COALESCE(saldo_disponivel,0) as sd, data FROM caixa_fechamento WHERE unidade=? AND data <= ? ORDER BY data DESC LIMIT 1",
          [unit, periodoFim]
        ).catch(() => [] as Record<string, unknown>[]);

        const lastClose = closeRows[0];
        const saldoAnterior = toN(lastClose?.sd);
        const lastDate = String(lastClose?.data ?? '1900-01-01');

        const movRows = await db.select<Record<string, unknown>[]>(`
          SELECT
            COALESCE(SUM(CASE WHEN tipo='ENTRADA' THEN valor ELSE 0 END),0) as ent,
            COALESCE(SUM(CASE WHEN tipo='SAIDA'   THEN valor ELSE 0 END),0) as sai
          FROM lancamentos WHERE origem=? AND data > ? AND data <= ? AND deleted_at IS NULL
        `, [unit, lastDate, periodoFim]).catch(() => [] as Record<string, unknown>[]);

        const mov = movRows[0] ?? {};
        total += saldoAnterior + applyRepasse(toN(mov.ent) - toN(mov.sai));
      }

      setSaldoFinalDisponivel(total);
    } catch (e) { console.error(e); }
  }, [periodoFim, filtroHist]);

  useEffect(() => { calcularSaldoFinalDisponivel(); }, [calcularSaldoFinalDisponivel]);

  // Verifica se o mês anterior tem lançamentos sem fechamento de caixa
  useEffect(() => {
    (async () => {
      try {
        const db = await getDb();
        const h = new Date();
        const m = h.getMonth(); // 0 = Jan
        const y = h.getFullYear();
        const mesPrevNum = m === 0 ? 12 : m;
        const anoPrev    = m === 0 ? y - 1 : y;
        const mesPrev    = `${anoPrev}-${String(mesPrevNum).padStart(2, '0')}`;

        const unitsComMov = await db.select<{ origem: string }[]>(
          comunidadeNomeFiltro
            ? "SELECT DISTINCT origem FROM lancamentos WHERE substr(data,1,7)=? AND origem=? AND deleted_at IS NULL"
            : "SELECT DISTINCT origem FROM lancamentos WHERE substr(data,1,7)=? AND deleted_at IS NULL",
          comunidadeNomeFiltro ? [mesPrev, comunidadeNomeFiltro] : [mesPrev]
        ).catch(() => [] as { origem: string }[]);
        if (unitsComMov.length === 0) return;

        const unitsComFech = await db.select<{ unidade: string }[]>(
          "SELECT DISTINCT unidade FROM caixa_fechamento WHERE substr(data,1,7)=?",
          [mesPrev]
        ).catch(() => [] as { unidade: string }[]);

        const fechadas = new Set(unitsComFech.map(u => u.unidade));
        if (unitsComMov.some(u => !fechadas.has(u.origem))) {
          const nomeMes = new Date(anoPrev, mesPrevNum - 1).toLocaleString('pt-BR', { month: 'long' });
          setAlertaFechamento(`${nomeMes.charAt(0).toUpperCase() + nomeMes.slice(1)} de ${anoPrev}`);
        }
      } catch {}
    })();
  }, []);

  const carregarRepasses = useCallback(async () => {
    setLoadingRepasse(true);
    try {
      const db = await getDb();
      const cfgRows = await db.select<Record<string, unknown>[]>(
        "SELECT * FROM configuracoes_partilha WHERE id=1 LIMIT 1"
      ).catch(() => [] as Record<string, unknown>[]);
      const cfg = (cfgRows[0] ?? { comunidade: 30, area_missionaria: 40, arquidiocese: 29, fundo_missionario: 1 }) as Record<string, unknown>;
      const partilhaCfg = dbRowToPartilha(cfg);
      const toN = (v: unknown) => { const n = Number(v); return isNaN(n) ? 0 : n; };

      let sql = `SELECT substr(data,1,7) as mes,
        COALESCE(SUM(CASE WHEN tipo='ENTRADA' THEN valor ELSE 0 END),0) as entradas,
        COALESCE(SUM(CASE WHEN tipo='SAIDA'   THEN valor ELSE 0 END),0) as saidas
        FROM lancamentos WHERE substr(data,1,4)=? AND deleted_at IS NULL`;
      const params: unknown[] = [String(anoRepasse)];
      if (unidadeRepasse !== 'TODOS') { sql += ' AND origem=?'; params.push(unidadeRepasse); }
      sql += ' GROUP BY substr(data,1,7) ORDER BY mes';

      const rows = await db.select<Record<string, unknown>[]>(sql, params).catch(() => []);
      const dados: RepasseMes[] = rows.map(row => {
        const entradas  = toN(row.entradas);
        const saidas    = toN(row.saidas);
        const saldoBruto = entradas - saidas;
        const r = calcularRepasse(saldoBruto, partilhaCfg);
        return { mes: String(row.mes ?? ''), entradas, saidas, saldoBruto, ...r };
      });
      setDadosRepasse(dados);
    } finally { setLoadingRepasse(false); }
  }, [anoRepasse, unidadeRepasse]);

  const carregarLixeira = useCallback(async () => {
    const db = await getDb();
    // Membro só vê a lixeira da própria comunidade
    const sql = comunidadeNomeFiltro
      ? "SELECT * FROM lancamentos WHERE deleted_at IS NOT NULL AND origem = ? ORDER BY deleted_at DESC LIMIT 50"
      : "SELECT * FROM lancamentos WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC LIMIT 50";
    const items = await db.select<Lancamento[]>(sql, comunidadeNomeFiltro ? [comunidadeNomeFiltro] : []).catch(() => []);
    setLixeiraItems(items);
  }, [comunidadeNomeFiltro]);

  useEffect(() => { if (aba === 'repasses') carregarRepasses(); }, [aba, carregarRepasses]);
  useEffect(() => { if (showLixeira) carregarLixeira(); }, [showLixeira, carregarLixeira]);

  // Lançamentos do período selecionado (De / Até)
  const lancamentosDia = totalGeral.filter(l =>
    l.data >= dataSel && l.data <= dataSelFim &&
    (unidade !== '' && (unidade === 'TODOS' || l.origem === unidade))
  ).sort((a, b) => (a.data ?? '').localeCompare(b.data ?? '') || a.id - b.id);
  const totalEntradasDia = lancamentosDia.filter(l => l.tipo === 'ENTRADA').reduce((s, l) => s + l.valor, 0);
  const totalSaidasDia   = lancamentosDia.filter(l => l.tipo === 'SAIDA').reduce((s, l) => s + l.valor, 0);
  const saldoDia         = totalEntradasDia - totalSaidasDia;
  const saldoAntNum      = parseMoney(saldoAnterior);

  // Conferência Física
  // Dinheiro/PIX são auto-populados pelas ENTRADAS do período (por método),
  // então a conferência compara com o Total de Entradas — mesma lógica dos
  // relatórios impressos. O Saldo Anterior NÃO entra aqui: ele é saldo
  // herdado, não um recebimento a conferir.
  const dinheiroNum = parseMoney(dinheiro);
  const pixNum      = parseMoney(pix);
  const totalConferido = dinheiroNum + pixNum;
  const diferenca   = totalConferido - totalEntradasDia;
  const conferidoOk = Math.abs(diferenca) < 0.01;

  // Partilha em cascata sobre saldo real do caixa
  const partilha = calcularPartilha(saldoDia);

  // Saldo Final Disponível = dinheiro real em mãos na data final selecionada:
  // acumula o mês inteiro (do dia 1º até a data), não só o período exibido.
  // Um dia sem movimento não pode "esconder" o déficit já acumulado no mês.
  const inicioMesSel = dataSel.slice(0, 7) + '-01';
  const saldoMesAteData = totalGeral
    .filter(l =>
      l.data >= inicioMesSel && l.data <= dataSelFim &&
      (unidade !== '' && (unidade === 'TODOS' || l.origem === unidade)))
    .reduce((s, l) => s + (l.tipo === 'ENTRADA' ? l.valor : -l.valor), 0);
  const partilhaMes = calcularPartilha(saldoMesAteData);
  const saldoFinalNaData = saldoAntNum + partilhaMes.saldoDisponivel;
  const dataFimFmt = `${dataSelFim.slice(8, 10)}/${dataSelFim.slice(5, 7)}`;

  async function handleLancar(e: React.FormEvent) {
    e.preventDefault();
    const vlr = parseFloat((tipoForm === 'ENTRADA' ? vlrEntrada : vlrSaida).replace(',', '.'));
    if (!hist.trim() || isNaN(vlr) || vlr <= 0) {
      showToast('Preencha o Histórico e o Valor.', 'error');
      return;
    }
    // Permite lançamentos retroativos (fichas de meses anteriores); bloqueia apenas datas futuras
    if (dataLanc > hoje()) {
      showToast(`Data "${dataLanc.split('-').reverse().join('/')}" é futura. Utilize uma data até hoje.`, 'error');
      return;
    }
    try {
      const metodo = tipoForm === 'ENTRADA' ? modoEntrada : 'CAIXA';
      await FinanceiroRepository.lancamentos.create({
        doc_num: docNum || null,
        categoria: 'caixa',
        descricao: hist,
        valor: vlr,
        data: dataLanc,
        tipo: tipoForm,
        origem: unidade,
        metodo,
      });
      if (dataLanc < dataSel || dataLanc > dataSelFim) {
        // Lançamento fora do período exibido (ex.: retroativo): move o período
        // para a data lançada — lista, fluxo e conferência recarregam para esse dia
        setDataSel(dataLanc); setDataSelFim(dataLanc);
      } else if (tipoForm === 'ENTRADA') {
        // Auto-popula Conferência Física conforme modo da entrada
        if (modoEntrada === 'DINHEIRO') {
          setDinheiro(prev => fmtMoneyInput(parseMoney(prev) + vlr));
        } else {
          setPix(prev => fmtMoneyInput(parseMoney(prev) + vlr));
        }
        setConfSalva(false);
      }
      // Mantém dataLanc: facilita lançar vários registros do mesmo dia retroativo
      setDocNum(''); setHist(''); setVlrEntrada(''); setVlrSaida('');
      await carregarDados();
    } catch (e) { console.error(e); showToast('Erro ao lançar.', 'error'); }
  }

  async function handleExcluir(id: number) {
    const ok = await ask('Excluir este lançamento? O registro poderá ser recuperado na Lixeira.', { title: 'Confirmar exclusão', kind: 'warning' });
    if (!ok) return;
    await FinanceiroRepository.lancamentos.softDelete(id);
    await carregarDados();
    await sincronizarConferencia();
  }

  async function handleSalvarConferencia() {
    // Grava o Saldo Final Disponível (saldoAnterior + saldo real do mês acumulado
    // até o dia) para ser usado como saldo anterior do próximo mês
    await salvarFechamento(dataSel, unidade, dinheiroNum, pixNum, saldoAntNum, obsConf, round2(saldoFinalNaData));
    setConfSalva(true);
    await calcularSaldoFinalDisponivel();
    showToast('Conferência salva com sucesso!', 'success');
  }

  // Dados para histórico
  const lancamentosHist = totalGeral.filter(l =>
    l.data >= periodoInicio && l.data <= periodoFim &&
    (filtroHist === 'TODOS' || l.origem === filtroHist)
  ).sort((a, b) => (b.data ?? '').localeCompare(a.data ?? ''));
  const totalEntHist = lancamentosHist.filter(l => l.tipo === 'ENTRADA').reduce((s, l) => s + l.valor, 0);
  const totalSaiHist = lancamentosHist.filter(l => l.tipo === 'SAIDA').reduce((s, l) => s + l.valor, 0);

  const nomeNivel2 = configPartilha.areaMissionaria > 0 ? 'Área Missionária / Paróquia' : 'Paróquia';

  return (
    <div style={{ display: 'grid', gap: 16 }}>

      {/* ── Modal de Edição de Lançamento ─────────────────────────────────── */}
      {editando && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'white', borderRadius: 16, padding: 28, width: 540, maxWidth: '95vw', boxShadow: '0 8px 40px rgba(0,0,0,0.22)' }}>
            <h3 style={{ margin: '0 0 18px', fontSize: 16, fontWeight: 800, color: '#1f3b73' }}>✏️ Corrigir Lançamento #{editando.id}</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <label style={lbl}>Data</label>
                <input type="date" style={inp} value={editData} onChange={e => setEditData(e.target.value)} />
              </div>
              <div>
                <label style={lbl}>Doc. Nº</label>
                <input style={inp} value={editDoc} onChange={e => setEditDoc(e.target.value)} placeholder="Opcional" />
              </div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={lbl}>Histórico *</label>
              <input style={inp} value={editHist} onChange={e => setEditHist(e.target.value)} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <label style={lbl}>Tipo</label>
                <select style={inp} value={editTipo} onChange={e => setEditTipo(e.target.value as 'ENTRADA'|'SAIDA')}>
                  <option value="ENTRADA">Entrada</option>
                  <option value="SAIDA">Saída</option>
                </select>
              </div>
              <div>
                <label style={lbl}>Valor R$</label>
                <input style={inp} value={editValor} onChange={e => setEditValor(e.target.value)} placeholder="0,00" />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
              <div>
                <label style={lbl}>Forma (Método)</label>
                <select style={inp} value={editMetodo} onChange={e => setEditMetodo(e.target.value)}>
                  <option value="DINHEIRO">💵 Dinheiro</option>
                  <option value="PIX">📱 PIX</option>
                  <option value="CAIXA">Caixa</option>
                </select>
              </div>
              <div>
                <label style={lbl}>Comunidade / Unidade</label>
                {isMembro ? (
                  <div style={{ ...inp, background: '#f5f7fa', color: '#344054', fontWeight: 700 }}>{editOrigem}</div>
                ) : (
                  <select style={inp} value={editOrigem} onChange={e => setEditOrigem(e.target.value)}>
                    <option value="">— Selecione —</option>
                    {comunidades.map(c => <option key={c.id} value={c.nome}>🏘️ {c.nome}</option>)}
                  </select>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setEditando(null)} style={{ padding: '9px 22px', background: '#f2f4f7', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer', fontSize: 13, color: '#344054' }}>
                Cancelar
              </button>
              <button onClick={handleSalvarEdicao} style={{ padding: '9px 22px', background: '#1f3b73', color: 'white', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>
                ✅ Salvar Correção
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Alerta de fechamento pendente */}
      {alertaFechamento && (
        <div style={{ background: '#fff7ed', border: '1px solid #fb923c', borderRadius: 10, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 20 }}>⚠️</span>
          <div style={{ flex: 1, fontSize: 13, color: '#9a3412' }}>
            <strong>Fechamento pendente:</strong> o mês de <strong>{alertaFechamento}</strong> tem lançamentos sem conferência de caixa salva.
            Acesse <strong>📋 Movimento do Caixa</strong>, selecione cada comunidade e salve a Conferência Física.
          </div>
          <button onClick={() => setAlertaFechamento(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: '#9a3412', lineHeight: 1 }}>✕</button>
        </div>
      )}

      {/* Abas */}
      <div style={{ background: 'white', borderRadius: 14, border: '1px solid #e4e7ec', padding: 14, display: 'flex', gap: 10 }}>
        {([['caixa','📋 Movimento do Caixa'],['historico','📊 Histórico'],['repasses','📈 Repasses']] as const).map(([k, label]) => (
          <button key={k} onClick={() => setAba(k)} style={{ borderRadius: 999, padding: '9px 20px', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, background: aba === k ? '#1f3b73' : '#eef2f7', color: aba === k ? 'white' : '#344054' }}>
            {label}
          </button>
        ))}
      </div>

      {/* ════════════════════════════════════════════════════
          ABA: MOVIMENTO DO CAIXA
      ════════════════════════════════════════════════════ */}
      {aba === 'caixa' && (<>

        {/* Seleção de Data e Comunidade */}
        <div style={{ ...card, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 16, alignItems: 'end' }}>
          <div>
            <label style={lbl}>Comunidade / Unidade</label>
            {isMembro ? (
              <div style={{ ...inp, background: '#f5f7fa', color: '#344054', fontWeight: 700 }}>{unidade}</div>
            ) : (
              <select value={unidade} onChange={e => setUnidade(e.target.value)} style={inp}>
                <option value="">— Selecione a comunidade —</option>
                {comunidades.map(c => <option key={c.id} value={c.nome}>🏘️ {c.nome}</option>)}
              </select>
            )}
          </div>
          <div>
            <label style={lbl}>🔍 De</label>
            <input type="date" value={dataSel} onChange={e => { setDataSel(e.target.value); if (e.target.value > dataSelFim) setDataSelFim(e.target.value); }} style={inp} />
          </div>
          <div>
            <label style={lbl}>Até</label>
            <input type="date" value={dataSelFim} onChange={e => setDataSelFim(e.target.value)} style={inp} />
          </div>
          <div>
            <button
              type="button"
              onClick={() => { const h = hoje(); setDataSel(h); setDataSelFim(h); setDataLanc(h); }}
              title="Fechar pesquisa e voltar ao dia de hoje"
              style={{ padding: '9px 16px', background: dataSel !== hoje() || dataSelFim !== hoje() ? '#1f3b73' : '#eef2f7', color: dataSel !== hoje() || dataSelFim !== hoje() ? 'white' : '#667085', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer', fontSize: 13, whiteSpace: 'nowrap' }}>
              📅 Hoje
            </button>
          </div>
        </div>

        {/* Aviso visual quando o filtro não está no dia de hoje */}
        {(dataSel !== hoje() || dataSelFim !== hoje()) && (
          <div style={{ background: '#fffbe6', border: '1px solid #f59e0b', borderRadius: 10, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 18 }}>⚠️</span>
            <div style={{ flex: 1, fontSize: 13, color: '#92400e' }}>
              <strong>Você está visualizando um período anterior.</strong> Novos lançamentos só são permitidos no mês atual.
              Clique em <strong>📅 Hoje</strong> para voltar ao dia de hoje e lançar normalmente.
            </div>
            <button
              type="button"
              onClick={() => { const h = hoje(); setDataSel(h); setDataSelFim(h); setDataLanc(h); }}
              style={{ padding: '8px 18px', background: '#f59e0b', color: 'white', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer', fontSize: 13, whiteSpace: 'nowrap' }}>
              📅 Voltar ao Hoje
            </button>
          </div>
        )}

        {/* Aviso: selecione comunidade */}
        {unidade === '' && (
          <div style={{ ...card, textAlign: 'center', padding: 40, color: '#98a2b3', fontSize: 14 }}>
            Selecione uma comunidade acima para visualizar os lançamentos.
          </div>
        )}

        {/* Tabela de Lançamentos */}
        <div style={{ ...card, display: unidade === '' ? 'none' : undefined }}>
          <h3 style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 700, color: '#1f3b73' }}>Lançamentos do Período</h3>

          {/* Form de Lançamento */}
          <form onSubmit={handleLancar} style={{ background: '#f9fafb', border: '1px solid #eaecf0', borderRadius: 10, padding: 14, marginBottom: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '140px 100px 1fr 130px 130px', gap: 10, alignItems: 'end' }}>
              <div>
                <label style={lbl}>Data do Lançamento</label>
                <input type="date" style={inp} value={dataLanc} onChange={e => setDataLanc(e.target.value)} required />
              </div>
              <div>
                <label style={lbl}>Doc. Nº</label>
                <input style={inp} value={docNum} onChange={e => setDocNum(e.target.value)} placeholder="Opcional" />
              </div>
              <div>
                <label style={lbl}>Histórico *</label>
                <input style={inp} value={hist} onChange={e => setHist(e.target.value)} placeholder="Ex: Dízimo, Oferta, Manutenção..." required />
              </div>
              <div>
                <label style={lbl}>Entrada R$</label>
                <input style={{ ...inp, borderColor: tipoForm === 'ENTRADA' ? '#22c55e' : '#d0d5dd' }}
                  value={vlrEntrada}
                  onChange={e => { setVlrEntrada(e.target.value); setVlrSaida(''); setTipoForm('ENTRADA'); }}
                  placeholder="0,00" />
              </div>
              <div>
                <label style={lbl}>Saída R$</label>
                <input style={{ ...inp, borderColor: tipoForm === 'SAIDA' ? '#ef4444' : '#d0d5dd' }}
                  value={vlrSaida}
                  onChange={e => { setVlrSaida(e.target.value); setVlrEntrada(''); setTipoForm('SAIDA'); }}
                  placeholder="0,00" />
              </div>
            </div>

            {/* Modo de entrada: Dinheiro ou PIX */}
            {tipoForm === 'ENTRADA' && (
              <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#667085', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Forma de recebimento:</span>
                {(['DINHEIRO', 'PIX'] as const).map(modo => (
                  <button
                    key={modo}
                    type="button"
                    onClick={() => setModoEntrada(modo)}
                    style={{
                      padding: '6px 16px', borderRadius: 20, border: '1.5px solid',
                      borderColor: modoEntrada === modo ? (modo === 'DINHEIRO' ? '#16a34a' : '#2563eb') : '#d0d5dd',
                      background: modoEntrada === modo ? (modo === 'DINHEIRO' ? '#dcfce7' : '#eff6ff') : 'white',
                      color: modoEntrada === modo ? (modo === 'DINHEIRO' ? '#15803d' : '#1d4ed8') : '#667085',
                      fontWeight: 700, fontSize: 12, cursor: 'pointer',
                    }}>
                    {modo === 'DINHEIRO' ? '💵 Dinheiro' : '📱 PIX'}
                  </button>
                ))}
                <span style={{ fontSize: 11, color: '#98a2b3' }}>→ valor vai para Conferência Física automaticamente</span>
              </div>
            )}

            <button type="submit" style={{ marginTop: 10, padding: '9px 24px', background: '#1f3b73', color: 'white', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>
              + Lançar
            </button>
          </form>

          {/* Tabela */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f2f4f7' }}>
                  {['Data','Doc. Nº','Histórico','Entradas','Saídas','Ações'].map(h => (
                    <th key={h} style={{ padding: '9px 12px', textAlign: h === 'Entradas' || h === 'Saídas' ? 'right' : 'left', fontSize: 11, fontWeight: 700, color: '#667085', borderBottom: '1.5px solid #e4e7ec', textTransform: 'uppercase' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lancamentosDia.length === 0 ? (
                  <tr><td colSpan={6} style={{ textAlign: 'center', padding: 24, color: '#98a2b3', fontSize: 13 }}>Nenhum lançamento neste período.</td></tr>
                ) : lancamentosDia.map((l) => (
                  <tr key={l.id} style={{ borderBottom: '1px solid #f2f4f7' }}>
                    <td style={{ padding: '8px 12px', color: '#667085' }}>{l.data.split('-').reverse().join('/')}</td>
                    <td style={{ padding: '8px 12px', color: '#667085' }}>{l.doc_num || '—'}</td>
                    <td style={{ padding: '8px 12px', fontWeight: 500 }}>{l.descricao}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', color: '#16a34a', fontWeight: 700 }}>{l.tipo === 'ENTRADA' ? fmt(l.valor) : ''}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', color: '#dc2626', fontWeight: 700 }}>{l.tipo === 'SAIDA' ? fmt(l.valor) : ''}</td>
                    <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                      <button onClick={() => abrirEdicao(l)} style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontSize: 15, marginRight: 4 }} title="Editar">✏️</button>
                      <button onClick={() => handleExcluir(l.id)} style={{ background: 'none', border: 'none', color: '#fda29b', cursor: 'pointer', fontSize: 16 }} title="Excluir">🗑</button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: '#f9fafb', fontWeight: 800, borderTop: '2px solid #e4e7ec' }}>
                  <td colSpan={3} style={{ padding: '10px 12px', fontSize: 12, textTransform: 'uppercase', color: '#344054' }}>Total do Período</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', color: '#16a34a' }}>{fmt(totalEntradasDia)}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', color: '#dc2626' }}>{fmt(totalSaidasDia)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Fluxo Contábil + Conferência Física — lado a lado */}
        <div style={{ display: unidade === '' ? 'none' : 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

          {/* Fluxo Contábil */}
          <div style={card}>
            <h3 style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 700, color: '#1f3b73' }}>Fluxo Contábil</h3>
            {[
              ['Total de Entradas (Período)', fmt(totalEntradasDia), '#16a34a'],
              ['Total de Saídas (Período)',   fmt(totalSaidasDia),   '#dc2626'],
              ['Saldo do Período',            fmt(saldoDia),         saldoDia >= 0 ? '#1f3b73' : '#dc2626'],
            ].map(([label, valor, cor]) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f2f4f7', fontSize: 13 }}>
                <span style={{ color: '#667085' }}>{label}</span>
                <span style={{ fontWeight: 700, color: cor as string }}>{valor}</span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #f2f4f7', fontSize: 13, gap: 12 }}>
              <span style={{ color: '#667085', whiteSpace: 'nowrap' }}>Saldo Anterior Conciliado {saldoAnteriorBloqueado && <span title="Valor conciliado automaticamente a partir de meses anteriores. Não pode ser alterado." style={{ cursor: 'help' }}>🔒</span>}</span>
              <input
                type="text"
                inputMode="decimal"
                value={saldoAnterior}
                onChange={e => { if (!saldoAnteriorBloqueado) { setSaldoAnterior(maskMoney(e.target.value)); setConfSalva(false); } }}
                readOnly={saldoAnteriorBloqueado}
                style={{ ...inp, width: 130, textAlign: 'right', fontWeight: 700, color: saldoAnteriorBloqueado ? '#98a2b3' : '#344054', padding: '5px 8px', fontSize: 13, background: saldoAnteriorBloqueado ? '#f9fafb' : undefined, cursor: saldoAnteriorBloqueado ? 'not-allowed' : undefined }}
                placeholder="0,00"
              />
            </div>
            {/* Saldo Real = período após repasses (mesmo que a impressão) */}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f2f4f7', fontSize: 13 }}>
              <span style={{ color: '#667085' }}>Saldo Real (após repasses)</span>
              <span style={{ fontWeight: 700, color: partilha.saldoDisponivel >= 0 ? '#1f3b73' : '#dc2626' }}>{fmt(partilha.saldoDisponivel)}</span>
            </div>
            {/* Saldo Final Disponível = dinheiro real em mãos na data (mês acumulado) */}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, background: '#1f3b73', margin: '8px -20px -20px', padding: '14px 20px', borderRadius: '0 0 14px 14px' }}>
              <div>
                <div style={{ fontWeight: 800, color: 'white' }}>Saldo Final Disponível</div>
                <div style={{ fontSize: 11, color: '#93c5fd', marginTop: 2 }}>Saldo Anterior + Saldo Real do mês até {dataFimFmt} ({fmt(partilhaMes.saldoDisponivel)})</div>
              </div>
              <span style={{ fontWeight: 800, color: 'white', fontSize: 18, alignSelf: 'center' }}>{fmt(saldoFinalNaData)}</span>
            </div>
          </div>

          {/* Conferência Física — só disponível para um dia específico */}
          <div style={{ ...card, border: dataSel !== dataSelFim ? '1px solid #e4e7ec' : conferidoOk && confSalva ? '1.5px solid #22c55e' : '1px solid #e4e7ec' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#1f3b73' }}>Conferência Física</h3>
              {dataSel === dataSelFim && confSalva && conferidoOk && <span style={{ fontSize: 11, fontWeight: 700, color: '#16a34a', background: '#dcfce7', padding: '3px 10px', borderRadius: 20 }}>✓ Auditado</span>}
            </div>

            {/* Período multi-dia: só exibe resumo, sem formulário de conferência */}
            {dataSel !== dataSelFim ? (
              <div style={{ padding: '20px 0', textAlign: 'center', color: '#667085', fontSize: 13 }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>📅</div>
                <div style={{ fontWeight: 700, color: '#344054', marginBottom: 4 }}>Conferência Física — Visão por Período</div>
                <div style={{ color: '#98a2b3', fontSize: 12, maxWidth: 320, margin: '0 auto' }}>
                  A conferência física é registrada dia a dia. Para conferir e salvar, selecione um único dia nos campos <strong>De</strong> e <strong>Até</strong>.
                </div>
              </div>
            ) : (
              <>
            <div style={{ fontSize: 11, color: '#6b7280', background: '#fffbe6', border: '1px solid #fde68a', borderRadius: 8, padding: '7px 10px', marginBottom: 12 }}>
              💡 Para corrigir Saldo Anterior, Dinheiro ou PIX de uma comunidade errada: selecione a comunidade e data incorretas, zere os valores e salve. Depois selecione a comunidade correta e registre os valores certos.
            </div>
            <div style={{ display: 'grid', gap: 10 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={lbl}>Dinheiro R$</label>
                  <input style={inp} type="text" inputMode="decimal" value={dinheiro} onChange={e => { setDinheiro(maskMoney(e.target.value)); setConfSalva(false); }} placeholder="0,00" />
                </div>
                <div>
                  <label style={lbl}>PIX R$</label>
                  <input style={inp} type="text" inputMode="decimal" value={pix} onChange={e => { setPix(maskMoney(e.target.value)); setConfSalva(false); }} placeholder="0,00" />
                </div>
              </div>
              <div>
                <label style={lbl}>Saldo Anterior Conciliado R$ {saldoAnteriorBloqueado && <span title="Bloqueado — valor conciliado de meses anteriores" style={{ cursor: 'help' }}>🔒</span>}</label>
                <input style={{ ...inp, background: saldoAnteriorBloqueado ? '#f9fafb' : undefined, color: saldoAnteriorBloqueado ? '#98a2b3' : undefined, cursor: saldoAnteriorBloqueado ? 'not-allowed' : undefined }} type="text" inputMode="decimal" value={saldoAnterior} onChange={e => { if (!saldoAnteriorBloqueado) { setSaldoAnterior(maskMoney(e.target.value)); setConfSalva(false); } }} readOnly={saldoAnteriorBloqueado} placeholder="0,00" />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '8px 12px', background: '#f9fafb', borderRadius: 8 }}>
                <span style={{ color: '#667085' }}>Total Conferido</span>
                <span style={{ fontWeight: 700 }}>{fmt(totalConferido)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '8px 12px', borderRadius: 8, background: conferidoOk ? '#dcfce7' : '#fef2f2' }}>
                <span style={{ fontWeight: 700, color: conferidoOk ? '#16a34a' : '#dc2626' }}>DIFERENÇA</span>
                <span style={{ fontWeight: 800, color: conferidoOk ? '#16a34a' : '#dc2626' }}>{conferidoOk ? 'R$ 0,00 ✓' : fmt(diferenca)}</span>
              </div>
              <div>
                <label style={lbl}>Observação</label>
                <input style={inp} value={obsConf} onChange={e => { setObsConf(e.target.value); setConfSalva(false); }} placeholder="Divergências, correções..." />
              </div>
              <button onClick={handleSalvarConferencia} style={{ padding: '10px', background: '#1f3b73', color: 'white', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>
                {confSalva ? '✓ Conferência Salva — Atualizar' : 'Salvar Conferência do Dia'}
              </button>
            </div>
              </>
            )}
          </div>
        </div>

        {/* Descrição de Repasse em Cascata */}
        <div style={card}>
          <h3 style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 700, color: '#1f3b73' }}>Descrição de Repasse</h3>
          <p style={{ margin: '0 0 16px', fontSize: 12, color: '#98a2b3' }}>Cálculo em cascata sobre o Saldo do Período ({fmt(saldoDia)})</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            {[
              { label: 'Comunidade',            pct: configPartilha.comunidade,       val: partilha.comunidade,       base: saldoDia,                                                                        cor: '#16a34a', bg: '#f0fdf4' },
              { label: nomeNivel2,              pct: configPartilha.areaMissionaria,  val: partilha.areaMissionaria,  base: saldoDia - partilha.comunidade,                                                  cor: '#2563eb', bg: '#eff6ff' },
              { label: 'Arquidiocese / Diocese', pct: configPartilha.arquidiocese,    val: partilha.arquidiocese,     base: saldoDia - partilha.comunidade - partilha.areaMissionaria,                       cor: '#7c3aed', bg: '#f5f3ff' },
              { label: 'Fundo Missionário',      pct: configPartilha.fundoMissionario, val: partilha.fundoMissionario, base: saldoDia - partilha.comunidade - partilha.areaMissionaria - partilha.arquidiocese, cor: '#b45309', bg: '#fffbeb' },
            ].map(item => (
              <div key={item.label} style={{ background: item.bg, border: `1px solid ${item.cor}33`, borderRadius: 12, padding: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: item.cor, textTransform: 'uppercase', marginBottom: 4 }}>{item.label}</div>
                <div style={{ fontSize: 11, color: '#98a2b3', marginBottom: 6 }}>{item.pct}% de {fmt(item.base)}</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: item.cor }}>{fmt(item.val)}</div>
              </div>
            ))}
          </div>
          {/* Saldo Final Disponível — mesmo cálculo da ficha de impressão */}
          <div style={{ marginTop: 14, padding: '14px 18px', background: '#1f3b73', borderRadius: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#93c5fd', textTransform: 'uppercase' }}>Saldo Final Disponível</div>
              <div style={{ fontSize: 11, color: '#93c5fd', marginTop: 2 }}>
                Saldo Anterior ({fmt(saldoAntNum)}) + Saldo Real do mês até {dataFimFmt} ({fmt(partilhaMes.saldoDisponivel)})
              </div>
            </div>
            <div style={{ fontSize: 24, fontWeight: 800, color: 'white' }}>{fmt(saldoFinalNaData)}</div>
          </div>

          {/* Botões de impressão */}
          <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
            <button
              onClick={() => setMostrarPreviewDia(v => !v)}
              style={{ padding: '9px 20px', background: mostrarPreviewDia ? '#1f3b73' : '#f5f7fa', border: '1px solid #d0d5dd', color: mostrarPreviewDia ? 'white' : '#344054', borderRadius: 8, fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>
              🖨️ {mostrarPreviewDia ? 'Fechar Relatório do Dia' : 'Imprimir Relatório do Dia'}
            </button>
            <button
              onClick={() => setMostrarPreviewMes(v => !v)}
              style={{ padding: '9px 20px', background: mostrarPreviewMes ? '#1f3b73' : '#eef2f7', border: '1px solid #c8d0de', color: mostrarPreviewMes ? 'white' : '#1f3b73', borderRadius: 8, fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>
              📋 {mostrarPreviewMes ? 'Fechar Preview Mensal' : 'Preview Movimento do Mês'}
            </button>
          </div>
        </div>

        {/* ── Preview Diário ───────────────────────────────────────────────── */}
        {mostrarPreviewDia && paroquia && unidade && (
          <RelatorioDiarioPreview
            paroquia={paroquia}
            unidade={unidade}
            dataSel={dataSel}
            dataSelFim={dataSelFim}
            lancamentos={lancamentosDia}
            totalEntradas={totalEntradasDia}
            totalSaidas={totalSaidasDia}
            saldoDia={saldoDia}
            saldoAnterior={saldoAntNum}
            partilha={partilha}
            dinheiro={dinheiroNum}
            pix={pixNum}
            configPartilha={configPartilha}
            nomeNivel2={nomeNivel2}
          />
        )}
        {mostrarPreviewDia && (!paroquia || !unidade) && (
          <div style={{ marginTop: 14, padding: 16, background: '#fff8e1', border: '1px solid #f0c040', borderRadius: 10, color: '#7a5d00', fontSize: 13 }}>
            ⚠️ Selecione uma comunidade para gerar o relatório do dia.
          </div>
        )}

        {/* ── Preview Mensal ────────────────────────────────────────────────── */}
        {mostrarPreviewMes && paroquia && (
          <RelatorioMensalPreview
            paroquia={paroquia}
            unidade={unidade}
            mes={dataSel.slice(0, 7)}
            lancamentos={totalGeral}
            configPartilha={configPartilha}
            calcularPartilha={calcularPartilha}
            nomeNivel2={nomeNivel2}
          />
        )}
        {mostrarPreviewMes && !paroquia && (
          <div style={{ marginTop: 14, padding: 16, background: '#fff8e1', border: '1px solid #f0c040', borderRadius: 10, color: '#7a5d00', fontSize: 13 }}>
            ⚠️ Dados da paróquia não carregados. Verifique as configurações do sistema.
          </div>
        )}

      </>)}

      {/* ════════════════════════════════════════════════════
          ABA: HISTÓRICO
      ════════════════════════════════════════════════════ */}
      {aba === 'historico' && (
        <div style={{ display: 'grid', gap: 16 }}>
        <div style={card}>
          <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700, color: '#1f3b73' }}>Histórico de Lançamentos</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={lbl}>De</label>
              <input type="date" value={periodoInicio} onChange={e => setPeriodoInicio(e.target.value)} style={inp} />
            </div>
            <div>
              <label style={lbl}>Até</label>
              <input type="date" value={periodoFim} onChange={e => setPeriodoFim(e.target.value)} style={inp} />
            </div>
            <div>
              <label style={lbl}>Unidade</label>
              {isMembro ? (
                <div style={{ ...inp, background: '#f5f7fa', color: '#344054', fontWeight: 700 }}>{filtroHist}</div>
              ) : (
                <select value={filtroHist} onChange={e => setFiltroHist(e.target.value)} style={inp}>
                  <option value="TODOS">Todas</option>
                  {comunidades.map(c => <option key={c.id} value={c.nome}>{c.nome}</option>)}
                </select>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 24, marginBottom: 16, padding: '12px 16px', background: '#f9fafb', borderRadius: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 13 }}>Bruto Entradas: <strong style={{ color: '#16a34a' }}>{fmt(totalEntHist)}</strong></span>
            <span style={{ fontSize: 13 }}>Bruto Saídas: <strong style={{ color: '#dc2626' }}>{fmt(totalSaiHist)}</strong></span>
            <span style={{ fontSize: 13, color: '#667085' }}>Bruto Saldo: <strong style={{ color: (totalEntHist - totalSaiHist) >= 0 ? '#16a34a' : '#dc2626' }}>{fmt(totalEntHist - totalSaiHist)}</strong></span>
            <div style={{ marginLeft: 'auto', background: '#1f3b73', borderRadius: 10, padding: '8px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#93c5fd', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Saldo Final Disponível</span>
              <span style={{ fontSize: 16, fontWeight: 800, color: saldoFinalDisponivel >= 0 ? '#4ade80' : '#f87171' }}>{fmt(saldoFinalDisponivel)}</span>
            </div>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f2f4f7' }}>
                {['Data','Doc.Nº','Histórico','Unidade','Modo','Entrada','Saída','Ações'].map(h => (
                  <th key={h} style={{ padding: '9px 10px', textAlign: h === 'Entrada' || h === 'Saída' ? 'right' : 'left', fontSize: 11, fontWeight: 700, color: '#667085', borderBottom: '1.5px solid #e4e7ec', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lancamentosHist.length === 0 ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: 24, color: '#98a2b3' }}>Nenhum lançamento no período.</td></tr>
              ) : lancamentosHist.map((l) => (
                <tr key={l.id} style={{ borderBottom: '1px solid #f2f4f7' }}>
                  <td style={{ padding: '8px 10px', color: '#667085' }}>{(l.data ?? '').split('-').reverse().join('/')}</td>
                  <td style={{ padding: '8px 10px', color: '#667085' }}>{l.doc_num || '—'}</td>
                  <td style={{ padding: '8px 10px' }}>{l.descricao}</td>
                  <td style={{ padding: '8px 10px', fontSize: 11 }}><span style={{ background: '#eef2f7', padding: '2px 8px', borderRadius: 20 }}>{l.origem}</span></td>
                  <td style={{ padding: '8px 10px', fontSize: 11 }}>
                    {l.tipo === 'ENTRADA' && (
                      <span style={{
                        background: l.metodo === 'PIX' ? '#eff6ff' : '#f0fdf4',
                        color: l.metodo === 'PIX' ? '#1d4ed8' : '#15803d',
                        padding: '2px 8px', borderRadius: 20, fontWeight: 700
                      }}>
                        {l.metodo === 'PIX' ? '📱 PIX' : l.metodo === 'DINHEIRO' ? '💵 Dinheiro' : l.metodo || '—'}
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '8px 10px', textAlign: 'right', color: '#16a34a', fontWeight: 700 }}>{l.tipo === 'ENTRADA' ? fmt(l.valor) : ''}</td>
                  <td style={{ padding: '8px 10px', textAlign: 'right', color: '#dc2626', fontWeight: 700 }}>{l.tipo === 'SAIDA'   ? fmt(l.valor) : ''}</td>
                  <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>
                    <button onClick={() => abrirEdicao(l)} style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontSize: 15, marginRight: 4 }} title="Editar">✏️</button>
                    <button onClick={async () => { const ok = await ask('Excluir? O registro poderá ser recuperado na Lixeira.', { title: 'Confirmar', kind: 'warning' }); if(!ok) return; await FinanceiroRepository.lancamentos.softDelete(l.id); await carregarDados(); }} style={{ background: 'none', border: 'none', color: '#fda29b', cursor: 'pointer', fontSize: 15 }} title="Excluir">🗑</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Lixeira de registros excluídos */}
        <div style={{ ...card, display: unidade === '' ? 'none' : undefined }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: showLixeira ? 12 : 0 }}>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#667085' }}>🗑️ Lixeira — registros excluídos</h3>
            <button onClick={() => setShowLixeira(v => !v)} style={{ padding: '6px 14px', background: showLixeira ? '#fee2e2' : '#f2f4f7', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer', fontSize: 12, color: showLixeira ? '#dc2626' : '#344054' }}>
              {showLixeira ? 'Fechar Lixeira' : 'Abrir Lixeira'}
            </button>
          </div>
          {showLixeira && (
            lixeiraItems.length === 0
              ? <div style={{ padding: '12px 0', color: '#98a2b3', fontSize: 13 }}>Nenhum registro excluído.</div>
              : <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, marginTop: 8 }}>
                  <thead>
                    <tr style={{ background: '#fef2f2' }}>
                      {['Data','Histórico','Valor','Unidade','Excluído em',''].map((h, i) => (
                        <th key={i} style={{ padding: '7px 10px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#667085', borderBottom: '1px solid #fecaca', textTransform: 'uppercase' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {lixeiraItems.map((l) => (
                      <tr key={l.id} style={{ borderBottom: '1px solid #fef2f2', opacity: 0.8 }}>
                        <td style={{ padding: '7px 10px', color: '#667085' }}>{String(l.data ?? '').split('-').reverse().join('/')}</td>
                        <td style={{ padding: '7px 10px' }}>{l.descricao}</td>
                        <td style={{ padding: '7px 10px', color: l.tipo === 'ENTRADA' ? '#16a34a' : '#dc2626', fontWeight: 700 }}>
                          {l.tipo === 'ENTRADA' ? '+' : '-'}{fmt(Number(l.valor ?? 0))}
                        </td>
                        <td style={{ padding: '7px 10px', fontSize: 11 }}>{l.origem}</td>
                        <td style={{ padding: '7px 10px', fontSize: 11, color: '#98a2b3' }}>
                          {String(l.deleted_at ?? '').replace('T', ' ').slice(0, 16)}
                        </td>
                        <td style={{ padding: '7px 10px' }}>
                          <button onClick={async () => {
                            await FinanceiroRepository.lancamentos.restore(l.id);
                            await carregarDados(); await carregarLixeira();
                          }} style={{ padding: '4px 12px', background: '#dcfce7', border: '1px solid #86efac', borderRadius: 6, color: '#15803d', fontWeight: 700, cursor: 'pointer', fontSize: 11 }}>
                            ↩ Recuperar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
          )}
        </div>
      </div>
      )}
      {/* ════════════════════════════════════════════════════
          ABA: REPASSES
      ════════════════════════════════════════════════════ */}
      {aba === 'repasses' && (
        <div style={{ display: 'grid', gap: 16 }}>

          {/* Filtros */}
          <div style={{ ...card, display: 'flex', gap: 16, alignItems: 'end', flexWrap: 'wrap' }}>
            <div>
              <label style={lbl}>Ano</label>
              <select style={{ ...inp, width: 110 }} value={anoRepasse} onChange={e => setAnoRepasse(Number(e.target.value))}>
                {[new Date().getFullYear() - 2, new Date().getFullYear() - 1, new Date().getFullYear()].map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={lbl}>Unidade</label>
              {isMembro ? (
                <div style={{ ...inp, width: 220, background: '#f5f7fa', color: '#344054', fontWeight: 700 }}>{unidadeRepasse}</div>
              ) : (
                <select style={{ ...inp, width: 220 }} value={unidadeRepasse} onChange={e => setUnidadeRepasse(e.target.value)}>
                  <option value="TODOS">Todas as unidades</option>
                  {comunidades.map(c => <option key={c.id} value={c.nome}>{c.nome}</option>)}
                </select>
              )}
            </div>
            <button onClick={carregarRepasses} style={{ padding: '9px 20px', background: '#1f3b73', color: 'white', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>
              🔍 Atualizar
            </button>
          </div>

          {/* Tabela */}
          <div style={card} id="repasses-print-area">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#1f3b73' }}>
                Distribuição de Repasses — {anoRepasse}
              </h3>
              {dadosRepasse.length > 0 && (
                <button
                  onClick={() => {
                    const area = document.getElementById('repasses-print-area');
                    if (!area) return;
                    const win = window.open('', '_blank', 'width=900,height=700');
                    if (!win) return;
                    win.document.write(`<!DOCTYPE html><html><head><title>Repasses ${anoRepasse}</title><style>
                      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 20px; color: #1a1a1a; }
                      table { width: 100%; border-collapse: collapse; font-size: 12px; }
                      th { background: #f2f4f7; padding: 8px 10px; text-align: right; font-size: 10px; font-weight: 700; color: #667085; border-bottom: 1.5px solid #e4e7ec; text-transform: uppercase; }
                      th:first-child { text-align: left; }
                      td { padding: 8px 10px; text-align: right; border-bottom: 1px solid #f2f4f7; }
                      td:first-child { text-align: left; font-weight: 600; }
                      tfoot tr { background: #1f3b73; color: white; font-weight: 800; }
                      tfoot td { border: none; padding: 10px; }
                      h3 { color: #1f3b73; margin-bottom: 16px; }
                      @media print { body { padding: 0; } button { display: none !important; } }
                    </style></head><body>${area.innerHTML}</body></html>`);
                    win.document.close();
                    setTimeout(() => { win.print(); }, 300);
                  }}
                  style={{ padding: '7px 16px', background: '#f2f4f7', border: '1px solid #d0d5dd', borderRadius: 8, fontWeight: 700, cursor: 'pointer', fontSize: 12, color: '#344054' }}
                >
                  🖨️ Imprimir
                </button>
              )}
            </div>
            {loadingRepasse ? (
              <div style={{ textAlign: 'center', padding: 24, color: '#98a2b3' }}>Carregando...</div>
            ) : dadosRepasse.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 24, color: '#98a2b3', fontSize: 13 }}>Nenhum lançamento em {anoRepasse}.</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: '#f2f4f7' }}>
                      {['Mês','Entradas','Saídas','Comunidade', nomeNivel2,'Arquidiocese','Fundo Missio.','Total Repasse','Saldo Disponível'].map(h => (
                        <th key={h} style={{ padding: '8px 10px', textAlign: h === 'Mês' ? 'left' : 'right', fontSize: 10, fontWeight: 700, color: '#667085', borderBottom: '1.5px solid #e4e7ec', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {dadosRepasse.map(row => {
                      const [y, m] = row.mes.split('-');
                      const nomeMesRow = new Date(Number(y), Number(m) - 1).toLocaleString('pt-BR', { month: 'long' });
                      return (
                        <tr key={row.mes} style={{ borderBottom: '1px solid #f2f4f7' }}>
                          <td style={{ padding: '8px 10px', fontWeight: 600, color: '#344054' }}>{nomeMesRow.charAt(0).toUpperCase() + nomeMesRow.slice(1)}</td>
                          <td style={{ padding: '8px 10px', textAlign: 'right', color: '#16a34a', fontWeight: 700 }}>{fmt(row.entradas)}</td>
                          <td style={{ padding: '8px 10px', textAlign: 'right', color: '#dc2626', fontWeight: 700 }}>{fmt(row.saidas)}</td>
                          <td style={{ padding: '8px 10px', textAlign: 'right', color: '#15803d' }}>{fmt(row.comunidade)}</td>
                          <td style={{ padding: '8px 10px', textAlign: 'right', color: '#1d4ed8' }}>{fmt(row.areaMissionaria)}</td>
                          <td style={{ padding: '8px 10px', textAlign: 'right', color: '#7c3aed' }}>{fmt(row.arquidiocese)}</td>
                          <td style={{ padding: '8px 10px', textAlign: 'right', color: '#b45309' }}>{fmt(row.fundoMissionario)}</td>
                          <td style={{ padding: '8px 10px', textAlign: 'right', color: '#667085', fontWeight: 700 }}>{fmt(row.totalRepasse)}</td>
                          <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 800, color: row.saldoDisponivel >= 0 ? '#1f3b73' : '#dc2626' }}>{fmt(row.saldoDisponivel)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    {(() => {
                      const t = dadosRepasse.reduce((a, r) => ({
                        entradas: a.entradas + r.entradas, saidas: a.saidas + r.saidas,
                        comunidade: a.comunidade + r.comunidade, areaMissionaria: a.areaMissionaria + r.areaMissionaria,
                        arquidiocese: a.arquidiocese + r.arquidiocese, fundoMissionario: a.fundoMissionario + r.fundoMissionario,
                        totalRepasse: a.totalRepasse + r.totalRepasse, saldoDisponivel: a.saldoDisponivel + r.saldoDisponivel,
                      }), { entradas: 0, saidas: 0, comunidade: 0, areaMissionaria: 0, arquidiocese: 0, fundoMissionario: 0, totalRepasse: 0, saldoDisponivel: 0 });
                      return (
                        <tr style={{ background: '#1f3b73', fontWeight: 800, color: 'white' }}>
                          <td style={{ padding: '10px', fontSize: 11, textTransform: 'uppercase' }}>Total {anoRepasse}</td>
                          <td style={{ padding: '10px', textAlign: 'right' }}>{fmt(t.entradas)}</td>
                          <td style={{ padding: '10px', textAlign: 'right' }}>{fmt(t.saidas)}</td>
                          <td style={{ padding: '10px', textAlign: 'right' }}>{fmt(t.comunidade)}</td>
                          <td style={{ padding: '10px', textAlign: 'right' }}>{fmt(t.areaMissionaria)}</td>
                          <td style={{ padding: '10px', textAlign: 'right' }}>{fmt(t.arquidiocese)}</td>
                          <td style={{ padding: '10px', textAlign: 'right' }}>{fmt(t.fundoMissionario)}</td>
                          <td style={{ padding: '10px', textAlign: 'right' }}>{fmt(t.totalRepasse)}</td>
                          <td style={{ padding: '10px', textAlign: 'right', color: '#4ade80', fontSize: 14 }}>{fmt(t.saldoDisponivel)}</td>
                        </tr>
                      );
                    })()}
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
