// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A conferência dos passes anônimos (Privacy Pass, RFC 9578, tipo 0x0002 Blind RSA 2048, RSASSA-PSS SHA-384 com sal de 48) SÓ com a
// chave PÚBLICA da semana. Quem emite é o servidor do site (com a sessão da conta aprovada, lib/rede/passes/servidor.ts); este servidor
// não tem segredo nenhum da rede social. A chave pública da semana vem da rota pública da rede (CHAT_PASSES_CHAVE_URL, "?semana=<n>"),
// fica na memória, e o id dela (SHA-256 do SPKI) tem de ser o que a rota diz. Uma chave por semana: um passe feito com outra chave (uma
// chave dada só a uma pessoa, para reconhecê-la) não confere aqui.
//
// O passe: tipo(2) ‖ nonce(32) ‖ resumo do desafio(32) ‖ id da chave(32) ‖ assinatura(256). Vale com a chave da semana ou da anterior.
// Devolve o resumo do passe gasto (SHA-256("alumia/r2/passes/gasto/v1" ‖ nonce)), que o banco grava no MESMO lote da ação
// (repetido = recusado lá).

use std::collections::HashMap;
use std::sync::{Arc, Mutex};

use ring::signature::{RSA_PSS_2048_8192_SHA384, UnparsedPublicKey};

use crate::cripto::{agora_s, de_b64, iguais, resumo, semana_de, sha256};

pub const TAMANHO_DO_PASSE: usize = 2 + 32 + 32 + 32 + 256;
const EMISSOR: &str = "alumia.invalid";
/// O OID do RSASSA-PSS (o SPKI do RFC 9578).
const OID_RSASSA_PSS: &str = "1.2.840.113549.1.1.10";

/// O resumo do desafio de todos os passes gerais (o mesmo de lib/rede/passes/comum.ts, resumoDoDesafio()).
pub fn resumo_do_desafio() -> [u8; 32] {
    let mut d = Vec::new();
    d.extend_from_slice(&2u16.to_be_bytes());
    d.extend_from_slice(&(EMISSOR.len() as u16).to_be_bytes());
    d.extend_from_slice(EMISSOR.as_bytes());
    d.push(0); // contexto de resgate vazio
    d.extend_from_slice(&(EMISSOR.len() as u16).to_be_bytes());
    d.extend_from_slice(EMISSOR.as_bytes());
    sha256(&[&d])
}

/// Uma chave pública da semana, pronta para conferir.
pub struct Chave {
    pub id: [u8; 32],
    /// RSAPublicKey (PKCS#1) tirado do SPKI.
    rsa: Vec<u8>,
}

/// Tira a chave RSA do SPKI RSASSA-PSS (com o `spki`, da RustCrypto); confere o OID.
pub fn chave_do_spki(spki_der: &[u8]) -> Option<Chave> {
    let info = spki::SubjectPublicKeyInfoRef::try_from(spki_der).ok()?;
    if info.algorithm.oid.to_string() != OID_RSASSA_PSS {
        return None;
    }
    let rsa = info.subject_public_key.as_bytes()?.to_vec();
    Some(Chave { id: sha256(&[spki_der]), rsa })
}

/// Por que o passe não vale.
#[derive(Debug, PartialEq, Eq)]
pub enum Recusa {
    SemPasse,
    Invalido,
    SemServico,
}

/// De onde vêm as chaves (a rota pública da rede, ou uma lista fixa nos testes).
pub enum Fonte {
    Rota {
        url: String,
        http: reqwest::Client,
    },
    #[cfg(test)]
    Fixas(HashMap<i64, Vec<u8>>),
}

/// O que a memória guarda de cada semana: a chave (nula se a rota disse que não há) e quando foi lida.
type Lida = (Option<Arc<Chave>>, i64);

pub struct Chaves {
    fonte: Fonte,
    memoria: Mutex<HashMap<i64, Lida>>,
}

