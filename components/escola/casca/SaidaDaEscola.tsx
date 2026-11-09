// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useRef, useState } from "react";
import { localePath, type Locale } from "@/i18n/config";
import type { TextosDaFormacaoBase } from "@/i18n/escola/formacao-base";
import { getClient } from "@/lib/backend";
import { apagarCofre } from "@/lib/escola/cofre";
import { BASE_DOS_AUDIOS_DA_VIDA } from "@/lib/escola/vida";
import { KEYS, notifyStored } from "@/lib/storage";

type T = TextosDaFormacaoBase["casca"];

/** O que a Escola guarda neste aparelho: o privado (conversas, rascunhos, fichas) sai sempre; o estudo, só se pedir. */
const PRIVADO = "lucia:escola-privado:";
const ESTUDO = ["lucia:escola:", "lucia:escola-discreto", "lucia-escola-discreto"];

function apagar(armazem: Storage | undefined, tudo: boolean) {
  if (!armazem) return;
  const chaves: string[] = [];
  for (let i = 0; i < armazem.length; i++) {
    const chave = armazem.key(i);
    if (chave && (chave.startsWith(PRIVADO) || (tudo && ESTUDO.some((p) => chave.startsWith(p))))) chaves.push(chave);
  }
  for (const chave of chaves) {
    try {
      armazem.removeItem(chave);
    } catch {
      // segue com as outras
    }
  }
}

/**
 * Sair da Escola: encerra a sessão DESTE aparelho no servidor (o token de renovação é revogado, então uma cópia dele não
 * serve mais), apaga o privado da Escola guardado aqui e troca a página pela entrada do site com location.replace, para
 * o "Voltar" do navegador não reabrir a Escola. As outras sessões da conta (outros aparelhos) continuam.
 */
async function sairDaEscola(lang: Locale, tudo: boolean) {
  try {
    const supabase = await getClient();
    await supabase.auth.signOut({ scope: "local" });
  } catch {
    // sem rede: a sessão local sai do mesmo jeito abaixo
  }
  try {
    for (const chave of [KEYS.session, KEYS.name, KEYS.avatar]) localStorage.removeItem(chave);
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const chave = localStorage.key(i);
      // A sessão do Supabase (sb-<projeto>-auth-token), caso a revogação acima não tenha chegado a apagá-la.
      if (chave && /^sb-.*-auth-token/.test(chave)) localStorage.removeItem(chave);
    }
    apagar(localStorage, tudo);
    // O cofre guarda o mesmo privado, cifrado: sai junto.
    apagarCofre();
    apagar(sessionStorage, true);
  } catch {
    // armazenamento bloqueado
  }
  if (tudo) {
    try {
      indexedDB.deleteDatabase(BASE_DOS_AUDIOS_DA_VIDA);
    } catch {
      // sem IndexedDB
    }
  }
  notifyStored();
  location.replace(localePath(lang, "/"));
}

/** O link "Voltar ao site", que leva à entrada do site do instituto. */
export function VoltarAoSiteDaEscola({ lang, t, celular = false }: { lang: Locale; t: T; celular?: boolean }) {
  return (
    <a href={localePath(lang, "/")} className={celular ? "ef-voltar-site ef-voltar-site-celular" : "ef-voltar-site"}>
      <span aria-hidden>←</span> {celular ? t.voltarSiteCurto : t.voltarSite}
    </a>
  );
}

/** O botão "Sair da escola" e a confirmação, com a escolha de apagar também o estudo guardado neste aparelho. */
export function SaidaDaEscola({ lang, t, celular = false }: { lang: Locale; t: T; celular?: boolean }) {
  const caixa = useRef<HTMLDialogElement>(null);
  const [tudo, setTudo] = useState(false);
  const [saindo, setSaindo] = useState(false);
  useEffect(() => {
    const d = caixa.current;
    return () => d?.close();
  }, []);
  return (
    <>
      <button type="button" className={celular ? "ef-sair ef-sair-celular" : "ef-sair"} aria-haspopup="dialog" onClick={() => caixa.current?.showModal()}>
        {celular ? t.sairCurto : t.sair}
      </button>
      <dialog ref={caixa} className="ef-sair-caixa" aria-labelledby="ef-sair-titulo">
        <h2 id="ef-sair-titulo" className="ef-t">
          {t.sairTitulo}
        </h2>
        <p>{t.sairTexto}</p>
        <label className="ef-sair-tudo">
          <input type="checkbox" checked={tudo} onChange={(e) => setTudo(e.target.checked)} />
          <span>{t.sairApagarTudo}</span>
        </label>
        <div className="ef-sair-botoes">
          <button
            type="button"
            className="ef-botao-vermelho"
            disabled={saindo}
            onClick={() => {
              setSaindo(true);
              void sairDaEscola(lang, tudo);
            }}
          >
            {saindo ? t.saindo : t.sairConfirmar}
          </button>
          <button type="button" className="ef-botao-vazado" disabled={saindo} onClick={() => caixa.current?.close()}>
            {t.sairCancelar}
          </button>
        </div>
      </dialog>
    </>
  );
}
