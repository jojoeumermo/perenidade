// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// "Este binário está no livro público?" no Rust do app do computador (onda R3, item 2.4). É o que faz o app RECUSAR uma
// atualização fora do livro: antes de abrir o instalador baixado, o app confere o pacote Sigstore dele aqui.
//
// A criptografia é toda do cliente oficial do Sigstore para Rust (`sigstore` 0.14.0): cadeia do certificado até o Fulcio, SCT do
// registro de certificados, identidade (texto exato), assinatura (DSSE ou de mensagem), a coerência do corpo da entrada do Rekor
// com o pacote e a janela de validade do certificado. Duas coisas que o verificador do pacote dessa versão AINDA NÃO faz (está
// escrito no próprio código dele: "TODO ... sigstore-rs#285") são feitas aqui, com as funções da MESMA biblioteca:
//   1. a prova de inclusão de Merkle (RFC 6962) da entrada no livro, até o topo;
//   2. a assinatura do Rekor sobre esse topo ("checkpoint"), com a chave do Rekor da raiz de confiança embutida, escolhida pelo
//      id do livro que o pacote declara.
//   3. a "promessa" assinada do Rekor (SET: o corpo, a hora de entrada, o id e o índice no livro, assinados pela chave do Rekor). A
//      biblioteca usa a hora de entrada para conferir a janela de dez minutos do certificado, mas não confere a assinatura dela:
//      sem o passo 3, quem tivesse a chave de um certificado vencido mudaria a hora e passaria.
// Sem 1 e 2, um pacote com uma entrada inventada (que nunca foi ao livro) passaria. O teste `entrada_inventada` prova isso; o
// `hora_de_entrada_mexida` prova o 3.
// Desenho e limites: docs/BUILD-REPRODUZIVEL.md ("Como o app confere").
//
// Qualquer falha é "fora do log" (falha fechada); o motivo serve só para a tela e para os testes.
use base64::engine::general_purpose::STANDARD as B64;
use base64::Engine;
use serde_json::Value;
use sha2::{Digest, Sha256};
use sigstore::bundle::verify::{blocking::Verifier, policy};
use sigstore::bundle::Bundle;
use sigstore::crypto::{CosignVerificationKey, Signature};
use sigstore::rekor::models::checkpoint::SignedCheckpoint;
use sigstore::rekor::models::InclusionProof;
use sigstore::trust::ManualTrustRoot;
use std::collections::BTreeMap;

use crate::identidade::Identidade;
use crate::Erro;

/// A raiz de confiança pública do Sigstore embutida no app (a mesma de public/apps/raiz-sigstore.json; trocada a cada versão).
pub const RAIZ_EMBUTIDA: &[u8] = include_bytes!("../../../public/apps/raiz-sigstore.json");

const TIPOS_DE_PACOTE: [&str; 2] =
    ["application/vnd.dev.sigstore.bundle.v0.3+json", "application/vnd.dev.sigstore.bundle+json;version=0.2"];

/// Por que um binário foi recusado.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Motivo {
    PacoteMalformado,
    VersaoDoPacote,
    SemProvaDeInclusao,
    IdentidadeVazia,
    /// A biblioteca recusou (cadeia, SCT, identidade, assinatura, corpo da entrada, resumo do arquivo, validade).
    Sigstore(String),
    LivroDesconhecido,
    InclusaoNaoConfere,
    /// A promessa assinada do Rekor (SET) não confere: hora de entrada, índice ou corpo mexidos.
    PromessaNaoConfere,
}

struct Raiz {
    fulcio: Vec<Vec<u8>>,
    ctfe: BTreeMap<String, Vec<u8>>,
    rekor: BTreeMap<String, Vec<u8>>,
}

fn b64(v: &Value) -> Option<Vec<u8>> {
    B64.decode(v.as_str()?).ok()
}

