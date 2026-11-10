// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState } from "react";
import { alumia } from "@/lib/rede/cliente-alumia";
import { rede } from "@/lib/rede/cliente";
import { carregarTextosDaAlumia, type TextosDaAlumia } from "@/lib/rede/textos-alumia";
import type { Post } from "@/lib/rede/tipos";
import { textoDoErro } from "../erros";
import { EsqueletoDaLinha } from "../Esqueletos";
import type { PropsDaTelaDoPacote } from "../registro";
import { FaixaDaPrevia, PostCompacto, previa, Torradas, useTextosAlumia3, useTorrada } from "../conversa/base3";
import { salvosDaPrevia } from "../descoberta/previa";
// O visual novo (só com "rede-v2" + "alumia-2": a folha só vale dentro de [data-al="2"]).
import "../conversa/alumia3.css";

/**
 * Salvos (/alumia/salvos): o que a pessoa guardou para ler depois, do mais novo ao mais antigo. A lista é privada (rede_salvos,
 * só a própria pessoa lê) e passa pela mesma matriz de visibilidade de sempre: post apagado, retido ou que ela deixou de poder ver some.
 */
export default function Salvos({ lang, s, situacao }: PropsDaTelaDoPacote) {
  const [t, setT] = useState<TextosDaAlumia | null>(null);
  const t3 = useTextosAlumia3(lang);
  const torradas = useTorrada();
  // Os que a pessoa tirou agora: o cartão encolhe e some, e "Desfazer" traz de volta no mesmo lugar.
  const [tirados, setTirados] = useState<ReadonlySet<string>>(() => new Set());
  const [voltas, setVoltas] = useState<Record<string, number>>({});
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
    (previa() ? Promise.resolve({ itens: salvosDaPrevia(), proximo: null }) : alumia.salvos(null, 20))
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

  function tirar(p: Post, salvo: boolean) {
    if (!t3) return;
    setTirados((atual) => {
      const n = new Set(atual);
      if (salvo) n.delete(p.id);
      else n.add(p.id);
      return n;
    });
    if (salvo) return;
    torradas.mostrar({
      texto: t3.comum.tiradoDosSalvos,
      acao: {
        rotulo: t3.comum.desfazer,
        fazer: () => {
          setTirados((atual) => {
            const n = new Set(atual);
            n.delete(p.id);
            return n;
          });
          // O cartão volta como novo (com "Salvo" aceso) e, de verdade, salva de novo no banco (na prévia, fica só na tela).
          setVoltas((v) => ({ ...v, [p.id]: (v[p.id] ?? 0) + 1 }));
          if (!previa()) rede.salvar(p.id, true).catch((e) => torradas.mostrar({ texto: textoDoErro(s, e), erro: true }));
        },
      },
    });
  }

  if (!t || !t3) return <EsqueletoDaLinha rotulo={s.estados.carregando} quantos={3} />;
  return (
    <section aria-labelledby="alumia-salvos-titulo" className="al3-tela">
      <FaixaDaPrevia t={t3} />
      <header className="border-b border-rule px-[18px] py-4 font-sans">
        <h1 id="alumia-salvos-titulo" className="al3-cond al3-titulo-tela">{t.salvos.titulo}</h1>
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
          <ol aria-label={t.salvos.titulo} className="al3-lista-entra">
            {itens.map((p, i) => (
              <li
                key={p.id}
                className="al3-saindo"
                data-saindo={tirados.has(p.id) ? "sim" : undefined}
                style={{ "--i": i } as React.CSSProperties}
                // Fora da lista para o leitor de tela e o teclado enquanto some (o "Desfazer" do aviso traz de volta).
                inert={tirados.has(p.id)}
              >
                <div>
                  <PostCompacto key={voltas[p.id] ?? 0} post={p} lang={lang} s={s} t={t3} logado={situacao.logado} comComunidade aoErro={(e) => torradas.mostrar({ texto: textoDoErro(s, e), erro: true })} aoSalvar={(salvo) => tirar(p, salvo)} />
                </div>
              </li>
            ))}
          </ol>
          {itens.every((p) => tirados.has(p.id)) && <p className="px-[18px] py-6 font-sans text-ink-soft">{t.salvos.vazio}</p>}
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
      <Torradas estado={torradas} />
    </section>
  );
}
