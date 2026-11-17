// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useId, useState } from "react";
import { decisao as cliente, type NumerosDaComunidade as Numeros } from "@/lib/rede/decisao/cliente";
import { preencher } from "@/lib/rede/preencher";
import { Botao } from "../../ui/Botao";
import { diaCurto, erroDaDecisao, type TextosDaDecisao } from "./textos";

type Coluna = "posts" | "respostas" | "membros_novos" | "denuncias" | "decididas" | "resposta_horas";

/**
 * Os números da comunidade para quem a modera (L2-56): agora (denúncias esperando, votações abertas), esta semana em ladrilhos e as
 * últimas 8 semanas numa tabela. Só agregados, cada número a partir de 3 (o banco já manda nulo abaixo disso). Nenhuma pessoa,
 * nenhum "quem mais posta".
 */
export function NumerosDaComunidade({ slug, td, lang }: { slug: string; td: TextosDaDecisao; lang: string }) {
  const id = useId();
  const tn = td.numeros;
  const [estado, setEstado] = useState<{ slug: string; dado?: Numeros; erro?: string } | null>(null);
  const [versao, setVersao] = useState(0);
  // No celular, só esta semana e a anterior; as outras atrás de um botão (no computador, a tabela inteira, como antes).
  const [todas, setTodas] = useState(false);

  useEffect(() => {
    let vivo = true;
    cliente.numeros(slug).then(
      (dado) => vivo && setEstado({ slug, dado }),
      (e) => vivo && setEstado({ slug, erro: erroDaDecisao(td, e) }),
    );
    return () => {
      vivo = false;
    };
  }, [slug, td, versao]);

  const colunas: { chave: Coluna; rotulo: string }[] = [
    { chave: "posts", rotulo: tn.posts },
    { chave: "respostas", rotulo: tn.respostas },
    { chave: "membros_novos", rotulo: tn.membros },
    { chave: "denuncias", rotulo: tn.denuncias },
    { chave: "decididas", rotulo: tn.decididas },
    { chave: "resposta_horas", rotulo: tn.tempo },
  ];
  const valor = (n: number | null, chave: Coluna) => (n === null ? tn.menosDe3 : chave === "resposta_horas" ? preencher(tn.horas, { n: n.toLocaleString(lang === "pt" ? "pt-BR" : lang) }) : n.toLocaleString(lang === "pt" ? "pt-BR" : lang));

  let corpo;
  if (!estado || estado.slug !== slug) corpo = <p className="d10-nota" role="status">{td.carregando}</p>;
  else if (estado.erro || !estado.dado) {
    corpo = (
      <div>
        <p className="d10-erro" role="alert">{estado.erro}</p>
        <Botao variante="contorno" tamanho="p" onClick={() => setVersao((n) => n + 1)}>
          {td.tentar}
        </Botao>
      </div>
    );
  } else {
    const n = estado.dado;
    const esta = n.semanas[0];
    // A maior contagem de posts visível nas 8 semanas, para a barrinha da tabela.
    const maiorPosts = Math.max(0, ...n.semanas.map((s) => s.posts ?? 0));
    corpo = (
      <>
        <div className="d10-ladrilhos">
          <div className="d10-ladrilho-grupo">
            <span className="d10-cond d10-grupo-rotulo">{tn.agora}</span>
            <Ladrilho rotulo={tn.denunciasAbertas} valor={n.denuncias_abertas === null ? tn.menosDe3 : String(n.denuncias_abertas)} vazio={n.denuncias_abertas === null} />
            <Ladrilho rotulo={tn.votacoesAbertas} valor={String(n.votacoes_abertas)} vazio={false} />
          </div>
          {esta ? (
            <div className="d10-ladrilho-grupo d10-ladrilho-grupo-largo">
              <span className="d10-cond d10-grupo-rotulo">{tn.estaSemana}</span>
              {colunas.map((c) => (
                <Ladrilho key={c.chave} rotulo={c.rotulo} valor={valor(esta[c.chave], c.chave)} vazio={esta[c.chave] === null} />
              ))}
            </div>
          ) : null}
        </div>
        <div className="d10-tabela-caixa">
          <table className="d10-tabela" aria-describedby={`${id}-nota`} data-todas={todas ? "" : undefined} id={`${id}-tabela`}>
            <caption className="sr-only">{tn.titulo}</caption>
            <thead>
              <tr>
                <th scope="col">{tn.semana}</th>
                {colunas.map((c) => (
                  <th key={c.chave} scope="col">
                    {c.rotulo}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {n.semanas.map((s, i) => (
                <tr key={s.semana} className={i >= 2 ? "d10-antiga" : undefined}>
                  <th scope="row">{i === 0 ? tn.estaSemana : diaCurto(s.semana, lang)}</th>
                  {colunas.map((c) => (
                    <td key={c.chave} data-rotulo={c.rotulo} className={s[c.chave] === null ? "d10-poucos" : ""}>
                      <span>{valor(s[c.chave], c.chave)}</span>
                      {c.chave === "posts" && s.posts !== null && maiorPosts > 0 ? (
                        <span aria-hidden className="d10-mini">
                          <span style={{ inlineSize: `${Math.round((s.posts / maiorPosts) * 100)}%` }} />
                        </span>
                      ) : null}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {n.semanas.length > 2 ? (
            <button type="button" className="al-botao al-botao-contorno al-botao-m d10-so-estreito" aria-expanded={todas} aria-controls={`${id}-tabela`} onClick={() => setTodas((v) => !v)}>
              {todas ? tn.esconderAnteriores : tn.verAnteriores}
            </button>
          ) : null}
        </div>
        <p id={`${id}-nota`} className="d10-nota">
          {tn.notaTempo} {tn.notaMembros}
        </p>
      </>
    );
  }

  return (
    <section className="d10-numeros" aria-labelledby={`${id}-t`}>
      <h3 id={`${id}-t`} className="d10-cond d10-secao-titulo">
        <span aria-hidden className="d10-ladrilho-icone">≡</span>
        {tn.titulo}
      </h3>
      <p className="d10-lead">{tn.lead}</p>
      {corpo}
    </section>
  );
}

function Ladrilho({ rotulo, valor, vazio }: { rotulo: string; valor: string; vazio: boolean }) {
  return (
    <div className={`d10-ladrilho ${vazio ? "d10-ladrilho-vazio" : ""}`}>
      <span className="d10-cond d10-ladrilho-n">{valor}</span>
      <span className="d10-ladrilho-rotulo">{rotulo}</span>
    </div>
  );
}
