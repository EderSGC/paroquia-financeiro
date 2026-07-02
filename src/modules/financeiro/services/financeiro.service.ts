import { create } from 'zustand';

// Definimos a interface aqui para ser a única fonte da verdade
export interface Lancamento {
  id: number;
  categoria: string;
  descricao: string;
  valor: number;
  metodo: string;
  data: string;
  tipo: string;
  origem: string;       // nome da unidade: 'PAROQUIA' ou nome livre da comunidade
  nome_fiel?: string;  // coluna virtual do JOIN com fieis
  fiel_id?: number | null;
  doc_num?: string | null;
  uuid?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  deleted_at?: string | null;
}

interface FinanceiroState {
  dizimos: Lancamento[];
  setDizimos: (dados: Lancamento[]) => void;
}

export const useFinanceiroStore = create<FinanceiroState>((set) => ({
  dizimos: [],
  setDizimos: (dados) => set({ dizimos: dados }),
}));