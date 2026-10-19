// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O VLibras (recurso "vlibras"): o tradutor de português para Libras do Governo Federal, carregado só depois de a pessoa
// clicar em "Ativar" e confirmar o aviso de serviço externo. "Lembrar neste aparelho" (desmarcado por padrão) faz o
// tradutor carregar sozinho nas próximas páginas; é a única coisa que o site guarda sobre isso (lucia:vlibras).
//
// De onde vem: vlibras.gov.br/app redireciona para o repositório oficial do governo no jsDelivr, numa versão fixa.
// O site aponta direto para essa versão (sem redirecionamento), e a política de segurança (next.config.ts) libera, com o
// recurso ligado, só esse caminho e os serviços *.vlibras.gov.br (tradução, dicionário, repositório). Outros destinos
// que o tradutor tente usar, como serviços de métrica de terceiros, continuam bloqueados.
// Nova versão do VLibras? Troque VERSAO_VLIBRAS e confira no navegador (ativar, abrir o avatar, traduzir um trecho).

export const VERSAO_VLIBRAS = "v7.12.2";
export const ENDERECO_VLIBRAS = `https://cdn.jsdelivr.net/gh/spbgovbr-vlibras/vlibras-portal@${VERSAO_VLIBRAS}/app`;
export const LEMBRAR_VLIBRAS = "lucia:vlibras";

type Janela = Window & { VLibras?: { Widget: new (endereco: string) => unknown }; VLibrasWidget?: { path?: string } };

let pedido: Promise<void> | null = null;

export const vlibrasCarregado = () => pedido !== null;

/** Baixa o programa do VLibras e liga o tradutor (ele põe o próprio botão na lateral da tela). Uma vez por visita. */
export function carregarVLibras(): Promise<void> {
  pedido ??= new Promise<void>((resolve, reject) => {
    const janela = window as Janela;
    // O programa lê daqui de onde baixar o resto (imagens e o aplicativo), em vez do endereço que redireciona.
    janela.VLibrasWidget = { ...janela.VLibrasWidget, path: ENDERECO_VLIBRAS };
    const script = document.createElement("script");
    script.src = `${ENDERECO_VLIBRAS}/vlibras-plugin.js`;
    script.async = true;
    script.onload = () => {
      try {
        if (!janela.VLibras) throw new Error("vlibras");
        new janela.VLibras.Widget(ENDERECO_VLIBRAS);
        resolve();
      } catch (erro) {
        reject(erro);
      }
    };
    script.onerror = () => reject(new Error("vlibras"));
    document.body.appendChild(script);
  }).catch((erro) => {
    pedido = null;
    throw erro;
  });
  return pedido;
}

export function vlibrasLembrado(): boolean {
  try {
    return localStorage.getItem(LEMBRAR_VLIBRAS) === "sempre";
  } catch {
    return false;
  }
}

export function lembrarVLibras(sim: boolean) {
  try {
    if (sim) localStorage.setItem(LEMBRAR_VLIBRAS, "sempre");
    else localStorage.removeItem(LEMBRAR_VLIBRAS);
  } catch {
    // sem armazenamento: vale só para esta página
  }
}
