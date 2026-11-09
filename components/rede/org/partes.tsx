// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Peças pequenas da F4, sem estado e sem "use client" (servem na página do servidor e nas telas do navegador): o selo como na
// prancha, as barras de resultado de consulta, a lista de núcleos e o cartão "Ao vivo agora".
import type { CSSProperties, ReactNode } from "react";
import { escreverPessoas, porcentagem } from "@/lib/rede/org/contagem";
import { preencher } from "@/lib/rede/preencher";
import type { TextosDaOrg } from "@/lib/rede/textos-org";
import type { NucleoDaOrg, PlenariaAoVivo } from "@/lib/rede/tipos-org";
import { Selo } from "../ui/Selo";
import "./org.css";

/**
 * O selo "Organização verificada" como na prancha computador-inicio (papel com o visto vermelho), sempre com a regra junto ("não
 * é apoio do Instituto Lúcia", PLANO-ALUMIA §6.5) e levando à página que explica o selo. Para o cartão do post (F1) usar este.
 */
export function SeloDaOrg({ t, lang, desde }: { t: Pick<TextosDaOrg, "selo">; lang: string; desde?: string }) {
  return <Selo texto={t.selo.texto} regra={t.selo.regra} desde={desde ? preencher(t.selo.desde, { data: desde }) : undefined} href={`/${lang}/alumia/organizacoes`} className="al-selo-papel" />;
}

/**
 * As barras do resultado de uma consulta (prancha: "Votar contra 71%"). A maior vem mais forte. A porcentagem está sempre escrita
 * (a barra é só reforço) e cada linha tem a frase inteira para o leitor de tela.
 */
export function BarrasDaConsulta({ opcoes, rotulo, barra }: { opcoes: { id: string; texto: string; proporcao: number | null }[]; rotulo: string; barra: string }) {
  const comP = opcoes.map((o) => ({ ...o, p: porcentagem(o.proporcao) ?? 0 }));
  const maior = Math.max(...comP.map((o) => o.p));
  return (
    <ul className="al-org-barras" aria-label={rotulo}>
      {comP.map((o) => (
        <li key={o.id} className={`al-org-barra ${o.p === maior && maior > 0 ? "al-org-barra-primeira" : ""}`} aria-label={preencher(barra, { opcao: o.texto, p: o.p })}>
          <span aria-hidden className="al-org-barra-cheia" style={{ width: `${o.p}%` }} />
          <span aria-hidden>{o.texto}</span>
          <span aria-hidden className="al-org-barra-p">{o.p}%</span>
        </li>
      ))}
    </ul>
  );
}

/** A lista de núcleos (prancha: anel na cor, nome, "terças, 19h"); `acao` põe o botão de entrar de cada um. */
export function ListaDeNucleos({ nucleos, rotulo, acao }: { nucleos: Pick<NucleoDaOrg, "id" | "nome" | "cor" | "quando" | "onde">[]; rotulo: string; acao?: (id: string) => ReactNode }) {
  return (
    <ul className="al-org-nucleos" aria-label={rotulo}>
      {nucleos.map((n) => (
        <li key={n.id} className="al-org-nucleo">
          <span aria-hidden className="al-org-anel" style={{ "--al-cor": `var(--al-com-${n.cor})` } as CSSProperties} />
          <span className="al-org-nucleo-nome">
            {n.nome}
            {n.onde ? <span className="al-org-nucleo-onde">{n.onde}</span> : null}
          </span>
          <span className="al-org-nucleo-quando">{n.quando}</span>
          {acao ? acao(n.id) : null}
        </li>
      ))}
    </ul>
  );
}

/**
 * O cartão "Ao vivo agora" (prancha computador-inicio, coluna da direita): faixa vermelha com o ponto que pulsa (parado para quem
 * pediu menos movimento), quantas pessoas na sala (agregado, "mais de", e nada abaixo de 3), o título e os dois botões que a
 * prancha tem, passados por quem usa (Entrar na sala e Mandar pergunta). `extra` põe a fila de perguntas embaixo.
 */
export function CartaoAoVivo({
  plenaria,
  t,
  lang,
  acoes,
  extra,
  titulo = "h3",
  contagem = "sala",
}: {
  plenaria: Pick<PlenariaAoVivo, "titulo" | "descricao" | "naSala" | "naFila">;
  t: Pick<TextosDaOrg, "plenaria">;
  lang: string;
  acoes?: ReactNode;
  extra?: ReactNode;
  titulo?: "h2" | "h3";
  /** O que vai no canto da faixa: pessoas na sala (coluna) ou perguntas na fila (página para organizações). */
  contagem?: "sala" | "fila";
}) {
  const Titulo = titulo;
  const canto =
    contagem === "sala"
      ? escreverPessoas(plenaria.naSala, t.plenaria.naSala, lang)
      : preencher(t.plenaria.naFila, { n: new Intl.NumberFormat(lang === "pt" ? "pt-BR" : lang).format(plenaria.naFila) });
  return (
    <article className="al-org-aovivo">
      <div className="al-org-aovivo-topo">
        <span className="al-org-aovivo-selo al-cond">
          <span aria-hidden className="al-org-aovivo-ponto" />
          {t.plenaria.aoVivo}
        </span>
        <span className="al-org-aovivo-conta">{canto}</span>
      </div>
      {plenaria.titulo ? (
        <div className="al-org-aovivo-corpo">
          <Titulo>{plenaria.titulo}</Titulo>
          {plenaria.descricao ? <p>{plenaria.descricao}</p> : null}
          {acoes ? <div className="al-org-aovivo-acoes">{acoes}</div> : null}
        </div>
      ) : null}
      {extra}
    </article>
  );
}
