// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Atualizações do app do computador (onda R3, item 2.4): o app RECUSA o que não estiver no livro público do Sigstore (Rekor).
//
// Fluxo: a casca pede a versão nova; o nativo baixa o instalador da plataforma e o pacote Sigstore dele do lançamento do GitHub
// da tag v<versao> (só HTTPS, só esses dois servidores); confere no `alumia_nucleo::transparencia` com a identidade do fluxo de
// lançamento NAQUELA tag; só então grava o instalador numa pasta temporária e o abre (o sistema pede a confirmação de sempre).
// Fora do livro, nada é gravado nem aberto, e a casca mostra por quê.
//
// Ao abrir, o app confere a si mesmo: o resumo do próprio executável contra o pacote do executável da versão compilada. Fora do livro
// (binário trocado, ou instalado de outro lugar) = o chat não abre (a casca decide pela resposta "fora_do_log").
//
// Não usamos o tauri-plugin-updater: ele exige uma chave de assinatura própria (minisign) guardada no CI, e o desenho da R3 é
// "sem chave para guardar" (Sigstore keyless). Público em docs/BUILD-REPRODUZIVEL.md.
use alumia_nucleo::identidade::identidade_da_versao;
use alumia_nucleo::identidade::REPOSITORIO;
use alumia_nucleo::transparencia::conferir_no_log;

/// O que a casca recebe.
#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "snake_case")]
pub enum Resultado {
    NoLog,
    ForaDoLog,
    SemRede,
}

/// Os tamanhos máximos que o app aceita baixar.
pub const LIMITE_DO_PACOTE: usize = 256 * 1024;
pub const LIMITE_DO_INSTALADOR: usize = 512 * 1024 * 1024;

/// Por que um arquivo do lançamento não veio.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Falha {
    /// Não deu para perguntar (sem rede, servidor fora do ar, resposta grande demais): não se sabe se está no livro.
    SemRede,
    /// O GitHub respondeu, pelo TLS, que o arquivo não existe (404/410): não há pacote publicado para esta versão, logo ela NÃO
    /// está no livro. Antes isto virava "sem rede" e um executável de uma versão nunca lançada passava por "não deu para conferir".
    NaoPublicado,
}

impl Falha {
    fn resultado(self) -> Resultado {
        match self {
            Falha::SemRede => Resultado::SemRede,
            Falha::NaoPublicado => Resultado::ForaDoLog,
        }
    }
}

/// Quem baixa (o de verdade usa reqwest; os testes, bytes fixos).
pub trait Baixador {
    fn baixar(&self, endereco: &str, limite: usize) -> Result<Vec<u8>, Falha>;
}

/// A plataforma deste executável, como aparece no nome dos arquivos do lançamento.
pub fn alvo() -> &'static str {
    if cfg!(all(target_os = "windows", target_arch = "x86_64")) {
        "windows-x64"
    } else if cfg!(all(target_os = "macos", target_arch = "aarch64")) {
        "macos-arm64"
    } else if cfg!(all(target_os = "macos", target_arch = "x86_64")) {
        "macos-x64"
    } else if cfg!(all(target_os = "linux", target_arch = "x86_64")) {
        "linux-x64"
    } else {
        "desconhecido"
    }
}

/// O nome do instalador no lançamento.
pub fn nome_do_instalador(versao: &str, alvo: &str) -> String {
    match alvo {
        "windows-x64" => format!("alumia-{versao}-{alvo}-setup.exe"),
        "linux-x64" => format!("alumia-{versao}-{alvo}.AppImage"),
        _ => format!("alumia-{versao}-{alvo}.dmg"),
    }
}

/// O nome do executável de dentro do instalador, publicado à parte para o app conferir a si mesmo.
pub fn nome_do_executavel(versao: &str, alvo: &str) -> String {
    if alvo.starts_with("windows") {
        format!("alumia-{versao}-{alvo}-executavel.exe")
    } else {
        format!("alumia-{versao}-{alvo}-executavel")
    }
}

