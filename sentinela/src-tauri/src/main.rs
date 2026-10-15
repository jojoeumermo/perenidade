// Sentinela Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later.
// Sem janela de console no Windows.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    sentinela_lucia_lib::run()
}
