// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// No cadastro a pessoa pode marcar que quer aparecer com nome e foto. A triagem só vê o codinome, então nada vai ao servidor
// naquela hora: a marca fica neste aparelho (lib/rede/identidade.ts, CHAVE_DA_INTENCAO). Depois de aprovada e dentro da rede, este
// lembrete aparece UMA vez, porque ela pediu. "Agora não" apaga a marca e ele não volta; "Escolher agora" leva à tela da escolha,
// que ainda mostra o que muda e pede a confirmação. Sem a marca, este componente não mostra nem baixa nada; com a marca, só
// aparece se a escolha estiver aberta no banco.
import { useEffect, useState } from "react";
import Link from "@/components/Link";
import { redeIdentidade } from "@/lib/rede/cliente-identidade";
import { CHAVE_DA_INTENCAO } from "@/lib/rede/identidade";
import { enderecoDeEditarPerfil } from "@/lib/rede/perfil";
import { useTextosDaIdentidade } from "./textos";
import "./identidade.css";

/** O endereço que abre o editor do perfil já na escolha da identidade. */
export const enderecoDaEscolha = (lang: string): string => `${enderecoDeEditarPerfil(lang)}?identidade=escolher`;

/** Guarda (ou apaga) a marca feita no cadastro. Só neste aparelho. */
export function guardarIntencao(quer: boolean) {
  try {
    if (quer) window.localStorage.setItem(CHAVE_DA_INTENCAO, "1");
    else window.localStorage.removeItem(CHAVE_DA_INTENCAO);
  } catch {
    // sem armazenamento: a pessoa escolhe depois, nos ajustes do perfil
  }
}

function Aviso({ lang, aoFechar }: { lang: string; aoFechar: () => void }) {
  const t = useTextosDaIdentidade(lang);
  if (!t) return null;
  return (
    <aside className="ali-lembrete" aria-label={t.titulo}>
      <p>{t.lembrete.texto}</p>
      <div className="ali-botoes">
        <button type="button" className="al-botao al-botao-fantasma al-botao-p" onClick={aoFechar}>
          {t.lembrete.nao}
        </button>
        <Link href={enderecoDaEscolha(lang)} className="al-botao al-botao-claro al-botao-p" onClick={aoFechar}>
          {t.lembrete.sim}
        </Link>
      </div>
    </aside>
  );
}

export function LembreteDeIdentidade({ lang, membro }: { lang: string; membro: boolean }) {
  const [marcada, setMarcada] = useState(false);
  useEffect(() => {
    if (!membro) return;
    let quer = false;
    try {
      quer = window.localStorage.getItem(CHAVE_DA_INTENCAO) === "1";
    } catch {
      quer = false;
    }
    if (!quer) return;
    // Só lembra com a escolha aberta no banco: fechada, a marca espera quieta no aparelho.
    let vivo = true;
    redeIdentidade.aberta().then((sim) => vivo && sim && setMarcada(true));
    return () => {
      vivo = false;
    };
  }, [membro]);
  if (!membro || !marcada) return null;
  return (
    <Aviso
      lang={lang}
      aoFechar={() => {
        guardarIntencao(false);
        setMarcada(false);
      }}
    />
  );
}
