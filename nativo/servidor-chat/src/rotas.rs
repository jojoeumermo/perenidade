// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// As rotas do servidor do chat (docs/rede/CHAT-SEPARADO.md). As das caixas têm o MESMO JSON das rotas da R2 (app/api/alumia/caixa/*),
// sem o "/api/alumia" do começo:
//   POST /caixa/lote       {itens:[{acao:'criar'|'depositar'|'pedido', …}]}   (o passe, quando há, no Authorization: PrivateToken)
//   POST /caixa/buscar     {id, pl, cursor}
//   POST /caixa/confirmar  {id, pl, ate}
//   POST /caixa/trocar     {id, pl, pd_h?, pl_h?, bloqueio}
//   POST /caixa/apagar     {id, pl}
//   POST /cofre/ler        {id, pl}                    → {cofre: {versao, blob, dia} | null}
//   POST /cofre/gravar     {id, pd, pd_h?, pl_h?, versao, blob, desafio?, nonce?}
//   POST /cofre/apagar     {id, pl}
//   GET  /desafio          → {desafio, bits, bits_com_passe}   (a prova de trabalho; quem vem de outra instância paga `bits`)
//   GET  /saude            → {ok}
//   POST /interno/franquia/conferir  {marcas:[{c, id_h, pd_h, dia, marca}]} → {confere:[bool]}  (só com o token da interface)
// Regras de todas: pedido com cookie de sessão ("sb-…") ou com Authorization que não seja um passe é recusado ("sem_sessao_aqui"):
// o JWT de serviço da rede social não abre nada aqui. Sem cache, sem log do corpo nem do endereço de rede, corpo com teto.

use std::sync::Arc;

use axum::Router;
use axum::body::Bytes;
use axum::extract::{DefaultBodyLimit, Request, State};
use axum::http::{HeaderMap, HeaderValue, Method, StatusCode, header};
use axum::middleware::{self, Next};
use axum::response::{IntoResponse, Response};
use axum::routing::{get, post};
use deadpool_postgres::Pool;
use serde_json::{Map, Value, json};

use crate::cripto::{agora_s, de_b64, dia_utc, iguais, para_b64, para_b64u, resumo, sha256};
use crate::franquia;
use crate::lote::Juntador;
use crate::passes::{Chaves, Recusa};
use crate::prova::{BITS_COM_PASSE, Provas, TAMANHO_DO_DESAFIO, TAMANHO_DO_NONCE};

pub const CORPO_DO_LOTE: usize = 192 * 1024;
pub const CORPO_DO_COFRE: usize = 6 * 1024 * 1024;
pub const CORPO: usize = 16 * 1024;
/// Os tamanhos aceitos do envelope (os mesmos de chat.tamanho_ok e de lib/rede/caixas/tamanhos.ts).
const TAMANHOS: [usize; 11] = [3184, 5232, 9328, 17520, 25712, 33904, 2098, 8242, 32818, 131122, 66672];
const TAMANHO_PEDIDO: usize = 5232;

pub struct Estado {
    pub banco: Pool,
    pub juntador: Juntador,
    pub chaves: Chaves,
    pub provas: Provas,
    pub franquia: String,
    pub franquia_anterior: Option<String>,
    pub token_interface: String,
    /// O token de antes da última troca (2.6), aceito junto durante a troca.
    pub token_anterior: Option<String>,
    pub bits_de_fora: u32,
    pub origens: Vec<String>,
}

type E = State<Arc<Estado>>;

pub fn rotas(estado: Arc<Estado>) -> Router {
    Router::new()
        .route("/caixa/lote", post(lote).layer(DefaultBodyLimit::max(CORPO_DO_LOTE)))
        .route("/caixa/buscar", post(buscar).layer(DefaultBodyLimit::max(CORPO)))
        .route("/caixa/confirmar", post(confirmar).layer(DefaultBodyLimit::max(CORPO)))
        .route("/caixa/trocar", post(trocar).layer(DefaultBodyLimit::max(CORPO)))
        .route("/caixa/apagar", post(apagar).layer(DefaultBodyLimit::max(CORPO)))
        .route("/cofre/ler", post(cofre_ler).layer(DefaultBodyLimit::max(CORPO)))
        .route("/cofre/gravar", post(cofre_gravar).layer(DefaultBodyLimit::max(CORPO_DO_COFRE)))
        .route("/cofre/apagar", post(cofre_apagar).layer(DefaultBodyLimit::max(CORPO)))
        .route("/desafio", get(desafio))
        .route("/saude", get(saude))
        .route("/interno/franquia/conferir", post(franquia_conferir).layer(DefaultBodyLimit::max(CORPO)))
        .fallback(|| async { responder(StatusCode::NOT_FOUND, json!({ "ok": false, "erro": "nao_encontrado" })) })
        .layer(middleware::from_fn_with_state(estado.clone(), cabecalhos_comuns))
        .with_state(estado)
}

