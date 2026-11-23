// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O "fetch nativo" do app do computador (onda R3, itens 1.2 e 3.3): as chamadas do chat aos serviços anônimos do site (caixas,
// pedidos, diretório, passes, franquia) e à entrada saem daqui, e não da página: sem `Origin`, sem cookie, com os MESMOS
// cabeçalhos do Android (`User-Agent: alumia/1`). Só para o endereço do Instituto, só nos caminhos dos serviços do chat (a mesma
// lista de lib/rede/chat/origem.ts, SERVICOS_DO_CHAT), só GET e POST, corpo e resposta com teto. A página não escolhe servidor.
//
// É o oitavo comando: o desenho da R3 listava sete; sem ele, a casca no computador falaria com o site com o `Origin` da página
// (tauri://localhost), diferente do Android e recusado pelas rotas que conferem a origem.
use alumia_nucleo::caminho::ORIGEM_DA_REDE;

pub const SERVICOS_DO_CHAT: [&str; 8] = [
    "/api/alumia/porta",
    "/api/alumia/conta",
    "/api/alumia/impressao",
    "/api/alumia/caixa",
    "/api/alumia/pedido",
    "/api/alumia/diretorio",
    "/api/alumia/passes",
    "/api/alumia/franquia",
];
/// O mesmo teto de corpo das rotas anônimas (192 KB) e um teto de resposta.
pub const LIMITE_DO_CORPO: usize = 192 * 1024;
pub const LIMITE_DA_RESPOSTA: usize = 2 * 1024 * 1024;
const CABECALHOS_PERMITIDOS: [&str; 2] = ["content-type", "authorization"];

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Recusa {
    Metodo,
    Caminho,
    Corpo,
    Cabecalho,
}

/// O pedido conferido: o endereço completo e os cabeçalhos que podem ir.
#[derive(Debug, PartialEq, Eq)]
pub struct Pedido {
    pub metodo: &'static str,
    pub endereco: String,
    pub cabecalhos: Vec<(String, String)>,
}

/// Confere o que a página pediu. Nada fora disto sai do app.
pub fn conferir_pedido(metodo: &str, caminho: &str, cabecalhos: &[(String, String)], corpo: usize) -> Result<Pedido, Recusa> {
    let metodo = match metodo {
        "GET" => "GET",
        "POST" => "POST",
        _ => return Err(Recusa::Metodo),
    };
    let caminho_sem_busca = caminho.split(['?', '#']).next().unwrap_or("");
    let servico = SERVICOS_DO_CHAT.iter().any(|s| caminho_sem_busca == *s || caminho_sem_busca.starts_with(&format!("{s}/")));
    if !servico || caminho.contains("..") || caminho.contains('\\') || caminho.contains("//") || caminho.contains('#') {
        return Err(Recusa::Caminho);
    }
    let endereco = alumia_nucleo::caminho::endereco_da_rede(caminho).ok_or(Recusa::Caminho)?;
    if !endereco.starts_with(ORIGEM_DA_REDE) {
        return Err(Recusa::Caminho);
    }
    if corpo > LIMITE_DO_CORPO || (metodo == "GET" && corpo > 0) {
        return Err(Recusa::Corpo);
    }
    let mut saida = Vec::new();
    for (nome, valor) in cabecalhos {
        let nome = nome.to_ascii_lowercase();
        if !CABECALHOS_PERMITIDOS.contains(&nome.as_str()) || valor.len() > 4096 || valor.bytes().any(|b| b < 0x20 || b == 0x7f) {
            return Err(Recusa::Cabecalho);
        }
        saida.push((nome, valor.clone()));
    }
    Ok(Pedido { metodo, endereco, cabecalhos: saida })
}

#[cfg(test)]
mod testes {
    use super::*;
    use proptest::prelude::*;

    #[test]
    fn so_os_servicos_do_chat_no_endereco_do_instituto() {
        let p = conferir_pedido("POST", "/api/alumia/caixa/lote", &[("Content-Type".into(), "application/json".into())], 100).unwrap();
        assert_eq!(p.endereco, "https://institutolucia.org/api/alumia/caixa/lote");
        assert_eq!(p.cabecalhos, vec![("content-type".to_string(), "application/json".to_string())]);
        assert!(conferir_pedido("GET", "/api/alumia/passes/chave", &[], 0).is_ok());
        for ruim in [
            "/api/rede/painel",
            "/api/alumia/caixas",
            "/api/alumia/caixa/../../painel",
            "//mal.example/api/alumia/caixa",
            "https://mal.example/api/alumia/caixa",
            "/api/alumia/caixa\\..\\x",
            "/pt/alumia",
            "/api/alumia/caixa#x",
        ] {
            assert_eq!(conferir_pedido("POST", ruim, &[], 0), Err(Recusa::Caminho), "{ruim}");
        }
    }

    #[test]
    fn metodo_corpo_e_cabecalhos() {
        assert_eq!(conferir_pedido("DELETE", "/api/alumia/caixa", &[], 0), Err(Recusa::Metodo));
        assert_eq!(conferir_pedido("GET", "/api/alumia/caixa", &[], 1), Err(Recusa::Corpo));
        assert_eq!(conferir_pedido("POST", "/api/alumia/caixa", &[], LIMITE_DO_CORPO + 1), Err(Recusa::Corpo));
        for h in ["cookie", "origin", "host", "x-forwarded-for", "user-agent"] {
            assert_eq!(conferir_pedido("POST", "/api/alumia/caixa", &[(h.into(), "x".into())], 0), Err(Recusa::Cabecalho), "{h}");
        }
        assert_eq!(conferir_pedido("POST", "/api/alumia/caixa", &[("authorization".into(), "a\r\nb".into())], 0), Err(Recusa::Cabecalho));
    }

    proptest! {
        /// Qualquer caminho aceito começa no endereço do Instituto e num dos serviços do chat.
        #[test]
        fn aceito_e_sempre_do_instituto(c in "[ -~]{0,80}") {
            if let Ok(p) = conferir_pedido("POST", &c, &[], 0) {
                prop_assert!(p.endereco.starts_with("https://institutolucia.org/api/alumia/"));
                prop_assert!(!p.endereco[8..].contains("//"));
            }
        }
    }
}