fn ler_raiz(json: &[u8]) -> Result<Raiz, Erro> {
    let v: Value = serde_json::from_slice(json).map_err(|_| Erro::Raiz)?;
    let mut fulcio = Vec::new();
    for ca in v["certificateAuthorities"].as_array().ok_or(Erro::Raiz)? {
        for c in ca["certChain"]["certificates"].as_array().ok_or(Erro::Raiz)? {
            fulcio.push(b64(&c["rawBytes"]).ok_or(Erro::Raiz)?);
        }
    }
    let chaves = |lista: &Value| -> Result<BTreeMap<String, Vec<u8>>, Erro> {
        let mut m = BTreeMap::new();
        for l in lista.as_array().ok_or(Erro::Raiz)? {
            let id = l["logId"]["keyId"].as_str().ok_or(Erro::Raiz)?.to_string();
            m.insert(id, b64(&l["publicKey"]["rawBytes"]).ok_or(Erro::Raiz)?);
        }
        Ok(m)
    };
    Ok(Raiz { fulcio, ctfe: chaves(&v["ctlogs"])?, rekor: chaves(&v["tlogs"])? })
}

/// A prova de inclusão da (única) entrada do pacote, conferida até o topo assinado pelo Rekor.
fn conferir_inclusao(pacote: &Value, raiz: &Raiz) -> Result<(), Motivo> {
    let entrada = &pacote["verificationMaterial"]["tlogEntries"][0];
    let id_do_livro = entrada["logId"]["keyId"].as_str().ok_or(Motivo::PacoteMalformado)?;
    let chave = raiz.rekor.get(id_do_livro).ok_or(Motivo::LivroDesconhecido)?;
    // O id do livro é o SHA-256 da chave pública: o pacote não escolhe uma chave que não seja a dele.
    if B64.encode(Sha256::digest(chave)) != id_do_livro {
        return Err(Motivo::LivroDesconhecido);
    }
    let chave = CosignVerificationKey::try_from_der(chave).map_err(|_| Motivo::LivroDesconhecido)?;
    let prova = &entrada["inclusionProof"];
    let numero = |v: &Value| -> Option<u64> { v.as_str().and_then(|s| s.parse().ok()).or_else(|| v.as_u64()) };
    let indice = numero(&prova["logIndex"]).ok_or(Motivo::PacoteMalformado)?;
    let tamanho = numero(&prova["treeSize"]).ok_or(Motivo::PacoteMalformado)?;
    let topo: [u8; 32] = b64(&prova["rootHash"]).and_then(|b| b.try_into().ok()).ok_or(Motivo::PacoteMalformado)?;
    let mut passos = Vec::new();
    for h in prova["hashes"].as_array().ok_or(Motivo::PacoteMalformado)? {
        passos.push(b64(h).and_then(|b| <[u8; 32]>::try_from(b).ok()).ok_or(Motivo::PacoteMalformado)?);
    }
    let checkpoint: SignedCheckpoint =
        serde_json::from_value(prova["checkpoint"]["envelope"].clone()).map_err(|_| Motivo::PacoteMalformado)?;
    let corpo = b64(&entrada["canonicalizedBody"]).ok_or(Motivo::PacoteMalformado)?;
    // O "kindVersion" do pacote é uma cópia sem assinatura do tipo e da versão que estão no corpo da entrada (o que vai ao livro):
    // tem de bater com o corpo, para o pacote não dizer uma coisa e o livro outra (o Node exige o mesmo).
    let declarado: Value = serde_json::from_slice(&corpo).map_err(|_| Motivo::PacoteMalformado)?;
    if entrada["kindVersion"]["kind"] != declarado["kind"] || entrada["kindVersion"]["version"] != declarado["apiVersion"] {
        return Err(Motivo::PacoteMalformado);
    }
    conferir_promessa(entrada, id_do_livro, &chave)?;
    let indice = i64::try_from(indice).map_err(|_| Motivo::PacoteMalformado)?;
    InclusionProof::new(indice, topo, tamanho, passos, Some(checkpoint)).verify(&corpo, &chave).map_err(|_| Motivo::InclusaoNaoConfere)
}