// ── O que todas as respostas levam ───────────────────────────────────────────────────────────────────────────────────────

pub fn responder(status: StatusCode, corpo: Value) -> Response {
    let mut r = (status, serde_json::to_vec(&corpo).unwrap_or_default()).into_response();
    let h = r.headers_mut();
    h.insert(header::CONTENT_TYPE, HeaderValue::from_static("application/json"));
    h.insert(header::CACHE_CONTROL, HeaderValue::from_static("no-store"));
    h.insert("x-robots-tag", HeaderValue::from_static("noindex"));
    h.insert(header::REFERRER_POLICY, HeaderValue::from_static("no-referrer"));
    h.insert("x-content-type-options", HeaderValue::from_static("nosniff"));
    r
}

/// CORS só para as origens configuradas (o site, quando o chat web falar com este servidor); OPTIONS responde sem tocar em nada.
async fn cabecalhos_comuns(State(e): E, pedido: Request, proximo: Next) -> Response {
    let origem = pedido.headers().get(header::ORIGIN).and_then(|o| o.to_str().ok()).map(str::to_owned);
    let permitida = origem.filter(|o| e.origens.iter().any(|x| x == o));
    let mut r = if pedido.method() == Method::OPTIONS { responder(StatusCode::NO_CONTENT, Value::Null) } else { proximo.run(pedido).await };
    if let Some(o) = permitida.and_then(|o| HeaderValue::from_str(&o).ok()) {
        let h = r.headers_mut();
        h.insert(header::ACCESS_CONTROL_ALLOW_ORIGIN, o);
        h.insert(header::ACCESS_CONTROL_ALLOW_METHODS, HeaderValue::from_static("GET, POST"));
        h.insert(header::ACCESS_CONTROL_ALLOW_HEADERS, HeaderValue::from_static("content-type, authorization"));
        h.insert(header::VARY, HeaderValue::from_static("origin"));
    }
    r
}

/// O pedido traz algo de conta? Cookie de sessão do Supabase ("sb-…") ou Authorization que não é um passe.
pub fn traz_sessao(h: &HeaderMap) -> bool {
    let cookie = h.get_all(header::COOKIE).iter().filter_map(|v| v.to_str().ok()).collect::<Vec<_>>().join(";");
    if cookie.split(';').any(|p| p.trim_start().starts_with("sb-")) {
        return true;
    }
    match h.get(header::AUTHORIZATION) {
        None => false,
        Some(v) => v.to_str().map(|a| !a.trim().is_empty() && !a.trim_start().starts_with("PrivateToken ")).unwrap_or(true),
    }
}

fn recusa_de_sessao() -> Response {
    responder(StatusCode::BAD_REQUEST, json!({ "ok": false, "erro": "sem_sessao_aqui" }))
}
fn invalido() -> Response {
    responder(StatusCode::BAD_REQUEST, json!({ "ok": false, "erro": "invalido" }))
}
fn rede() -> Response {
    responder(StatusCode::BAD_GATEWAY, json!({ "ok": false, "erro": "rede" }))
}
fn recusa_do_passe(r: Recusa) -> Response {
    match r {
        Recusa::SemServico => responder(StatusCode::SERVICE_UNAVAILABLE, json!({ "ok": false, "erro": "sem_servico" })),
        _ => responder(StatusCode::UNAUTHORIZED, json!({ "ok": false, "erro": "passe" })),
    }
}

