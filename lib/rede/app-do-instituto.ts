// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// A Alumia NÃO mora dentro do aplicativo do Instituto (decisão da coordenação de 12/11/2026): ela tem endereço próprio e vai
// ganhar aplicativo só dela. Este arquivo diz, no navegador, se a página está aberta dentro do aplicativo do Instituto, e o
// site então esconde as entradas para a Alumia (os links marcados com data-entrada-alumia) e, se alguém chegar a uma tela dela
// por um link guardado, mostra um aviso no lugar (app/[lang]/alumia/layout.tsx). No navegador nada muda.
//
// Como o site sabe que está no aplicativo (capacitor.config.ts e docs/APP-LOJA.md):
//   - o WebView do Android se anuncia com "; wv)" no agente de usuário, e a casca do Capacitor acrescenta "InstitutoLuciaApp/2";
//   - instalado na tela inicial (PWA do site do Instituto), a página abre em display-mode standalone/minimal-ui;
//   - um aplicativo que abre o site por TWA pode chamar a primeira página com ?app=instituto; a marca fica guardada na sessão
//     da aba (sessionStorage) para as páginas seguintes, que já não trazem o parâmetro.
// O endereço próprio da Alumia (alumia.*, ou o host de NEXT_PUBLIC_ALUMIA_URL) NUNCA conta como aplicativo do Instituto: a
// Alumia instalada a partir do próprio endereço é a casa dela.
//
// Sem DOM nas funções puras e sem "@/" de propósito (roda no Node nos testes: scripts/testar-alumia-acabamento.mjs).

/** A marca que a casca do Capacitor acrescenta ao agente de usuário (capacitor.config.ts, android.appendUserAgent). */
export const MARCA_DO_APP = "InstitutoLuciaApp";

/** O atributo que vai no <html> quando a página está no aplicativo do Instituto. */
export const ATRIBUTO_SEM_ALUMIA = "data-sem-alumia";

/** A chave da sessão da aba que lembra o ?app=instituto. */
export const CHAVE_DO_APP = "lucia:app-instituto";

export interface SinaisDoAparelho {
  /** O agente de usuário do navegador. */
  ua: string;
  /** A página abriu instalada (display-mode standalone/minimal-ui, ou navigator.standalone no iOS). */
  instalada: boolean;
  /** O host da página (com ou sem porta). */
  host: string;
  /** O host do endereço próprio da Alumia, se estiver ligado (vazio se não). */
  hostDaAlumia: string;
  /** A busca da página (location.search). */
  busca: string;
  /** Uma aba que já recebeu o ?app=instituto antes. */
  lembrado: boolean;
}

/** O host é o da própria Alumia? Pura. */
export function ehHostDaAlumia(host: string, hostDaAlumia: string): boolean {
  const nome = host.toLowerCase().trim().replace(/:\d+$/, "");
  if (!nome) return false;
  if (nome.startsWith("alumia.")) return true;
  return Boolean(hostDaAlumia) && nome === hostDaAlumia.toLowerCase().replace(/:\d+$/, "");
}

/** O parâmetro de quem abre o site por TWA: ?app=instituto. Pura. */
export function pedidoPeloParametro(busca: string): boolean {
  try {
    return new URLSearchParams(busca).get("app") === "instituto";
  } catch {
    return false;
  }
}

/** A página está dentro do aplicativo do Instituto? Pura. */
export function dentroDoAppDoInstituto(x: SinaisDoAparelho): boolean {
  if (ehHostDaAlumia(x.host, x.hostDaAlumia)) return false;
  return x.ua.includes(MARCA_DO_APP) || x.ua.includes("; wv)") || x.instalada || x.lembrado || pedidoPeloParametro(x.busca);
}

/** O host de um endereço (vazio se não for um endereço). Pura. */
export function hostDoEndereco(url: string): string {
  try {
    return url ? new URL(url).host : "";
  } catch {
    return "";
  }
}

/**
 * O mesmo que dentroDoAppDoInstituto, em texto, para rodar ANTES da primeira pintura (dentro do prefsScript, lib/prefs.ts): sem
 * ele o link da Alumia piscaria no menu do aplicativo. `hostDaAlumia` é o host do endereço próprio, gravado na hora do build.
 */
export function scriptDoApp(hostDaAlumia: string): string {
  return `try{var h=location.host.toLowerCase().replace(/:\\d+$/,""),ha=${JSON.stringify(hostDaAlumia.toLowerCase().replace(/:\d+$/, ""))};if(!(h.indexOf("alumia.")===0||(ha&&h===ha))){var u=navigator.userAgent,l=false;try{if(new URLSearchParams(location.search).get("app")==="instituto")sessionStorage.setItem(${JSON.stringify(CHAVE_DO_APP)},"1");l=sessionStorage.getItem(${JSON.stringify(CHAVE_DO_APP)})==="1"}catch(e){}if(u.indexOf(${JSON.stringify(MARCA_DO_APP)})>-1||u.indexOf("; wv)")>-1||l||matchMedia("(display-mode: standalone), (display-mode: minimal-ui)").matches||navigator.standalone===true)document.documentElement.setAttribute(${JSON.stringify(ATRIBUTO_SEM_ALUMIA)},"")}}catch(e){}`;
}