impl Chaves {
    pub fn nova(fonte: Fonte) -> Self {
        Chaves { fonte, memoria: Mutex::new(HashMap::new()) }
    }

    /// A chave de uma semana. A que existe fica guardada; a que falta é perguntada de novo depois de 60 s.
    pub async fn da_semana(&self, semana: i64) -> Result<Option<Arc<Chave>>, Recusa> {
        let agora = agora_s();
        if let Some((c, quando)) = self.memoria.lock().map_err(|_| Recusa::SemServico)?.get(&semana)
            && (c.is_some() || agora - quando < 60)
        {
            return Ok(c.clone());
        }
        let lida = match &self.fonte {
            #[cfg(test)]
            Fonte::Fixas(m) => m.get(&semana).and_then(|spki| chave_do_spki(spki)).map(Arc::new),
            Fonte::Rota { url, http } => buscar(http, url, semana).await?,
        };
        let mut m = self.memoria.lock().map_err(|_| Recusa::SemServico)?;
        m.insert(semana, (lida.clone(), agora));
        // Só as semanas recentes ficam na memória.
        m.retain(|s, _| *s >= semana - 3);
        Ok(lida)
    }

    /// Confere o passe do cabeçalho Authorization. Devolve o resumo do gasto.
    pub async fn conferir(&self, cabecalho: Option<&str>, agora: i64) -> Result<[u8; 32], Recusa> {
        let passe = ler_passe(cabecalho)?;
        if passe[0..2] != [0, 2] || !iguais(&passe[34..66], &resumo_do_desafio()) {
            return Err(Recusa::Invalido);
        }
        let semana = semana_de(agora);
        for s in [semana, semana - 1] {
            let Some(chave) = self.da_semana(s).await? else { continue };
            if !iguais(&passe[66..98], &chave.id) {
                continue;
            }
            return UnparsedPublicKey::new(&RSA_PSS_2048_8192_SHA384, &chave.rsa)
                .verify(&passe[0..98], &passe[98..])
                .map(|_| resumo("alumia/r2/passes/gasto/v1", &passe[2..34]))
                .map_err(|_| Recusa::Invalido);
        }
        Err(Recusa::Invalido)
    }
}

/// Lê o cabeçalho `PrivateToken token="…"` (RFC 9577).
pub fn ler_passe(cabecalho: Option<&str>) -> Result<Vec<u8>, Recusa> {
    let c = cabecalho.unwrap_or("").trim();
    let Some(resto) = c.strip_prefix("PrivateToken ") else { return Err(Recusa::SemPasse) };
    let valor = resto.trim().strip_prefix("token=").ok_or(Recusa::Invalido)?;
    let valor = valor.trim_matches('"');
    if valor.len() > 520 {
        return Err(Recusa::Invalido);
    }
    de_b64(valor, Some(TAMANHO_DO_PASSE)).ok_or(Recusa::Invalido)
}

async fn buscar(http: &reqwest::Client, url: &str, semana: i64) -> Result<Option<Arc<Chave>>, Recusa> {
    let r = http.get(format!("{url}?semana={semana}")).send().await.map_err(|_| Recusa::SemServico)?;
    if r.status().as_u16() == 404 {
        return Ok(None);
    }
    if !r.status().is_success() {
        return Err(Recusa::SemServico);
    }
    let corpo = r.bytes().await.map_err(|_| Recusa::SemServico)?;
    if corpo.len() > 8192 {
        return Err(Recusa::SemServico);
    }
    let v: serde_json::Value = serde_json::from_slice(&corpo).map_err(|_| Recusa::SemServico)?;
    if v.get("semana").and_then(|s| s.as_i64()) != Some(semana) {
        return Err(Recusa::SemServico);
    }
    let spki = v.get("publica").and_then(|p| p.as_str()).and_then(|p| de_b64(p, None)).ok_or(Recusa::SemServico)?;
    let id = v.get("id").and_then(|p| p.as_str()).and_then(|p| de_b64(p, Some(32))).ok_or(Recusa::SemServico)?;
    let chave = chave_do_spki(&spki).ok_or(Recusa::SemServico)?;
    if !iguais(&chave.id, &id) {
        return Err(Recusa::SemServico);
    }
    Ok(Some(Arc::new(chave)))
}

