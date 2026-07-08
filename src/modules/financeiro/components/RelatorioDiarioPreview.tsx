import { DocumentHeader } from '@core/components/DocumentHeader';
import { dispararImpressaoFiel } from '../utils/printHelper';
import type { Paroquia } from '../../../core/types/app.types';
import type { Lancamento } from '../services';

const PRINT_ID = 'relatorio-caixa';

const fmt = (v: number) =>
  'R$ ' + Math.abs(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

interface Props {
  paroquia: Paroquia;
  unidade: string;
  dataSel: string;
  dataSelFim: string;
  lancamentos: Lancamento[];
  totalEntradas: number;
  totalSaidas: number;
  saldoDia: number;
  saldoAnterior: number;
  partilha: {
    comunidade: number;
    areaMissionaria: number;
    arquidiocese: number;
    fundoMissionario: number;
    saldoDisponivel: number;
  };
  dinheiro: number;
  pix: number;
  configPartilha: { comunidade: number; areaMissionaria: number; arquidiocese: number; fundoMissionario: number };
  nomeNivel2: string;
}

export function RelatorioDiarioPreview({
  paroquia, unidade, dataSel, dataSelFim, lancamentos,
  totalEntradas, totalSaidas, saldoDia, saldoAnterior,
  partilha, dinheiro, pix, configPartilha, nomeNivel2,
}: Props) {
  const saldoReal     = partilha.saldoDisponivel;
  const saldoFinalDisp = saldoAnterior + saldoReal;
  const totalConfer   = dinheiro + pix;
  const totalRepasse  = partilha.comunidade + partilha.areaMissionaria + partilha.arquidiocese + partilha.fundoMissionario;
  const diferenca     = totalConfer - totalEntradas;
  const diferencaOk   = Math.abs(diferenca) < 0.01;
  const baseAreaMiss  = saldoDia - partilha.comunidade;
  const baseArqui     = baseAreaMiss - partilha.areaMissionaria;

  const isSingleDay = dataSel === dataSelFim;
  const periodoLabel = isSingleDay
    ? dataSel.split('-').reverse().join('/')
    : `${dataSel.split('-').reverse().join('/')} a ${dataSelFim.split('-').reverse().join('/')}`;

  const minLinhas   = 22;
  const linhasVazias = Math.max(0, minLinhas - lancamentos.length);

  const thStyle: React.CSSProperties = {
    border: '1px solid #222', padding: '7px 8px', fontSize: 10, fontWeight: 700,
    background: '#e8e8e8', textAlign: 'center', textTransform: 'uppercase',
  };
  const tdVal: React.CSSProperties = {
    border: '1px solid #222', padding: '5px 7px', fontSize: 10, textAlign: 'right', whiteSpace: 'nowrap',
  };
  const tdValNeg: React.CSSProperties = { ...tdVal, color: '#c00', fontWeight: 700 };
  const tdValPos: React.CSSProperties = { ...tdVal, color: '#0a5', fontWeight: 700 };

  return (
    <div style={{ marginTop: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12, gap: 10 }}>
        <button
          onClick={() => dispararImpressaoFiel(PRINT_ID, `Movimento do Caixa - ${unidade} - ${periodoLabel}`)}
          style={{ padding: '10px 22px', background: '#1f3b73', color: 'white', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer', fontSize: 13 }}
        >
          🖨️ Imprimir Relatório do Dia
        </button>
      </div>

      <div
        id={PRINT_ID}
        style={{
          background: 'white', boxShadow: '0 4px 32px rgba(0,0,0,0.15)',
          borderRadius: 6, padding: '24px 28px', maxWidth: 820, margin: '0 auto',
          fontFamily: 'Arial, sans-serif',
        }}
      >
        <DocumentHeader paroquia={paroquia} />

        <h1 style={{ textAlign: 'center', fontSize: 26, fontWeight: 900, letterSpacing: '0.04em', margin: '18px 0 14px', color: '#111' }}>
          MOVIMENTO DO CAIXA
        </h1>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderBottom: '1.5px solid #222', borderTop: '1.5px solid #222', padding: '5px 0', marginBottom: 10 }}>
          <div style={{ fontSize: 11 }}><strong>COMUNIDADE:</strong>&nbsp; {unidade}</div>
          <div style={{ fontSize: 11 }}><strong>DATA:</strong>&nbsp; {periodoLabel}</div>
        </div>

        {/* Tabela de lançamentos */}
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
            {lancamentos.map((l, i) => (
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
            {Array.from({ length: linhasVazias }).map((_, i) => (
              <tr key={`vazio-${i}`}>
                <td style={{ border: '1px solid #ccc', padding: '6px' }}>&nbsp;</td>
                <td style={{ border: '1px solid #ccc' }} />
                <td style={{ border: '1px solid #ccc' }} />
                <td style={{ border: '1px solid #ccc' }} />
                <td style={{ border: '1px solid #ccc' }} />
              </tr>
            ))}
            <tr style={{ background: '#f2f2f2' }}>
              <td colSpan={3} style={{ border: '1px solid #222', padding: '5px 8px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase' }}>TOTAIS DO DIA</td>
              <td style={{ ...tdValPos }}>{fmt(totalEntradas)}</td>
              <td style={{ ...tdValNeg }}>{fmt(totalSaidas)}</td>
            </tr>
          </tbody>
        </table>

        {/* Seção inferior: 2 colunas (estrutura da imagem 1) */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 14, marginTop: 8 }}>

          {/* Coluna ESQUERDA: Cálculo %, Conferência Física, Descrição de Repasse, Diferença */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

            {/* Cálculo em % de repasses */}
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th colSpan={2} style={{ ...thStyle, textAlign: 'left', background: '#dde' }}>
                    Cálculo em % de repasses:
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
                    <td style={{ ...tdVal }}>{fmt(dinheiro)}</td>
                  </tr>
                  <tr>
                    <td style={{ border: '1px solid #ccc', padding: '4px 7px', fontSize: 10 }}>PIX</td>
                    <td style={{ ...tdVal }}>{fmt(pix)}</td>
                  </tr>
                  <tr style={{ background: '#f2f2f2' }}>
                    <td style={{ border: '1px solid #222', padding: '5px 7px', fontSize: 10, fontWeight: 700 }}>TOTAL CONFERIDO</td>
                    <td style={{ ...tdVal, fontWeight: 700, border: '1px solid #222' }}>{fmt(totalConfer)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

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
                    Esta célula cruza o que foi recebido em Dinheiro e PIX com as entradas registradas no sistema. <strong>A lógica é:</strong> Dinheiro + PIX deve ser igual ao Total de Entradas. O resultado <strong>deve ser R$ 0,00</strong> — se diferente, há entradas lançadas sem forma de recebimento correspondente ou divergência no valor conferido.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Coluna DIREITA: Fluxo Contábil, Saldos, Assinaturas */}
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
                  <td style={{ border: '1px solid #ccc', padding: '4px 7px', fontSize: 10 }}>TOTAL DE ENTRADAS (DIA)</td>
                  <td style={{ ...tdValPos }}>{fmt(totalEntradas)}</td>
                </tr>
                <tr>
                  <td style={{ border: '1px solid #ccc', padding: '4px 7px', fontSize: 10 }}>TOTAL DE SAÍDAS (DIA)</td>
                  <td style={{ ...tdValNeg }}>{fmt(totalSaidas)}</td>
                </tr>
                <tr style={{ background: '#f2f2f2' }}>
                  <td style={{ border: '1px solid #222', padding: '5px 7px', fontSize: 10, fontWeight: 700 }}>SALDO DO DIA</td>
                  <td style={{ ...tdVal, fontWeight: 700, border: '1px solid #222', color: saldoDia >= 0 ? '#0a5' : '#c00' }}>{fmt(saldoDia)}</td>
                </tr>
              </tbody>
            </table>

            {/* Saldo Anterior Conciliado */}
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

            {/* Assinaturas */}
            <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 50, paddingBottom: 10 }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: '#444' }}>Assinaturas</div>
              <div>
                <div style={{ borderTop: '1px solid #222', paddingTop: 5, fontSize: 10, textAlign: 'center' }}>
                  Tesoureiro(a) da Comunidade
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
  );
}
