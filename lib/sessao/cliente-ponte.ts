// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// O lado da Alumia (e da Escola) da ponte de sessão (lib/sessao/ponte.ts). Sem sessão neste endereço, abre o quadro escondido do
// site, pede o código de uma vez e troca por uma sessão nova DESTE endereço. Tenta uma vez por aba; depois de "Sair" aqui, para de
// tentar até a pessoa entrar à mão de novo (quem saiu não volta a entrar sozinho).
import { getClient, hasBackend, hasSession } from "@/lib/backend";
import { mensagemDaPonte, numeroDaVez, origemDoSite } from "./ponte";

const TENTADA = "lucia:ponte-tentada";
const NAO = "lucia:ponte-nao";

/** Depois de "Sair" neste endereço: a ponte não traz a sessão de volta sozinha. */
export function pararPonte() {
  try {
    localStorage.setItem(NAO, "1");
  } catch {
    // sem armazenamento: nada a lembrar
  }
}

/** Depois de entrar à mão: a ponte volta a valer na próxima vez. */
export function liberarPonte() {
  try {
    localStorage.removeItem(NAO);
  } catch {
    // idem
  }
}

/** Existe ponte para este endereço (é alumia. ou escola. do site) e ainda vale tentar nesta aba? */
export function ponteDisponivel(): boolean {
  if (typeof window === "undefined" || !hasBackend || hasSession()) return false;
  if (!origemDoSite(window.location.origin)) return false;
  try {
    if (localStorage.getItem(NAO) === "1" || sessionStorage.getItem(TENTADA) === "1") return false;
  } catch {
    return false;
  }
  return true;
}

/** Tenta trazer a entrada do site. Devolve true se agora há sessão neste endereço. */
export function trazerSessaoDoSite(prazo = 6000): Promise<boolean> {
  if (!ponteDisponivel()) return Promise.resolve(false);
  const site = origemDoSite(window.location.origin)!;
  try {
    sessionStorage.setItem(TENTADA, "1");
  } catch {
    return Promise.resolve(false);
  }
  return new Promise<boolean>((resolver) => {
    const n = numeroDaVez();
    const quadro = document.createElement("iframe");
    let fim = false;
    const terminar = (valor: boolean) => {
      if (fim) return;
      fim = true;
      window.removeEventListener("message", ouvir);
      clearTimeout(relogio);
      quadro.remove();
      resolver(valor);
    };
    const ouvir = (ev: MessageEvent) => {
      if (ev.origin !== site || ev.source !== quadro.contentWindow) return;
      const m = mensagemDaPonte(ev.data);
      if (!m || m.tipo === "pronto" || m.tipo === "pedir" || m.n !== n) return;
      if (m.tipo === "nada") return terminar(false);
      void getClient()
        .then((supabase) => supabase.auth.verifyOtp({ token_hash: m.token_hash, type: "magiclink" }))
        .then(({ data, error }) => terminar(!error && Boolean(data.session)))
        .catch(() => terminar(false));
    };
    const relogio = setTimeout(() => terminar(false), prazo);
    window.addEventListener("message", ouvir);
    quadro.title = "ponte";
    quadro.setAttribute("aria-hidden", "true");
    quadro.tabIndex = -1;
    quadro.style.cssText = "position:absolute;width:1px;height:1px;border:0;opacity:0;pointer-events:none;left:-9999px;top:0";
    quadro.addEventListener("load", () => quadro.contentWindow?.postMessage({ tipo: "pedir", n }, site));
    quadro.src = `${site}/api/sessao/ponte`;
    document.body.appendChild(quadro);
  });
}
