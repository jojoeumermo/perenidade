// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import "./stories.css";
import { useEffect, useState, type CSSProperties } from "react";
import { PALETA_DO_STORY } from "@/lib/rede/stories/visual";
import type { Situacao } from "@/lib/rede/tipos";
import type { DestaqueDeStories } from "@/lib/rede/tipos-stories";
import { CapaDoDestaque } from "./CapaDoDestaque";
import { preencherStory, useClienteDosStories, useTextosDosStories } from "./usar";
import { Visor } from "./Visor";

/**
 * Os destaques no perfil (como os do Instagram): bolinhas com a capa e o nome, que abrem o visor com os stories guardados. Só
 * aparecem os stories que EU posso ver (o mesmo público de quando foram publicados; bloqueio e retenção valem); o número é de
 * stories, nunca de pessoas. Nada é contado ao servidor sobre quem abriu. Encaixe para a área de perfil (F4): basta
 * `<DestaquesDoPerfil lang handle situacao />` acima das abas.
 */
export function DestaquesDoPerfil({ lang, handle, situacao }: { lang: string; handle: string; situacao: Situacao }) {
  const t = useTextosDosStories(lang);
  const cliente = useClienteDosStories();
  const [lista, setLista] = useState<DestaqueDeStories[] | null>(null);
  const [erro, setErro] = useState(false);
  const [aberto, setAberto] = useState<DestaqueDeStories | null>(null);
  const [versao, setVersao] = useState(0);
  const dono = situacao.handle === handle || (!!cliente?.previa && (handle === "voce" || handle === "eu"));
  const logado = situacao.logado || !!cliente?.previa;

  useEffect(() => {
    if (!cliente || !logado) return;
    let vivo = true;
    cliente
      .destaques(handle)
      .then((l) => vivo && (setLista(l), setErro(false)))
      .catch(() => vivo && setErro(true));
    return () => {
      vivo = false;
    };
  }, [cliente, handle, logado, versao]);

  if (!t || !cliente || !logado) return null;
  if (erro) return <p className="al-st-erro">{t.destaques.erro}</p>;
  if (!lista) return <div className="al-st-destaques" aria-busy="true" style={{ minHeight: 104 }} />;
  if (lista.length === 0) return dono ? <p className="al-st-destaques-vazio">{t.destaques.vazioDono}</p> : null;

  return (
    <section className="al-st-destaques" aria-label={t.destaques.rotulo}>
      <ul className="al-st-faixa-trilho">
        {lista.map((d) => (
          <li key={d.id} className="al-st-faixa-item">
            <button type="button" className="al-st-bolinha al-st-destaque" aria-label={preencherStory(t.destaques.abrir, { titulo: d.titulo, n: d.n })} onClick={() => setAberto(d)}>
              <span className="al-st-destaque-capa" style={{ "--al-st-anel": PALETA_DO_STORY[d.cor].fundo } as CSSProperties}>
                <CapaDoDestaque d={d} />
              </span>
              <span className="al-st-nome" aria-hidden>
                {d.titulo}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {aberto ? (
        <Visor
          t={t}
          cliente={cliente}
          lang={lang}
          handle={handle}
          destaque={{ id: aberto.id, titulo: aberto.titulo }}
          aoFechar={() => {
            setAberto(null);
            setVersao((v) => v + 1);
          }}
          aoMudou={() => setVersao((v) => v + 1)}
        />
      ) : null}
    </section>
  );
}

