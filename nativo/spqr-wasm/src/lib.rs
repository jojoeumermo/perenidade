// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O SPQR do Signal (crate `spqr` v1.7.0, AGPL-3.0-only) em funções C para WebAssembly, sem wasm-bindgen. Onda R3, item 1.1.
// Documento: docs/rede/CHAT-PRIVADO.md ("A camada pós-quântica"). Quem usa: lib/rede/chat/r3/spqr.ts.
//
// Nada de cifra aqui: só a cola entre os bytes do JavaScript e a API do `spqr` (initial_state, send, recv). O sorteio vem do
// `crypto.getRandomValues` do JavaScript (import `env.aleatorio`), por duas portas:
//   - o `getrandom` 0.3 (backend "custom": RUSTFLAGS='--cfg getrandom_backend="custom"'), que o spqr e o libcrux podem pedir;
//   - a semente de 32 bytes do `enviar`, sorteada pelo JavaScript, para o ChaCha20Rng que o `spqr::send` pede.
//
// Contrato com o JavaScript:
//   reservar(n) -> ponteiro       o JavaScript escreve a entrada ali e chama `soltar` depois (zerando antes)
//   inicial(direcao, chave, n)    direcao 0 = A2B (quem começa), 1 = B2A; chave = auth_key de 32 bytes  → saída: estado
//   enviar(estado, n, semente32)  → saída: [estado][mensagem][chave]       (cada campo: u32 little-endian + bytes)
//   receber(estado, n, msg, m)    → saída: [estado][chave]
//   saida_ptr(), saida_len()      a última saída (o JavaScript copia e chama `limpar`)
//   limpar()                      zera e solta a última saída (chaves e estados não ficam na memória do módulo)
// Retorno 0 = certo; -1 = o spqr recusou (estado ou mensagem inválida, versão abaixo da mínima, chave repetida, salto grande demais).
//
// Versão: V1 com mínima V1. Uma mensagem V0 (sem a parte pós-quântica) é recusada pelo próprio spqr (MinimumVersion): não há como
// "negociar para baixo".
use rand_chacha::ChaCha20Rng;
use rand_core::SeedableRng;

#[cfg(target_arch = "wasm32")]
#[link(wasm_import_module = "env")]
extern "C" {
    fn aleatorio(p: *mut u8, n: usize);
}

/// O backend "custom" do getrandom 0.3: o sorteio do sistema vem do `crypto.getRandomValues` do JavaScript.
#[cfg(target_arch = "wasm32")]
#[no_mangle]
unsafe extern "Rust" fn __getrandom_v03_custom(dest: *mut u8, len: usize) -> Result<(), getrandom::Error> {
    aleatorio(dest, len);
    Ok(())
}

#[no_mangle]
pub extern "C" fn reservar(n: usize) -> *mut u8 {
    let mut v = Vec::<u8>::with_capacity(n.max(1));
    let p = v.as_mut_ptr();
    std::mem::forget(v);
    p
}

/// # Safety
/// `p` tem de ter vindo de `reservar(n)` com o mesmo `n`, e não pode ser solto duas vezes.
#[no_mangle]
pub unsafe extern "C" fn soltar(p: *mut u8, n: usize) {
    drop(Vec::from_raw_parts(p, 0, n.max(1)));
}

static mut SAIDA: Vec<u8> = Vec::new();

/// # Safety
/// Só no fio único do WebAssembly.
#[no_mangle]
pub unsafe extern "C" fn saida_ptr() -> *const u8 {
    (*std::ptr::addr_of!(SAIDA)).as_ptr()
}

/// # Safety
/// Só no fio único do WebAssembly.
#[no_mangle]
pub unsafe extern "C" fn saida_len() -> usize {
    (*std::ptr::addr_of!(SAIDA)).len()
}

