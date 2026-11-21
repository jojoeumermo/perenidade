// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A conferência de um binário no Rekor com bytes quaisquer no lugar do pacote Sigstore (e do arquivo): nunca cai, e NUNCA aceita
// (um pacote que não foi assinado pelo fluxo de lançamento não pode passar, nem por acaso do parser).
#![no_main]

use alumia_nucleo::{conferir_no_log, identidade::identidade_da_versao};
use libfuzzer_sys::fuzz_target;

fuzz_target!(|dados: &[u8]| {
    let Some((&corte, resto)) = dados.split_first() else { return };
    let (arquivo, pacote) = resto.split_at((corte as usize).min(resto.len()));
    let identidade = identidade_da_versao("1.0.0").expect("versão de teste válida");
    if let Ok(true) = conferir_no_log(arquivo, pacote, &identidade) {
        panic!("pacote qualquer aceito como registrado no Rekor");
    }
});
