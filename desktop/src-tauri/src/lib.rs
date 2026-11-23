// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O app da Alumia para computador (onda R3, itens 1.2, 2.3 e 2.4).
//
// O que ele garante, e onde:
//   - a única página com acesso ao nativo é a casca EMPACOTADA (tauri://localhost; http://tauri.localhost no Windows): a janela é
//     criada aqui com `on_navigation` que recusa qualquer outro endereço e `on_new_window` que recusa toda janela nova; a
//     capability (capabilities/principal.json) não tem o campo `remote`;
//   - a lista de comandos é fechada (build.rs): os oito abaixo, e só eles, cada um permitido pela capability;
//   - nenhum comando de plugin está liberado para a página: notificação, abrir no navegador e instância única são usados só daqui;
//   - uma instância só (a segunda abertura só traz a janela da primeira para a frente);
//   - a notificação é sempre "Nova mensagem", sem remetente nem trecho (o texto nem vem da página);
//   - "apagar tudo" apaga a chave do cofre (tudo o que ela embrulhou deixa de abrir), os dados da página e as pastas do app.
// O protocolo do chat é o TypeScript + WebAssembly da casca, igual no site e no Android.
pub mod atualizacao;
pub mod rede;

use base64::engine::general_purpose::STANDARD as B64;
use base64::Engine;
use tauri::webview::NewWindowResponse;
use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_notification::NotificationExt;
use tauri_plugin_opener::OpenerExt;

/// O rótulo da única janela (o mesmo da capability).
pub const JANELA: &str = "principal";
/// O texto da notificação: fixo, sem nada da conversa.
pub const TEXTO_DA_NOTIFICACAO: &str = "Nova mensagem";
/// A versão deste executável (a do Cargo.toml, a mesma da tag do lançamento).
pub const VERSAO: &str = env!("CARGO_PKG_VERSION");

/// A página só pode estar na casca empacotada.
pub fn navegacao_permitida(u: &url::Url) -> bool {
    match u.scheme() {
        "tauri" => u.host_str() == Some("localhost"),
        "http" | "https" => u.host_str() == Some("tauri.localhost") && u.port().is_none(),
        _ => false,
    }
}

fn erro<E: std::fmt::Debug>(_: E) -> String {
    "erro".to_string()
}

#[tauri::command]
fn cofre_embrulhar(finalidade: String, dados: String) -> Result<String, String> {
    let dados = B64.decode(dados).map_err(erro)?;
    alumia_nucleo::embrulhar(&finalidade, &dados).map(|e| B64.encode(e)).map_err(erro)
}

#[tauri::command]
fn cofre_desembrulhar(finalidade: String, embrulhado: String) -> Result<Option<String>, String> {
    let Ok(e) = B64.decode(embrulhado) else { return Ok(None) };
    alumia_nucleo::desembrulhar(&finalidade, &e).map(|d| d.map(|x| B64.encode(x))).map_err(erro)
}

#[tauri::command]
async fn atualizacao_conferir(versao: String) -> Result<atualizacao::Resultado, String> {
    // A casca pergunta pela versão que ela acha que está rodando; vale a compilada.
    if versao != VERSAO {
        return Ok(atualizacao::Resultado::ForaDoLog);
    }
    tauri::async_runtime::spawn_blocking(move || {
        let proprio = std::env::current_exe().and_then(std::fs::read).map_err(erro)?;
        let b = atualizacao::BaixadorHttps::novo().ok_or("erro")?;
        Ok(atualizacao::conferir_instalado(&b, &versao, &proprio))
    })
    .await
    .map_err(erro)?
}

#[tauri::command]
async fn atualizacao_instalar(app: tauri::AppHandle, versao: String) -> Result<atualizacao::Resultado, String> {
    let conferido = tauri::async_runtime::spawn_blocking(move || {
        let b = atualizacao::BaixadorHttps::novo().ok_or(atualizacao::Resultado::SemRede)?;
        atualizacao::baixar_conferido(&b, &versao)
    })
    .await
    .map_err(erro)?;
    let (nome, bytes) = match conferido {
        Ok(x) => x,
        Err(r) => return Ok(r),
    };
    // Só chega aqui o que está no livro (e é mais nova que a instalada). Grava numa pasta NOVA da pasta temporária e entrega ao
    // sistema: a pasta é criada aqui (create_dir, que falha se ela já existe; no Linux e no macOS só para este usuário, 0700). Antes,
    // create_dir_all aceitava uma pasta que outro usuário do /tmp tivesse criado antes, e ele podia trocar o arquivo entre gravar e
    // abrir (auditoria interna da R3).
    let pasta = atualizacao::pasta_nova(&std::env::temp_dir()).map_err(erro)?;
    let caminho = pasta.join(&nome);
    std::fs::write(&caminho, &bytes).map_err(erro)?;
    app.opener().open_path(caminho.to_string_lossy(), None::<&str>).map_err(erro)?;
    app.exit(0);
    Ok(atualizacao::Resultado::NoLog)
}