fn objeto(corpo: &Bytes) -> Option<Map<String, Value>> {
    match serde_json::from_slice::<Value>(corpo).ok()? {
        Value::Object(m) => Some(m),
        _ => None,
    }
}
fn bytes_de(m: &Map<String, Value>, campo: &str, tamanho: Option<usize>) -> Option<Vec<u8>> {
    de_b64(m.get(campo)?.as_str()?, tamanho)
}
/// Um campo opcional: ausente ou nulo = Ok(None); presente e torto = Err.
fn opcional(m: &Map<String, Value>, campo: &str, tamanho: usize) -> Result<Option<Vec<u8>>, ()> {
    match m.get(campo) {
        None | Some(Value::Null) => Ok(None),
        Some(Value::String(s)) => de_b64(s, Some(tamanho)).map(Some).ok_or(()),
        _ => Err(()),
    }
}

async fn chamar(banco: &Pool, sql: &str, params: &[&(dyn tokio_postgres::types::ToSql + Sync)]) -> Option<Value> {
    let c = banco.get().await.ok()?;
    let linha = c.query_one(sql, params).await.ok()?;
    linha.try_get::<_, Option<Value>>(0).ok().map(|v| v.unwrap_or(Value::Null))
}

fn id_da_caixa(id: &[u8]) -> Vec<u8> {
    resumo("alumia/r2/caixa", id).to_vec()
}

// ── O que paga a criação e o pedido: passe (o cabeçalho) ou prova de trabalho ───────────────────────────────────────────────

/// Desafio e nonce da prova de trabalho.
type ProvaDoItem = (Vec<u8>, Vec<u8>);

/// A prova de trabalho do item (desafio e nonce), se veio; Err se veio torta.
fn prova_do_item(m: &Map<String, Value>) -> Result<Option<ProvaDoItem>, ()> {
    match (opcional(m, "desafio", TAMANHO_DO_DESAFIO)?, opcional(m, "nonce", TAMANHO_DO_NONCE)?) {
        (Some(d), Some(n)) => Ok(Some((d, n))),
        (None, None) => Ok(None),
        _ => Err(()),
    }
}

// ── As rotas ─────────────────────────────────────────────────────────────────────────────────────────────────────────────

