// Sentinela Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later.
//
// A casca nativa é mínima: abre a janela com o app web e liga só os quatro plugins que as telas usam
// (notificação, caixa de salvar, escrita do arquivo escolhido, abrir link no navegador). Nenhum segredo mora aqui.

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .run(tauri::generate_context!())
        .expect("erro ao abrir o Sentinela Lúcia");
}