#[tauri::command]
fn rede_abrir(app: tauri::AppHandle, caminho: String) -> Result<(), String> {
    let endereco = alumia_nucleo::caminho::endereco_da_rede(&caminho).ok_or("caminho")?;
    app.opener().open_url(endereco, None::<&str>).map_err(erro)
}

#[derive(serde::Serialize)]
struct Resposta {
    status: u16,
    corpo: String,
    tipo: Option<String>,
}

#[tauri::command]
async fn rede_pedir(metodo: String, caminho: String, cabecalhos: Vec<(String, String)>, corpo: Option<String>) -> Result<Resposta, String> {
    let corpo = match corpo {
        Some(c) => B64.decode(c).map_err(erro)?,
        None => Vec::new(),
    };
    let pedido = rede::conferir_pedido(&metodo, &caminho, &cabecalhos, corpo.len()).map_err(erro)?;
    tauri::async_runtime::spawn_blocking(move || -> Result<Resposta, String> {
        let cliente = reqwest::blocking::Client::builder()
            .https_only(true)
            .redirect(reqwest::redirect::Policy::none())
            .user_agent("alumia/1")
            .timeout(std::time::Duration::from_secs(30))
            .build()
            .map_err(erro)?;
        let mut req = if pedido.metodo == "GET" { cliente.get(&pedido.endereco) } else { cliente.post(&pedido.endereco).body(corpo) };
        for (n, v) in &pedido.cabecalhos {
            req = req.header(n.as_str(), v.as_str());
        }
        let r = req.send().map_err(erro)?;
        let status = r.status().as_u16();
        let tipo = r.headers().get("content-type").and_then(|v| v.to_str().ok()).map(str::to_string);
        if r.content_length().is_some_and(|n| n as usize > rede::LIMITE_DA_RESPOSTA) {
            return Err("grande".into());
        }
        let bytes = r.bytes().map_err(erro)?;
        if bytes.len() > rede::LIMITE_DA_RESPOSTA {
            return Err("grande".into());
        }
        Ok(Resposta { status, corpo: B64.encode(bytes), tipo })
    })
    .await
    .map_err(erro)?
}

#[tauri::command]
fn app_apagar_tudo(app: tauri::AppHandle) -> Result<(), String> {
    // A chave primeiro: sem ela, o que estiver embrulhado em qualquer lugar deixa de abrir, mesmo se uma pasta não puder ser apagada.
    let chave = alumia_nucleo::cofre::apagar_com(&alumia_nucleo::ChaveiroDoSistema);
    if let Some(j) = app.get_webview_window(JANELA) {
        let _ = j.clear_all_browsing_data();
    }
    // Com o WebView aberto, o Windows não deixa apagar a pasta do perfil dele (os arquivos estão presos): o conteúdo já saiu acima,
    // mas o esqueleto do perfil fica. O marcador, AO LADO das pastas, faz a próxima abertura apagar tudo antes de o WebView subir.
    let pastas = pastas_do_app(&app);
    if let Some(m) = pastas.first().and_then(|p| marcador_de_apagar(p)) {
        let _ = std::fs::write(m, b"");
    }
    for p in &pastas {
        let _ = std::fs::remove_dir_all(p);
    }
    chave.map_err(erro)?;
    app.exit(0);
    Ok(())
}

/// As pastas do app (dados, dados locais, cache, configuração), a de dados locais primeiro (é onde mora o perfil do WebView).
fn pastas_do_app(app: &tauri::AppHandle) -> Vec<std::path::PathBuf> {
    let c = app.path();
    [c.app_local_data_dir(), c.app_data_dir(), c.app_cache_dir(), c.app_config_dir()].into_iter().flatten().collect()
}

