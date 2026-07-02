import { useState, useEffect } from 'react';
import { getDb } from '@core/database';
import { DocumentHeader } from '@core/components/DocumentHeader';
import { dispararImpressaoFiel } from '../utils/printHelper';
import type { Paroquia } from '../../../core/types/app.types';
import type { Lancamento } from '../services';
import type { ConfiguracaoPartilha } from '../../../core/types/entities';

interface PartilhaResult {
  comunidade: number;
  areaMissionaria: number;
  arquidiocese: number;
  fundoMissionario: number;
  saldoDisponivel: number;
}

interface Props {
  paroquia: Paroquia;
  unidade: string;
  mes: string; // YYYY-MM
  lancamentos: Lancamento[];
  configPartilha: { comunidade: number; areaMissionaria: number; arquidiocese: number; fundoMissionario: number };
  calcularPartilha: (saldo: number) => PartilhaResult;
  nomeNivel2: string;
}

const PRINT_ID = 'relatorio-caixa-mensal';

const fmt = (v: number) =>
  'R$ ' + Math.abs(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtMes = (mes: string) => {
  const [ano, m] = mes.split('-');
  const nomes = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  return `${nomes[parseInt(m) - 1]} de ${ano}`;
};

const ultimoDiaMes = (mes: string) => {
  const [ano, m] = mes.split('-').map(Number);
  return new Date(ano, m, 0).getDate();
};

const tdLabel: React.CSSProperties = {
  border: '1px solid #222', padding: '5px 7px', fontSize: 10, fontWeight: 700,
  background: '#f2f2f2', whiteSpace: 'nowrap',
};
const tdVal: React.CSSProperties = {
  border: '1px solid #222', padding: '5px 7px', fontSize: 10, textAlign: 'right', whiteSpace: 'nowrap',
};
const tdValNeg: React.CSSProperties = { ...tdVal, color: '#c00', fontWeight: 700 };
const tdValPos: React.CSSProperties = { ...tdVal, color: '#0a5', fontWeight: 700 };

export function RelatorioMensalPreview({ paroquia, unidade, mes, lancamentos, configPartilha, calcularPartilha, nomeNivel2 }: Props) {
  const [dinheiroMes, setDinheiroMes] = useState(0);
  const [pixMes, setPixMes] = useState(0);
  const [saldoAnterior, setSaldoAnterior] = useState(0);

  useEffect(() => {
    const carregar = async () => {
      try {
        const db = await getDb();

        // Dinheiro e PIX: soma diretamente dos lançamentos de ENTRADA do mês por metodo
        const entradasMes = await db.select<{ metodo: string; total: number }[]>(
          "SELECT metodo, SUM(valor) as total FROM lancamentos WHERE data LIKE $1 AND origem = $2 AND tipo = 'ENTRADA' AND deleted_at IS NULL GROUP BY metodo",
          [`${mes}%`, unidade]
        );
        setDinheiroMes(entradasMes.find(r => r.metodo === 'DINHEIRO')?.total ?? 0);
        setPixMes(entradasMes.find(r => r.metodo === 'PIX')?.total ?? 0);

        // Calcula o mês anterior ao mês do relatório
        const [anoMes, numMes] = mes.split('-').map(Number);
        const mesAntNum = numMes === 1 ? 12 : numMes - 1;
        const anoAnt    = numMes === 1 ? anoMes - 1 : anoMes;
        const mesAnt    = `${anoAnt}-${String(mesAntNum).padStart(2, '0')}`;

        // Tenta usar saldo_disponivel já gravado do mês anterior (dado novo)
        const fechUltAnt = await db.select<{ saldo_disponivel: number | null }[]>(
          "SELECT saldo_disponivel FROM caixa_fechamento WHERE data LIKE $1 AND unidade = $2 AND saldo_disponivel > 0 ORDER BY data DESC LIMIT 1",
          [`${mesAnt}%`, unidade]
        );
        if (fechUltAnt.length > 0) {
          setSaldoAnterior(Number(fechUltAnt[0].saldo_disponivel));
        } else {
          // Reconstrói o Saldo Final Disponível do mês anterior a partir dos lançamentos
          const cfgRows = await db.select<ConfiguracaoPartilha[]>("SELECT * FROM configuracoes_partilha WHERE id=1 LIMIT 1");
          const cfg = cfgRows[0] ?? { id: 1, comunidade: 30, area_missionaria: 40, arquidiocese: 29, fundo_missionario: 1 };

          const primFechAnt = await db.select<{ saldo_anterior: number | null }[]>(
            "SELECT saldo_anterior FROM caixa_fechamento WHERE data LIKE $1 AND unidade = $2 AND saldo_anterior > 0 ORDER BY data ASC LIMIT 1",
            [`${mesAnt}%`, unidade]
          );
          const saldoInicioAnt = Number(primFechAnt[0]?.saldo_anterior ?? 0);

          const lancsAnt = await db.select<{ tipo: string; valor: number }[]>(
            "SELECT tipo, valor FROM lancamentos WHERE data LIKE $1 AND origem = $2 AND deleted_at IS NULL",
            [`${mesAnt}%`, unidade]
          );
          const entAnt = lancsAnt.filter(r => r.tipo === 'ENTRADA').reduce((s, r) => s + r.valor, 0);
          const saiAnt = lancsAnt.filter(r => r.tipo === 'SAIDA').reduce((s, r) => s + r.valor, 0);
          const base = Math.max(0, entAnt - saiAnt);
          const c1 = base * ((cfg.comunidade ?? 30) / 100);
          const c2 = (base - c1) * ((cfg.area_missionaria ?? 40) / 100);
          const c3 = (base - c1 - c2) * ((cfg.arquidiocese ?? 29) / 100);
          const c4 = (base - c1 - c2 - c3) * ((cfg.fundo_missionario ?? 1) / 100);
          const saldoLiquido = base - c1 - c2 - c3 - c4;

          setSaldoAnterior(saldoInicioAnt + saldoLiquido);
        }
      } catch { /* silencioso */ }
    };
    carregar();
  }, [mes, unidade]);

  const lancMes = lancamentos
    .filter(l => l.data?.startsWith(mes) && (unidade === 'TODOS' || l.origem === unidade))
    .sort((a, b) => a.data.localeCompare(b.data) || a.id - b.id);

  const totalEntradas = lancMes.filter(l => l.tipo === 'ENTRADA').reduce((s, l) => s + l.valor, 0);
  const totalSaidas   = lancMes.filter(l => l.tipo === 'SAIDA').reduce((s, l) => s + l.valor, 0);
  const saldoDoMes    = totalEntradas - totalSaidas;

  const partilha       = calcularPartilha(saldoDoMes);
  const totalRepasse   = partilha.comunidade + partilha.areaMissionaria + partilha.arquidiocese + partilha.fundoMissionario;
  const saldoReal      = saldoDoMes - totalRepasse;
  const saldoFinalDisp = saldoAnterior + saldoReal;
  const totalConfer    = dinheiroMes + pixMes;
  // Diferença: compara o que foi recebido fisicamente (dinheiro+pix) com o total de entradas registrado.
  // Deve ser R$0,00 — se diferente, significa que há entradas sem forma de recebimento definida.
  const diferenca      = totalConfer - totalEntradas;
  const diferencaOk    = Math.abs(diferenca) < 0.01;

  // Base para Área Missionária = saldo após retirar o repasse da Comunidade
  const baseAreaMiss = saldoDoMes - partilha.comunidade;
  // Base para Arquidiocese = saldo após retirar Comunidade + Área Missionária
  const baseArqui = baseAreaMiss - partilha.areaMissionaria;

  const ultimoDia = `${mes}-${String(ultimoDiaMes(mes)).padStart(2, '0')}`;
  const nomeComunidade = unidade;

  // Fileiras vazias para preencher a tabela (mínimo 20 linhas)
  const minLinhas = 22;
  const linhasVazias = Math.max(0, minLinhas - lancMes.length);

  const thStyle: React.CSSProperties = {
    border: '1px solid #222', padding: '7px 8px', fontSize: 10, fontWeight: 700,
    background: '#e8e8e8', textAlign: 'center', textTransform: 'uppercase',
  };

  return (
    <div style={{ marginTop: 20 }}>
      {/* Botão de impressão (fora do papel) */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12, gap: 10 }}>
        <button
          onClick={() => {
            const [ano, m] = mes.split('-');
            const nomes = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
            const nomeMes = nomes[parseInt(m) - 1];
            dispararImpressaoFiel(PRINT_ID, `Movimento do Caixa - ${nomeComunidade} - ${nomeMes} ${ano}`);
          }}
          style={{ padding: '10px 22px', background: '#1f3b73', color: 'white', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer', fontSize: 13 }}
        >
          🖨️ Imprimir Relatório Mensal
        </button>
      </div>

      {/* ── PAPEL A4 ─────────────────────────────────────────────────────────── */}
      <div
        id={PRINT_ID}
        style={{
          background: 'white', boxShadow: '0 4px 32px rgba(0,0,0,0.15)',
          borderRadius: 6, padding: '24px 28px', maxWidth: 820, margin: '0 auto',
          fontFamily: 'Arial, sans-serif',
        }}
      >
        {/* ── Cabeçalho ───────────────────────────────────────────────────── */}
        <DocumentHeader paroquia={paroquia} />

        {/* ── Título ──────────────────────────────────────────────────────── */}
        <h1 style={{ textAlign: 'center', fontSize: 26, fontWeight: 900, letterSpacing: '0.04em', margin: '18px 0 14px', color: '#111' }}>
          MOVIMENTO DO CAIXA
        </h1>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#444', marginBottom: 2 }}>
          Período: <span style={{ fontWeight: 400 }}>{fmtMes(mes)}</span>
        </div>

        {/* ── Linha COMUNIDADE / DATA ──────────────────────────────────────── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderBottom: '1.5px solid #222', borderTop: '1.5px solid #222', padding: '5px 0', marginBottom: 10 }}>
          <div style={{ fontSize: 11 }}><strong>COMUNIDADE:</strong>&nbsp; {nomeComunidade}</div>
          <div style={{ fontSize: 11 }}><strong>DATA:</strong>&nbsp; {ultimoDia.split('-').reverse().join('/')}</div>
        </div>

        {/* ── Tabela de Lançamentos ──────────────────────────────────────── */}
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 14 }}>
          <thead>
            <tr>
              <th style={{ ...thStyle, width: 80 }}>DATA</th>
              <th style={{ ...thStyle, width: 60 }}>DOC. N°</th>
              <th style={{ ...thStyle }}>HISTÓRICO</th>
              <th style={{ ...thStyle, width: 110 }}>ENTRADAS</th>
              <th style={{ ...thStyle, width: 110 }}>SAÍDAS</th>
            </tr>
          </thead>
          <tbody>
            {lancMes.map((l, i) => (
              <tr key={l.id ?? i}>
                <td style={{ border: '1px solid #ccc', padding: '4px 6px', fontSize: 9.5, textAlign: 'center' }}>
                  {l.data ? l.data.split('-').reverse().join('/') : ''}
                </td>
                <td style={{ border: '1px solid #ccc', padding: '4px 6px', fontSize: 9.5, textAlign: 'center' }}>
                  {l.doc_num || ''}
                </td>
                <td style={{ border: '1px solid #ccc', padding: '4px 8px', fontSize: 9.5 }}>
                  {l.descricao}
                  {l.metodo && l.tipo === 'ENTRADA' ? ` (${l.metodo === 'PIX' ? 'PIX' : 'Dinheiro'})` : ''}
                </td>
                <td style={{ border: '1px solid #ccc', padding: '4px 6px', fontSize: 9.5, textAlign: 'right', color: '#0a5', fontWeight: 600 }}>
                  {l.tipo === 'ENTRADA' ? `R$  ${l.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : ''}
                </td>
                <td style={{ border: '1px solid #ccc', padding: '4px 6px', fontSize: 9.5, textAlign: 'right', color: '#c00', fontWeight: 600 }}>
                  {l.tipo === 'SAIDA' ? `R$  ${l.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : ''}
                </td>
              </tr>
            ))}
            {/* Linhas vazias para preenchimento */}
            {Array.from({ length: linhasVazias }).map((_, i) => (
              <tr key={`vazio-${i}`}>
                <td style={{ border: '1px solid #ccc', padding: '6px' }}>&nbsp;</td>
                <td style={{ border: '1px solid #ccc' }} />
                <td style={{ border: '1px solid #ccc' }} />
                <td style={{ border: '1px solid #ccc' }} />
                <td style={{ border: '1px solid #ccc' }} />
              </tr>
            ))}
            {/* Totais */}
            <tr style={{ background: '#f2f2f2' }}>
              <td colSpan={3} style={{ border: '1px solid #222', padding: '5px 8px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase' }}>TOTAIS DO MÊS</td>
              <td style={{ ...tdValPos }}>{fmt(totalEntradas)}</td>
              <td style={{ ...tdValNeg }}>{fmt(totalSaidas)}</td>
            </tr>
          </tbody>
        </table>

        {/* ── Seção inferior: 2 colunas ────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 14, marginTop: 8 }}>

          {/* Coluna ESQUERDA */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

            {/* Cálculo em % de repasse */}
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th colSpan={2} style={{ ...thStyle, textAlign: 'left', background: '#dde' }}>
                    Cálculo em % de repasse:
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ border: '1px solid #ccc', padding: '4px 7px', fontSize: 9.5 }}>
                    Resultado calculado sobre o Repasse Com.:
                  </td>
                  <td style={{ ...tdVal }}>{fmt(baseAreaMiss)}</td>
                </tr>
                <tr>
                  <td colSpan={2} style={{ border: '1px solid #ccc', padding: '5px 7px', fontSize: 9, fontStyle: 'italic', color: '#555' }}>
                    Repasse {nomeNivel2} vem calculado sobre o valor restante subtraído do Repasse da Comunidade.
                  </td>
                </tr>
                <tr>
                  <td style={{ border: '1px solid #ccc', padding: '4px 7px', fontSize: 9.5 }}>
                    Resultado calculado sobre o Repasse {nomeNivel2}:
                  </td>
                  <td style={{ ...tdVal }}>{fmt(baseArqui)}</td>
                </tr>
                <tr>
                  <td colSpan={2} style={{ border: '1px solid #ccc', padding: '5px 7px', fontSize: 9, fontStyle: 'italic', color: '#555' }}>
                    O valor do Repasse para Arquidiocese é calculado sobre o valor final do Repasse {nomeNivel2}. A Manutenção da Arquidiocese vem calculada sobre o valor do Repasse da Arquidiocese.
                  </td>
                </tr>
              </tbody>
            </table>

            {/* Conferência Física */}
            <div>
              <div style={{ textAlign: 'center', fontWeight: 700, fontSize: 11, marginBottom: 2 }}>
                CONFERÊNCIA FÍSICA
              </div>
              <div style={{ textAlign: 'center', fontSize: 9.5, marginBottom: 6, color: '#555' }}>
                (Dinheiro e Banco)
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th colSpan={2} style={{ ...thStyle, background: '#dde' }}>DETALHES FÍSICOS</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ border: '1px solid #ccc', padding: '4px 7px', fontSize: 10 }}>DINHEIRO</td>
                    <td style={{ ...tdVal }}>{fmt(dinheiroMes)}</td>
                  </tr>
                  <tr>
                    <td style={{ border: '1px solid #ccc', padding: '4px 7px', fontSize: 10 }}>PIX</td>
                    <td style={{ ...tdVal }}>{fmt(pixMes)}</td>
                  </tr>
                  <tr style={{ background: '#f2f2f2' }}>
                    <td style={{ border: '1px solid #222', padding: '5px 7px', fontSize: 10, fontWeight: 700 }}>TOTAL CONFERIDO</td>
                    <td style={{ ...tdVal, fontWeight: 700, border: '1px solid #222' }}>{fmt(totalConfer)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Coluna DIREITA */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>

            {/* Fluxo Contábil */}
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th colSpan={2} style={{ ...thStyle, background: '#dde', textAlign: 'center' }}>FLUXO CONTÁBIL</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ border: '1px solid #ccc', padding: '4px 7px', fontSize: 10 }}>TOTAL DE ENTRADAS (MÊS)</td>
                  <td style={{ ...tdValPos }}>{fmt(totalEntradas)}</td>
                </tr>
                <tr>
                  <td style={{ border: '1px solid #ccc', padding: '4px 7px', fontSize: 10 }}>TOTAL DE SAÍDAS (MÊS)</td>
                  <td style={{ ...tdValNeg }}>{fmt(totalSaidas)}</td>
                </tr>
                <tr style={{ background: '#f2f2f2' }}>
                  <td style={{ border: '1px solid #222', padding: '5px 7px', fontSize: 10, fontWeight: 700 }}>SALDO DO MÊS</td>
                  <td style={{ ...tdVal, fontWeight: 700, border: '1px solid #222', color: saldoDoMes >= 0 ? '#0a5' : '#c00' }}>{fmt(saldoDoMes)}</td>
                </tr>
              </tbody>
            </table>

            {/* Saldo Anterior */}
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                <tr style={{ background: '#fffbe6' }}>
                  <td style={{ border: '1.5px solid #bbb', padding: '5px 7px', fontSize: 10, fontWeight: 700 }}>SALDO ANTERIOR CONCILIADO</td>
                  <td style={{ ...tdVal, border: '1.5px solid #bbb', fontWeight: 700 }}>{fmt(saldoAnterior)}</td>
                </tr>
                <tr>
                  <td colSpan={2} style={{ border: '1px solid #eee', padding: '3px 7px', fontSize: 8.5, fontStyle: 'italic', color: '#666' }}>
                    "Sempre verificar se este valor foi reconciliado no banco"
                  </td>
                </tr>
              </tbody>
            </table>

            {/* Saldo Real */}
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                <tr style={{ background: '#e8f4e8' }}>
                  <td style={{ border: '1.5px solid #1f3b73', padding: '6px 7px', fontSize: 11, fontWeight: 700, color: '#1f3b73' }}>SALDO REAL</td>
                  <td style={{ ...tdVal, border: '1.5px solid #1f3b73', fontWeight: 800, fontSize: 11, color: '#1f3b73' }}>{fmt(saldoReal)}</td>
                </tr>
                <tr>
                  <td colSpan={2} style={{ border: '1px solid #eee', padding: '3px 7px', fontSize: 8.5, fontStyle: 'italic', color: '#666' }}>
                    Valor já descontado o repasse Arquidiocese e {nomeNivel2}
                  </td>
                </tr>
              </tbody>
            </table>

            {/* Saldo Final Disponível */}
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                <tr style={{ background: '#1f3b73' }}>
                  <td style={{ border: '1.5px solid #1f3b73', padding: '8px 7px', fontSize: 11, fontWeight: 800, color: 'white' }}>SALDO FINAL DISPONÍVEL</td>
                  <td style={{ ...tdVal, border: '1.5px solid #1f3b73', fontWeight: 900, fontSize: 13, color: 'white', background: '#1f3b73' }}>{fmt(saldoFinalDisp)}</td>
                </tr>
                <tr>
                  <td colSpan={2} style={{ border: '1px solid #eee', padding: '3px 7px', fontSize: 8.5, fontStyle: 'italic', color: '#666' }}>
                    Saldo Anterior + Saldo Real
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Página 2: Repasse + Diferença + Assinaturas ────────────────── */}
        <div style={{ borderTop: '2px solid #ccc', marginTop: 30, paddingTop: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

            {/* Coluna Esquerda: Repasse + Diferença */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

              {/* Descrição de Repasse */}
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th colSpan={2} style={{ ...thStyle, background: '#dde', textAlign: 'center' }}>DESCRIÇÃO DE REPASSE</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ border: '1px solid #ccc', padding: '4px 7px', fontSize: 10 }}>
                      COMUNIDADE ({configPartilha.comunidade}%)
                    </td>
                    <td style={{ ...tdVal }}>{fmt(partilha.comunidade)}</td>
                  </tr>
                  <tr>
                    <td style={{ border: '1px solid #ccc', padding: '4px 7px', fontSize: 10 }}>
                      {nomeNivel2.toUpperCase()} ({configPartilha.areaMissionaria}%)
                    </td>
                    <td style={{ ...tdVal }}>{fmt(partilha.areaMissionaria)}</td>
                  </tr>
                  <tr>
                    <td style={{ border: '1px solid #ccc', padding: '4px 7px', fontSize: 10 }}>
                      ARQUIDIOCESE / DIOCESE ({configPartilha.arquidiocese}%)
                    </td>
                    <td style={{ ...tdVal }}>{fmt(partilha.arquidiocese)}</td>
                  </tr>
                  {configPartilha.fundoMissionario > 0 && (
                    <tr>
                      <td style={{ border: '1px solid #ccc', padding: '4px 7px', fontSize: 10 }}>
                        FUNDO MISSIONÁRIO ({configPartilha.fundoMissionario}%)
                      </td>
                      <td style={{ ...tdVal }}>{fmt(partilha.fundoMissionario)}</td>
                    </tr>
                  )}
                  <tr style={{ background: '#f2f2f2' }}>
                    <td style={{ border: '1px solid #222', padding: '5px 7px', fontSize: 10, fontWeight: 700 }}>TOTAL DE REPASSE</td>
                    <td style={{ ...tdVal, fontWeight: 700, border: '1px solid #222' }}>{fmt(totalRepasse)}</td>
                  </tr>
                </tbody>
              </table>

              {/* Diferença */}
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  <tr style={{ background: diferencaOk ? '#e8f4e8' : '#fde8e8' }}>
                    <td style={{ border: '1.5px solid #222', padding: '5px 7px', fontSize: 10, fontWeight: 700 }}>
                      **DIFERENÇA**
                    </td>
                    <td style={{ ...tdVal, border: '1.5px solid #222', fontWeight: 800, color: diferencaOk ? '#0a5' : '#c00' }}>
                      {diferencaOk ? 'R$ 0,00 ✓' : fmt(diferenca)}
                    </td>
                  </tr>
                  <tr>
                    <td colSpan={2} style={{ border: '1px solid #eee', padding: '6px 7px', fontSize: 8.5, color: '#555', lineHeight: 1.5 }}>
                      Esta célula cruza o total físico recebido (Dinheiro + PIX) com o total de entradas registrado no sistema.{' '}
                      <strong>A lógica é:</strong> Dinheiro + PIX deve ser igual ao Total de Entradas.
                      O resultado <strong>deve ser obrigatoriamente R$ 0,00</strong>. Se diferente, há entradas sem forma de recebimento definida ou divergência no recebimento físico.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Coluna Direita: Assinaturas */}
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', paddingTop: 10 }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: '#444', marginBottom: 8 }}>Assinaturas</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 50, paddingBottom: 10 }}>
                <div>
                  <div style={{ borderTop: '1px solid #222', paddingTop: 5, fontSize: 10, textAlign: 'center' }}>
                    Coordenador Financeiro da Comunidade
                  </div>
                </div>
                <div>
                  <div style={{ borderTop: '1px solid #222', paddingTop: 5, fontSize: 10, textAlign: 'center' }}>
                    Pe. Éder de Souza Gomes Cordeiro
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
