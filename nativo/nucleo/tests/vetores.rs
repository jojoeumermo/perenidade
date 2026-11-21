// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Aceite da onda R3, item 2.4, no Rust: "um binário fora do log é recusado". Os MESMOS vetores do Node
// (scripts/vetores/sigstore/LEIA-ME.md): o pacote real do sigstore-python v4.5.1 e o arquivo dele; cada ataque é uma mudança.
use alumia_nucleo::identidade::identidade_da_versao;
use alumia_nucleo::transparencia::{conferir_no_log, conferir_no_log_com_raiz, Motivo, RAIZ_EMBUTIDA};
use alumia_nucleo::Identidade;
use base64::engine::general_purpose::STANDARD as B64;
use base64::Engine;
use serde_json::Value;
use sha2::{Digest, Sha256};

const ARQUIVO: &[u8] = include_bytes!("../../../scripts/vetores/sigstore/sigstore-4.5.1-py3-none-any.whl");
const PACOTE: &[u8] = include_bytes!("../../../scripts/vetores/sigstore/pacote-positivo.json");

fn quem() -> Identidade {
    Identidade {
        uri: "https://github.com/sigstore/sigstore-python/.github/workflows/release.yml@refs/tags/v4.5.1".into(),
        emissor: "https://token.actions.githubusercontent.com".into(),
    }
}
fn pacote() -> Value {
    serde_json::from_slice(PACOTE).unwrap()
}
fn bytes(v: &Value) -> Vec<u8> {
    serde_json::to_vec(v).unwrap()
}
fn recusa(arquivo: &[u8], p: &Value, i: &Identidade) -> Motivo {
    conferir_no_log_com_raiz(arquivo, &bytes(p), i, RAIZ_EMBUTIDA).expect_err("devia recusar")
}
fn entrada(p: &mut Value) -> &mut Value {
    &mut p["verificationMaterial"]["tlogEntries"][0]
}

#[test]
fn o_pacote_real_confere() {
    assert_eq!(conferir_no_log_com_raiz(ARQUIVO, PACOTE, &quem(), RAIZ_EMBUTIDA), Ok(()));
    assert!(conferir_no_log(ARQUIVO, PACOTE, &quem()).unwrap());
}

#[test]
fn um_byte_trocado_no_arquivo() {
    let mut a = ARQUIVO.to_vec();
    a[1000] ^= 1;
    assert!(matches!(recusa(&a, &pacote(), &quem()), Motivo::Sigstore(_)));
}

#[test]
fn arquivo_que_nunca_foi_ao_livro() {
    recusa(b"alumia-falsa.exe", &pacote(), &quem());
    recusa(b"", &pacote(), &quem());
}

#[test]
fn resumo_trocado_dentro_da_declaracao() {
    let falso = b"binario-adulterado";
    let mut p = pacote();
    let mut d: Value = serde_json::from_slice(&B64.decode(p["dsseEnvelope"]["payload"].as_str().unwrap()).unwrap()).unwrap();
    d["subject"][0]["digest"]["sha256"] = Value::String(hex(&Sha256::digest(falso)));
    p["dsseEnvelope"]["payload"] = Value::String(B64.encode(serde_json::to_vec(&d).unwrap()));
    recusa(falso, &p, &quem());
}

#[test]
fn assinatura_do_envelope_trocada() {
    let mut p = pacote();
    let mut s = B64.decode(p["dsseEnvelope"]["signatures"][0]["sig"].as_str().unwrap()).unwrap();
    let n = s.len();
    s[n - 5] ^= 1;
    p["dsseEnvelope"]["signatures"][0]["sig"] = Value::String(B64.encode(s));
    recusa(ARQUIVO, &p, &quem());
}

#[test]
fn sem_prova_de_inclusao() {
    let mut p = pacote();
    entrada(&mut p).as_object_mut().unwrap().remove("inclusionProof");
    assert_eq!(recusa(ARQUIVO, &p, &quem()), Motivo::SemProvaDeInclusao);
}

#[test]
fn prova_cortada() {
    let mut p = pacote();
    entrada(&mut p)["inclusionProof"]["hashes"].as_array_mut().unwrap().pop();
    assert_eq!(recusa(ARQUIVO, &p, &quem()), Motivo::InclusaoNaoConfere);
}

#[test]
fn prova_com_passo_trocado() {
    let mut p = pacote();
    let h = &mut entrada(&mut p)["inclusionProof"]["hashes"][3];
    let mut b = B64.decode(h.as_str().unwrap()).unwrap();
    b[0] ^= 0x80;
    *h = Value::String(B64.encode(b));
    assert_eq!(recusa(ARQUIVO, &p, &quem()), Motivo::InclusaoNaoConfere);
}

