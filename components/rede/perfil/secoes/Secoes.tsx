// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// As seções próprias do perfil (onda 12, 12D): Sobre, Links, Trilhas, Comunidades e "Onde eu somei". Cada uma só aparece se a
// pessoa a escolheu (a ordem é dela) e o banco já manda só o que pode ser visto. Nada de contagem de cliques, de lista de quem
// segue, de lugar. Os links saem limpos, com rel="me" (o perfil diz "este site é meu", e o site pode dizer o mesmo de volta).
import { useId } from "react";
import Link from "@/components/Link";
import { localePath } from "@/i18n/config";
import { linkLimpo } from "@/lib/rede/aparencia";
import type { SecoesVistas } from "@/lib/rede/cliente-secoes-perfil";
import { slugDoSelo } from "@/lib/rede/perfil";
import { useNomesDasTrilhas } from "../../estudo/conquistas/usarNomesDasTrilhas";
import { preencher } from "@/lib/rede/preencher";
import { periodoEmTexto, type SecaoDoPerfil } from "@/lib/rede/secoes-perfil";
import { enderecos } from "@/lib/rede/tipos";
import type { TextosDasSecoes } from "./textos";
import "./secoes.css";

interface Props {
  chave: SecaoDoPerfil;
  vistas: SecoesVistas;
  /** Os selos do perfil (as trilhas vêm daqui: 'trilha:<slug>', já filtrados pelo que a pessoa escolheu mostrar). */
  selos: readonly string[];
  meu: boolean;
  t: TextosDasSecoes;
  lang: string;
}

function Moldura({ titulo, children, vazio }: { titulo: string; children?: React.ReactNode; vazio?: string }) {
  const id = useId();
  return (
    <section className="pfs-secao" aria-labelledby={id}>
      <h2 id={id} className="al-cond pfs-titulo">
        <i aria-hidden className="pfs-ladrilho" />
        {titulo}
      </h2>
      {vazio ? <p className="pfs-vazio">{vazio}</p> : children}
    </section>
  );
}

function IconeConferido() {
  return (
    <svg aria-hidden viewBox="0 0 16 16" width="14" height="14">
      <path d="M8 1l1.8 1.3 2.2-.1.7 2.1 1.8 1.3-.7 2.1.7 2.1-1.8 1.3-.7 2.1-2.2-.1L8 15l-1.8-1.3-2.2.1-.7-2.1L1.5 10.4l.7-2.1-.7-2.1 1.8-1.3.7-2.1 2.2.1z" fill="currentColor" />
      <path d="M5.2 8.2l1.9 1.9 3.8-4" fill="none" stroke="var(--al-fundo)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Uma seção própria do perfil. Nula quando não há o que mostrar a quem visita (a dona vê o aviso de vazio). */
export function SecaoPropria({ chave, vistas, selos, meu, t, lang }: Props) {
  const nome = t.secoes.nomes[chave];
  switch (chave) {
    case "sobre": {
      const texto = vistas.sobre ?? "";
      if (!texto && !meu) return null;
      return (
        <Moldura titulo={nome} vazio={texto ? undefined : t.secoes.ajudas.sobre}>
          <div className="pfs-sobre">
            {texto.split(/\n{2,}/).map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        </Moldura>
      );
    }
    case "links": {
      const links = vistas.links ?? [];
      if (links.length === 0 && !meu) return null;
      return (
        <Moldura titulo={nome} vazio={links.length ? undefined : t.links.vazio}>
          <ul className="pfs-links">
            {links.map((l) => {
              const limpo = linkLimpo(l.url);
              if (!limpo) return null;
              const conferido = l.conferido === "rel_me" ? t.links.conferidoRelMe : l.conferido === "mediacao" ? t.links.conferidoMediacao : null;
              return (
                <li key={l.url}>
                  <a href={limpo.href} rel="me noopener noreferrer nofollow" target="_blank" className="pfs-link" data-conferido={l.conferido ? "" : undefined}>
                    <span className="pfs-link-titulo">{l.titulo}</span>
                    <span className="pfs-link-dominio">{limpo.dominio}</span>
                    {conferido ? (
                      <span className="pfs-carimbo" title={conferido}>
                        <IconeConferido />
                        <span className="al-cond">{t.links.conferido}</span>
                        <span className="sr-only">: {conferido}</span>
                      </span>
                    ) : null}
                  </a>
                </li>
              );
            })}
          </ul>
        </Moldura>
      );
    }
    case "trilhas": {
      const slugs = selos.map(slugDoSelo).filter((s): s is string => Boolean(s));
      if (slugs.length === 0 && !meu) return null;
      return (
        <Moldura titulo={nome} vazio={slugs.length ? undefined : t.trilhas.vazio}>
          <ul className="pfs-ladrilhos">
            {slugs.map((slug) => (
              <li key={slug}>
                <Link href={localePath(lang, `/trilhas/${slug}`)} className="pfs-trilha">
                  <NomeDaTrilha slug={slug} lang={lang} />
                </Link>
              </li>
            ))}
          </ul>
          <p className="pfs-nota">{t.trilhas.ajuda}</p>
        </Moldura>
      );
    }
    case "comunidades": {
      const lista = vistas.comunidades ?? [];
      if (lista.length === 0 && !meu) return null;
      return (
        <Moldura titulo={nome} vazio={lista.length ? undefined : t.comunidades.vazio}>
          <ul className="pfs-ladrilhos">
            {lista.map((c) => (
              <li key={c.slug}>
                <Link href={enderecos.comunidade(lang, c.slug)} className="pfs-comunidade" style={/^#[0-9a-f]{6}$/.test(c.cor) ? { ["--pfs-cor" as string]: c.cor } : undefined}>
                  <i aria-hidden />
                  {c.nome}
                </Link>
              </li>
            ))}
          </ul>
        </Moldura>
      );
    }
    case "voluntariado": {
      const lista = vistas.voluntariado ?? [];
      if (lista.length === 0 && !meu) return null;
      return (
        <Moldura titulo={nome} vazio={lista.length ? undefined : t.voluntariado.vazio}>
          <ul className="pfs-somei">
            {lista.map((v) => (
              <li key={`${v.frente}-${v.de}`}>
                <span className="pfs-somei-frente">{t.voluntariado.frentes[v.frente]}</span>
                <span className="pfs-somei-anos">{periodoEmTexto(v.de, v.ate, t.voluntariado.hoje)}</span>
              </li>
            ))}
          </ul>
          {lista.length ? (
            <p className="pfs-nota pfs-nota-carimbo">
              <IconeConferido />
              {t.voluntariado.confirmado}
            </p>
          ) : null}
        </Moldura>
      );
    }
    default:
      return null;
  }
}

/** O texto curto que diz quantos, só a partir de 3 (abaixo disso, nada). */
/** O título da trilha no idioma da página (a lista do site); o fim do endereço só enquanto a lista não chega ou se não chegar. */
function NomeDaTrilha({ slug, lang }: { slug: string; lang: string }) {
  const nomes = useNomesDasTrilhas(lang);
  return <>{nomes.nome(slug)}</>;
}

export function quantasPessoas(n: number | null, t: TextosDasSecoes, lang: string): string | null {
  return n === null ? null : preencher(t.pacote.nPessoas, { n: n.toLocaleString(lang) });
}
