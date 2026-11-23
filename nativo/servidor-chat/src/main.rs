// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// alumia-chat: o servidor do chat separado da Alumia (onda R3, item 3.1; docs/rede/CHAT-SEPARADO.md). Caixas anônimas, cofre anônimo,
// prova de trabalho e a conferência da franquia, com banco Postgres PRÓPRIO (nativo/servidor-chat/banco/001-chat.sql) e segredos
// PRÓPRIOS. Não tem conta, sessão, diretório nem registro: não sabe de quem é caixa nenhuma. Não grava log de pedido, nem de corpo,
// nem de endereço de rede.
//
// Configuração (ambiente):
//   CHAT_BANCO_URL                 postgres://chat_servidor:…@banco:5432/chat   (o banco deste servidor; nada da rede social)
//   CHAT_FRANQUIA_SEGREDO          32 letras ou mais (a marca da franquia e a chave do desafio da prova de trabalho)
//   CHAT_FRANQUIA_SEGREDO_ANTERIOR opcional: o de antes da última troca (confere marcas antigas durante o prazo da denúncia)
//   CHAT_INTERFACE_TOKEN           32 letras ou mais [A-Za-z0-9_-] (a rede social pergunta pela franquia com ele; só essa rota)
//   CHAT_INTERFACE_TOKEN_ANTERIOR  opcional: o de antes da última troca (vale junto até a rede social passar a mandar o novo)
//   CHAT_PASSES_CHAVE_URL          https://<site>/api/alumia/passes/chave (a chave PÚBLICA dos passes da semana)
//   CHAT_ESCUTA                    endereço:porta onde escutar (padrão 0.0.0.0:8080)
//   CHAT_BITS_DE_FORA              bits da prova de trabalho de quem vem de outra instância (padrão 22; 22 a 24, os do aparelho)
//   CHAT_ORIGENS                   origens do navegador que podem chamar (CORS), separadas por vírgula (vazio = nenhuma)
//   CHAT_ESPERA_DO_LOTE_MS         padrão 2000 (os testes usam menos)

mod cripto;
mod franquia;
mod lote;
mod passes;
mod prova;
mod rotas;
#[cfg(test)]
mod vetor_de_teste;

use std::str::FromStr;
use std::sync::Arc;
use std::time::Duration;

use deadpool_postgres::{Manager, ManagerConfig, Pool, RecyclingMethod};

fn variavel(nome: &str) -> Option<String> {
    std::env::var(nome).ok().map(|v| v.trim().to_owned()).filter(|v| !v.is_empty())
}

fn parar(motivo: &str) -> ! {
    // nosemgrep: alumia-rust-sem-log-de-corpo (mensagem de partida, sem pedido)
    eprintln!("alumia-chat: {motivo}");
    std::process::exit(2)
}

fn segredo(nome: &str) -> String {
    match variavel(nome) {
        Some(s) if s.len() >= 32 => s,
        _ => parar(&format!("{nome} ausente ou curto (32 letras ou mais)")),
    }
}

#[tokio::main]
async fn main() {
    // O TLS de saída (a rota da chave pública dos passes) usa o ring, a mesma biblioteca do resto.
    let _ = rustls::crypto::ring::default_provider().install_default();

    let banco_url = variavel("CHAT_BANCO_URL").unwrap_or_else(|| parar("CHAT_BANCO_URL ausente"));
    let franquia = segredo("CHAT_FRANQUIA_SEGREDO");
    let franquia_anterior = variavel("CHAT_FRANQUIA_SEGREDO_ANTERIOR").filter(|s| s.len() >= 32);
    let token_valido = |t: &String| t.bytes().all(|c| c.is_ascii_alphanumeric() || c == b'-' || c == b'_');
    let token_interface = segredo("CHAT_INTERFACE_TOKEN");
    if !token_valido(&token_interface) {
        parar("CHAT_INTERFACE_TOKEN só com letras, números, - e _");
    }
    // Na troca do token (2.6), o de antes vale junto por um tempo; torto ou curto, é ignorado (nunca afrouxa a conferência).
    // nosemgrep: alumia-rust-comparacao-de-segredo (leitura da configuração na partida, não é caminho de pedido)
    let token_anterior = variavel("CHAT_INTERFACE_TOKEN_ANTERIOR").filter(|t| t.len() >= 32 && token_valido(t) && *t != token_interface);
    let chave_url = variavel("CHAT_PASSES_CHAVE_URL").unwrap_or_else(|| parar("CHAT_PASSES_CHAVE_URL ausente"));
    if !chave_url.starts_with("https://") && variavel("CHAT_TESTE_SEM_TLS").as_deref() != Some("1") {
        parar("CHAT_PASSES_CHAVE_URL tem de ser https");
    }
    let escuta = variavel("CHAT_ESCUTA").unwrap_or_else(|| "0.0.0.0:8080".into());
    let bits_de_fora = variavel("CHAT_BITS_DE_FORA").and_then(|b| b.parse::<u32>().ok()).unwrap_or(22);
    if !(22..=24).contains(&bits_de_fora) {
        parar("CHAT_BITS_DE_FORA entre 22 e 24 (os limites do aparelho, lib/rede/instancias/endereco.ts)");
    }
    let espera = variavel("CHAT_ESPERA_DO_LOTE_MS").and_then(|b| b.parse::<u64>().ok()).unwrap_or(2000).clamp(10, 10_000);
    let origens: Vec<String> = variavel("CHAT_ORIGENS")
        .map(|o| {
            o.split(',').map(|x| x.trim().to_owned()).filter(|x| x.starts_with("https://") || x.starts_with("http://localhost")).collect()
        })
        .unwrap_or_default();

    let config = tokio_postgres::Config::from_str(&banco_url).unwrap_or_else(|_| parar("CHAT_BANCO_URL inválido"));
    let gerente = Manager::from_config(config, tokio_postgres::NoTls, ManagerConfig { recycling_method: RecyclingMethod::Fast });
    let banco: Pool = Pool::builder(gerente).max_size(16).build().unwrap_or_else(|_| parar("banco"));

    let http = reqwest::Client::builder()
        .timeout(Duration::from_secs(6))
        .redirect(reqwest::redirect::Policy::none())
        .user_agent("alumia-chat/1")
        .build()
        .unwrap_or_else(|_| parar("cliente http"));

    let estado = Arc::new(rotas::Estado {
        juntador: lote::Juntador::novo(banco.clone(), Duration::from_millis(espera)),
        banco: banco.clone(),
        chaves: passes::Chaves::nova(passes::Fonte::Rota { url: chave_url, http }),
        provas: prova::Provas::nova(&franquia),
        franquia,
        franquia_anterior,
        token_interface,
        token_anterior,
        bits_de_fora,
        origens,
    });

    // A limpeza do banco (pacotes de 30 dias, caixas vencidas, passes gastos velhos): a cada 6 horas.
    tokio::spawn(async move {
        let mut relogio = tokio::time::interval(Duration::from_secs(6 * 3600));
        loop {
            relogio.tick().await;
            if let Ok(c) = banco.get().await {
                let _ = c.query_one("select chat.limpeza()", &[]).await;
            }
        }
    });

    let ouvinte = tokio::net::TcpListener::bind(&escuta).await.unwrap_or_else(|_| parar("não consegui escutar"));
    // nosemgrep: alumia-rust-sem-log-de-corpo (mensagem de partida, sem pedido)
    eprintln!("alumia-chat: no ar");
    if axum::serve(ouvinte, rotas::rotas(estado)).await.is_err() {
        parar("o servidor parou");
    }
}
