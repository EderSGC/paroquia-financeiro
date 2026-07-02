import type { CSSProperties } from "react";
import { useEffect, useState, useCallback } from "react";
import { open, ask } from "@tauri-apps/plugin-dialog";
import { readFile } from "@tauri-apps/plugin-fs";
import { exit } from "@tauri-apps/plugin-process";
import { getDb } from "@core/database";
import {
  fazerBackup,
  restaurarBackup,
  getBackupInfo,
  getBackupConfig,
  configurarPastaCloud,
  fazerBackupNaPasta,
  formatarTamanho,
} from "../../../core/services/backup.service";
import {
  exportarRegistros,
  importarRegistros,
  getTabelasSincronizaveis,
  type SyncImportResult,
} from "../../../core/services/sync.service";
import { AuditoriaPage } from "../../configuracoes/pages/AuditoriaPage";

import { AppLogo } from "../../../core/ui/AppLogo";
import { ModalAlert, ModalConfirm } from "../../../core/ui/Modal";
import { useTheme, PALETTES } from "../../../core/hooks/useTheme";
import type { Palette } from "../../../core/hooks/useTheme";
import type { Paroquia, Usuario, PapelUsuario } from "../../../core/types/app.types";
import { LABEL_PAPEL } from "../../../core/types/app.types";
import { createDataUrl } from "../../../core/utils/image";
import {
  salvarConfiguracoesParoquia,
  carregarPartilha, salvarPartilha,
  listarUsuarios, criarUsuario, excluirUsuario, salvarPerguntaSeguranca,
  type ConfigPartilha, type UsuarioListItem,
} from "../../auth/services/auth.service";

interface SystemConfigPageProps {
  paroquia: Paroquia;
  usuario: Usuario;
  onParoquiaUpdated: (paroquia: Paroquia) => void;
}

const inputStyle: CSSProperties = {
  width: "100%", padding: "12px 14px", borderRadius: 10,
  border: "1px solid #d6dbe7", background: "#ffffff",
  color: "#1a1d2e", fontSize: 14, boxSizing: "border-box",
};

const labelStyle: CSSProperties = {
  display: "block", marginBottom: 6, fontSize: 12,
  fontWeight: 700, color: "#667085",
  textTransform: "uppercase", letterSpacing: "0.05em",
};

const numInput: CSSProperties = {
  width: "100%", padding: "10px 12px", borderRadius: 8,
  border: "1px solid #d6dbe7", background: "#fff",
  color: "#1a1d2e", fontSize: 15, fontWeight: 700,
  textAlign: "right", boxSizing: "border-box",
};

// ─────────────────────────────────────────────────────────────────────────────