/// Endereço de um arquivo do lançamento da tag v<versao>.
pub fn endereco(versao: &str, nome: &str) -> String {
    format!("https://github.com/{REPOSITORIO}/releases/download/v{versao}/{nome}")
}

/// A conferência de um arquivo baixado contra o pacote dele, com a identidade do fluxo de lançamento na tag `versao`.
pub fn conferir_baixado(arquivo: &[u8], pacote: &[u8], versao: &str) -> Resultado {
    let Some(identidade) = identidade_da_versao(versao) else { return Resultado::ForaDoLog };
    match conferir_no_log(arquivo, pacote, &identidade) {
        Ok(true) => Resultado::NoLog,
        _ => Resultado::ForaDoLog,
    }
}

/// O app confere a si mesmo: o executável que está rodando (`proprio`) é o da versão `versao` registrada no livro?
pub fn conferir_instalado(b: &dyn Baixador, versao: &str, proprio: &[u8]) -> Resultado {
    if identidade_da_versao(versao).is_none() {
        return Resultado::ForaDoLog;
    }
    let nome = nome_do_executavel(versao, alvo());
    match b.baixar(&endereco(versao, &format!("{nome}.sigstore.json")), LIMITE_DO_PACOTE) {
        Ok(pacote) => conferir_baixado(proprio, &pacote, versao),
        Err(f) => f.resultado(),
    }
}

/// `versao` é MAIS NOVA que `atual`? As duas no formato do lançamento (três números, "1.2.3"); qualquer outra coisa é "não".
pub fn mais_nova(versao: &str, atual: &str) -> bool {
    fn numeros(v: &str) -> Option<[u64; 3]> {
        let mut p = v.split('.');
        let r = [p.next()?.parse().ok()?, p.next()?.parse().ok()?, p.next()?.parse().ok()?];
        if p.next().is_some() {
            return None;
        }
        Some(r)
    }
    matches!((numeros(versao), numeros(atual)), (Some(v), Some(a)) if v > a)
}

/// Baixa e confere o instalador da versão `versao`. `Ok(bytes)` SÓ quando está no livro E é mais nova que a compilada (`crate::VERSAO`);
/// o resto não sai daqui. O livro prova a origem, não a frescura: sem a comparação, quem rodasse código na casca mandaria "atualizar"
/// para uma versão antiga, assinada e no livro, mas com falha conhecida (auditoria interna da R3).
pub fn baixar_conferido(b: &dyn Baixador, versao: &str) -> Result<(String, Vec<u8>), Resultado> {
    baixar_conferido_desde(b, versao, crate::VERSAO)
}

/// O mesmo, com a versão instalada dada (os testes).
pub fn baixar_conferido_desde(b: &dyn Baixador, versao: &str, atual: &str) -> Result<(String, Vec<u8>), Resultado> {
    if identidade_da_versao(versao).is_none() || !mais_nova(versao, atual) {
        return Err(Resultado::ForaDoLog);
    }
    let nome = nome_do_instalador(versao, alvo());
    let pacote = b.baixar(&endereco(versao, &format!("{nome}.sigstore.json")), LIMITE_DO_PACOTE).map_err(Falha::resultado)?;
    let instalador = b.baixar(&endereco(versao, &nome), LIMITE_DO_INSTALADOR).map_err(Falha::resultado)?;
    match conferir_baixado(&instalador, &pacote, versao) {
        Resultado::NoLog => Ok((nome, instalador)),
        r => Err(r),
    }
}

/// O que a resposta final diz. Só um 404/410 do PRÓPRIO servidor do lançamento (depois dos redirecionamentos permitidos) quer dizer
/// "não publicado"; qualquer outra coisa que não seja 200 é "não deu para conferir" (um 404 de um servidor fora da lista nem chega
/// aqui: o redirecionamento para ele é parado e a resposta é o 3xx).
pub fn falha_pela_resposta(final_: &url::Url, status: u16) -> Option<Falha> {
    match status {
        200..=299 => None,
        404 | 410 if servidor_permitido(final_) => Some(Falha::NaoPublicado),
        _ => Some(Falha::SemRede),
    }
}

