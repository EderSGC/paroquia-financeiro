import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface FontSelectorProps {
  fonteAtual: string;
  onChange: (novaFonte: string) => void;
}

export function FontSelector({ fonteAtual, onChange }: FontSelectorProps) {
  const [fontesDoSistema, setFontesDoSistema] = useState<string[]>([]);
  const [isOpen, setIsOpen] = useState(false); // Controla a abertura do menu customizado

  useEffect(() => {
    const carregarFontes = async () => {
      try {
        const lista = await invoke<string[]>('buscar_fontes_sistema');
        if (lista) setFontesDoSistema(lista);
      } catch (error) {
        console.error("Erro ao buscar fontes:", error);
      }
    };
    carregarFontes();
  }, []);

  return (
    <div style={{ marginBottom: '20px', position: 'relative', width: '300px' }}>
      <label style={{
        display: 'block',
        fontSize: '11px',
        fontWeight: 700,
        color: 'var(--dm-label-color)',
        marginBottom: '6px',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}>
        FONTE DO DOCUMENTO:
      </label>

      {/* Botão que abre o seletor customizado */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        style={{
          padding: '10px 14px',
          background: 'var(--dm-input-bg)',
          border: '1px solid var(--dm-input-border)',
          borderRadius: '8px',
          cursor: 'pointer',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '14px',
          color: 'var(--dm-input-color)',
          fontFamily: 'Inter, system-ui, sans-serif',
        }}
      >
        <span>{fonteAtual || "Selecione a fonte..."}</span>
        <span style={{ fontSize: '10px' }}>{isOpen ? '▲' : '▼'}</span>
      </div>

      {/* Menu suspenso customizado */}
      {isOpen && (
        <div style={{
          position: 'absolute',
          top: '105%',
          left: 0,
          right: 0,
          backgroundColor: 'var(--dm-card-bg)',
          border: '1px solid var(--dm-card-border)',
          borderRadius: '8px',
          boxShadow: 'var(--shadow-modal)',
          zIndex: 1000,
          maxHeight: '300px',
          overflowY: 'auto',
        }}>
          {fontesDoSistema.map((fonte) => (
            <div
              key={fonte}
              onClick={() => {
                onChange(fonte);
                setIsOpen(false);
              }}
              style={{
                padding: '10px 14px',
                cursor: 'pointer',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderBottom: '1px solid var(--dm-separator)',
                backgroundColor: fonteAtual === fonte ? 'var(--dm-badge-bg)' : 'transparent',
                fontFamily: 'Inter, sans-serif',
                color: 'var(--dm-input-color)',
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--dm-table-hover)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = fonteAtual === fonte ? 'var(--dm-badge-bg)' : 'transparent'}
            >
              <span style={{ fontSize: '14px' }}>{fonte}</span>
              <span style={{
                fontFamily: fonte,
                fontSize: '16px',
                color: 'var(--dm-label-color)',
              }}>
                Abc
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};