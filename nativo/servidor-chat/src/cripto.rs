// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// As peças pequenas: resumo, HMAC, HKDF e sorteio pelo `ring` (biblioteca consagrada, auditada); comparação em tempo constante pelo
// `subtle`; base64 pelo `base64`; o dia e a semana em UTC. Nada de cifra feita à mão aqui.

use base64::Engine;
use base64::engine::general_purpose::{STANDARD, URL_SAFE_NO_PAD};
use ring::{digest, hkdf, hmac, rand::SecureRandom, rand::SystemRandom};
use subtle::ConstantTimeEq;

/// SHA-256 de várias partes juntas.
pub fn sha256(partes: &[&[u8]]) -> [u8; 32] {
    let mut ctx = digest::Context::new(&digest::SHA256);
    for p in partes {
        ctx.update(p);
    }
    let mut saida = [0u8; 32];
    saida.copy_from_slice(ctx.finish().as_ref());
    saida
}

/// SHA-256(rótulo ‖ valor): o resumo que o banco guarda no lugar do segredo (o mesmo de lib/rede/caixas/base.ts).
pub fn resumo(rotulo: &str, valor: &[u8]) -> [u8; 32] {
    sha256(&[rotulo.as_bytes(), valor])
}

/// HMAC-SHA-256 de várias partes juntas.
pub fn hmac_sha256(chave: &[u8], partes: &[&[u8]]) -> [u8; 32] {
    let k = hmac::Key::new(hmac::HMAC_SHA256, chave);
    let mut ctx = hmac::Context::with_key(&k);
    for p in partes {
        ctx.update(p);
    }
    let mut saida = [0u8; 32];
    saida.copy_from_slice(ctx.sign().as_ref());
    saida
}

struct Tamanho(usize);
impl hkdf::KeyType for Tamanho {
    fn len(&self) -> usize {
        self.0
    }
}

/// HKDF-SHA-256 sem sal (o mesmo do `hkdf(sha256, ikm, undefined, info, 32)` da @noble/hashes: sal vazio = 32 zeros no HMAC).
pub fn hkdf32(ikm: &[u8], info: &[u8]) -> [u8; 32] {
    let prk = hkdf::Salt::new(hkdf::HKDF_SHA256, &[]).extract(ikm);
    let mut saida = [0u8; 32];
    let infos = [info];
    // O comprimento pedido é fixo (32) e válido: expand e fill não falham com ele.
    prk.expand(&infos, Tamanho(32)).and_then(|o| o.fill(&mut saida)).expect("hkdf de 32 bytes");
    saida
}

/// Comparação em tempo constante (para o mesmo comprimento; comprimentos diferentes: falso).
pub fn iguais(a: &[u8], b: &[u8]) -> bool {
    a.len() == b.len() && bool::from(a.ct_eq(b))
}

/// `n` bytes do sorteio do sistema.
pub fn sortear(n: usize) -> Vec<u8> {
    let mut v = vec![0u8; n];
    SystemRandom::new().fill(&mut v).expect("sorteio do sistema");
    v
}

/// Base64 (padrão ou de endereço, com ou sem "=") para bytes; nulo se não for. `tamanho`: confere o comprimento.
pub fn de_b64(texto: &str, tamanho: Option<usize>) -> Option<Vec<u8>> {
    if texto.is_empty() || !texto.bytes().all(|c| c.is_ascii_alphanumeric() || matches!(c, b'-' | b'_' | b'+' | b'/' | b'=')) {
        return None;
    }
    let limpo: String = texto
        .trim_end_matches('=')
        .chars()
        .map(|c| match c {
            '+' => '-',
            '/' => '_',
            x => x,
        })
        .collect();
    let bytes = URL_SAFE_NO_PAD.decode(limpo.as_bytes()).ok()?;
    match tamanho {
        Some(t) if bytes.len() != t => None,
        _ => Some(bytes),
    }
}