/// O baixador de verdade: só HTTPS, só github.com e o servidor de arquivos dele (os redirecionamentos do lançamento), sem cookie.
pub struct BaixadorHttps(reqwest::blocking::Client);

/// Os únicos servidores de onde o app baixa atualização.
pub fn servidor_permitido(u: &url::Url) -> bool {
    u.scheme() == "https"
        && matches!(u.host_str(), Some("github.com") | Some("objects.githubusercontent.com") | Some("release-assets.githubusercontent.com"))
}

impl BaixadorHttps {
    pub fn novo() -> Option<Self> {
        let politica = reqwest::redirect::Policy::custom(|tentativa| {
            if tentativa.previous().len() > 5 || !servidor_permitido(tentativa.url()) {
                tentativa.stop()
            } else {
                tentativa.follow()
            }
        });
        reqwest::blocking::Client::builder()
            .https_only(true)
            .redirect(politica)
            .user_agent("alumia/1")
            .timeout(std::time::Duration::from_secs(120))
            .build()
            .ok()
            .map(Self)
    }
}

impl Baixador for BaixadorHttps {
    fn baixar(&self, endereco: &str, limite: usize) -> Result<Vec<u8>, Falha> {
        let u = url::Url::parse(endereco).map_err(|_| Falha::SemRede)?;
        if !servidor_permitido(&u) {
            return Err(Falha::SemRede);
        }
        let mut r = self.0.get(u).send().map_err(|_| Falha::SemRede)?;
        if let Some(f) = falha_pela_resposta(r.url(), r.status().as_u16()) {
            return Err(f);
        }
        if r.content_length().is_some_and(|n| n as usize > limite) {
            return Err(Falha::SemRede);
        }
        let mut saida = Vec::new();
        let mut pedaco = [0u8; 64 * 1024];
        loop {
            let n = std::io::Read::read(&mut r, &mut pedaco).map_err(|_| Falha::SemRede)?;
            if n == 0 {
                break;
            }
            if saida.len() + n > limite {
                return Err(Falha::SemRede);
            }
            saida.extend_from_slice(&pedaco[..n]);
        }
        Ok(saida)
    }
}

/// Cria uma pasta NOVA dentro de `base` para o instalador: `create_dir` (falha se já existe: ninguém a cria antes para trocar o arquivo)
/// e, no Linux e no macOS, só para este usuário (0700). O nome leva o processo e a hora; se já existir, tenta outro nome, e nunca
/// usa uma que já estava lá.
pub fn pasta_nova(base: &std::path::Path) -> std::io::Result<std::path::PathBuf> {
    #[cfg(unix)]
    let construtor = {
        use std::os::unix::fs::DirBuilderExt;
        let mut c = std::fs::DirBuilder::new();
        c.mode(0o700);
        c
    };
    #[cfg(not(unix))]
    let construtor = std::fs::DirBuilder::new();
    let agora = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_nanos()).unwrap_or(0);
    let mut ultimo = None;
    for tentativa in 0..8u32 {
        let pasta = base.join(format!("alumia-atualizacao-{}-{agora}-{tentativa}", std::process::id()));
        match construtor.create(&pasta) {
            Ok(()) => return Ok(pasta),
            Err(e) => ultimo = Some(e),
        }
    }
    Err(ultimo.unwrap_or_else(|| std::io::Error::other("pasta")))
}

#[cfg(test)]
mod testes {
    use super::*;
    use std::collections::HashMap;
    use std::sync::Mutex;

    /// Um "lançamento" falso: o que o servidor devolveria em cada endereço. Guarda o que foi pedido.
    /// O que falta no mapa volta como "sem rede" (servidor fora do ar).
    struct Falso(HashMap<String, Vec<u8>>, Mutex<Vec<String>>);
    impl Baixador for Falso {
        fn baixar(&self, endereco: &str, limite: usize) -> Result<Vec<u8>, Falha> {
            self.1.lock().unwrap().push(endereco.to_string());
            match self.0.get(endereco) {
                Some(b) if b.len() <= limite => Ok(b.clone()),
                _ => Err(Falha::SemRede),
            }
        }
    }

