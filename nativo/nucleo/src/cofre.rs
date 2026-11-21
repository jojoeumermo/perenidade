// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O cofre do app no computador (onda R3, itens 1.2 e 2.3). O chat guarda as suas chaves cifradas na loja do aparelho (como no
// site); aqui mora a chave que EMBRULHA essas chaves: 32 bytes sorteados pelo sistema operacional na primeira vez e guardados no
// chaveiro do sistema (Credential Manager no Windows, Keychain no macOS, Secret Service no Linux), nunca num arquivo do app.
//
// Formato do embrulho: 0x01 ‖ nonce(12) ‖ AES-256-GCM(chave, dados, aad = "alumia/r3/cofre-computador/v1" ‖ 0x00 ‖ finalidade).
// A finalidade entra como dado associado: o embrulho de uma finalidade não abre como outra. AES-256-GCM é o da RustCrypto
// (`aes-gcm`); o nonce é sorteado pelo sistema (getrandom) a cada embrulho.
//
// Limites, ditos sem rodeio: o chaveiro do sistema NÃO é um cofre de hardware como o StrongBox do Android. No Windows a chave fica
// protegida pela conta do usuário (DPAPI): outro programa rodando como a mesma pessoa consegue pedi-la. Com o app aberto e
// desbloqueado, a chave está na memória. O que o cofre dá: a chave não fica em arquivo do app, não vai para cópia de pasta nem
// para outro computador, e "apagar tudo" a remove.
use aes_gcm::aead::{Aead, KeyInit, OsRng, Payload};
use aes_gcm::{AeadCore, Aes256Gcm, Key, Nonce};
use zeroize::Zeroizing;

use crate::Erro;

const VERSAO: u8 = 0x01;
const ROTULO: &[u8] = b"alumia/r3/cofre-computador/v1";
const SERVICO: &str = "org.institutolucia.alumia";
const CONTA: &str = "cofre-v1";
const MAXIMO: usize = 1 << 20;

/// Onde a chave do cofre mora. O do sistema em uso; o da memória só nos testes (o CI não tem chaveiro).
pub trait Chaveiro {
    fn ler(&self) -> Result<Option<Zeroizing<Vec<u8>>>, Erro>;
    fn gravar(&self, chave: &[u8]) -> Result<(), Erro>;
    fn apagar(&self) -> Result<(), Erro>;
}

/// O chaveiro do sistema operacional.
pub struct ChaveiroDoSistema;

impl ChaveiroDoSistema {
    fn entrada() -> Result<keyring::Entry, Erro> {
        keyring::Entry::new(SERVICO, CONTA).map_err(|_| Erro::Chaveiro)
    }
}

impl Chaveiro for ChaveiroDoSistema {
    fn ler(&self) -> Result<Option<Zeroizing<Vec<u8>>>, Erro> {
        match Self::entrada()?.get_secret() {
            Ok(s) => Ok(Some(Zeroizing::new(s))),
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(_) => Err(Erro::Chaveiro),
        }
    }
    fn gravar(&self, chave: &[u8]) -> Result<(), Erro> {
        Self::entrada()?.set_secret(chave).map_err(|_| Erro::Chaveiro)
    }
    fn apagar(&self) -> Result<(), Erro> {
        match Self::entrada()?.delete_credential() {
            Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
            Err(_) => Err(Erro::Chaveiro),
        }
    }
}

/// Um chaveiro só na memória (testes).
#[derive(Default)]
pub struct ChaveiroNaMemoria(std::sync::Mutex<Option<Vec<u8>>>);

impl Chaveiro for ChaveiroNaMemoria {
    fn ler(&self) -> Result<Option<Zeroizing<Vec<u8>>>, Erro> {
        Ok(self.0.lock().map_err(|_| Erro::Chaveiro)?.clone().map(Zeroizing::new))
    }
    fn gravar(&self, chave: &[u8]) -> Result<(), Erro> {
        *self.0.lock().map_err(|_| Erro::Chaveiro)? = Some(chave.to_vec());
        Ok(())
    }
    fn apagar(&self) -> Result<(), Erro> {
        *self.0.lock().map_err(|_| Erro::Chaveiro)? = None;
        Ok(())
    }
}

fn finalidade_valida(f: &str) -> bool {
    !f.is_empty() && f.len() <= 64 && f.bytes().all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b"-_.:/".contains(&b))
}

fn aad(finalidade: &str) -> Vec<u8> {
    [ROTULO, &[0u8], finalidade.as_bytes()].concat()
}

/// A chave do cofre; cria (sorteada pelo sistema) se ainda não existe. Chave com tamanho errado no chaveiro = erro (nunca troca
/// sozinha uma chave que pode estar embrulhando dados).
fn chave(c: &dyn Chaveiro, criar: bool) -> Result<Option<Zeroizing<Vec<u8>>>, Erro> {
    match c.ler()? {
        Some(k) if k.len() == 32 => Ok(Some(k)),
        Some(_) => Err(Erro::Chaveiro),
        None if criar => {
            let nova = Zeroizing::new(Aes256Gcm::generate_key(OsRng).to_vec());
            c.gravar(&nova)?;
            Ok(Some(nova))
        }
        None => Ok(None),
    }
}

/// Embrulha `dados` para `finalidade` com a chave do cofre de `c`.
pub fn embrulhar_com(c: &dyn Chaveiro, finalidade: &str, dados: &[u8]) -> Result<Vec<u8>, Erro> {
    if !finalidade_valida(finalidade) {
        return Err(Erro::Finalidade);
    }
    if dados.len() > MAXIMO {
        return Err(Erro::Tamanho);
    }
    let k = chave(c, true)?.ok_or(Erro::Chaveiro)?;
    let cifra = Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(&k));
    let nonce = Aes256Gcm::generate_nonce(&mut OsRng);
    let aad = aad(finalidade);
    let cifrado = cifra.encrypt(&nonce, Payload { msg: dados, aad: &aad }).map_err(|_| Erro::Tamanho)?;
    let mut saida = Vec::with_capacity(1 + 12 + cifrado.len());
    saida.push(VERSAO);
    saida.extend_from_slice(&nonce);
    saida.extend_from_slice(&cifrado);
    Ok(saida)
}

