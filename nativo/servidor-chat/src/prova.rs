// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A prova de trabalho, sem estado: desafio = minuto (u32) ‖ 16 bytes sorteados ‖ HMAC-SHA-256 (chave tirada do segredo do servidor do
// chat) sobre os dois. Vale 10 minutos; o resumo do desafio usado vai para chat.passes_gastos no mesmo lote (usado de novo, recusado).
// A resposta é um nonce de 8 bytes tal que SHA-256(desafio ‖ nonce) comece por `bits` bits zero (o mesmo de lib/rede/caixas/prova.ts).
//
// Serve a dois casos: o pedido de conversa de quem tem passe (passe + 20 bits, como na R2) e quem vem de OUTRA instância (item 2.7),
// que não tem passe daqui (o passe diria de qual instância a pessoa vem): só a prova, com mais bits (22 por padrão, CHAT_BITS_DE_FORA).

use crate::cripto::{hkdf32, hmac_sha256, iguais, resumo, sha256, sortear};

pub const TAMANHO_DO_DESAFIO: usize = 52;
pub const TAMANHO_DO_NONCE: usize = 8;
pub const BITS_COM_PASSE: u32 = 20;
const VALIDADE_MIN: i64 = 10;

pub struct Provas {
    chave: [u8; 32],
}

impl Provas {
    pub fn nova(segredo: &str) -> Self {
        Provas { chave: hkdf32(segredo.as_bytes(), b"alumia/r3/instancias/desafio/v1") }
    }

    /// Um desafio novo, do minuto de `agora` (segundos).
    pub fn emitir(&self, agora: i64) -> Vec<u8> {
        let mut corpo = Vec::with_capacity(TAMANHO_DO_DESAFIO);
        corpo.extend_from_slice(&((agora / 60) as u32).to_be_bytes());
        corpo.extend_from_slice(&sortear(16));
        let etiqueta = hmac_sha256(&self.chave, &[b"alumia/r3/instancias/desafio/v1", &corpo]);
        corpo.extend_from_slice(&etiqueta);
        corpo
    }

    /// Confere: é nosso (HMAC, tempo constante), está no prazo e o resumo tem `bits` zeros no começo. Devolve o resumo a gastar.
    pub fn conferir(&self, desafio: &[u8], nonce: &[u8], bits: u32, agora: i64) -> Option<[u8; 32]> {
        if desafio.len() != TAMANHO_DO_DESAFIO || nonce.len() != TAMANHO_DO_NONCE {
            return None;
        }
        let esperado = hmac_sha256(&self.chave, &[b"alumia/r3/instancias/desafio/v1", &desafio[..20]]);
        if !iguais(&esperado, &desafio[20..]) {
            return None;
        }
        let minuto = u32::from_be_bytes([desafio[0], desafio[1], desafio[2], desafio[3]]) as i64;
        let idade = agora / 60 - minuto;
        if !(0..=VALIDADE_MIN).contains(&idade) {
            return None;
        }
        if !zeros_no_comeco(&sha256(&[desafio, nonce]), bits) {
            return None;
        }
        Some(resumo("alumia/r2/pedido/gasto/v1", desafio))
    }
}

/// Os primeiros `bits` bits são zero?
pub fn zeros_no_comeco(h: &[u8], bits: u32) -> bool {
    let inteiros = (bits / 8) as usize;
    if h.len() < inteiros + 1 || h[..inteiros].iter().any(|b| *b != 0) {
        return false;
    }
    let resto = bits % 8;
    resto == 0 || h[inteiros] >> (8 - resto) == 0
}

#[cfg(test)]
mod testes {
    use super::*;

    fn resolver(p: &Provas, d: &[u8], bits: u32, agora: i64) -> Vec<u8> {
        for n in 0u64.. {
            let nonce = n.to_be_bytes();
            if p.conferir(d, &nonce, bits, agora).is_some() {
                return nonce.to_vec();
            }
        }
        unreachable!()
    }

    #[test]
    fn prova_de_trabalho() {
        let p = Provas::nova("segredo-de-teste-com-mais-de-32-letras-aqui"); // gitleaks:allow (valor de teste)
        let agora = 1_795_564_800;
        let d = p.emitir(agora);
        let nonce = resolver(&p, &d, 12, agora);
        assert!(p.conferir(&d, &nonce, 12, agora).is_some());
        assert!(p.conferir(&d, &nonce, 12, agora + 11 * 60).is_none(), "vencido");
        assert!(p.conferir(&d, &nonce, 12, agora - 60).is_none(), "do futuro");
        let mut torto = d.clone();
        torto[5] ^= 1;
        assert!(p.conferir(&torto, &nonce, 12, agora).is_none(), "desafio que não é nosso");
        let outro = Provas::nova("outro-segredo-de-teste-com-mais-de-32-letras"); // gitleaks:allow (valor de teste)
        assert!(outro.conferir(&d, &nonce, 12, agora).is_none(), "de outro servidor");
        assert!(zeros_no_comeco(&[0, 0, 0x3f], 18));
        assert!(!zeros_no_comeco(&[0, 0, 0x40], 18));
    }
}