#[cfg(test)]
mod testes {
    use super::*;

    #[test]
    fn o_desafio_e_o_mesmo_do_typescript() {
        // lib/rede/passes/comum.ts: Buffer.from(resumoDoDesafio()).toString("hex")
        let esperado = "68cc0b309d9b0e5a840b25bd42ae42800777e233795b5ef5b7ce9aea95b93025";
        let feito: String = resumo_do_desafio().iter().map(|b| format!("{b:02x}")).collect();
        assert_eq!(feito, esperado);
    }

    fn cab(p: &str) -> String {
        format!("PrivateToken token=\"{p}\"")
    }

    #[tokio::test]
    async fn confere_o_passe_que_o_site_emite() {
        use crate::vetor_de_teste::*;
        let chaves = Chaves::nova(Fonte::Fixas(HashMap::from([(SEMANA, de_b64(SPKI, None).unwrap())])));
        let na_semana = SEMANA * 7 * 86_400 + 3600;
        let r = chaves.conferir(Some(&cab(PASSE)), na_semana).await;
        assert!(r.is_ok(), "o passe de verdade vale na semana da chave");
        let gasto = r.unwrap();
        let bytes = de_b64(PASSE, Some(TAMANHO_DO_PASSE)).unwrap();
        assert_eq!(gasto, resumo("alumia/r2/passes/gasto/v1", &bytes[2..34]), "o resumo do gasto é o do nonce");
        assert!(chaves.conferir(Some(&cab(PASSE)), na_semana + 7 * 86_400).await.is_ok(), "e na semana seguinte");
        assert_eq!(chaves.conferir(Some(&cab(PASSE)), na_semana + 14 * 86_400).await, Err(Recusa::Invalido), "não depois");
        assert_eq!(chaves.conferir(Some(&cab(PASSE)), na_semana - 7 * 86_400).await, Err(Recusa::Invalido), "nem antes");
        assert_eq!(chaves.conferir(Some(&cab(COM_CONTEXTO)), na_semana).await, Err(Recusa::Invalido), "passe com contexto não é geral");
        for i in [1usize, 10, 40, 80, 200, 353] {
            let mut t = bytes.clone();
            t[i] ^= 1;
            let torto = crate::cripto::para_b64u(&t);
            assert_eq!(chaves.conferir(Some(&cab(&torto)), na_semana).await, Err(Recusa::Invalido), "byte {i} trocado");
        }
        assert_eq!(chaves.conferir(None, na_semana).await, Err(Recusa::SemPasse));
    }

    #[test]
    fn spki_que_nao_e_rsa_pss() {
        assert!(chave_do_spki(&[0x30, 0x03, 0x02, 0x01, 0x00]).is_none());
        let mut spki = de_b64(crate::vetor_de_teste::SPKI, None).unwrap();
        assert!(chave_do_spki(&spki).is_some());
        // O OID do RSASSA-PSS (…01 01 0a) trocado pelo de RSA comum (…01 01 01): recusado.
        let pos = spki.windows(9).position(|w| w == [0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x0a]).unwrap();
        spki[pos + 8] = 0x01;
        assert!(chave_do_spki(&spki).is_none());
    }

    #[test]
    fn cabecalhos_tortos() {
        assert_eq!(ler_passe(None), Err(Recusa::SemPasse));
        assert_eq!(ler_passe(Some("Bearer abc")), Err(Recusa::SemPasse));
        assert_eq!(ler_passe(Some("PrivateToken token=\"AAAA\"")), Err(Recusa::Invalido));
        assert_eq!(ler_passe(Some("PrivateToken nada")), Err(Recusa::Invalido));
    }
}