/// Bytes para base64 de endereço (sem "=").
pub fn para_b64u(b: &[u8]) -> String {
    URL_SAFE_NO_PAD.encode(b)
}

/// Bytes para base64 padrão (o que o banco lê em jsonb).
pub fn para_b64(b: &[u8]) -> String {
    STANDARD.encode(b)
}

/// Segundos desde 1970.
pub fn agora_s() -> i64 {
    std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_secs() as i64).unwrap_or(0)
}

/// A semana (semanas inteiras desde 1970-01-01, em UTC): a mesma de lib/rede/passes/comum.ts.
pub fn semana_de(segundos: i64) -> i64 {
    segundos.div_euclid(7 * 86_400)
}

/// O dia em UTC ("AAAA-MM-DD") de um instante (o algoritmo de datas civis de Howard Hinnant, sem biblioteca de calendário).
pub fn dia_utc(segundos: i64) -> String {
    let z = segundos.div_euclid(86_400) + 719_468;
    let era = z.div_euclid(146_097);
    let doe = z - era * 146_097;
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    let y = yoe + era * 400 + if m <= 2 { 1 } else { 0 };
    format!("{y:04}-{m:02}-{d:02}")
}

/// Quantos dias entre dois "AAAA-MM-DD" (b − a); nulo se algum não é uma data de verdade.
pub fn dias_entre(a: &str, b: &str) -> Option<i64> {
    Some(numero_do_dia(b)? - numero_do_dia(a)?)
}

fn numero_do_dia(d: &str) -> Option<i64> {
    let p: Vec<&str> = d.split('-').collect();
    if p.len() != 3 || p[0].len() != 4 || p[1].len() != 2 || p[2].len() != 2 {
        return None;
    }
    let (y, m, dd): (i64, i64, i64) = (p[0].parse().ok()?, p[1].parse().ok()?, p[2].parse().ok()?);
    if !(1..=12).contains(&m) || !(1..=31).contains(&dd) {
        return None;
    }
    let y2 = if m <= 2 { y - 1 } else { y };
    let era = y2.div_euclid(400);
    let yoe = y2 - era * 400;
    let mp = if m > 2 { m - 3 } else { m + 9 };
    let doy = (153 * mp + 2) / 5 + dd - 1;
    let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
    let n = era * 146_097 + doe - 719_468;
    // Confere a ida e a volta (recusa "2026-02-31").
    if dia_utc(n * 86_400) != d { None } else { Some(n) }
}

#[cfg(test)]
mod testes {
    use super::*;

    #[test]
    fn dias() {
        assert_eq!(dia_utc(0), "1970-01-01");
        assert_eq!(dia_utc(1_795_564_800), "2026-11-25");
        assert_eq!(dias_entre("2026-11-18", "2026-11-25"), Some(7));
        assert_eq!(dias_entre("2026-02-31", "2026-03-01"), None);
        assert_eq!(dias_entre("2024-02-29", "2024-03-01"), Some(1));
        assert_eq!(semana_de(0), 0);
        assert_eq!(semana_de(7 * 86_400 - 1), 0);
        assert_eq!(semana_de(7 * 86_400), 1);
    }

    #[test]
    fn base64() {
        assert_eq!(de_b64("AAEC", None), Some(vec![0, 1, 2]));
        assert_eq!(de_b64("_-8=", None), de_b64("/+8", None));
        assert_eq!(de_b64("AAEC", Some(4)), None);
        assert_eq!(de_b64("A A", None), None);
        assert_eq!(de_b64("", None), None);
    }

    #[test]
    fn hkdf_igual_ao_da_noble() {
        // Vetor do RFC 5869 (caso 3: sem sal e sem info), os primeiros 32 bytes.
        let ikm = [0x0bu8; 22];
        let okm = hkdf32(&ikm, b"");
        assert_eq!(para_b64(&okm), "jaTndaVjwY9xX4AqBjxaMbihH1xe4Yeew0VOXzxzjS0=");
    }
}