async fn lote(State(e): E, h: HeaderMap, corpo: Bytes) -> Response {
    if traz_sessao(&h) {
        return recusa_de_sessao();
    }
    let Some(c) = objeto(&corpo) else { return invalido() };
    let Some(itens) = c.get("itens").and_then(|i| i.as_array()) else { return invalido() };
    if itens.is_empty() || itens.len() > 4 {
        return invalido();
    }
    let agora = agora_s();
    let dia = dia_utc(agora);
    let cabecalho_do_passe = h.get(header::AUTHORIZATION).and_then(|v| v.to_str().ok());
    let mut passe_usado = false;
    // (item para o banco, marca a devolver)
    let mut montados: Vec<(Value, Option<[u8; 32]>)> = Vec::new();

    for bruto in itens {
        let Some(x) = bruto.as_object() else { return invalido() };
        match x.get("acao").and_then(|a| a.as_str()) {
            Some("criar") => {
                let (Some(id), Some(pd_h), Some(pl_h)) =
                    (bytes_de(x, "id", Some(32)), bytes_de(x, "pd_h", Some(32)), bytes_de(x, "pl_h", Some(32)))
                else {
                    return invalido();
                };
                let Some(multi) = x.get("multi").and_then(|v| v.as_bool()) else { return invalido() };
                let pedidos = match x.get("pedidos") {
                    None | Some(Value::Null) => false,
                    Some(Value::Bool(b)) => *b,
                    _ => return invalido(),
                };
                // Criar paga: a prova de trabalho de quem vem de fora (bits maiores) OU um passe (o cabeçalho, um por pedido).
                let gasto = match prova_do_item(x) {
                    Err(()) => return invalido(),
                    Ok(Some((d, n))) => match e.provas.conferir(&d, &n, e.bits_de_fora, agora) {
                        Some(g) => g,
                        None => return responder(StatusCode::BAD_REQUEST, json!({ "ok": false, "erro": "prova" })),
                    },
                    Ok(None) => {
                        if passe_usado {
                            return invalido();
                        }
                        passe_usado = true;
                        match e.chaves.conferir(cabecalho_do_passe, agora).await {
                            Ok(g) => g,
                            Err(r) => return recusa_do_passe(r),
                        }
                    }
                };
                montados.push((
                    json!({ "acao": "criar", "id_h": para_b64(&id_da_caixa(&id)), "pd_h": para_b64(&pd_h), "pl_h": para_b64(&pl_h),
                    "multi": multi, "pedidos": pedidos, "gastos": [para_b64(&gasto)] }),
                    None,
                ));
            }
            Some(acao @ ("depositar" | "pedido")) => {
                let (Some(id), Some(pd), Some(env)) =
                    (bytes_de(x, "id", Some(32)), bytes_de(x, "pd", Some(32)), bytes_de(x, "envelope", None))
                else {
                    return invalido();
                };
                let Ok(franquia_c) = opcional(x, "franquia", 32) else { return invalido() };
                let unico = match x.get("unico") {
                    None | Some(Value::Null) => false,
                    Some(Value::Bool(b)) => *b,
                    _ => return invalido(),
                };
                if !TAMANHOS.contains(&env.len()) || (acao == "pedido" && env.len() != TAMANHO_PEDIDO) {
                    return responder(StatusCode::BAD_REQUEST, json!({ "ok": false, "erro": "tamanho" }));
                }
                let id_h = id_da_caixa(&id);
                let pd_h = resumo("alumia/r2/passe-deposito", &pd);
                let marca = franquia_c.as_ref().map(|fc| franquia::marca(&e.franquia, fc, &id_h, &pd_h, &dia));
                let mut item = json!({ "acao": acao, "id_h": para_b64(&id_h), "pd": para_b64(&pd), "envelope": para_b64(&env),
                    "franquia": franquia_c.as_ref().map(|v| para_b64(v)), "marca": marca.as_ref().map(|v| para_b64(v)), "unico": unico });
                if acao == "pedido" {
                    // O pedido de conversa: passe + prova de 20 bits (como na R2) ou, sem passe (outra instância), prova de `bits_de_fora`.
                    let Ok(prova) = prova_do_item(x) else { return invalido() };
                    let Some((d, n)) = prova else { return responder(StatusCode::BAD_REQUEST, json!({ "ok": false, "erro": "prova" })) };
                    let com_passe = cabecalho_do_passe.is_some() && !passe_usado;
                    let bits = if com_passe { BITS_COM_PASSE } else { e.bits_de_fora };
                    let Some(gasto_da_prova) = e.provas.conferir(&d, &n, bits, agora) else {
                        return responder(StatusCode::BAD_REQUEST, json!({ "ok": false, "erro": "prova" }));
                    };
                    let mut gastos = vec![Value::String(para_b64(&gasto_da_prova))];
                    if com_passe {
                        passe_usado = true;
                        match e.chaves.conferir(cabecalho_do_passe, agora).await {
                            Ok(g) => gastos.push(Value::String(para_b64(&g))),
                            Err(r) => return recusa_do_passe(r),
                        }
                    }
                    item["gastos"] = Value::Array(gastos);
                }
                montados.push((item, marca));
            }
            _ => return invalido(),
        }
    }

    let mut resultados = Vec::with_capacity(montados.len());
    let esperas: Vec<_> = montados
        .into_iter()
        .map(|(item, marca)| {
            let j = e.juntador.clone();
            let d = dia.clone();
            async move { (j.juntar(item, d).await, marca) }
        })
        .collect();
    for (r, marca) in futures_juntos(esperas).await {
        if r.get("ok") == Some(&Value::Bool(true)) {
            match marca {
                Some(m) => resultados.push(json!({ "ok": true, "marca": para_b64u(&m), "dia": dia })),
                None => resultados.push(json!({ "ok": true })),
            }
        } else {
            resultados.push(r);
        }
    }
    responder(StatusCode::OK, json!({ "resultados": resultados }))
}

/// Espera várias tarefas ao mesmo tempo (todas entram no mesmo lote), na ordem em que foram dadas.
async fn futures_juntos<F, T>(tarefas: Vec<F>) -> Vec<T>
where
    F: std::future::Future<Output = T> + Send + 'static,
    T: Send + 'static,
{
    let alcas: Vec<_> = tarefas.into_iter().map(tokio::spawn).collect();
    let mut saida = Vec::with_capacity(alcas.len());
    for a in alcas {
        match a.await {
            Ok(v) => saida.push(v),
            Err(_) => std::process::abort(),
        }
    }
    saida
}

