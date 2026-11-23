// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O cofre com o chaveiro na memória: embrulhar e desembrulhar devolve o mesmo; um byte trocado no embrulho ou outra finalidade
// não abre; bytes quaisquer no lugar do embrulho nunca derrubam nem abrem.
#![no_main]

use alumia_nucleo::cofre::{desembrulhar_com, embrulhar_com};
use alumia_nucleo::ChaveiroNaMemoria;
use libfuzzer_sys::fuzz_target;

fuzz_target!(|dados: &[u8]| {
    let c = ChaveiroNaMemoria::default();
    let Some((&modo, resto)) = dados.split_first() else { return };
    let finalidade = "chat:teste";
    if modo % 2 == 0 {
        // Bytes quaisquer como embrulho, com e sem chave no chaveiro.
        let _ = desembrulhar_com(&c, finalidade, resto);
        let _ = embrulhar_com(&c, finalidade, b"cria a chave");
        if let Ok(Some(_)) = desembrulhar_com(&c, finalidade, resto) {
            panic!("bytes quaisquer abriram no cofre");
        }
    } else if let Ok(embrulhado) = embrulhar_com(&c, finalidade, resto) {
        assert_eq!(desembrulhar_com(&c, finalidade, &embrulhado).ok().flatten().as_deref(), Some(resto), "não voltou igual");
        assert!(!matches!(desembrulhar_com(&c, "chat:outra", &embrulhado), Ok(Some(_))), "abriu com outra finalidade");
        let mut mexido = embrulhado.clone();
        let i = (modo as usize / 2) % mexido.len();
        mexido[i] ^= 0x01;
        assert!(!matches!(desembrulhar_com(&c, finalidade, &mexido), Ok(Some(_))), "abriu mexido");
    }
});
