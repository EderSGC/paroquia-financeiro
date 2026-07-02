export type MetodoPagamento = 'DINHEIRO' | 'BANCO' | 'PIX';
export type TipoMovimentacao = 'ENTRADA' | 'SAIDA';

export interface Dizimo {
  id?: number;
  fiel_id: number;
  nome: string;
  valor: number;
  data: string;
  metodo: MetodoPagamento;
}