// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A franquia das mensagens (message franking da R2, lib/rede/franquia/protocolo.ts) no servidor do chat: a marca de cada depósito é
// t = HMAC(K_dia, "alumia/r2/marca/v2" ‖ c ‖ id_h ‖ pd_h ‖ dia), K_dia = HKDF-SHA-256(CHAT_FRANQUIA_SEGREDO, info =
// "alumia/r2/marca/chave/v1|<dia>"), com pd_h o resumo do passe de depósito APRESENTADO. Os mesmos bytes de lib/rede/franquia/servidor.ts
// (o teste confere com um vetor tirado do TypeScript). O segredo é do servidor do chat: a rede social não tem.
//
// Rotação: CHAT_FRANQUIA_SEGREDO_ANTERIOR (opcional) confere marcas feitas antes da troca, pelos 90 dias do prazo da denúncia; marca
// nova sai sempre com o segredo novo.

use crate::cripto::{dias_entre, hkdf32, hmac_sha256, iguais};

pub const DIAS_DA_PROVA: i64 = 90;

pub fn marca(segredo: &str, c: &[u8], id_h: &[u8], pd_h: &[u8], dia: &str) -> [u8; 32] {
    let k = hkdf32(segredo.as_bytes(), format!("alumia/r2/marca/chave/v1|{dia}").as_bytes());
    hmac_sha256(&k, &[b"alumia/r2/marca/v2", c, id_h, pd_h, dia.as_bytes()])
}

/// A marca confere (com o segredo de agora ou com o anterior), e o dia é de verdade e está no prazo?
pub fn confere(segredos: &[&str], c: &[u8], id_h: &[u8], pd_h: &[u8], dia: &str, t: &[u8], hoje: &str) -> bool {
    if c.len() != 32 || id_h.len() != 32 || pd_h.len() != 32 || t.len() != 32 {
        return false;
    }
    match dias_entre(dia, hoje) {
        Some(idade) if (0..=DIAS_DA_PROVA).contains(&idade) => {}
        _ => return false,
    }
    // Todas as contas são feitas (sem sair no meio), para o tempo não dizer qual segredo conferiu.
    segredos.iter().fold(false, |achou, s| iguais(&marca(s, c, id_h, pd_h, dia), t) | achou)
}

#[cfg(test)]
mod testes {
    use super::*;

    #[test]
    fn a_marca_e_a_mesma_do_typescript() {
        // lib/rede/franquia/servidor.ts: marcaDoServidor(segredo, 32×0x01, 32×0x02, 32×0x03, "2026-11-25")
        let s = "segredo-da-franquia-de-teste-com-mais-de-32"; // gitleaks:allow (valor de teste)
        let t = marca(s, &[1u8; 32], &[2u8; 32], &[3u8; 32], "2026-11-25");
        let hex: String = t.iter().map(|b| format!("{b:02x}")).collect();
        assert_eq!(hex, "42516806d68641525d6a877a9f65a9e59f4a5033499a245eeda88a39ee3873a3");
        assert!(confere(&[s], &[1u8; 32], &[2u8; 32], &[3u8; 32], "2026-11-25", &t, "2026-11-26"));
        assert!(confere(
            &["outro-segredo-qualquer-com-mais-de-32-letras", s],
            &[1u8; 32],
            &[2u8; 32],
            &[3u8; 32],
            "2026-11-25",
            &t,
            "2026-11-26"
        ));
        assert!(!confere(&[s], &[1u8; 32], &[2u8; 32], &[4u8; 32], "2026-11-25", &t, "2026-11-26"), "outro passe");
        assert!(!confere(&[s], &[1u8; 32], &[2u8; 32], &[3u8; 32], "2026-11-25", &t, "2027-03-01"), "fora do prazo");
        assert!(!confere(&[s], &[1u8; 32], &[2u8; 32], &[3u8; 32], "2026-11-25", &t, "2026-11-24"), "no futuro");
    }
}