    /// O GitHub no ar, sem nada publicado: tudo é 404.
    struct NadaPublicado;
    impl Baixador for NadaPublicado {
        fn baixar(&self, _: &str, _: usize) -> Result<Vec<u8>, Falha> {
            Err(Falha::NaoPublicado)
        }
    }

    const PACOTE_REAL: &[u8] = include_bytes!("../../../scripts/vetores/sigstore/pacote-positivo.json");
    const ARQUIVO_REAL: &[u8] = include_bytes!("../../../scripts/vetores/sigstore/sigstore-4.5.1-py3-none-any.whl");

    fn lancamento(versao: &str, instalador: &[u8], pacote: &[u8]) -> Falso {
        let nome = nome_do_instalador(versao, alvo());
        let mut m = HashMap::new();
        m.insert(endereco(versao, &nome), instalador.to_vec());
        m.insert(endereco(versao, &format!("{nome}.sigstore.json")), pacote.to_vec());
        Falso(m, Mutex::new(Vec::new()))
    }

    /// O aceite: "um binário fora do log é recusado". Um instalador adulterado com o pacote de verdade de outra coisa, um instalador
    /// com um pacote real mas de outra identidade (outro projeto), e um pacote que nunca foi ao livro: nenhum sai de
    /// `baixar_conferido`, logo nenhum é gravado nem aberto.
    #[test]
    fn binario_fora_do_log_e_recusado() {
        let l = lancamento("1.0.0", b"instalador-adulterado", PACOTE_REAL);
        assert_eq!(baixar_conferido(&l, "1.0.0").unwrap_err(), Resultado::ForaDoLog);
        // Arquivo e pacote reais e casados, mas assinados por OUTRO fluxo (sigstore-python), não pelo nosso na tag v1.0.0.
        let l = lancamento("1.0.0", ARQUIVO_REAL, PACOTE_REAL);
        assert_eq!(baixar_conferido(&l, "1.0.0").unwrap_err(), Resultado::ForaDoLog);
        let l = lancamento("1.0.0", ARQUIVO_REAL, br#"{"mediaType":"application/vnd.dev.sigstore.bundle.v0.3+json"}"#);
        assert_eq!(baixar_conferido(&l, "1.0.0").unwrap_err(), Resultado::ForaDoLog);
    }

    #[test]
    fn versao_fora_do_formato_nem_baixa() {
        let l = lancamento("1.0.0", ARQUIVO_REAL, PACOTE_REAL);
        for v in ["1.0", "1.0.0/../../x", "latest", ""] {
            assert_eq!(baixar_conferido(&l, v).unwrap_err(), Resultado::ForaDoLog);
        }
        assert!(l.1.lock().unwrap().is_empty(), "nada foi baixado");
    }

    /// Ataque (auditoria interna da R3): a pasta do instalador que já existia (criada antes por outro usuário) nunca é usada.
    #[test]
    fn pasta_que_ja_existia_nao_e_usada() {
        let base = std::env::temp_dir().join(format!("alumia-teste-pasta-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&base);
        std::fs::create_dir(&base).unwrap();
        let a = pasta_nova(&base).unwrap();
        let b = pasta_nova(&base).unwrap();
        assert_ne!(a, b, "duas chamadas, duas pastas novas");
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            assert_eq!(std::fs::metadata(&a).unwrap().permissions().mode() & 0o777, 0o700);
        }
        assert!(std::fs::DirBuilder::new().create(&a).is_err(), "create_dir recusa a que já existe");
        std::fs::remove_dir_all(&base).unwrap();
    }

    /// Ataque (auditoria interna da R3): "atualizar" para uma versão igual ou mais velha que a instalada é recusado antes de baixar.
    #[test]
    fn versao_velha_ou_igual_nem_baixa() {
        let l = lancamento("1.0.0", ARQUIVO_REAL, PACOTE_REAL);
        for (v, atual) in [("1.0.0", "1.0.0"), ("1.0.0", "1.0.1"), ("1.0.0", "2.0.0"), ("1.9.9", "1.10.0")] {
            assert_eq!(baixar_conferido_desde(&l, v, atual).unwrap_err(), Resultado::ForaDoLog, "{v} sobre {atual}");
        }
        assert!(l.1.lock().unwrap().is_empty(), "nada foi baixado");
        assert!(
            mais_nova("1.10.0", "1.9.9") && mais_nova("2.0.0", "1.99.99") && !mais_nova("1.0", "0.1.0") && !mais_nova("1.0.0-rc1", "0.1.0")
        );
    }

    #[test]
    fn sem_rede_e_sem_rede() {
        let vazio = Falso(HashMap::new(), Mutex::new(Vec::new()));
        assert_eq!(baixar_conferido(&vazio, "1.0.0").unwrap_err(), Resultado::SemRede);
        assert_eq!(conferir_instalado(&vazio, "1.0.0", b"eu"), Resultado::SemRede);
    }

    /// Ataque: um executável que diz ser de uma versão nunca lançada (ou de um lançamento sem pacote). Antes, o 404 virava "sem
    /// rede" e a casca podia seguir por "não deu para conferir"; agora é "fora do log".
    #[test]
    fn versao_nunca_lancada_e_fora_do_log() {
        assert_eq!(conferir_instalado(&NadaPublicado, "77.0.0", b"eu"), Resultado::ForaDoLog);
        assert_eq!(baixar_conferido(&NadaPublicado, "77.0.0").unwrap_err(), Resultado::ForaDoLog);
    }

    #[test]
    fn so_o_404_do_lancamento_e_nao_publicado() {
        let gh = url::Url::parse("https://github.com/a/b/releases/download/v1/x").unwrap();
        let fora = url::Url::parse("https://mal.example/x").unwrap();
        assert_eq!(falha_pela_resposta(&gh, 200), None);
        assert_eq!(falha_pela_resposta(&gh, 404), Some(Falha::NaoPublicado));
        assert_eq!(falha_pela_resposta(&gh, 410), Some(Falha::NaoPublicado));
        for s in [302, 403, 429, 500, 503] {
            assert_eq!(falha_pela_resposta(&gh, s), Some(Falha::SemRede), "{s}");
        }
        assert_eq!(falha_pela_resposta(&fora, 404), Some(Falha::SemRede));
    }

    #[test]
    fn executavel_trocado_e_fora_do_log() {
        let nome = nome_do_executavel("1.0.0", alvo());
        let mut m = HashMap::new();
        m.insert(endereco("1.0.0", &format!("{nome}.sigstore.json")), PACOTE_REAL.to_vec());
        let l = Falso(m, Mutex::new(Vec::new()));
        assert_eq!(conferir_instalado(&l, "1.0.0", b"executavel-trocado"), Resultado::ForaDoLog);
    }

    #[test]
    fn conferencia_positiva_com_a_identidade_certa() {
        // O mesmo caminho de conferência aceita um arquivo do livro quando a identidade bate (aqui, a do vetor real): prova que a
        // recusa acima é pela identidade/livro, não por quebra da conferência.
        let i = alumia_nucleo::Identidade {
            uri: "https://github.com/sigstore/sigstore-python/.github/workflows/release.yml@refs/tags/v4.5.1".into(),
            emissor: "https://token.actions.githubusercontent.com".into(),
        };
        assert!(conferir_no_log(ARQUIVO_REAL, PACOTE_REAL, &i).unwrap());
    }

    #[test]
    fn so_baixa_de_servidores_do_lancamento() {
        for ok in ["https://github.com/a/b/releases/download/v1/x", "https://objects.githubusercontent.com/x"] {
            assert!(servidor_permitido(&url::Url::parse(ok).unwrap()), "{ok}");
        }
        for ruim in [
            "http://github.com/x",
            "https://github.com.mal.example/x",
            "https://mal.example/x",
            "file:///c:/x",
            "https://evil@mal.example/",
        ] {
            assert!(!servidor_permitido(&url::Url::parse(ruim).unwrap()), "{ruim}");
        }
        assert!(endereco("1.0.0", "x").starts_with("https://github.com/jojoeumermo/perenidade/releases/download/v1.0.0/"));
    }
}
