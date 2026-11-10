// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

/**
 * Um <details> que se comporta como menu de verdade (o "…" do cartão e o cartão da conta): fecha com Esc (o foco volta ao
 * <summary>, sem cair no <body>), com toque ou clique fora dele e quando o foco sai dele pelo Tab. Abrir um fecha o outro, porque
 * o toque no segundo é "fora" do primeiro. Sem JavaScript, o <details> continua abrindo e fechando pelo próprio <summary>.
 *
 * É um ref de função (React 19: a função devolvida limpa), para valer também quando o <details> só aparece depois da montagem.
 */
export function detalhesQueFecham(el: HTMLDetailsElement | null): (() => void) | undefined {
  if (!el) return undefined;
  let limpar: (() => void) | null = null;
  const fechar = (devolverFoco: boolean) => {
    if (!el.open) return;
    el.open = false;
    if (devolverFoco) el.querySelector<HTMLElement>(":scope > summary")?.focus();
  };
  const aoMudar = () => {
    limpar?.();
    limpar = null;
    if (!el.open) return;
    const fora = (e: PointerEvent) => {
      if (!el.contains(e.target as Node)) fechar(false);
    };
    const tecla = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // O Esc fecha só este menu (o diálogo de fora, se houver, continua aberto).
      e.preventDefault();
      e.stopPropagation();
      fechar(true);
    };
    const foco = (e: FocusEvent) => {
      const para = e.relatedTarget as Node | null;
      if (para && !el.contains(para)) fechar(false);
    };
    document.addEventListener("pointerdown", fora, true);
    el.addEventListener("keydown", tecla);
    el.addEventListener("focusout", foco);
    limpar = () => {
      document.removeEventListener("pointerdown", fora, true);
      el.removeEventListener("keydown", tecla);
      el.removeEventListener("focusout", foco);
    };
  };
  el.addEventListener("toggle", aoMudar);
  return () => {
    el.removeEventListener("toggle", aoMudar);
    limpar?.();
  };
}
