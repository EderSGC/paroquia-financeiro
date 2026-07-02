use tauri::menu::{Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::{Emitter, Manager};
use tauri_plugin_sql::{Migration, MigrationKind};
use font_kit::source::SystemSource;
use font_kit::family_name::FamilyName;
use font_kit::properties::{Properties, Weight};
use font_kit::handle::Handle;

#[tauri::command]
fn navegar(window: tauri::Window, modulo: String) {
    let _ = window.emit("navegar", modulo);
}

#[tauri::command]
fn buscar_fontes_sistema() -> Vec<String> {
    let source = SystemSource::new();
    if let Ok(fonts) = source.all_families() {
        let mut lista = fonts;
        lista.sort();
        lista
    } else {
        vec!["Arial".into(), "Times New Roman".into(), "Courier New".into()]
    }
}

#[tauri::command]
fn imprimir_pdf(pdf_bytes: Vec<u8>, nome_arquivo: String) -> Result<String, String> {
    let raw_nome = if nome_arquivo.is_empty() { "documento.pdf".to_string() } else { nome_arquivo };
    let nome = std::path::Path::new(&raw_nome).file_name().unwrap_or_default().to_string_lossy().to_string();
    let tmp = std::env::temp_dir().join(&nome);
    std::fs::write(&tmp, &pdf_bytes).map_err(|e| format!("Erro ao criar arquivo temporário: {}", e))?;
    let caminho_str = tmp.to_string_lossy().to_string();

    #[cfg(target_os = "macos")]
    {
        let caminho_clone = caminho_str.clone();
        std::thread::spawn(move || {
            let script = format!(
                r#"tell application "Preview"
    open POSIX file "{}"
    activate
end tell
delay 1.5
tell application "System Events"
    keystroke "p" using command down
end tell"#,
                caminho_clone
            );
            let _ = std::process::Command::new("osascript")
                .arg("-e")
                .arg(&script)
                .output();
        });
    }

    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&caminho_str)
            .spawn()
            .map_err(|e| format!("Erro ao abrir: {}", e))?;
    }

    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd")
            .args(["/C", "start", "", &caminho_str])
            .spawn()
            .map_err(|e| format!("Erro ao abrir: {}", e))?;
    }

    Ok("Documento aberto para impressão".into())
}

#[tauri::command]
fn buscar_arquivo_fonte(familia: String) -> (Option<String>, Option<String>) {
    let source = SystemSource::new();
    let names = &[FamilyName::Title(familia)];

    let normal = source
        .select_best_match(names, &Properties::new())
        .ok()
        .and_then(|h| if let Handle::Path { path, .. } = h { Some(path.to_string_lossy().into_owned()) } else { None });

    let mut bold_props = Properties::new();
    bold_props.weight = Weight::BOLD;
    let bold = source
        .select_best_match(names, &bold_props)
        .ok()
        .and_then(|h| if let Handle::Path { path, .. } = h { Some(path.to_string_lossy().into_owned()) } else { None });

    (normal, bold)
}

#[tauri::command]
fn desinstalar_sistema(app: tauri::AppHandle) -> Result<String, String> {
    let app_data = app.path().app_data_dir().map_err(|e| e.to_string())?;

    // Remove banco de dados e arquivos de configuração
    if app_data.exists() {
        std::fs::remove_dir_all(&app_data).map_err(|e| format!("Erro ao remover dados: {}", e))?;
    }

    // Remove cache
    if let Ok(cache) = app.path().app_cache_dir() {
        let _ = std::fs::remove_dir_all(&cache);
    }

    // Remove logs
    if let Ok(logs) = app.path().app_log_dir() {
        let _ = std::fs::remove_dir_all(&logs);
    }

    #[cfg(target_os = "windows")]
    {
        // No Windows, executa o desinstalador nativo se existir
        let exe_path = std::env::current_exe().map_err(|e| e.to_string())?;
        if let Some(install_dir) = exe_path.parent() {
            let uninstaller = install_dir.join("uninstall.exe");
            if uninstaller.exists() {
                let _ = std::process::Command::new(&uninstaller)
                    .arg("/S") // silent mode
                    .spawn();
                return Ok("desinstalador_windows".into());
            }
        }
    }

    #[cfg(target_os = "macos")]
    {
        // No macOS, move o .app para a Lixeira
        let exe_path = std::env::current_exe().map_err(|e| e.to_string())?;
        // exe está em App.app/Contents/MacOS/app-name
        if let Some(app_bundle) = exe_path.parent().and_then(|p| p.parent()).and_then(|p| p.parent()) {
            let app_path = app_bundle.to_string_lossy().to_string();
            let script = format!(
                r#"tell application "Finder" to delete POSIX file "{}""#,
                app_path
            );
            let _ = std::process::Command::new("osascript")
                .arg("-e")
                .arg(&script)
                .output();
        }
    }

    #[cfg(target_os = "linux")]
    {
        if let Ok(home) = std::env::var("HOME") {
            let desktop_file = std::path::PathBuf::from(&home)
                .join(".local/share/applications/financeiro-paroquial.desktop");
            let _ = std::fs::remove_file(&desktop_file);
        }
        let exe_path = std::env::current_exe().map_err(|e| e.to_string())?;
        let _ = std::fs::remove_file(&exe_path);
    }

    Ok("dados_removidos".into())
}