export function SystemConfigPage({ paroquia, usuario, onParoquiaUpdated }: SystemConfigPageProps) {
  const isParoco = usuario.papel === 'paroquia' || usuario.papel === 'admin';
  const { palette, setPalette } = useTheme();

  // ── Dados da paróquia ──────────────────────────────────────────────────────
  const [form, setForm] = useState<Paroquia>(paroquia);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [alerta, setAlerta] = useState<{ tipo: "sucesso" | "erro" | "info"; msg: string } | null>(null);
  const [fazendoBackup, setFazendoBackup] = useState(false);
  const [restaurando, setRestaurando] = useState(false);
  const [backupInfo, setBackupInfo] = useState(getBackupInfo());
  const [abaAtiva, setAbaAtiva] = useState<"identidade" | "backup" | "sincronizacao" | "partilha" | "usuarios" | "auditoria" | "aparencia" | "sistema">("identidade");
  const [desinstalando, setDesinstalando] = useState(false);

  // ── Sincronização ──────────────────────────────────────────────────────────
  const tabelasSync = getTabelasSincronizaveis();
  const [syncTabelas, setSyncTabelas] = useState<string[]>(tabelasSync.map(t => t.nome));
  const [syncComunidadeId, setSyncComunidadeId] = useState<string>("");
  const [exportando, setExportando] = useState(false);
  const [importando, setImportando] = useState(false);
  const [importResult, setImportResult] = useState<SyncImportResult | null>(null);

  // ── Partilha ───────────────────────────────────────────────────────────────
  const [partilha, setPartilha] = useState<ConfigPartilha>({ comunidade: 30, areaMissionaria: 40, arquidiocese: 29, fundoMissionario: 1 });
  const [salvandoPartilha, setSalvandoPartilha] = useState(false);
  const totalPartilha = partilha.comunidade + partilha.areaMissionaria + partilha.arquidiocese + partilha.fundoMissionario;
  const partilhaValida = Math.abs(totalPartilha - 100) < 0.01;

  // ── Usuários ───────────────────────────────────────────────────────────────
  const [usuarios, setUsuarios] = useState<UsuarioListItem[]>([]);
  const [comunidades, setComunidades] = useState<{ id: number; nome: string }[]>([]);
  const [novoUsuario, setNovoUsuario] = useState({ nome: "", login: "", senha: "", papel: "vigario" as PapelUsuario, comunidade_id: "" });
  const [criandoUsuario, setCriandoUsuario] = useState(false);
  const [idExcluirUsuario, setIdExcluirUsuario] = useState<number | null>(null);

  useEffect(() => { setForm(paroquia); }, [paroquia]);

  useEffect(() => {
    (async () => {
      const db = await getDb();
      const cs = await db.select<{ id: number; nome: string }[]>("SELECT id, nome FROM comunidades WHERE deleted_at IS NULL ORDER BY nome");
      setComunidades(cs);
    })();
  }, []);

  const carregarDados = useCallback(async () => {
    if (!isParoco) return;
    const [p, us] = await Promise.all([carregarPartilha(), listarUsuarios()]);
    setPartilha(p);
    setUsuarios(us);
  }, [isParoco]);

  useEffect(() => { carregarDados(); }, [carregarDados]);

  // ── Helpers ────────────────────────────────────────────────────────────────
  function updateField<K extends keyof Paroquia>(key: K, value: Paroquia[K]) {
    setForm(c => ({ ...c, [key]: value }));
  }

  function getTituloParoquia(nome: string) {
    const normalized = nome.trim();
    if (!normalized) return { principal: "Área Missionária", secundario: "Nome da Comunidade" };
    const prefixes = ["Área Missionária", "Paróquia", "Comunidade", "Santuário", "Catedral"];
    const foundPrefix = prefixes.find(p => normalized.startsWith(`${p} `));
    if (foundPrefix) return { principal: foundPrefix, secundario: normalized.slice(foundPrefix.length).trim() };
    return { principal: normalized, secundario: "" };
  }

  async function selecionarImagem(target: "logo_path" | "diocese_logo_path") {
    const path = await open({ filters: [{ name: "Imagem", extensions: ["png", "jpg", "jpeg"] }] });
    if (path && typeof path === "string") {
      const bytes = await readFile(path);
      updateField(target, createDataUrl(path, new Uint8Array(bytes)));
    }
  }

  async function handleFazerBackup() {
    setFazendoBackup(true);
    try {
      const destino = await fazerBackup();
      setBackupInfo(getBackupInfo());
      setAlerta({ tipo: "sucesso", msg: `✅ Backup salvo com sucesso!\n\n📁 ${destino}` });
    } catch (e) {
      if ((e as Error)?.message !== "CANCELLED") {
        console.error(e);
        setAlerta({ tipo: "erro", msg: "Não foi possível realizar o backup. Verifique as permissões de pasta." });
      }
    } finally { setFazendoBackup(false); }
  }

  async function handleRestaurarBackup() {
    setRestaurando(true);
    try {
      await restaurarBackup();
      // Se chegou aqui sem recarregar, algo deu errado silenciosamente
    } catch (e) {
      if ((e as Error)?.message !== "CANCELLED") {
        console.error(e);
        setAlerta({ tipo: "erro", msg: "Não foi possível restaurar o backup. Verifique se o arquivo selecionado é válido." });
      }
    } finally { setRestaurando(false); }
  }

  async function salvar() {
    if (!form.nome.trim()) { setErro("Informe o nome da paróquia."); return; }
    if (!form.diocese.trim()) { setErro("Informe o nome da diocese."); return; }
    setSalvando(true); setErro(""); setMensagem("");
    try {
      await salvarConfiguracoesParoquia(form);
      onParoquiaUpdated(form);
      setMensagem("Configurações salvas com sucesso.");
    } catch { setErro("Não foi possível salvar as configurações agora."); }
    finally { setSalvando(false); }
  }

  async function gravarPartilha() {
    if (!partilhaValida) { setAlerta({ tipo: "erro", msg: "A soma dos percentuais deve ser exatamente 100%." }); return; }
    setSalvandoPartilha(true);
    try {
      await salvarPartilha(partilha);
      setAlerta({ tipo: "sucesso", msg: "Configuração da partilha salva com sucesso!" });
    } catch { setAlerta({ tipo: "erro", msg: "Erro ao salvar a partilha." }); }
    finally { setSalvandoPartilha(false); }
  }

  async function handleCriarUsuario(e: React.FormEvent) {
    e.preventDefault();
    if (!novoUsuario.nome || !novoUsuario.login || !novoUsuario.senha) {
      setAlerta({ tipo: "erro", msg: "Preencha todos os campos obrigatórios." }); return;
    }
    if (novoUsuario.papel === 'membro' && !novoUsuario.comunidade_id) {
      setAlerta({ tipo: "erro", msg: "Selecione a comunidade do membro." }); return;
    }
    setCriandoUsuario(true);
    try {
      await criarUsuario({
        nome: novoUsuario.nome.trim(),
        login: novoUsuario.login.trim(),
        senha: novoUsuario.senha,
        papel: novoUsuario.papel,
        comunidade_id: novoUsuario.comunidade_id ? Number(novoUsuario.comunidade_id) : null,
      });
      setNovoUsuario({ nome: "", login: "", senha: "", papel: "vigario", comunidade_id: "" });
      await carregarDados();
      setAlerta({ tipo: "sucesso", msg: "Usuário criado com sucesso!" });
    } catch {
      setAlerta({ tipo: "erro", msg: "Erro ao criar usuário. Login já pode estar em uso." });
    } finally { setCriandoUsuario(false); }
  }

  async function handleExcluirUsuario() {
    if (!idExcluirUsuario) return;
    if (idExcluirUsuario === usuario.id) {
      setAlerta({ tipo: "erro", msg: "Você não pode excluir sua própria conta." });
      setIdExcluirUsuario(null); return;
    }
    try {
      await excluirUsuario(idExcluirUsuario);
      await carregarDados();
      setAlerta({ tipo: "sucesso", msg: "Usuário removido." });
    } catch { setAlerta({ tipo: "erro", msg: "Erro ao remover usuário." }); }
    setIdExcluirUsuario(null);
  }

  const tituloParoquia = getTituloParoquia(form.nome);

  const abas = [
    { id: "identidade", label: "🏛️ Identidade" },
    { id: "aparencia",  label: "🎨 Aparência" },
    { id: "backup",     label: "💾 Backup" },
    { id: "sincronizacao", label: "🔄 Sincronização" },
    ...(isParoco ? [
      { id: "partilha",  label: "⚖️ Partilha" },
      { id: "usuarios",  label: "👥 Usuários" },
      { id: "auditoria", label: "🔍 Auditoria" },
    ] : []),
    { id: "sistema", label: "⚙️ Sistema" },
  ] as { id: typeof abaAtiva; label: string }[];

  return (
    <div style={{ display: "grid", gap: 24 }}>
      <ModalAlert aberto={!!alerta} tipo={alerta?.tipo ?? "info"} mensagem={alerta?.msg ?? ""} onFechar={() => setAlerta(null)} />
      <ModalConfirm
        aberto={idExcluirUsuario !== null}
        titulo="Remover Usuário"
        mensagem="Deseja remover este usuário do sistema? Esta ação não pode ser desfeita."
        textoBotaoOk="Remover"
        cor="danger"
        onConfirmar={handleExcluirUsuario}
        onCancelar={() => setIdExcluirUsuario(null)}
      />

      {/* ── Abas de navegação ── */}
      <div style={{ display: "flex", gap: 6, background: "white", padding: 6, borderRadius: 14, border: "1px solid #e4e7ec", flexWrap: "wrap" }}>
        {abas.map(aba => (
          <button
            key={aba.id}
            onClick={() => setAbaAtiva(aba.id)}
            style={{
              padding: "8px 16px", borderRadius: 10, border: "none", cursor: "pointer",
              fontWeight: 600, fontSize: 13,
              background: abaAtiva === aba.id ? "#1f3b73" : "transparent",
              color: abaAtiva === aba.id ? "white" : "#667085",
              transition: "all 0.15s",
            }}
          >
            {aba.label}
          </button>
        ))}
      </div>

      {/* ── Auditoria ── */}
      {abaAtiva === "auditoria" && isParoco && (
        <AuditoriaPage usuario={usuario} />
      )}

      {/* ── Backup ── */}
      {abaAtiva === "backup" && (
      <section style={{ background: "white", borderRadius: 18, border: "1px solid #e4e7ec", padding: 28 }}>
        <h2 style={{ margin: "0 0 8px", fontSize: 20, color: "#1a1d2e" }}>💾 Backup e Restauração</h2>
        <p style={{ margin: "0 0 24px", color: "#667085", fontSize: 14, lineHeight: 1.6 }}>
          Faça backup regularmente do banco de dados para evitar perda de informações.
          A restauração substituirá todos os dados atuais pelo backup selecionado.
        </p>

        {/* Info último backup */}
        <div style={{ background: "#f8fafc", borderRadius: 12, border: "1px solid #e4e7ec", padding: 16, marginBottom: 24 }}>
          <p style={{ margin: "0 0 4px", fontSize: 12, fontWeight: 700, color: "#667085", textTransform: "uppercase" }}>Último Backup</p>
          {backupInfo.lastBackupDate ? (
            <>
              <p style={{ margin: "0 0 2px", fontSize: 14, fontWeight: 600, color: "#027a48" }}>
                {new Date(backupInfo.lastBackupDate).toLocaleString("pt-BR")}
              </p>
              <p style={{ margin: 0, fontSize: 12, color: "#667085", wordBreak: "break-all" }}>
                {backupInfo.lastBackupPath}
              </p>
            </>
          ) : (
            <p style={{ margin: 0, fontSize: 14, color: "#b42318" }}>Nenhum backup realizado ainda.</p>
          )}
        </div>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <button
            onClick={handleFazerBackup}
            disabled={fazendoBackup}
            style={{ background: "#059669", color: "white", border: "none", borderRadius: 10, padding: "12px 24px", fontSize: 14, fontWeight: 700, cursor: "pointer", opacity: fazendoBackup ? 0.7 : 1 }}
          >
            {fazendoBackup ? "⏳ Fazendo backup..." : "📥 Fazer Backup Agora"}
          </button>

          <button
            onClick={handleRestaurarBackup}
            disabled={restaurando}
            style={{ background: "#dc2626", color: "white", border: "none", borderRadius: 10, padding: "12px 24px", fontSize: 14, fontWeight: 700, cursor: "pointer", opacity: restaurando ? 0.7 : 1 }}
          >
            {restaurando ? "⏳ Restaurando..." : "🔄 Restaurar Backup"}
          </button>
        </div>

        <p style={{ margin: "16px 0 0", fontSize: 12, color: "#b45309", background: "#fef3c7", padding: "10px 14px", borderRadius: 8, border: "1px solid #fde68a" }}>
          ⚠️ A restauração substitui imediatamente todos os dados atuais e reinicia o sistema. Esta operação não pode ser desfeita.
        </p>

        {/* ── Backup na Nuvem ── */}
        <div style={{ marginTop: 28, borderTop: "1px solid #e4e7ec", paddingTop: 24 }}>
          <h3 style={{ margin: "0 0 8px", fontSize: 16, color: "#1a1d2e" }}>☁️ Backup Automático na Nuvem</h3>
          <p style={{ margin: "0 0 16px", color: "#667085", fontSize: 13, lineHeight: 1.6 }}>
            Configure uma pasta sincronizada (Google Drive, OneDrive, Dropbox, iCloud) para backups automáticos a cada 24 horas.
            Os relatórios PDF também podem ser salvos nessa pasta para compartilhar com o pároco.
          </p>

          <div style={{ background: "#f0fdf4", borderRadius: 12, border: "1px solid #bbf7d0", padding: 16, marginBottom: 16 }}>
            <p style={{ margin: "0 0 4px", fontSize: 12, fontWeight: 700, color: "#15803d", textTransform: "uppercase" }}>Pasta Configurada</p>
            <p style={{ margin: 0, fontSize: 13, color: "#166534", wordBreak: "break-all" }}>
              {getBackupConfig().pastaCloud || "Nenhuma pasta configurada — backups automáticos desativados."}
            </p>
          </div>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <button
              onClick={async () => {
                try {
                  const pasta = await configurarPastaCloud(usuario.id);
                  if (pasta) {
                    setBackupInfo(getBackupInfo());
                    setAlerta({ tipo: "sucesso", msg: `☁️ Pasta de backup configurada!\n\n📁 ${pasta}\n\nBackups automáticos ativados (a cada 24h).` });
                  }
                } catch (e) {
                  if ((e as Error).message !== "CANCELLED") {
                    setAlerta({ tipo: "erro", msg: "Erro ao configurar pasta de backup." });
                  }
                }
              }}
              style={{ background: "#1d4ed8", color: "white", border: "none", borderRadius: 10, padding: "12px 24px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}
            >
              📂 {getBackupConfig().pastaCloud ? "Alterar Pasta" : "Configurar Pasta"}
            </button>

            {getBackupConfig().pastaCloud && (
              <button
                onClick={async () => {
                  try {
                    const pasta = getBackupConfig().pastaCloud!;
                    await fazerBackupNaPasta(pasta, usuario.id);
                    setBackupInfo(getBackupInfo());
                    setAlerta({ tipo: "sucesso", msg: "☁️ Backup enviado para a nuvem com sucesso!" });
                  } catch (e) {
                    setAlerta({ tipo: "erro", msg: "Erro ao fazer backup na nuvem." });
                  }
                }}
                style={{ background: "#059669", color: "white", border: "none", borderRadius: 10, padding: "12px 24px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}
              >
                ☁️ Enviar Backup Agora
              </button>
            )}
          </div>
        </div>
      </section>
      )}

      {/* ── Sincronização ── */}
      {abaAtiva === "sincronizacao" && (
        <section style={{ background: "white", borderRadius: 18, border: "1px solid #e4e7ec", padding: 28 }}>
          <h2 style={{ margin: "0 0 8px", fontSize: 20, color: "#1a1d2e" }}>🔄 Compartilhar Registros</h2>
          <p style={{ margin: "0 0 24px", color: "#667085", fontSize: 14, lineHeight: 1.6 }}>
            Exporte registros para compartilhar com outra instalação do sistema, ou importe registros recebidos.
            A importação <strong>não apaga</strong> dados existentes — apenas adiciona novos e atualiza os que foram modificados.
          </p>

          {/* ── Exportar ── */}
          <div style={{ background: "#f0fdf4", borderRadius: 14, border: "1px solid #bbf7d0", padding: 24, marginBottom: 24 }}>
            <h3 style={{ margin: "0 0 8px", fontSize: 16, color: "#166534" }}>📤 Exportar Registros</h3>
            <p style={{ margin: "0 0 16px", color: "#15803d", fontSize: 13, lineHeight: 1.6 }}>
              Gera um arquivo <strong>.json</strong> com os registros selecionados. Salve no Google Drive, OneDrive, Dropbox ou envie por e-mail.
            </p>

            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Filtrar por Comunidade (opcional)</label>
              <select
                style={{ ...inputStyle, maxWidth: 360 }}
                value={syncComunidadeId}
                onChange={e => setSyncComunidadeId(e.target.value)}
              >
                <option value="">Todas as comunidades</option>
                {comunidades.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Tabelas para exportar</label>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 8 }}>
                {tabelasSync.map(t => (
                  <label key={t.nome} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#344054", cursor: "pointer", padding: "6px 10px", borderRadius: 8, background: syncTabelas.includes(t.nome) ? "#dcfce7" : "#f8fafc", border: "1px solid #e4e7ec" }}>
                    <input
                      type="checkbox"
                      checked={syncTabelas.includes(t.nome)}
                      onChange={e => {
                        if (e.target.checked) setSyncTabelas(prev => [...prev, t.nome]);
                        else setSyncTabelas(prev => prev.filter(x => x !== t.nome));
                      }}
                    />
                    {t.label}
                  </label>
                ))}
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button onClick={() => setSyncTabelas(tabelasSync.map(t => t.nome))} style={{ background: "none", border: "1px solid #bbf7d0", borderRadius: 6, padding: "4px 10px", fontSize: 11, color: "#166534", cursor: "pointer", fontWeight: 600 }}>Selecionar Todas</button>
                <button onClick={() => setSyncTabelas([])} style={{ background: "none", border: "1px solid #e4e7ec", borderRadius: 6, padding: "4px 10px", fontSize: 11, color: "#667085", cursor: "pointer", fontWeight: 600 }}>Limpar Seleção</button>
              </div>
            </div>

            <button
              disabled={exportando || syncTabelas.length === 0}
              onClick={async () => {
                setExportando(true);
                try {
                  const destino = await exportarRegistros({
                    comunidadeId: syncComunidadeId ? Number(syncComunidadeId) : null,
                    tabelas: syncTabelas,
                    usuarioId: usuario.id,
                  });
                  setAlerta({ tipo: "sucesso", msg: `📤 Registros exportados com sucesso!\n\n📁 ${destino}\n\nEnvie este arquivo para a outra instalação do sistema.` });
                } catch (e) {
                  if ((e as Error)?.message !== "CANCELLED") {
                    setAlerta({ tipo: "erro", msg: (e as Error).message || "Erro ao exportar registros." });
                  }
                } finally { setExportando(false); }
              }}
              style={{ background: "#059669", color: "white", border: "none", borderRadius: 10, padding: "12px 24px", fontSize: 14, fontWeight: 700, cursor: syncTabelas.length === 0 ? "not-allowed" : "pointer", opacity: (exportando || syncTabelas.length === 0) ? 0.6 : 1 }}
            >
              {exportando ? "⏳ Exportando..." : "📤 Exportar Registros"}
            </button>
          </div>

          {/* ── Importar ── */}
          <div style={{ background: "#eff6ff", borderRadius: 14, border: "1px solid #bfdbfe", padding: 24 }}>
            <h3 style={{ margin: "0 0 8px", fontSize: 16, color: "#1e40af" }}>📥 Importar Registros</h3>
            <p style={{ margin: "0 0 16px", color: "#1d4ed8", fontSize: 13, lineHeight: 1.6 }}>
              Selecione um arquivo <strong>.json</strong> recebido de outra instalação. Registros novos serão adicionados e existentes serão atualizados (se mais recentes). <strong>Nenhum dado existente será apagado.</strong>
            </p>

            <button
              disabled={importando}
              onClick={async () => {
                setImportando(true);
                setImportResult(null);
                try {
                  const resultado = await importarRegistros(usuario.id);
                  setImportResult(resultado);
                  if (resultado.erros.length === 0) {
                    setAlerta({ tipo: "sucesso", msg: `📥 Importação concluída!\n\n✅ ${resultado.inseridos} registros novos adicionados\n🔄 ${resultado.atualizados} registros atualizados` });
                  } else {
                    setAlerta({ tipo: "info", msg: `📥 Importação concluída com avisos.\n\n✅ ${resultado.inseridos} novos | 🔄 ${resultado.atualizados} atualizados\n⚠️ ${resultado.erros.length} erro(s) — veja os detalhes abaixo.` });
                  }
                } catch (e) {
                  if ((e as Error)?.message !== "CANCELLED") {
                    setAlerta({ tipo: "erro", msg: (e as Error).message || "Erro ao importar registros." });
                  }
                } finally { setImportando(false); }
              }}
              style={{ background: "#1d4ed8", color: "white", border: "none", borderRadius: 10, padding: "12px 24px", fontSize: 14, fontWeight: 700, cursor: "pointer", opacity: importando ? 0.6 : 1 }}
            >
              {importando ? "⏳ Importando..." : "📥 Importar Registros"}
            </button>

            {importResult && (
              <div style={{ marginTop: 16, padding: 16, background: "#f8fafc", borderRadius: 10, border: "1px solid #e4e7ec" }}>
                <p style={{ margin: "0 0 8px", fontWeight: 700, fontSize: 14, color: "#1a1d2e" }}>Resultado da Importação</p>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, auto)", gap: "4px 20px", fontSize: 13, marginBottom: 12 }}>
                  <span style={{ color: "#059669", fontWeight: 700 }}>✅ Novos:</span><span>{importResult.inseridos}</span><span />
                  <span style={{ color: "#1d4ed8", fontWeight: 700 }}>🔄 Atualizados:</span><span>{importResult.atualizados}</span><span />
                  <span style={{ color: "#667085", fontWeight: 700 }}>⏭️ Ignorados:</span><span>{importResult.ignorados}</span><span />
                </div>
                {importResult.detalhes.length > 0 && (
                  <div style={{ fontSize: 12, color: "#344054" }}>
                    <p style={{ margin: "0 0 4px", fontWeight: 600 }}>Por tabela:</p>
                    {importResult.detalhes.map(d => (
                      <div key={d.tabela} style={{ padding: "2px 0" }}>
                        <strong>{d.tabela}</strong>: {d.inseridos} novos, {d.atualizados} atualizados
                      </div>
                    ))}
                  </div>
                )}
                {importResult.erros.length > 0 && (
                  <div style={{ marginTop: 8, padding: 10, background: "#fef2f2", borderRadius: 8, fontSize: 12, color: "#991b1b" }}>
                    <p style={{ margin: "0 0 4px", fontWeight: 700 }}>Erros:</p>
                    {importResult.erros.map((e, i) => <div key={i}>{e}</div>)}
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── Identidade institucional ── */}
      {abaAtiva === "identidade" && (<>
      <section style={{ background: "white", borderRadius: 18, border: "1px solid #e4e7ec", padding: 28, boxShadow: "0 18px 48px rgba(15,23,42,0.06)" }}>
        <h2 style={{ margin: "0 0 8px", color: "#1a1d2e", fontSize: 22 }}>Identidade institucional</h2>
        <p style={{ margin: "0 0 24px", color: "#667085", fontSize: 14, maxWidth: 760, lineHeight: 1.6 }}>
          Dados oficiais da diocese e paróquia — usados em documentos, memorandos e certidões.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 18 }}>
          {([
            ["Nome da Paróquia", "nome", "Ex: Área Missionária Nossa da Esperança"],
            ["Nome da Diocese", "diocese", "Ex: Arquidiocese de Manaus"],
            ["Endereço", "endereco", "Rua, número e bairro"],
            ["CEP", "cep", "69000-000"],
            ["Cidade", "cidade", "Manaus"],
            ["Estado", "estado", "AM"],
            ["E-mail", "email", "secretaria@paroquia.org.br"],
            ["Telefone", "telefone", "(92) 0000-0000"],
            ["CNPJ", "cnpj", "00.000.000/0000-00"],
            ["Horário de Confissões", "confissoes_horario", "Ex: Sábados, 16h às 17h30"],
            ["Horário de Atendimento", "atendimento_horario", "Ex: Segunda a sexta, 9h às 17h"],
          ] as [string, keyof Paroquia, string][]).map(([label, field, placeholder]) => (
            <div key={field}>
              <label style={labelStyle}>{label}</label>
              <input
                style={inputStyle}
                value={(form[field] as string) || ""}
                onChange={e => updateField(field, field === "estado" ? e.target.value.toUpperCase() : e.target.value)}
                placeholder={placeholder}
                maxLength={field === "estado" ? 2 : undefined}
              />
            </div>
          ))}
        </div>
      </section>

      {/* Logos */}
      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 24 }}>
        {([
          ["logo_path", "Logo da Paróquia", "Esta logo aparecerá no sistema e no cabeçalho dos documentos.", "P"],
          ["diocese_logo_path", "Logo da Diocese", "Esta logo ficará no lado direito dos documentos oficiais.", "D"],
        ] as [keyof Paroquia, string, string, string][]).map(([field, titulo, desc, fallback]) => (
          <div key={field} style={{ background: "white", borderRadius: 18, border: "1px solid #e4e7ec", padding: 24 }}>
            <h3 style={{ margin: "0 0 8px", fontSize: 18, color: "#1a1d2e" }}>{titulo}</h3>
            <p style={{ margin: "0 0 18px", color: "#667085", fontSize: 13, lineHeight: 1.6 }}>{desc}</p>
            <div onClick={() => selecionarImagem(field as "logo_path" | "diocese_logo_path")}
              style={{ border: "2px dashed #d6dbe7", borderRadius: 16, padding: 24, display: "flex", flexDirection: "column", alignItems: "center", gap: 12, cursor: "pointer", background: "#f8fafc" }}>
              <AppLogo logoPath={form[field] as string} alt={titulo} size={110} radius={18} fallbackText={fallback} background="white" padding={4} />
              <strong style={{ color: "#1d2939", fontSize: 14 }}>Selecionar imagem</strong>
              <span style={{ color: "#667085", fontSize: 12 }}>PNG ou JPG</span>
            </div>
          </div>
        ))}
      </section>

      {/* Prévia do cabeçalho */}
      <section style={{ background: "white", borderRadius: 18, border: "1px solid #e4e7ec", padding: 28 }}>
        <h3 style={{ margin: "0 0 14px", fontSize: 18, color: "#1a1d2e" }}>Prévia do cabeçalho documental</h3>
        <div style={{ border: "1px solid #d6dbe7", borderRadius: 14, padding: 20, background: "#fcfcfd" }}>
          <div style={{ display: "grid", gridTemplateColumns: "88px 1fr 88px", gap: 16, alignItems: "start" }}>
            <div style={{ display: "flex", justifyContent: "center" }}>
              <AppLogo logoPath={form.logo_path} alt="Logo" size={72} radius={14} fallbackText="P" background="white" padding={4} />
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontWeight: 400, color: "#344054", fontSize: 15 }}>{form.diocese || "Nome da Diocese"}</div>
              <div style={{ color: "#101828", fontSize: 19, fontWeight: 700, marginTop: 6 }}>{tituloParoquia.principal}</div>
              {tituloParoquia.secundario && <div style={{ color: "#101828", fontSize: 17, fontWeight: 700, marginTop: 2 }}>{tituloParoquia.secundario}</div>}
              <div style={{ color: "#667085", fontSize: 12, marginTop: 10, lineHeight: 1.6 }}>
                {[form.endereco, [form.cep, form.cidade, form.estado].filter(Boolean).join(" · "), form.email, form.telefone, form.cnpj ? `CNPJ: ${form.cnpj}` : ""].filter(Boolean).join(" | ")}
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "center" }}>
              <AppLogo logoPath={form.diocese_logo_path} alt="Diocese" size={72} radius={14} fallbackText="D" background="white" padding={4} />
            </div>
          </div>
        </div>
        {erro && <p style={{ color: "#b42318", margin: "16px 0 0", fontSize: 13 }}>{erro}</p>}
        {mensagem && <p style={{ color: "#027a48", margin: "16px 0 0", fontSize: 13 }}>{mensagem}</p>}
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20 }}>
          <button onClick={salvar} disabled={salvando} style={{ background: "#374151", color: "white", border: "none", borderRadius: 10, padding: "12px 18px", fontSize: 14, fontWeight: 700, cursor: "pointer", opacity: salvando ? 0.7 : 1 }}>
            {salvando ? "Salvando..." : "Salvar configurações"}
          </button>
        </div>
      </section>
      </>)}

      {/* ── Configuração da Partilha ── */}
      {abaAtiva === "partilha" && isParoco && (
        <section style={{ background: "white", borderRadius: 18, border: "1px solid #e4e7ec", padding: 28 }}>
          <h3 style={{ margin: "0 0 6px", fontSize: 18, color: "#1a1d2e" }}>⚖️ Distribuição da Partilha</h3>
          <p style={{ margin: "0 0 20px", color: "#667085", fontSize: 14, lineHeight: 1.6 }}>
            Define como o saldo final do caixa é distribuído entre os destinos. A soma deve ser exatamente <strong>100%</strong>.
            Esses percentuais refletem as normas da sua diocese — somente o Pároco pode alterá-los.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16, marginBottom: 20 }}>
            {([
              ["Comunidade (%)", "comunidade", "#059669"],
              ["Área Missionária (%)", "areaMissionaria", "#2563eb"],
              ["Arquidiocese (%)", "arquidiocese", "#7c3aed"],
              ["Fundo Missionário (%)", "fundoMissionario", "#b45309"],
            ] as [string, keyof ConfigPartilha, string][]).map(([label, field, cor]) => (
              <div key={field}>
                <label style={{ ...labelStyle, color: cor }}>{label}</label>
                <input
                  type="number"
                  min={0} max={100} step={0.1}
                  value={partilha[field]}
                  onChange={e => setPartilha(p => ({ ...p, [field]: parseFloat(e.target.value) || 0 }))}
                  style={{ ...numInput, borderColor: cor, color: cor }}
                />
              </div>
            ))}
          </div>
          <div style={{
            display: "flex", alignItems: "center", gap: 16, padding: "12px 16px",
            borderRadius: 10, background: partilhaValida ? "#f0fdf4" : "#fff7ed",
            border: `1px solid ${partilhaValida ? "#bbf7d0" : "#fed7aa"}`, marginBottom: 16,
          }}>
            <span style={{ fontWeight: 700, fontSize: 16, color: partilhaValida ? "#166534" : "#c2410c" }}>
              Total: {totalPartilha.toFixed(1)}%
            </span>
            <span style={{ fontSize: 13, color: partilhaValida ? "#166534" : "#c2410c" }}>
              {partilhaValida ? "✓ Soma válida" : "⚠ A soma deve ser 100%"}
            </span>
          </div>
          <button onClick={gravarPartilha} disabled={salvandoPartilha || !partilhaValida} style={{ background: "#7c3aed", color: "white", border: "none", borderRadius: 10, padding: "12px 24px", fontSize: 14, fontWeight: 700, cursor: partilhaValida ? "pointer" : "not-allowed", opacity: (salvandoPartilha || !partilhaValida) ? 0.6 : 1 }}>
            {salvandoPartilha ? "Salvando..." : "Salvar Distribuição"}
          </button>
        </section>
      )}

      {/* ── Gestão de Usuários ── */}
      {abaAtiva === "usuarios" && isParoco && (
        <section style={{ background: "white", borderRadius: 18, border: "1px solid #e4e7ec", padding: 28 }}>
          <h3 style={{ margin: "0 0 6px", fontSize: 18, color: "#1a1d2e" }}>👥 Gestão de Usuários</h3>
          <p style={{ margin: "0 0 20px", color: "#667085", fontSize: 14, lineHeight: 1.6 }}>
            Crie e gerencie os acessos de Vigários, Secretários e Membros de Comunidade. Somente o Pároco pode realizar esta gestão.
          </p>

          {/* Formulário de criação */}
          <form onSubmit={handleCriarUsuario} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14, marginBottom: 28, padding: 20, background: "#f8fafc", borderRadius: 12, border: "1px solid #e4e7ec" }}>
            <div>
              <label style={labelStyle}>Nome Completo *</label>
              <input style={inputStyle} value={novoUsuario.nome} onChange={e => setNovoUsuario(p => ({ ...p, nome: e.target.value }))} placeholder="Nome do usuário" />
            </div>
            <div>
              <label style={labelStyle}>Login *</label>
              <input style={inputStyle} value={novoUsuario.login} onChange={e => setNovoUsuario(p => ({ ...p, login: e.target.value }))} placeholder="nome.sobrenome" />
            </div>
            <div>
              <label style={labelStyle}>Senha *</label>
              <input type="password" style={inputStyle} value={novoUsuario.senha} onChange={e => setNovoUsuario(p => ({ ...p, senha: e.target.value }))} placeholder="Senha inicial" />
            </div>
            <div>
              <label style={labelStyle}>Papel *</label>
              <select style={inputStyle} value={novoUsuario.papel} onChange={e => setNovoUsuario(p => ({ ...p, papel: e.target.value as PapelUsuario, comunidade_id: "" }))}>
                <option value="admin">Administrador</option>
                <option value="paroquia">Pároco</option>
                <option value="vigario">Vigário</option>
                <option value="secretaria">Secretária(o)</option>
                <option value="membro">Membro de Comunidade</option>
              </select>
            </div>
            {novoUsuario.papel === 'membro' && (
              <div>
                <label style={labelStyle}>Comunidade *</label>
                <select style={inputStyle} value={novoUsuario.comunidade_id} onChange={e => setNovoUsuario(p => ({ ...p, comunidade_id: e.target.value }))}>
                  <option value="">Selecione...</option>
                  {comunidades.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </div>
            )}
            <div style={{ display: "flex", alignItems: "flex-end" }}>
              <button type="submit" disabled={criandoUsuario} style={{ background: "#1d4ed8", color: "white", border: "none", borderRadius: 10, padding: "12px 20px", fontSize: 14, fontWeight: 700, cursor: "pointer", width: "100%", opacity: criandoUsuario ? 0.7 : 1 }}>
                {criandoUsuario ? "Criando..." : "+ Criar Usuário"}
              </button>
            </div>
          </form>

          {/* Lista de usuários */}
          <div style={{ borderRadius: 12, border: "1px solid #e4e7ec", overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f8fafc" }}>
                  {["Nome", "Login", "Papel", "Comunidade", "Ação"].map(h => (
                    <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontSize: 12, color: "#667085", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {usuarios.map(u => (
                  <tr key={u.id} style={{ borderTop: "1px solid #f0f0f0" }}>
                    <td style={{ padding: "12px 16px", fontWeight: 600, fontSize: 14 }}>
                      {u.nome}
                      {u.id === usuario.id && <span style={{ marginLeft: 6, fontSize: 11, background: "#dbeafe", color: "#1d4ed8", padding: "1px 6px", borderRadius: 4, fontWeight: 700 }}>Você</span>}
                    </td>
                    <td style={{ padding: "12px 16px", fontSize: 13, color: "#667085" }}>{u.login}</td>
                    <td style={{ padding: "12px 16px" }}>
                      <span style={{
                        padding: "3px 8px", borderRadius: 6, fontSize: 12, fontWeight: 600,
                        background: u.papel === 'admin' ? "#fef3c7" : u.papel === 'paroquia' ? "#ede9fe" : u.papel === 'membro' ? "#d1fae5" : "#dbeafe",
                        color:      u.papel === 'admin' ? "#92400e" : u.papel === 'paroquia' ? "#5b21b6" : u.papel === 'membro' ? "#065f46" : "#1d4ed8",
                      }}>
                        {LABEL_PAPEL[u.papel as keyof typeof LABEL_PAPEL] ?? u.papel}
                      </span>
                    </td>
                    <td style={{ padding: "12px 16px", fontSize: 13, color: "#667085" }}>{u.comunidade_nome ?? "—"}</td>
                    <td style={{ padding: "12px 16px" }}>
                      {u.id !== usuario.id && (
                        <button onClick={() => setIdExcluirUsuario(u.id)} style={{ color: "#dc2626", background: "none", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
                          Remover
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ── Aparência ── */}
      {abaAtiva === "aparencia" && (
        <section style={{ background: "white", borderRadius: 18, border: "1px solid #e4e7ec", padding: 28 }}>
          <h2 style={{ margin: "0 0 8px", fontSize: 20, color: "#1a1d2e" }}>🎨 Paleta de Cores</h2>
          <p style={{ margin: "0 0 24px", color: "#667085", fontSize: 14, lineHeight: 1.6 }}>
            Escolha a paleta de cores do sistema. A mudança é aplicada imediatamente em toda a interface.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 14 }}>
            {PALETTES.map(p => {
              const selected = palette === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => setPalette(p.id as Palette)}
                  style={{
                    display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
                    padding: "20px 16px", borderRadius: 14, cursor: "pointer",
                    border: selected ? `2px solid ${p.color}` : "2px solid #e4e7ec",
                    background: selected ? `${p.color}0D` : "#fafafa",
                    transition: "all 0.2s ease",
                    boxShadow: selected ? `0 4px 16px ${p.color}25` : "none",
                  }}
                >
                  <div style={{
                    width: 48, height: 48, borderRadius: 14,
                    background: `linear-gradient(135deg, ${p.color}, ${p.color}BB)`,
                    boxShadow: `0 4px 12px ${p.color}40`,
                  }} />
                  <span style={{
                    fontSize: 13, fontWeight: selected ? 700 : 600,
                    color: selected ? p.color : "#475467",
                  }}>
                    {p.label}
                  </span>
                  {selected && (
                    <span style={{
                      fontSize: 11, fontWeight: 700, color: "white",
                      background: p.color, borderRadius: 6, padding: "2px 8px",
                    }}>
                      Ativo
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* ── ABA SISTEMA ── */}
      {abaAtiva === "sistema" && (
        <section style={{ background: "white", borderRadius: 18, border: "1px solid #e4e7ec", padding: "28px 32px" }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: "#1a1d2e", marginBottom: 6 }}>Informações do Sistema</h2>
          <p style={{ color: "#667085", fontSize: 13, marginBottom: 24 }}>Versão, manutenção e desinstalação do aplicativo.</p>

          {/* Versão */}
          <div style={{ padding: "16px 20px", background: "#f8fafc", borderRadius: 12, border: "1px solid #e4e7ec", marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#344054" }}>Financeiro Paroquial</div>
                <div style={{ fontSize: 12, color: "#98a2b3", marginTop: 2 }}>Versão {__APP_VERSION__}</div>
              </div>
              <div style={{ fontSize: 11, color: "#98a2b3" }}>
                {navigator.platform.includes("Mac") ? "macOS" : navigator.platform.includes("Win") ? "Windows" : "Linux"}
              </div>
            </div>
          </div>

          {/* Pergunta de Segurança */}
          <div style={{ padding: "20px", background: "#eff6ff", borderRadius: 12, border: "1px solid #bfdbfe", marginBottom: 20 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: "#1e40af", marginBottom: 6 }}>🔐 Pergunta de Segurança</h3>
            <p style={{ fontSize: 12, color: "#1d4ed8", lineHeight: 1.6, marginBottom: 16 }}>
              Configure uma pergunta de segurança para proteger a recuperação de senha da sua conta.
              Ao redefinir a senha, além do nome completo, será exigida a resposta correta.
            </p>
            <div style={{ display: "grid", gap: 12, maxWidth: 400 }}>
              <div>
                <label style={labelStyle}>Pergunta</label>
                <select
                  id="pergunta-seguranca"
                  style={inputStyle}
                  defaultValue=""
                  onChange={() => {}}
                >
                  <option value="">Selecione uma pergunta...</option>
                  <option value="Qual o nome da sua mãe?">Qual o nome da sua mãe?</option>
                  <option value="Em que cidade você nasceu?">Em que cidade você nasceu?</option>
                  <option value="Qual o nome do seu primeiro animal de estimação?">Qual o nome do seu primeiro animal de estimação?</option>
                  <option value="Qual o nome da sua escola primária?">Qual o nome da sua escola primária?</option>
                  <option value="Qual o seu santo de devoção?">Qual o seu santo de devoção?</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Resposta</label>
                <input id="resposta-seguranca" style={inputStyle} placeholder="Sua resposta (não diferencia maiúsculas)" />
              </div>
              <button
                onClick={async () => {
                  const perguntaEl = document.getElementById("pergunta-seguranca") as HTMLSelectElement;
                  const respostaEl = document.getElementById("resposta-seguranca") as HTMLInputElement;
                  const pergunta = perguntaEl?.value;
                  const resposta = respostaEl?.value;
                  if (!pergunta || !resposta?.trim()) {
                    setAlerta({ tipo: "erro", msg: "Selecione uma pergunta e digite uma resposta." });
                    return;
                  }
                  try {
                    await salvarPerguntaSeguranca(usuario.id, pergunta, resposta);
                    setAlerta({ tipo: "sucesso", msg: "🔐 Pergunta de segurança configurada com sucesso!" });
                  } catch {
                    setAlerta({ tipo: "erro", msg: "Erro ao salvar pergunta de segurança." });
                  }
                }}
                style={{ background: "#1d4ed8", color: "white", border: "none", borderRadius: 10, padding: "10px 20px", fontSize: 13, fontWeight: 700, cursor: "pointer", width: "fit-content" }}
              >
                Salvar Pergunta de Segurança
              </button>
            </div>
          </div>

          {/* Desinstalar */}
          <div style={{ padding: "20px", background: "#fef2f2", borderRadius: 12, border: "1px solid #fecaca" }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: "#991b1b", marginBottom: 6 }}>Desinstalar Sistema</h3>
            <p style={{ fontSize: 12, color: "#dc2626", lineHeight: 1.6, marginBottom: 16 }}>
              Esta ação remove completamente o aplicativo e todos os dados locais (banco de dados, configurações, cache).
              <strong> Faça um backup antes de prosseguir.</strong> Esta ação não pode ser desfeita.
            </p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button
                disabled={desinstalando}
                onClick={async () => {
                  const confirma1 = await ask(
                    "Tem certeza que deseja DESINSTALAR o Financeiro Paroquial?\n\nTodos os dados serão removidos permanentemente.",
                    { title: "Desinstalar Sistema", kind: "warning" }
                  );
                  if (!confirma1) return;
                  const confirma2 = await ask(
                    "ÚLTIMA CONFIRMAÇÃO:\n\nVocê fez backup dos seus dados?\nEsta ação é IRREVERSÍVEL.",
                    { title: "Confirmar Desinstalação", kind: "warning" }
                  );
                  if (!confirma2) return;
                  setDesinstalando(true);
                  try {
                    const { invoke } = await import("@tauri-apps/api/core");
                    await invoke("desinstalar_sistema");
                    await exit(0);
                  } catch (e) {
                    console.error("Erro ao desinstalar:", e);
                    setAlerta({ tipo: "erro", msg: "Erro ao desinstalar: " + String(e) });
                    setDesinstalando(false);
                  }
                }}
                style={{
                  padding: "10px 24px", borderRadius: 10, border: "none", cursor: desinstalando ? "wait" : "pointer",
                  background: "#dc2626", color: "white", fontWeight: 700, fontSize: 13,
                  opacity: desinstalando ? 0.6 : 1, fontFamily: "inherit", transition: "all .15s",
                }}
              >
                {desinstalando ? "Desinstalando..." : "Desinstalar Aplicativo"}
              </button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

declare const __APP_VERSION__: string;