/// A "promessa" assinada do Rekor (SET): a assinatura, pela chave do livro, do JSON canônico com o corpo da entrada, a hora de
/// entrada, o id do livro (hex) e o índice global. É o que prende a hora de entrada (usada na janela do certificado) ao livro.
fn conferir_promessa(entrada: &Value, id_do_livro: &str, chave: &CosignVerificationKey) -> Result<(), Motivo> {
    let numero = |v: &Value| -> Option<u64> { v.as_str().and_then(|s| s.parse().ok()).or_else(|| v.as_u64()) };
    let corpo = entrada["canonicalizedBody"].as_str().ok_or(Motivo::PacoteMalformado)?;
    let hora = numero(&entrada["integratedTime"]).ok_or(Motivo::PacoteMalformado)?;
    let indice = numero(&entrada["logIndex"]).ok_or(Motivo::PacoteMalformado)?;
    let id: String = B64.decode(id_do_livro).map_err(|_| Motivo::PacoteMalformado)?.iter().map(|b| format!("{b:02x}")).collect();
    let assinatura = b64(&entrada["inclusionPromise"]["signedEntryTimestamp"]).ok_or(Motivo::PromessaNaoConfere)?;
    // JSON canônico (chaves em ordem, sem espaço); o corpo é base64 e o id é hex: nada a escapar.
    let mensagem = serde_json::to_vec(&serde_json::json!({
        "body": corpo,
        "integratedTime": hora,
        "logID": id,
        "logIndex": indice,
    }))
    .map_err(|_| Motivo::PacoteMalformado)?;
    chave.verify_signature(Signature::Raw(&assinatura), &mensagem).map_err(|_| Motivo::PromessaNaoConfere)
}

/// A conferência com o motivo, contra uma raiz de confiança dada (os testes trocam a raiz).
pub fn conferir_no_log_com_raiz(arquivo: &[u8], pacote_json: &[u8], identidade: &Identidade, raiz_json: &[u8]) -> Result<(), Motivo> {
    let pacote: Value = serde_json::from_slice(pacote_json).map_err(|_| Motivo::PacoteMalformado)?;
    let tipo = pacote["mediaType"].as_str().ok_or(Motivo::VersaoDoPacote)?;
    if !TIPOS_DE_PACOTE.contains(&tipo) {
        return Err(Motivo::VersaoDoPacote);
    }
    let entradas = pacote["verificationMaterial"]["tlogEntries"].as_array().ok_or(Motivo::SemProvaDeInclusao)?;
    if entradas.len() != 1
        || !entradas[0]["inclusionProof"]["checkpoint"]["envelope"].is_string()
        || !entradas[0]["inclusionProof"]["hashes"].is_array()
    {
        return Err(Motivo::SemProvaDeInclusao);
    }
    if identidade.uri.is_empty() || identidade.emissor.is_empty() {
        return Err(Motivo::IdentidadeVazia);
    }
    let raiz = ler_raiz(raiz_json).map_err(|_| Motivo::Sigstore("raiz".into()))?;
    let bundle: Bundle = serde_json::from_value(pacote.clone()).map_err(|_| Motivo::PacoteMalformado)?;

    let confianca = ManualTrustRoot {
        fulcio_certs: raiz.fulcio.iter().map(|c| c.as_slice().into()).collect(),
        rekor_keys: raiz.rekor.clone(),
        ctfe_keys: raiz.ctfe.clone(),
    };
    let verificador = Verifier::new(Default::default(), confianca).map_err(|e| Motivo::Sigstore(e.to_string()))?;
    let politica = policy::Identity::new(&identidade.uri, &identidade.emissor);
    let mut resumo = Sha256::new();
    resumo.update(arquivo);
    verificador.verify_digest(resumo, bundle, &politica, true).map_err(|e| Motivo::Sigstore(e.to_string()))?;
    conferir_inclusao(&pacote, &raiz)
}

/// O contrato do desenho (seção 4.4): `Ok(true)` só quando tudo confere, com a raiz embutida.
pub fn conferir_no_log(arquivo: &[u8], pacote_json: &[u8], identidade: &Identidade) -> Result<bool, Erro> {
    Ok(conferir_no_log_com_raiz(arquivo, pacote_json, identidade, RAIZ_EMBUTIDA).is_ok())
}