async fn buscar(State(e): E, h: HeaderMap, corpo: Bytes) -> Response {
    if traz_sessao(&h) {
        return recusa_de_sessao();
    }
    let Some(c) = objeto(&corpo) else { return invalido() };
    let (Some(id), Some(pl)) = (bytes_de(&c, "id", Some(32)), bytes_de(&c, "pl", Some(32))) else { return invalido() };
    let cursor = match c.get("cursor") {
        None | Some(Value::Null) => 0,
        Some(v) => match v.as_i64() {
            Some(n) if (0..=i32::MAX as i64).contains(&n) => n as i32,
            _ => return invalido(),
        },
    };
    match chamar(&e.banco, "select chat.caixa_buscar($1, $2, $3)", &[&id_da_caixa(&id), &pl, &cursor]).await {
        Some(v) => responder(StatusCode::OK, json!({ "pacotes": v.get("pacotes").cloned().unwrap_or(json!([])) })),
        None => rede(),
    }
}

async fn confirmar(State(e): E, h: HeaderMap, corpo: Bytes) -> Response {
    if traz_sessao(&h) {
        return recusa_de_sessao();
    }
    let Some(c) = objeto(&corpo) else { return invalido() };
    let (Some(id), Some(pl)) = (bytes_de(&c, "id", Some(32)), bytes_de(&c, "pl", Some(32))) else { return invalido() };
    let Some(ate) = c.get("ate").and_then(|v| v.as_i64()).filter(|n| (0..=i32::MAX as i64).contains(n)).map(|n| n as i32) else {
        return invalido();
    };
    match chamar(&e.banco, "select chat.caixa_confirmar($1, $2, $3)", &[&id_da_caixa(&id), &pl, &ate]).await {
        Some(_) => responder(StatusCode::OK, json!({ "ok": true })),
        None => rede(),
    }
}

async fn trocar(State(e): E, h: HeaderMap, corpo: Bytes) -> Response {
    if traz_sessao(&h) {
        return recusa_de_sessao();
    }
    let Some(c) = objeto(&corpo) else { return invalido() };
    let (Some(id), Some(pl)) = (bytes_de(&c, "id", Some(32)), bytes_de(&c, "pl", Some(32))) else { return invalido() };
    let (Ok(pd_h), Ok(pl_h)) = (opcional(&c, "pd_h", 32), opcional(&c, "pl_h", 32)) else { return invalido() };
    let Some(bloqueio) = c.get("bloqueio").and_then(|v| v.as_bool()) else { return invalido() };
    if pd_h.is_none() && pl_h.is_none() {
        return invalido();
    }
    match chamar(&e.banco, "select chat.caixa_trocar($1, $2, $3, $4, $5)", &[&id_da_caixa(&id), &pl, &pd_h, &pl_h, &bloqueio]).await {
        Some(v) if v.get("ok") == Some(&Value::Bool(true)) => responder(StatusCode::OK, json!({ "ok": true })),
        Some(v) => {
            responder(StatusCode::NOT_FOUND, json!({ "ok": false, "erro": v.get("erro").cloned().unwrap_or(json!("nao_encontrada")) }))
        }
        None => rede(),
    }
}

async fn apagar(State(e): E, h: HeaderMap, corpo: Bytes) -> Response {
    if traz_sessao(&h) {
        return recusa_de_sessao();
    }
    let Some(c) = objeto(&corpo) else { return invalido() };
    let (Some(id), Some(pl)) = (bytes_de(&c, "id", Some(32)), bytes_de(&c, "pl", Some(32))) else { return invalido() };
    match chamar(&e.banco, "select chat.caixa_apagar($1, $2)", &[&id_da_caixa(&id), &pl]).await {
        Some(_) => responder(StatusCode::OK, json!({ "ok": true })),
        None => rede(),
    }
}

fn id_do_cofre(id: &[u8]) -> Vec<u8> {
    resumo("alumia/r3/cofre-anonimo/caixa/v1", id).to_vec()
}

async fn cofre_ler(State(e): E, h: HeaderMap, corpo: Bytes) -> Response {
    if traz_sessao(&h) {
        return recusa_de_sessao();
    }
    let Some(c) = objeto(&corpo) else { return invalido() };
    let (Some(id), Some(pl)) = (bytes_de(&c, "id", Some(32)), bytes_de(&c, "pl", Some(32))) else { return invalido() };
    match chamar(&e.banco, "select chat.cofre_ler($1, $2)", &[&id_do_cofre(&id), &pl]).await {
        Some(v) => responder(StatusCode::OK, json!({ "cofre": v })),
        None => rede(),
    }
}