pub fn run() {
    let migrations = vec![
        Migration {
            version: 1,
            description: "criar tabelas iniciais",
            sql: "
                CREATE TABLE IF NOT EXISTS fieis (id INTEGER PRIMARY KEY AUTOINCREMENT, nome TEXT NOT NULL, telefone TEXT);
                CREATE TABLE IF NOT EXISTS dizimos (id INTEGER PRIMARY KEY AUTOINCREMENT, fiel_id INTEGER, valor REAL NOT NULL, data TEXT NOT NULL, metodo TEXT NOT NULL, FOREIGN KEY(fiel_id) REFERENCES fieis(id));
                CREATE TABLE IF NOT EXISTS movimentacoes (id INTEGER PRIMARY KEY AUTOINCREMENT, categoria TEXT NOT NULL, descricao TEXT, valor REAL NOT NULL, data TEXT NOT NULL, metodo TEXT NOT NULL, tipo TEXT NOT NULL);
            ",
            kind: MigrationKind::Up,
        }
    ];

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:pastoral.db", migrations)
                .build(),
        )
        .setup(|app| {
            let handle = app.handle();
            let menu = Menu::new(handle)?;

            // ── 1. PARÓQUIA (app menu — primeiro à esquerda no macOS) ──────
            let item_sobre    = MenuItem::with_id(handle, "sobre",  "Sobre o Financeiro Paroquial", true, None::<&str>)?;
            let item_config   = MenuItem::with_id(handle, "config", "Configurações...",          true, Some("CmdOrCtrl+,"))?;
            let item_sair     = MenuItem::with_id(handle, "sair",   "Sair",                      true, Some("CmdOrCtrl+q"))?;
            let sub_app = Submenu::with_id_and_items(
                handle, "app", "Paróquia", true,
                &[
                    &item_sobre,
                    &PredefinedMenuItem::separator(handle)?,
                    &item_config,
                    &PredefinedMenuItem::separator(handle)?,
                    &item_sair,
                ],
            )?;

            // ── 2. ARQUIVO ───────────────────────────────────────────────
            let item_backup     = MenuItem::with_id(handle, "menu_backup",       "Fazer Backup",     true, Some("CmdOrCtrl+shift+b"))?;
            let item_restaurar  = MenuItem::with_id(handle, "menu_restaurar",    "Restaurar Backup", true, None::<&str>)?;
            let item_fechar     = PredefinedMenuItem::close_window(handle, Some("Fechar Janela"))?;
            let sub_arquivo = Submenu::with_id_and_items(
                handle, "arquivo", "Arquivo", true,
                &[
                    &item_backup,
                    &item_restaurar,
                    &PredefinedMenuItem::separator(handle)?,
                    &item_fechar,
                ],
            )?;

            // ── 3. EDITAR (Cmd+C/V/Z etc.) ───────────────────────────────
            let sub_editar = Submenu::with_id_and_items(
                handle, "editar", "Editar", true,
                &[
                    &PredefinedMenuItem::undo(handle, None)?,
                    &PredefinedMenuItem::redo(handle, None)?,
                    &PredefinedMenuItem::separator(handle)?,
                    &PredefinedMenuItem::cut(handle, None)?,
                    &PredefinedMenuItem::copy(handle, None)?,
                    &PredefinedMenuItem::paste(handle, None)?,
                    &PredefinedMenuItem::separator(handle)?,
                    &PredefinedMenuItem::select_all(handle, None)?,
                ],
            )?;

            // ── 4. MÓDULOS ────────────────────────────────────────────────
            // Financeiro
            let item_fin_caixas   = MenuItem::with_id(handle, "financeiro:caixas",    "Caixas/Contas",  true, None::<&str>)?;
            let item_fin_dizimo   = MenuItem::with_id(handle, "financeiro:dizimo",    "Dízimo",         true, None::<&str>)?;
            let item_fin_relat    = MenuItem::with_id(handle, "financeiro:relatorios","Relatórios",     true, None::<&str>)?;
            let sub_financeiro = Submenu::with_id_and_items(handle, "sub_financeiro", "Financeiro", true, &[
                &item_fin_caixas, &item_fin_dizimo, &item_fin_relat,
            ])?;

            // Cadastros
            let item_cad_comunidades = MenuItem::with_id(handle, "comunidades", "Comunidades", true, None::<&str>)?;
            let item_cad_fieis       = MenuItem::with_id(handle, "fieis",       "Fiéis",       true, None::<&str>)?;
            let item_cad_dizimistas  = MenuItem::with_id(handle, "dizimistas",  "Dizimistas",  true, None::<&str>)?;
            let sub_cadastros = Submenu::with_id_and_items(handle, "sub_cadastros", "Cadastros", true, &[
                &item_cad_comunidades, &item_cad_fieis, &item_cad_dizimistas,
            ])?;

            let sub_modulos = Submenu::with_id_and_items(
                handle, "modulos", "Módulos", true,
                &[
                    &sub_financeiro,
                    &sub_cadastros,
                ],
            )?;

            // ── 5. AJUDA ─────────────────────────────────────────────────
            let item_ajuda_sobre = MenuItem::with_id(handle, "sobre", "Sobre o Financeiro Paroquial", true, None::<&str>)?;
            let sub_ajuda = Submenu::with_id_and_items(
                handle, "ajuda", "Ajuda", true,
                &[&item_ajuda_sobre],
            )?;

            // ── 6. JANELA ────────────────────────────────────────────────
            let sub_janela = Submenu::with_id_and_items(
                handle, "janela", "Janela", true,
                &[
                    &PredefinedMenuItem::minimize(handle, None)?,
                    &PredefinedMenuItem::maximize(handle, None)?,
                    &PredefinedMenuItem::separator(handle)?,
                    &PredefinedMenuItem::fullscreen(handle, None)?,
                ],
            )?;

            // ── Monta o menu na ordem correta ────────────────────────────
            menu.append_items(&[
                &sub_app,
                &sub_arquivo,
                &sub_editar,
                &sub_modulos,
                &sub_ajuda,
                &sub_janela,
            ])?;
            app.set_menu(menu)?;

            // ── Handler: trata cliques do menu ───────────────────────────
            app.on_menu_event(|app, event| {
                let id = event.id().as_ref();
                match id {
                    "sair"  => { app.exit(0); }
                    "sobre" => {
                        // Apenas abre uma janela de about simples
                        if let Some(win) = app.get_webview_window("main") {
                            let _ = win.emit("menu_sobre", ());
                        }
                    }
                    "menu_backup" => {
                        if let Some(win) = app.get_webview_window("main") {
                            let _ = win.emit("menu_backup", ());
                        }
                    }
                    "menu_restaurar" => {
                        if let Some(win) = app.get_webview_window("main") {
                            let _ = win.emit("menu_restaurar", ());
                        }
                    }
                    // Qualquer outro ID (módulos simples ou compostos "modulo:aba") navega no frontend
                    id => {
                        if let Some(win) = app.get_webview_window("main") {
                            let _ = win.emit("navegar", id.to_string());
                        }
                    }
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![navegar, buscar_fontes_sistema, buscar_arquivo_fonte, imprimir_pdf, desinstalar_sistema])
        .run(tauri::generate_context!())
        .unwrap_or_else(|e| {
            eprintln!("Erro ao iniciar o sistema: {}", e);
            std::process::exit(1);
        });
}
