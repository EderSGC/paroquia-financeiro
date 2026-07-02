import { useEffect, useState } from 'react';
import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';

export function UpdateChecker() {
  const [update, setUpdate] = useState<{ version: string; body: string } | null>(null);
  const [installing, setInstalling] = useState(false);
  const [progress, setProgress] = useState('');

  useEffect(() => {
    const timer = setTimeout(async () => {
      try {
        const upd = await check();
        if (upd) {
          setUpdate({ version: upd.version, body: upd.body ?? '' });
        }
      } catch {
        // silently ignore — no internet or no releases yet
      }
    }, 5000);
    return () => clearTimeout(timer);
  }, []);

  async function handleInstall() {
    setInstalling(true);
    try {
      setProgress('Baixando atualização...');
      const upd = await check();
      if (!upd) return;
      await upd.downloadAndInstall((event) => {
        if (event.event === 'Started' && event.data.contentLength) {
          setProgress(`Baixando... 0/${Math.round(event.data.contentLength / 1024 / 1024)}MB`);
        } else if (event.event === 'Progress') {
          setProgress(`Baixando...`);
        } else if (event.event === 'Finished') {
          setProgress('Instalando...');
        }
      });
      setProgress('Reiniciando...');
      await relaunch();
    } catch (e) {
      console.error('Erro ao atualizar:', e);
      setProgress('Erro na atualização. Baixe manualmente em github.com/EderSGC/paroquia-app/releases');
      setInstalling(false);
    }
  }

  if (!update) return null;

  return (
    <div style={{
      position: 'fixed', bottom: 20, right: 20, zIndex: 99999,
      background: '#1f3b73', color: 'white', borderRadius: 14,
      padding: '16px 20px', boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
      maxWidth: 360, fontFamily: 'inherit',
    }}>
      <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 6 }}>
        Nova versão disponível: v{update.version}
      </div>
      {update.body && (
        <div style={{ fontSize: 12, color: '#93c5fd', marginBottom: 12, lineHeight: 1.4 }}>
          {update.body.slice(0, 200)}
        </div>
      )}
      {installing ? (
        <div style={{ fontSize: 12, color: '#93c5fd' }}>{progress}</div>
      ) : (
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={handleInstall}
            style={{
              padding: '8px 20px', background: '#22c55e', color: 'white',
              border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer', fontSize: 12,
            }}
          >
            Atualizar agora
          </button>
          <button
            onClick={() => setUpdate(null)}
            style={{
              padding: '8px 14px', background: 'transparent', color: '#93c5fd',
              border: '1px solid #93c5fd', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: 12,
            }}
          >
            Depois
          </button>
        </div>
      )}
    </div>
  );
}