async fn cofre_gravar(State(e): E, h: HeaderMap, corpo: Bytes) -> Response {
    if traz_sessao(&h) {
        return recusa_de_sessao();
    }
    let Some(c) = objeto(&corpo) else { return invalido() };
    let (Some(id), Some(pd), Some(blob)) = (bytes_de(&c, "id", Some(32)), bytes_de(&c, "pd", Some(32)), bytes_de(&c, "blob", None)) else {
        return invalido();
    };
    let (Ok(pd_h), Ok(pl_h)) = (opcional(&c, "pd_h", 32), opcional(&c, "pl_h", 32)) else { return invalido() };
    let Some(versao) = c.get("versao").and_then(|v| v.as_i64()).filter(|n| (0..=i32::MAX as i64).contains(n)).map(|n| n as i32) else {
        return invalido();
    };
    let agora = agora_s();
    // Só a criação (versão 0) paga: passe ou prova de trabalho.
    let gasto: Option<Vec<u8>> = if versao == 0 {
        match prova_do_item(&c) {
            Err(()) => return invalido(),
            Ok(Some((d, n))) => match e.provas.conferir(&d, &n, e.bits_de_fora, agora) {
                Some(g) => Some(g.to_vec()),
                None => return responder(StatusCode::BAD_REQUEST, json!({ "ok": false, "erro": "prova" })),
            },
            Ok(None) => match e.chaves.conferir(h.get(header::AUTHORIZATION).and_then(|v| v.to_str().ok()), agora).await {
                Ok(g) => Some(g.to_vec()),
                Err(r) => return recusa_do_passe(r),
            },
        }
    } else {
        None
    };
    match chamar(
        &e.banco,
        "select chat.cofre_gravar($1, $2, $3, $4, $5, $6, $7)",
        &[&id_do_cofre(&id), &pd, &pd_h, &pl_h, &versao, &blob, &gasto],
    )
    .await
    {
        Some(v) if v.get("ok") == Some(&Value::Bool(true)) => {
            responder(StatusCode::OK, json!({ "ok": true, "versao": v.get("versao").cloned().unwrap_or(Value::Null) }))
        }
        Some(v) => {
            let erro = v.get("erro").and_then(|x| x.as_str()).unwrap_or("invalido").to_owned();
            let status = if erro == "versao_ocupada" { StatusCode::CONFLICT } else { StatusCode::BAD_REQUEST };
            responder(status, json!({ "ok": false, "erro": erro }))
        }
        None => rede(),
    }
}

async fn cofre_apagar(State(e): E, h: HeaderMap, corpo: Bytes) -> Response {
    if traz_sessao(&h) {
        return recusa_de_sessao();
    }
    let Some(c) = objeto(&corpo) else { return invalido() };
    let (Some(id), Some(pl)) = (bytes_de(&c, "id", Some(32)), bytes_de(&c, "pl", Some(32))) else { return invalido() };
    match chamar(&e.banco, "select chat.cofre_apagar($1, $2)", &[&id_do_cofre(&id), &pl]).await {
        Some(_) => responder(StatusCode::OK, json!({ "ok": true })),
        None => rede(),
    }
}

async fn desafio(State(e): E, h: HeaderMap) -> Response {
    if traz_sessao(&h) {
        return recusa_de_sessao();
    }
    responder(
        StatusCode::OK,
        json!({ "desafio": para_b64u(&e.provas.emitir(agora_s())), "bits": e.bits_de_fora, "bits_com_passe": BITS_COM_PASSE }),
    )
}

async fn saude() -> Response {
    responder(StatusCode::OK, json!({ "ok": true }))
}

/// O token da interface com a rede social confere? (Tempo constante: os dois passam pelo SHA-256 antes de comparar.)
pub fn token_confere(h: &HeaderMap, esperado: &str) -> bool {
    if h.get(header::COOKIE).is_some() {
        return false;
    }
    let Some(dado) = h.get(header::AUTHORIZATION).and_then(|v| v.to_str().ok()).and_then(|a| a.trim().strip_prefix("AlumiaInterface "))
    else {
        return false;
    };
    iguais(&sha256(&[dado.trim().as_bytes()]), &sha256(&[esperado.as_bytes()]))
}

/// O token atual, ou o de antes durante a troca (2.6). Os dois em tempo constante (cada um passa pelo SHA-256 antes de comparar).
pub fn token_aceito(h: &HeaderMap, atual: &str, anterior: Option<&str>) -> bool {
    let a = token_confere(h, atual);
    let b = anterior.is_some_and(|t| token_confere(h, t));
    a | b
}

