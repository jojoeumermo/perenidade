// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O núcleo nativo do app da Alumia no computador (onda R3). Só o que só o nativo faz:
//   - `cofre`: embrulhar e desembrulhar segredos do chat com uma chave guardada no chaveiro do sistema;
//   - `transparencia`: conferir se um binário dos apps está no livro público do Sigstore (Rekor), assinado pelo fluxo de lançamento
//     deste repositório (é o que faz o app recusar atualização fora do livro);
//   - `identidade`: quem pode assinar (o mesmo de lib/rede/transparencia-apps/identidade.ts);
//   - `caminho`: o único formato de caminho que o app aceita para abrir a rede social no navegador do sistema.
// O protocolo do chat continua no TypeScript + WebAssembly da casca (o mesmo do site e do Android).
#![forbid(unsafe_code)]

pub mod caminho;
pub mod cofre;
pub mod identidade;
pub mod transparencia;

pub use cofre::{desembrulhar, embrulhar, Chaveiro, ChaveiroDoSistema, ChaveiroNaMemoria};
pub use identidade::Identidade;
pub use transparencia::{conferir_no_log, conferir_no_log_com_raiz, Motivo};

/// Os erros do núcleo. Nenhum carrega dado do chat nem caminho do computador.
#[derive(Debug, thiserror::Error)]
pub enum Erro {
    #[error("chaveiro do sistema indisponível")]
    Chaveiro,
    #[error("finalidade inválida")]
    Finalidade,
    #[error("dados grandes demais")]
    Tamanho,
    #[error("raiz de confiança inválida")]
    Raiz,
}