/// Zera a última saída (estado e chaves) e solta a memória dela.
///
/// # Safety
/// Só no fio único do WebAssembly.
#[no_mangle]
pub unsafe extern "C" fn limpar() {
    let s = &mut *std::ptr::addr_of_mut!(SAIDA);
    for b in s.iter_mut() {
        std::ptr::write_volatile(b, 0);
    }
    *s = Vec::new();
}

unsafe fn por(v: Vec<u8>) {
    limpar();
    *std::ptr::addr_of_mut!(SAIDA) = v;
}

fn campo(out: &mut Vec<u8>, b: &[u8]) {
    out.extend_from_slice(&(b.len() as u32).to_le_bytes());
    out.extend_from_slice(b);
}

unsafe fn fatia<'a>(p: *const u8, n: usize) -> &'a [u8] {
    if n == 0 {
        &[]
    } else {
        std::slice::from_raw_parts(p, n)
    }
}

/// O estado inicial de uma sessão: `direcao` 0 = A2B (quem começa a sessão), 1 = B2A.
///
/// # Safety
/// `chave` aponta para `n` bytes válidos.
#[no_mangle]
pub unsafe extern "C" fn inicial(direcao: u32, chave: *const u8, n: usize) -> i32 {
    if direcao > 1 || n != 32 {
        return -1;
    }
    let auth = fatia(chave, n);
    let p = spqr::Params {
        direction: if direcao == 0 { spqr::Direction::A2B } else { spqr::Direction::B2A },
        version: spqr::Version::V1,
        min_version: spqr::Version::V1,
        auth_key: auth,
        chain_params: spqr::ChainParams::default(),
    };
    match spqr::initial_state(p) {
        Ok(s) => {
            por(s);
            0
        }
        Err(_) => -1,
    }
}

/// Uma mensagem do SPQR: avança o estado e devolve [estado][mensagem][chave]. Chave vazia = erro (com mínima V1 sempre há chave).
///
/// # Safety
/// `e` aponta para `ne` bytes; `semente` para 32 bytes.
#[no_mangle]
pub unsafe extern "C" fn enviar(e: *const u8, ne: usize, semente: *const u8) -> i32 {
    let st = fatia(e, ne).to_vec();
    let mut s = [0u8; 32];
    s.copy_from_slice(fatia(semente, 32));
    let mut rng = ChaCha20Rng::from_seed(s);
    s.iter_mut().for_each(|b| std::ptr::write_volatile(b, 0));
    match spqr::send(&st, &mut rng) {
        Ok(r) => match r.key {
            Some(k) if !k.is_empty() => {
                let mut o = Vec::with_capacity(r.state.len() + r.msg.len() + k.len() + 12);
                campo(&mut o, &r.state);
                campo(&mut o, &r.msg);
                campo(&mut o, &k);
                por(o);
                0
            }
            _ => -1,
        },
        Err(_) => -1,
    }
}

/// Recebe uma mensagem do SPQR: devolve [estado][chave]. Chave vazia = erro.
///
/// # Safety
/// `e` aponta para `ne` bytes; `m` para `nm` bytes.
#[no_mangle]
pub unsafe extern "C" fn receber(e: *const u8, ne: usize, m: *const u8, nm: usize) -> i32 {
    let st = fatia(e, ne).to_vec();
    let msg = fatia(m, nm).to_vec();
    match spqr::recv(&st, &msg) {
        Ok(r) => match r.key {
            Some(k) if !k.is_empty() => {
                let mut o = Vec::with_capacity(r.state.len() + k.len() + 8);
                campo(&mut o, &r.state);
                campo(&mut o, &k);
                por(o);
                0
            }
            _ => -1,
        },
        Err(_) => -1,
    }
}

// ── Só no build de teste: o ML-KEM-768 do libcrux com sorteio dado (vetores do FIPS 203) ─────────────────────────────────────
#[cfg(feature = "teste")]
mod teste {
    use super::{campo, fatia, por};
    use libcrux_ml_kem::mlkem768;

