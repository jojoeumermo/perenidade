// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// A escolha no cadastro: codinome (marcado de saída) ou nome e foto. Toda conta ENTRA com codinome, porque quem analisa o pedido
// só vê o codinome; por isso marcar "nome e foto" aqui não manda nada ao servidor: a resposta fica neste aparelho
// (Lembrete.tsx) e, depois de aprovada, a rede lembra uma vez e abre a tela que mostra o que muda antes de trocar. Com a escolha
// fechada no banco (como nasce), este bloco não aparece.
import { useEffect, useId, useState } from "react";
import { redeIdentidade } from "@/lib/rede/cliente-identidade";
import { CHAVE_DA_INTENCAO } from "@/lib/rede/identidade";
import { guardarIntencao } from "./Lembrete";
import { useTextosDaIdentidade } from "./textos";
import "./identidade.css";

function Escolha({ lang }: { lang: string }) {
  const t = useTextosDaIdentidade(lang);
  const [quer, setQuer] = useState(false);
  const nome = useId();
  // Quem já marcou neste aparelho (voltou ao formulário) reencontra a marca.
  useEffect(() => {
    const id = window.setTimeout(() => {
      try {
        setQuer(window.localStorage.getItem(CHAVE_DA_INTENCAO) === "1");
      } catch {
        // sem armazenamento: fica o codinome
      }
    }, 0);
    return () => window.clearTimeout(id);
  }, []);
  if (!t) return null;
  const marcar = (v: boolean) => {
    setQuer(v);
    guardarIntencao(v);
  };
  return (
    <fieldset className="ali-cadastro">
      <legend className="ale-rotulo">{t.cadastro.titulo}</legend>
      <label className="ali-cadastro-opcao" data-marcada={!quer ? "" : undefined}>
        <input type="radio" name={nome} checked={!quer} onChange={() => marcar(false)} />
        <span>
          <strong>
            {t.cadastro.codinome} <em>{t.padrao}</em>
          </strong>
          <small>{t.cadastro.codinomeAjuda}</small>
        </span>
      </label>
      <label className="ali-cadastro-opcao" data-marcada={quer ? "" : undefined}>
        <input type="radio" name={nome} checked={quer} onChange={() => marcar(true)} />
        <span>
          <strong>{t.cadastro.publica}</strong>
          <small>{t.cadastro.publicaAjuda}</small>
        </span>
      </label>
      <p className="ale-ajuda">{t.cadastro.nota}</p>
    </fieldset>
  );
}

export function IdentidadeNoCadastro({ lang }: { lang: string }) {
  const [aberta, setAberta] = useState(false);
  useEffect(() => {
    let vivo = true;
    redeIdentidade.aberta().then((sim) => vivo && setAberta(sim));
    return () => {
      vivo = false;
    };
  }, []);
  return aberta ? <Escolha lang={lang} /> : null;
}
