// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState } from "react";
import { alumia } from "@/lib/rede/cliente-alumia";
import { carregarTextosDaAlumia, type TextosDaAlumia } from "@/lib/rede/textos-alumia";
import type { Post } from "@/lib/rede/tipos";
import { CartaoDePost } from "../CartaoDePost";
import { textoDoErro } from "../erros";
import { EsqueletoDaLinha } from "../Esqueletos";
import type { PropsDaTelaDoPacote } from "../registro";

/**
 * Salvos (/alumia/salvos): o que a pessoa guardou para ler depois, do mais novo ao mais antigo. A lista é privada (rede_salvos,
 * só a própria pessoa lê) e passa pela mesma matriz de visibilidade de sempre: post apagado, retido ou que ela deixou de poder ver some.
 */
export default function Salvos({ lang, s, situacao, aoEscrever }: PropsDaTelaDoPacote) {
  const [t, setT] = useState<TextosDaAlumia | null>(null);
  const [itens, setItens] = useState<Post[]>([]);
  const [proximo, setProximo] = useState<string | null>(null);
  const [estado, setEstado] = useState<"carregando" | "ok" | "erro">("carregando");
  const [erro, setErro] = useState("");
  const [mais, setMais] = useState(false);

  useEffect(() => {
    let vivo = true;
    carregarTextosDaAlumia(lang).then((x) => vivo && setT(x)).catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [lang]);

  useEffect(() => {
    if (!situacao.logado) return;
    let vivo = true;
    alumia
      .salvos(null, 20)
      .then((r) => {
        if (!vivo) return;
        setItens(r.itens);
        setProximo(r.proximo);
        setEstado("ok");
      })
      .catch((e) => {
        if (!vivo) return;
        setErro(textoDoErro(s, e));
        setEstado("erro");
      });
    return () => {
      vivo = false;
    };
  }, [s, situacao.logado]);

  async function carregarMais() {
    if (!proximo || mais) return;
    setMais(true);
    try {
      const r = await alumia.salvos(proximo, 20);
      setItens((atual) => [...atual, ...r.itens.filter((p) => !atual.some((x) => x.id === p.id))]);
      setProximo(r.proximo);
    } catch (e) {
      setErro(textoDoErro(s, e));
    } finally {
      setMais(false);
    }
  }

  if (!t) return <EsqueletoDaLinha rotulo={s.estados.carregando} quantos={3} />;
  return (
    <section aria-labelledby="alumia-salvos-titulo">
      <header className="border-b border-rule px-[18px] py-4 font-sans">
        <h1 id="alumia-salvos-titulo" className="font-serif text-2xl font-extrabold">{t.salvos.titulo}</h1>
        <p className="mt-1 text-sm text-ink-soft">{t.salvos.lead}</p>
      </header>
      {!situacao.logado ? (
        <p className="px-[18px] py-8 font-sans text-ink-soft">{t.salvos.entre}</p>
      ) : estado === "carregando" ? (
        <EsqueletoDaLinha rotulo={s.estados.carregando} quantos={3} />
      ) : estado === "erro" ? (
        <p role="alert" className="px-[18px] py-8 font-sans text-oxblood">{erro || s.estados.erro}</p>
      ) : itens.length === 0 ? (
        <p className="px-[18px] py-8 font-sans text-ink-soft">{t.salvos.vazio}</p>
      ) : (
        <>
          <ol aria-label={t.salvos.titulo}>
            {itens.map((p) => (
              <li key={p.id}>
                <CartaoDePost post={p} lang={lang} s={s} logado={situacao.logado} aoResponder={(post) => aoEscrever(post)} />
              </li>
            ))}
          </ol>
          {erro && <p role="alert" className="px-[18px] py-2 font-sans text-oxblood">{erro}</p>}
          {proximo ? (
            <div className="px-[18px] py-4 text-center">
              <button type="button" onClick={() => void carregarMais()} disabled={mais} className="min-h-11 cursor-pointer rounded-full border-[1.5px] border-ink px-5 font-sans font-bold hover:bg-parchment-deep disabled:opacity-60">
                {mais ? s.estados.carregando : s.estados.maisPosts}
              </button>
            </div>
          ) : (
            <p className="px-[18px] py-6 text-center font-sans text-sm text-ink-soft">{s.estados.fim}</p>
          )}
        </>
      )}
    </section>
  );
}
