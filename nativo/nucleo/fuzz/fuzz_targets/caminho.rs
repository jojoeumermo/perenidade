// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O caminho que a casca pede para abrir a rede social: quando aceito, o endereço é sempre a origem fixa seguida do próprio caminho,
// sem "//" logo depois da origem, sem barra invertida, espaço ou caractere de controle (nunca vira outro domínio).
#![no_main]

use alumia_nucleo::caminho::{endereco_da_rede, ORIGEM_DA_REDE};
use libfuzzer_sys::fuzz_target;

fuzz_target!(|dados: &[u8]| {
    let Ok(caminho) = std::str::from_utf8(dados) else { return };
    if let Some(endereco) = endereco_da_rede(caminho) {
        let resto = endereco.strip_prefix(ORIGEM_DA_REDE).expect("o endereço começa pela origem fixa");
        assert_eq!(resto, caminho);
        assert!(resto.starts_with('/') && !resto.starts_with("//") && !resto.starts_with("/\\"), "caminho que vira outro endereço: {resto}");
        assert!(!resto.bytes().any(|b| b == b'\\' || b == b'@' || b.is_ascii_whitespace() || b.is_ascii_control()), "caractere proibido: {resto}");
    }
});