#[test]
fn indice_da_folha_trocado() {
    let mut p = pacote();
    let prova = &mut entrada(&mut p)["inclusionProof"];
    let i: u64 = prova["logIndex"].as_str().unwrap().parse().unwrap();
    prova["logIndex"] = Value::String((i + 1).to_string());
    assert_eq!(recusa(ARQUIVO, &p, &quem()), Motivo::InclusaoNaoConfere);
}

/// O ataque que a biblioteca sozinha deixaria passar: uma entrada com prova de inclusão e topo inventados (sem a assinatura do
/// Rekor sobre esse topo). O topo é recalculado para bater com a prova; a assinatura do topo é a de outro topo.
#[test]
fn entrada_inventada() {
    let mut p = pacote();
    let prova = &mut entrada(&mut p)["inclusionProof"];
    let falso = B64.encode([7u8; 32]);
    let velho = prova["rootHash"].as_str().unwrap().to_string();
    let env = prova["checkpoint"]["envelope"].as_str().unwrap().replace(&velho, &falso);
    prova["checkpoint"]["envelope"] = Value::String(env);
    prova["rootHash"] = Value::String(falso);
    assert_eq!(recusa(ARQUIVO, &p, &quem()), Motivo::InclusaoNaoConfere);
}

#[test]
fn corpo_da_entrada_trocado() {
    let mut p = pacote();
    let e = entrada(&mut p);
    let mut corpo: Value = serde_json::from_slice(&B64.decode(e["canonicalizedBody"].as_str().unwrap()).unwrap()).unwrap();
    corpo["spec"]["envelopeHash"] = serde_json::json!({ "algorithm": "sha256", "value": "0".repeat(64) });
    e["canonicalizedBody"] = Value::String(B64.encode(serde_json::to_vec(&corpo).unwrap()));
    recusa(ARQUIVO, &p, &quem());
}

#[test]
fn duas_entradas_ou_nenhuma() {
    let mut p = pacote();
    let e = entrada(&mut p).clone();
    p["verificationMaterial"]["tlogEntries"].as_array_mut().unwrap().push(e);
    assert_eq!(recusa(ARQUIVO, &p, &quem()), Motivo::SemProvaDeInclusao);
    p["verificationMaterial"]["tlogEntries"] = serde_json::json!([]);
    assert_eq!(recusa(ARQUIVO, &p, &quem()), Motivo::SemProvaDeInclusao);
}

#[test]
fn livro_fora_da_raiz() {
    let mut raiz: Value = serde_json::from_slice(RAIZ_EMBUTIDA).unwrap();
    raiz["tlogs"] = serde_json::json!([]);
    let r = conferir_no_log_com_raiz(ARQUIVO, PACOTE, &quem(), &serde_json::to_vec(&raiz).unwrap());
    assert_eq!(r, Err(Motivo::LivroDesconhecido));
}

#[test]
fn raiz_sem_fulcio() {
    let mut raiz: Value = serde_json::from_slice(RAIZ_EMBUTIDA).unwrap();
    raiz["certificateAuthorities"] = serde_json::json!([]);
    assert!(conferir_no_log_com_raiz(ARQUIVO, PACOTE, &quem(), &serde_json::to_vec(&raiz).unwrap()).is_err());
}

#[test]
fn identidades_trocadas() {
    let p = pacote();
    recusa(ARQUIVO, &p, &identidade_da_versao("4.5.1").unwrap());
    let q = quem();
    for i in [
        Identidade { uri: q.uri.replace("v4.5.1", "v4.5.2"), ..q.clone() },
        Identidade { uri: q.uri.split('@').next().unwrap().to_string(), ..q.clone() },
        Identidade { uri: ".*".into(), ..q.clone() },
        Identidade { emissor: "https://accounts.google.com".into(), ..q.clone() },
    ] {
        recusa(ARQUIVO, &p, &i);
    }
    assert_eq!(recusa(ARQUIVO, &p, &Identidade { uri: String::new(), emissor: String::new() }), Motivo::IdentidadeVazia);
}

#[test]
fn formato_velho_e_lixo() {
    let mut p = pacote();
    p["mediaType"] = Value::String("application/vnd.dev.sigstore.bundle+json;version=0.1".into());
    assert_eq!(recusa(ARQUIVO, &p, &quem()), Motivo::VersaoDoPacote);
    for lixo in [&b""[..], b"null", b"[]", b"{}", b"\"x\"", b"{\"mediaType\":1}"] {
        assert!(conferir_no_log_com_raiz(ARQUIVO, lixo, &quem(), RAIZ_EMBUTIDA).is_err());
    }
}

fn hex(b: &[u8]) -> String {
    b.iter().map(|x| format!("{x:02x}")).collect()
}

mod propriedades {
    use super::*;
    use proptest::prelude::*;