async fn franquia_conferir(State(e): E, h: HeaderMap, corpo: Bytes) -> Response {
    if !token_aceito(&h, &e.token_interface, e.token_anterior.as_deref()) {
        return responder(StatusCode::UNAUTHORIZED, json!({ "ok": false, "erro": "token" }));
    }
    let Some(c) = objeto(&corpo) else { return invalido() };
    let Some(marcas) = c.get("marcas").and_then(|m| m.as_array()) else { return invalido() };
    if marcas.is_empty() || marcas.len() > 10 {
        return invalido();
    }
    let hoje = dia_utc(agora_s());
    let mut segredos: Vec<&str> = vec![&e.franquia];
    if let Some(a) = &e.franquia_anterior {
        segredos.push(a);
    }
    let mut confere = Vec::with_capacity(marcas.len());
    for m in marcas {
        let Some(x) = m.as_object() else { return invalido() };
        let campos = (
            bytes_de(x, "c", Some(32)),
            bytes_de(x, "id_h", Some(32)),
            bytes_de(x, "pd_h", Some(32)),
            bytes_de(x, "marca", Some(32)),
            x.get("dia").and_then(|d| d.as_str()),
        );
        let (Some(cc), Some(id_h), Some(pd_h), Some(t), Some(dia)) = campos else { return invalido() };
        confere.push(Value::Bool(franquia::confere(&segredos, &cc, &id_h, &pd_h, dia, &t, &hoje)));
    }
    responder(StatusCode::OK, json!({ "confere": confere }))
}

#[cfg(test)]
mod testes {
    use super::*;

    fn cab(pares: &[(&'static str, &str)]) -> HeaderMap {
        let mut h = HeaderMap::new();
        for (k, v) in pares {
            h.append(*k, HeaderValue::from_str(v).unwrap());
        }
        h
    }

    #[test]
    fn quem_traz_conta_e_recusado() {
        assert!(!traz_sessao(&cab(&[])));
        assert!(!traz_sessao(&cab(&[("authorization", "PrivateToken token=\"abc\"")])));
        assert!(traz_sessao(&cab(&[("authorization", "Bearer eyJhbGciOiJIUzI1NiJ9.servico.assinatura")])), "o JWT de serviço da rede");
        assert!(traz_sessao(&cab(&[("cookie", "tema=escuro; sb-projeto-auth-token=abc")])));
        assert!(traz_sessao(&cab(&[("authorization", "AlumiaInterface algum-token")])), "o token da interface não abre as caixas");
    }

    #[test]
    fn o_token_da_interface() {
        let t = "token-da-interface-de-teste-com-mais-de-32"; // gitleaks:allow (valor de teste)
        assert!(token_confere(&cab(&[("authorization", &format!("AlumiaInterface {t}"))]), t));
        assert!(!token_confere(&cab(&[("authorization", &format!("Bearer {t}"))]), t));
        assert!(!token_confere(&cab(&[("authorization", "AlumiaInterface outro")]), t));
        assert!(!token_confere(&cab(&[("authorization", &format!("AlumiaInterface {t}")), ("cookie", "sb-x=1")]), t));
    }

    #[test]
    fn a_troca_do_token_da_interface() {
        let novo = "token-novo-da-interface-de-teste-com-32-ou-mais"; // gitleaks:allow (valor de teste)
        let velho = "token-velho-da-interface-de-teste-com-32-ou-mais"; // gitleaks:allow (valor de teste)
        let com = |t: &str| cab(&[("authorization", &format!("AlumiaInterface {t}"))]);
        assert!(token_aceito(&com(novo), novo, None), "o atual vale");
        assert!(!token_aceito(&com(velho), novo, None), "sem troca em andamento, o velho não vale");
        assert!(token_aceito(&com(velho), novo, Some(velho)), "durante a troca, o velho vale junto");
        assert!(token_aceito(&com(novo), novo, Some(velho)), "e o novo também");
        assert!(!token_aceito(&com("outro-token-qualquer-com-mais-de-32-letras"), novo, Some(velho)), "um terceiro, nunca");
        assert!(!token_aceito(&cab(&[("authorization", &format!("Bearer {velho}"))]), novo, Some(velho)), "nem o velho como Bearer");
    }
}