/// Desembrulha; `None` se o embrulho foi mexido, é de outra finalidade, de outra chave (outro computador, ou a chave foi apagada).
pub fn desembrulhar_com(c: &dyn Chaveiro, finalidade: &str, embrulhado: &[u8]) -> Result<Option<Vec<u8>>, Erro> {
    if !finalidade_valida(finalidade) {
        return Err(Erro::Finalidade);
    }
    if embrulhado.len() < 1 + 12 + 16 || embrulhado.len() > MAXIMO + 64 || embrulhado[0] != VERSAO {
        return Ok(None);
    }
    let Some(k) = chave(c, false)? else { return Ok(None) };
    let cifra = Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(&k));
    let nonce = Nonce::from_slice(&embrulhado[1..13]);
    let aad = aad(finalidade);
    Ok(cifra.decrypt(nonce, Payload { msg: &embrulhado[13..], aad: &aad }).ok())
}

/// Apaga a chave do cofre: tudo o que ela embrulhou deixa de abrir (o "apagar tudo" e as senhas erradas).
pub fn apagar_com(c: &dyn Chaveiro) -> Result<(), Erro> {
    c.apagar()
}

/// O contrato do desenho (seção 4.4), com o chaveiro do sistema.
pub fn embrulhar(finalidade: &str, dados: &[u8]) -> Result<Vec<u8>, Erro> {
    embrulhar_com(&ChaveiroDoSistema, finalidade, dados)
}

/// O contrato do desenho (seção 4.4), com o chaveiro do sistema.
pub fn desembrulhar(finalidade: &str, embrulhado: &[u8]) -> Result<Option<Vec<u8>>, Erro> {
    desembrulhar_com(&ChaveiroDoSistema, finalidade, embrulhado)
}

#[cfg(test)]
mod testes {
    use super::*;
    use proptest::prelude::*;

    #[test]
    fn ida_e_volta() {
        let c = ChaveiroNaMemoria::default();
        let e = embrulhar_com(&c, "chat:loja", b"segredo").unwrap();
        assert_eq!(desembrulhar_com(&c, "chat:loja", &e).unwrap().as_deref(), Some(&b"segredo"[..]));
    }

    #[test]
    fn outra_finalidade_nao_abre() {
        let c = ChaveiroNaMemoria::default();
        let e = embrulhar_com(&c, "chat:loja", b"segredo").unwrap();
        assert_eq!(desembrulhar_com(&c, "chat:sessao", &e).unwrap(), None);
    }

    #[test]
    fn outra_chave_nao_abre_e_apagar_mata_tudo() {
        let (a, b) = (ChaveiroNaMemoria::default(), ChaveiroNaMemoria::default());
        let e = embrulhar_com(&a, "x", b"segredo").unwrap();
        embrulhar_com(&b, "x", b"outro").unwrap();
        assert_eq!(desembrulhar_com(&b, "x", &e).unwrap(), None);
        apagar_com(&a).unwrap();
        assert_eq!(desembrulhar_com(&a, "x", &e).unwrap(), None);
    }

    #[test]
    fn nonce_novo_a_cada_embrulho() {
        let c = ChaveiroNaMemoria::default();
        assert_ne!(embrulhar_com(&c, "x", b"igual").unwrap(), embrulhar_com(&c, "x", b"igual").unwrap());
    }

    #[test]
    fn chave_de_tamanho_errado_e_erro_e_nao_e_trocada() {
        let c = ChaveiroNaMemoria::default();
        c.gravar(&[1u8; 16]).unwrap();
        assert!(embrulhar_com(&c, "x", b"a").is_err());
        assert_eq!(c.ler().unwrap().unwrap().len(), 16);
    }

    #[test]
    fn finalidade_e_tamanho() {
        let c = ChaveiroNaMemoria::default();
        for f in ["", "Maiuscula", "com espaço", &"a".repeat(65)] {
            assert!(embrulhar_com(&c, f, b"a").is_err(), "{f}");
        }
        assert!(embrulhar_com(&c, "x", &vec![0u8; MAXIMO + 1]).is_err());
    }

    proptest! {
        #[test]
        fn decifrar_de_cifrar_e_identidade(dados in proptest::collection::vec(any::<u8>(), 0..2048)) {
            let c = ChaveiroNaMemoria::default();
            let e = embrulhar_com(&c, "p", &dados).unwrap();
            prop_assert_eq!(desembrulhar_com(&c, "p", &e).unwrap(), Some(dados));
        }

        #[test]
        fn qualquer_byte_mexido_nao_abre(dados in proptest::collection::vec(any::<u8>(), 1..256), i in any::<prop::sample::Index>(), x in 1u8..=255) {
            let c = ChaveiroNaMemoria::default();
            let mut e = embrulhar_com(&c, "p", &dados).unwrap();
            let j = i.index(e.len());
            e[j] ^= x;
            prop_assert_eq!(desembrulhar_com(&c, "p", &e).unwrap(), None);
        }

        #[test]
        fn lixo_nunca_derruba(lixo in proptest::collection::vec(any::<u8>(), 0..512)) {
            let c = ChaveiroNaMemoria::default();
            embrulhar_com(&c, "p", b"a").unwrap();
            prop_assert!(desembrulhar_com(&c, "p", &lixo).is_ok());
        }
    }
}
