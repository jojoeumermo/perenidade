// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A rede social abre FORA do app, no navegador do sistema, e só no endereço do Instituto. A casca do chat pede um caminho
// ("/pt/alumia"); o nativo monta o endereço com a origem fixa e recusa qualquer coisa que pudesse virar outro lugar (outro
// domínio, "//", barra invertida, esquema, espaço, caractere de controle). Mesma regra de lib/rede/casca/plataforma.ts.

pub const ORIGEM_DA_REDE: &str = "https://institutolucia.org";

/// O endereço completo da rede social para `caminho`, ou `None` se o caminho não é um caminho deste site.
pub fn endereco_da_rede(caminho: &str) -> Option<String> {
    if caminho.is_empty() || caminho.len() > 512 {
        return None;
    }
    let b = caminho.as_bytes();
    if b[0] != b'/' || b.get(1).is_some_and(|c| *c == b'/' || *c == b'\\') {
        return None;
    }
    let permitido = |c: u8| c.is_ascii_alphanumeric() || b"-._~%/?=&#".contains(&c);
    if !b.iter().all(|c| permitido(*c)) {
        return None;
    }
    Some(format!("{ORIGEM_DA_REDE}{caminho}"))
}

#[cfg(test)]
mod testes {
    use super::*;

    #[test]
    fn so_caminho_do_site() {
        assert_eq!(endereco_da_rede("/pt/alumia").as_deref(), Some("https://institutolucia.org/pt/alumia"));
        assert_eq!(endereco_da_rede("/pt/alumia/c/x?aba=1#topo").as_deref(), Some("https://institutolucia.org/pt/alumia/c/x?aba=1#topo"));
        for ruim in [
            "",
            "pt/alumia",
            "//mal.example",
            "/\\mal.example",
            "https://mal.example",
            "/pt/alumia@mal.example",
            "/a b",
            "/a\nb",
            "/a\u{0}b",
            "javascript:alert(1)",
            "/pt/\u{202e}x",
        ] {
            assert!(endereco_da_rede(ruim).is_none(), "{ruim:?}");
        }
        assert!(endereco_da_rede(&format!("/{}", "a".repeat(600))).is_none());
    }
}