/// O marcador "apagar na próxima abertura": um arquivo vazio ao lado da pasta (fora dela, para não sumir junto).
pub fn marcador_de_apagar(pasta: &std::path::Path) -> Option<std::path::PathBuf> {
    let nome = pasta.file_name()?.to_str()?;
    Some(pasta.with_file_name(format!("{nome}.apagar")))
}

/// Na abertura, ANTES do WebView: se o "apagar tudo" anterior deixou o marcador, apaga as pastas e depois o marcador. O marcador só
/// sai quando todas as pastas sumiram (se uma ficar presa, a próxima abertura tenta de novo).
pub fn apagar_pendente(pastas: &[std::path::PathBuf]) -> bool {
    let Some(m) = pastas.first().and_then(|p| marcador_de_apagar(p)) else { return false };
    if !m.exists() {
        return false;
    }
    let mut tudo = true;
    for p in pastas {
        if p.exists() && std::fs::remove_dir_all(p).is_err() {
            tudo = false;
        }
    }
    if tudo {
        let _ = std::fs::remove_file(&m);
    }
    true
}

#[tauri::command]
fn notificar(app: tauri::AppHandle) -> Result<(), String> {
    app.notification().builder().title("Alumia").body(TEXTO_DA_NOTIFICACAO).show().map_err(erro)
}

/// Monta e roda o app.
pub fn rodar() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(j) = app.get_webview_window(JANELA) {
                let _ = j.unminimize();
                let _ = j.set_focus();
            }
        }))
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            cofre_embrulhar,
            cofre_desembrulhar,
            atualizacao_conferir,
            atualizacao_instalar,
            rede_abrir,
            rede_pedir,
            app_apagar_tudo,
            notificar
        ])
        .setup(|app| {
            apagar_pendente(&pastas_do_app(app.handle()));
            WebviewWindowBuilder::new(app, JANELA, WebviewUrl::App("index.html".into()))
                .title("Alumia")
                .inner_size(1100.0, 760.0)
                .min_inner_size(360.0, 560.0)
                .devtools(cfg!(debug_assertions))
                .on_navigation(navegacao_permitida)
                .on_new_window(|_, _| NewWindowResponse::Deny)
                .build()?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("falha ao abrir o app");
}

#[cfg(test)]
mod testes {
    use super::*;

    #[test]
    fn so_a_casca_empacotada_navega() {
        for ok in ["tauri://localhost/index.html", "http://tauri.localhost/", "https://tauri.localhost/x?y"] {
            assert!(navegacao_permitida(&url::Url::parse(ok).unwrap()), "{ok}");
        }
        for ruim in [
            "https://institutolucia.org/pt/alumia",
            "http://tauri.localhost.mal.example/",
            "http://tauri.localhost:8080/",
            "tauri://mal.example/",
            "file:///c:/Windows/x",
            "javascript:alert(1)",
            "data:text/html,oi",
            "http://localhost:3000/",
            "about:blank",
        ] {
            assert!(!navegacao_permitida(&url::Url::parse(ruim).unwrap()), "{ruim}");
        }
    }

    /// "Apagar tudo" com o WebView aberto deixa o esqueleto do perfil (arquivos presos no Windows); a próxima abertura apaga.
    #[test]
    fn apagar_pendente_na_proxima_abertura() {
        let base = std::env::temp_dir().join(format!("alumia-teste-apagar-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&base);
        let local = base.join("org.institutolucia.alumia");
        let config = base.join("config").join("org.institutolucia.alumia");
        std::fs::create_dir_all(local.join("EBWebView/Default")).unwrap();
        std::fs::write(local.join("EBWebView/Default/Preferences"), b"{}").unwrap();
        std::fs::create_dir_all(&config).unwrap();
        let pastas = vec![local.clone(), config.clone()];
        // Sem marcador, nada muda (uma abertura normal).
        assert!(!apagar_pendente(&pastas));
        assert!(local.join("EBWebView/Default/Preferences").exists());
        let m = marcador_de_apagar(&local).unwrap();
        assert_eq!(m, base.join("org.institutolucia.alumia.apagar"));
        std::fs::write(&m, b"").unwrap();
        assert!(apagar_pendente(&pastas));
        assert!(!local.exists() && !config.exists() && !m.exists());
        let _ = std::fs::remove_dir_all(&base);
    }

    #[test]
    fn notificacao_sem_conteudo() {
        assert_eq!(TEXTO_DA_NOTIFICACAO, "Nova mensagem");
    }
}
