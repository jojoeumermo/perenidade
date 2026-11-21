// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Quem pode assinar um binário dos apps: SÓ o fluxo de lançamento dos apps deste repositório público, numa tag de versão, com a
// identidade OIDC do GitHub Actions. Os mesmos valores de lib/rede/transparencia-apps/identidade.ts (o teste da junção compara).

pub const REPOSITORIO: &str = "jojoeumermo/perenidade";
pub const FLUXO_DE_LANCAMENTO: &str = ".github/workflows/apps-lancamento.yml";
pub const EMISSOR_DO_GITHUB: &str = "https://token.actions.githubusercontent.com";

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Identidade {
    /// O "subject alternative name" do certificado (o endereço do fluxo com a tag), comparado como texto exato.
    pub uri: String,
    /// O emissor do token OIDC.
    pub emissor: String,
}

/// Versão no formato das tags (1.2.3, sem sufixo).
pub fn versao_valida(versao: &str) -> bool {
    let partes: Vec<&str> = versao.split('.').collect();
    let limites = [4usize, 4, 6];
    partes.len() == 3 && partes.iter().zip(limites).all(|(p, max)| !p.is_empty() && p.len() <= max && p.bytes().all(|b| b.is_ascii_digit()))
}

/// A identidade que assina a versão `versao` dos apps; `None` se a versão não tem o formato das tags.
pub fn identidade_da_versao(versao: &str) -> Option<Identidade> {
    if !versao_valida(versao) {
        return None;
    }
    Some(Identidade {
        uri: format!("https://github.com/{REPOSITORIO}/{FLUXO_DE_LANCAMENTO}@refs/tags/v{versao}"),
        emissor: EMISSOR_DO_GITHUB.to_string(),
    })
}

#[cfg(test)]
mod testes {
    use super::*;

    #[test]
    fn identidade_exata() {
        let i = identidade_da_versao("1.2.3").unwrap();
        assert_eq!(i.uri, "https://github.com/jojoeumermo/perenidade/.github/workflows/apps-lancamento.yml@refs/tags/v1.2.3");
        assert_eq!(i.emissor, "https://token.actions.githubusercontent.com");
        for v in ["1.2", "1.2.3-beta", "v1.2.3", "1.2.3/../x", "", " 1.2.3", "1..3", "12345.1.1"] {
            assert!(identidade_da_versao(v).is_none(), "{v}");
        }
    }
}