    /// semente (64 bytes: d ‖ z) → [ek (1184)][dk (2400)]
    ///
    /// # Safety
    /// `s` aponta para 64 bytes.
    #[no_mangle]
    pub unsafe extern "C" fn mlkem_par(s: *const u8) -> i32 {
        let mut semente = [0u8; 64];
        semente.copy_from_slice(fatia(s, 64));
        let par = mlkem768::generate_key_pair(semente);
        let mut o = vec![];
        campo(&mut o, par.pk());
        campo(&mut o, par.sk());
        por(o);
        0
    }

    /// ek (1184) e m (32) → [ct (1088)][ss (32)]; ek inválido (falha na conferência do FIPS 203) = -1.
    ///
    /// # Safety
    /// `ek` aponta para `n` bytes; `m` para 32.
    #[no_mangle]
    pub unsafe extern "C" fn mlkem_encapsular(ek: *const u8, n: usize, m: *const u8) -> i32 {
        let Ok(arr) = <[u8; 1184]>::try_from(fatia(ek, n)) else { return -1 };
        let pk = mlkem768::MlKem768PublicKey::from(arr);
        if !mlkem768::validate_public_key(&pk) {
            return -1;
        }
        let mut r = [0u8; 32];
        r.copy_from_slice(fatia(m, 32));
        let (ct, ss) = mlkem768::encapsulate(&pk, r);
        let mut o = vec![];
        campo(&mut o, ct.as_ref());
        campo(&mut o, ss.as_ref());
        por(o);
        0
    }

    /// dk (2400) e ct (1088) → [ss (32)]
    ///
    /// # Safety
    /// `dk` aponta para `nd` bytes; `ct` para `nc`.
    #[no_mangle]
    pub unsafe extern "C" fn mlkem_decapsular(dk: *const u8, nd: usize, ct: *const u8, nc: usize) -> i32 {
        let Ok(d) = <[u8; 2400]>::try_from(fatia(dk, nd)) else { return -1 };
        let Ok(c) = <[u8; 1088]>::try_from(fatia(ct, nc)) else { return -1 };
        let ss = mlkem768::decapsulate(&mlkem768::MlKem768PrivateKey::from(d), &mlkem768::MlKem768Ciphertext::from(c));
        let mut o = vec![];
        campo(&mut o, ss.as_ref());
        por(o);
        0
    }
}

#[cfg(test)]
mod testes {
    use rand_chacha::ChaCha20Rng;
    use rand_core::SeedableRng;

    fn par(auth: &[u8]) -> (Vec<u8>, Vec<u8>) {
        let p = |d| spqr::Params { direction: d, version: spqr::Version::V1, min_version: spqr::Version::V1, auth_key: auth, chain_params: spqr::ChainParams::default() };
        (spqr::initial_state(p(spqr::Direction::A2B)).unwrap(), spqr::initial_state(p(spqr::Direction::B2A)).unwrap())
    }

    #[test]
    fn ida_e_volta_da_as_mesmas_chaves() {
        let (mut a, mut b) = par(&[7u8; 32]);
        let mut rng = ChaCha20Rng::from_seed([1u8; 32]);
        for _ in 0..200 {
            let s = spqr::send(&a, &mut rng).unwrap();
            a = s.state;
            let r = spqr::recv(&b, &s.msg).unwrap();
            b = r.state;
            assert_eq!(s.key, r.key);
            assert!(s.key.is_some());
            std::mem::swap(&mut a, &mut b);
        }
    }

    #[test]
    fn mensagem_repetida_nao_da_a_chave_de_novo() {
        let (a, b) = par(&[9u8; 32]);
        let mut rng = ChaCha20Rng::from_seed([2u8; 32]);
        let s = spqr::send(&a, &mut rng).unwrap();
        let r = spqr::recv(&b, &s.msg).unwrap();
        assert!(spqr::recv(&r.state, &s.msg).map(|x| x.key.is_none()).unwrap_or(true));
    }
}
