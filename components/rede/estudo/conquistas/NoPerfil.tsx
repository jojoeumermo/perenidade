// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// As conquistas no perfil (encaixe abasDoPerfil, frente 11E): uma fileira com as medalhas que a pessoa ligou e a faixa de ajuda, se
// ela ligou. Sem nada ligado, quem visita não vê fileira nenhuma (nem "0 medalhas"); a dona vê o caminho para escolher o que aparece.
import "./conquistas.css";
import { useEffect, useId, useState } from "react";
import Link from "@/components/Link";
import type { ContextoDoEncaixe } from "../../encaixes";
import { conquistas } from "./cliente";
import { Emblema, nomeDaMedalha } from "./Emblema";
import type { ConquistasDoPerfil } from "./regras";
import { useNomesDasTrilhas } from "./usarNomesDasTrilhas";
import { useTextosDasConquistas } from "./usarTextos";

export function ConquistasNoPerfil({ lang, handle }: ContextoDoEncaixe & { handle: string }) {
  const t = useTextosDasConquistas(lang);
  const trilhas = useNomesDasTrilhas(lang);
  const id = useId();
  const [dado, setDado] = useState<{ handle: string; d: ConquistasDoPerfil } | null>(null);

  useEffect(() => {
    let vivo = true;
    conquistas
      .doPerfil(handle)
      .then((d) => vivo && setDado({ handle, d }))
      .catch(() => vivo && setDado(null));
    return () => {
      vivo = false;
    };
  }, [handle]);

  if (!t || !dado || dado.handle !== handle) return null;
  const { medalhas, faixa, meu } = dado.d;
  if (medalhas.length === 0 && !faixa) {
    if (!meu) return null;
    return (
      <div className="cq-perfil">
        <Link className="cq-link" href={`/${lang}/alumia/conquistas`}>{t.perfil.editar}</Link>
      </div>
    );
  }
  return (
    <section className="cq-perfil" aria-labelledby={`${id}-t`}>
      <h2 id={`${id}-t`} className="cq-perfil-titulo cq-cond">{t.perfil.titulo}</h2>
      <ul className="cq-perfil-lista">
        {medalhas.map((m) => (
          <li key={`${m.medalha}:${m.alvo}`} className="cq-perfil-item">
            <Emblema medalha={m.medalha} nivel={m.nivel} pequeno />
            <span>{nomeDaMedalha(t, m.medalha, m.alvo, m.nivel, trilhas.nome)}</span>
          </li>
        ))}
        {faixa && (
          <li className="cq-perfil-item" style={{ paddingLeft: "0.65rem" }}>
            <span className="cq-cond" style={{ color: "var(--al-texto-3)" }}>{t.perfil.faixa}</span>
            <span>{t.faixas[faixa].nome}</span>
          </li>
        )}
      </ul>
      {meu && <Link className="cq-link" href={`/${lang}/alumia/conquistas`}>{t.perfil.editar}</Link>}
    </section>
  );
}

export default ConquistasNoPerfil;
