// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A lista FECHADA de comandos do app: só estes oito existem para a página, e cada um só vale se a capability da janela
// (capabilities/principal.json) o permitir. Comando novo = entra aqui, em src/lib.rs e na capability, e o teste
// scripts/testar-r3-desktop.mjs falha até as três baterem.
fn main() {
    tauri_build::try_build(tauri_build::Attributes::new().app_manifest(tauri_build::AppManifest::new().commands(&[
        "cofre_embrulhar",
        "cofre_desembrulhar",
        "atualizacao_conferir",
        "atualizacao_instalar",
        "rede_abrir",
        "rede_pedir",
        "app_apagar_tudo",
        "notificar",
    ])))
    .expect("falha no build do Tauri");
}