    fn sem_linha_de_assinatura(p: &Value) -> Value {
        let mut e = p["verificationMaterial"]["tlogEntries"].clone();
        let envelope = e[0]["inclusionProof"]["checkpoint"]["envelope"].as_str().unwrap_or("").to_string();
        let texto = envelope
            .split(
                "

",
            )
            .next()
            .unwrap_or("")
            .to_string();
        e[0]["inclusionProof"]["checkpoint"]["envelope"] = Value::String(texto);
        e
    }

    proptest! {
        #![proptest_config(ProptestConfig { cases: 64, .. ProptestConfig::default() })]
        /// Qualquer byte do JSON mexido: nunca vira "no log" se a parte que a conferência lê mudou.
        #[test]
        fn um_byte_mexido(i in 0usize..PACOTE.len(), c in 32u8..127) {
            let mut b = PACOTE.to_vec();
            if b[i] == c { return Ok(()); }
            b[i] = c;
            if conferir_no_log_com_raiz(ARQUIVO, &b, &quem(), RAIZ_EMBUTIDA).is_ok() {
                let (a, n): (Value, Value) = (pacote(), serde_json::from_slice(&b).unwrap());
                prop_assert_eq!(&a["dsseEnvelope"], &n["dsseEnvelope"]);
                // O nome do assinante na linha de assinatura do topo ("— rekor.sigstore.dev …") não é parte do texto assinado
                // (a chave é escolhida pela raiz embutida): o que conta é o texto do topo, antes da linha em branco.
                prop_assert_eq!(sem_linha_de_assinatura(&a), sem_linha_de_assinatura(&n));
            }
        }
    }
}

/// As cópias sem assinatura do topo (`rootHash`, `treeSize`) diferentes do topo assinado: recusado (o Node recusa igual, com o
/// motivo "topo_incoerente"; os dois verificadores dão a mesma resposta).
#[test]
fn copia_do_topo_diferente_do_assinado() {
    let original = pacote();
    let raiz = original["verificationMaterial"]["tlogEntries"][0]["inclusionProof"]["rootHash"].as_str().unwrap().to_string();
    let tamanho: u64 = original["verificationMaterial"]["tlogEntries"][0]["inclusionProof"]["treeSize"].as_str().unwrap().parse().unwrap();
    for novo in [format!("A{}", &raiz[1..]), B64.encode([0u8; 32])] {
        let mut p = pacote();
        entrada(&mut p)["inclusionProof"]["rootHash"] = Value::String(novo);
        recusa(ARQUIVO, &p, &quem());
    }
    let mut p = pacote();
    entrada(&mut p)["inclusionProof"]["treeSize"] = Value::String((tamanho + 1).to_string());
    recusa(ARQUIVO, &p, &quem());
    // O tipo e a versão declarados fora do corpo da entrada têm de ser os do corpo.
    for (campo, valor) in [("version", "1.0.1"), ("kind", "intoto")] {
        let mut p = pacote();
        entrada(&mut p)["kindVersion"][campo] = Value::String(valor.into());
        assert_eq!(recusa(ARQUIVO, &p, &quem()), Motivo::PacoteMalformado, "kindVersion.{campo}");
    }
}

/// A hora de entrada no livro mexida (para caber na janela de um certificado vencido), a promessa assinada do Rekor estragada ou
/// ausente, o índice global trocado: recusado (a biblioteca 0.14 não confere a promessa; o nosso passo 3 confere).
#[test]
fn hora_de_entrada_mexida() {
    let original = pacote();
    let hora: u64 = original["verificationMaterial"]["tlogEntries"][0]["integratedTime"].as_str().unwrap().parse().unwrap();
    let indice: u64 = original["verificationMaterial"]["tlogEntries"][0]["logIndex"].as_str().unwrap().parse().unwrap();
    let set = original["verificationMaterial"]["tlogEntries"][0]["inclusionPromise"]["signedEntryTimestamp"].as_str().unwrap().to_string();
    let mut casos: Vec<Value> = Vec::new();
    for h in [hora + 1, hora - 1] {
        let mut p = pacote();
        entrada(&mut p)["integratedTime"] = Value::String(h.to_string());
        casos.push(p);
    }
    let mut p = pacote();
    entrada(&mut p)["inclusionPromise"]["signedEntryTimestamp"] = Value::String(format!("/{}", &set[1..]));
    casos.push(p);
    let mut p = pacote();
    entrada(&mut p).as_object_mut().unwrap().remove("inclusionPromise");
    casos.push(p);
    let mut p = pacote();
    entrada(&mut p)["logIndex"] = Value::String((indice + 1).to_string());
    casos.push(p);
    for p in &casos {
        recusa(ARQUIVO, p, &quem());
    }
    // A hora mexida cai no passo 3 (e não por acaso em outro).
    let mut p = pacote();
    entrada(&mut p)["integratedTime"] = Value::String((hora + 1).to_string());
    assert_eq!(recusa(ARQUIVO, &p, &quem()), Motivo::PromessaNaoConfere);
}
