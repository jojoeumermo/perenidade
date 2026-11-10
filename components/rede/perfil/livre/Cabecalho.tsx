// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// O cabeçalho do perfil livre: o MESMO componente na página do perfil e na prévia ao vivo do editor (o perfil muda enquanto a
// pessoa edita). Tudo vem da aparência conferida (lib/rede/aparencia.ts): a cor vira só variáveis CSS com "#rrggbb" calculado
// (com contraste garantido nos dois fundos e no botão), o clima e o modelo viram atributos de uma lista fechada, a capa e o rosto
// são desenhados a partir de palavras e dígitos. Nada de CSS, HTML ou URL livre. Alto contraste e e-ink passam por cima de tudo.
import type { CSSProperties, ReactNode } from "react";
import { linkLimpo, variaveisDoAcento, type AparenciaDoPerfil } from "@/lib/rede/aparencia";
import { dataCurta } from "@/lib/rede/org/contagem";
import { origemDaImagem } from "@/lib/rede/perfil";
import { preencher } from "@/lib/rede/preencher";
import type { CampoDoPerfil, StatusDoPerfil } from "@/lib/rede/tipos-org";
import type { ImagemDePerfil } from "@/lib/rede/tipos-perfil";
import { Avatar } from "../Avatar";
import { BioFormatada, CapaDeMosaico, FaixaPropria, RostoDePixels } from "./Pecas";
import type { TextosDoPerfilLivre } from "./textos";
import "./livre.css";

export interface DadosDoCabecalho {
  codinome: string;
  handle: string;
  pronomes: string | null;
  bio: string;
  status: { tipo: StatusDoPerfil; texto: string; ate: string | null } | null;
  campos: CampoDoPerfil[];
  avatar: ImagemDePerfil;
  capa: ImagemDePerfil;
}

/** As variáveis da cor do perfil num objeto de estilo (só cores "#rrggbb" calculadas aqui). */
export function estiloDoAcento(acento: string): CSSProperties {
  return variaveisDoAcento(acento) as CSSProperties;
}

export function CabecalhoDoPerfil({
  dados,
  aparencia,
  t,
  lang,
  acoes,
  depois,
  previa = false,
  nivel = 1,
}: {
  dados: DadosDoCabecalho;
  aparencia: AparenciaDoPerfil;
  t: TextosDoPerfilLivre;
  lang: string;
  /** Os botões (seguir, conversar, editar). */
  acoes?: ReactNode;
  /** O que vem logo abaixo (notas, erros). */
  depois?: ReactNode;
  /** Na prévia do editor: rótulo de região e sem foco nos links (a prévia não navega). */
  previa?: boolean;
  nivel?: 1 | 2;
}) {
  const a = aparencia;
  const capaImagem = a.capa ? null : origemDaImagem(dados.capa, "capa");
  const tamanhoDoRosto = a.layout === "centro" ? 112 : a.layout === "cartaz" ? 76 : 92;
  const Titulo = nivel === 1 ? "h1" : "h2";
  const tocandoLink = a.tocando?.link ? linkLimpo(a.tocando.link) : null;
  const passarFoco = previa ? -1 : undefined;

  return (
    <section
      className="pf"
      data-tema={a.tema}
      data-layout={a.layout}
      style={estiloDoAcento(a.acento)}
      aria-label={previa ? t.editor.previa : undefined}
      inert={previa ? true : undefined}
    >
      <div className="pf-capa">
        {a.capa ? (
          <CapaDeMosaico capa={a.capa} acento={a.acento} />
        ) : capaImagem ? (
          // eslint-disable-next-line @next/next/no-img-element -- desenho do projeto ou WebP já reencodado (sem EXIF).
          <img src={capaImagem} alt="" aria-hidden width={900} height={300} decoding="async" className="pf-capa-imagem" />
        ) : (
          <div aria-hidden className="pf-capa-vazia" />
        )}
        {a.layout === "cartaz" ? <div aria-hidden className="pf-capa-veu" /> : null}
      </div>

      <div className="pf-cabeca">
        <div className="pf-identidade">
          <div className="pf-rosto-moldura" style={{ width: tamanhoDoRosto, height: tamanhoDoRosto }}>
            {a.rosto ? <RostoDePixels px={a.rosto} tamanho={tamanhoDoRosto} /> : <Avatar imagem={dados.avatar} codinome={dados.codinome} tamanho={tamanhoDoRosto} />}
          </div>
          <div className="pf-nomes">
            <Titulo className="al-cond pf-nome">{dados.codinome}</Titulo>
            <p className="pf-handle">
              <span>@{dados.handle}</span>
              {dados.pronomes ? <span className="pf-pronomes">{dados.pronomes}</span> : null}
            </p>
          </div>
          {acoes ? <div className="pf-acoes">{acoes}</div> : null}
        </div>

        {dados.status || a.tocando ? (
          <div className="pf-agora">
            {dados.status ? (
              <p className="pf-status">
                <span aria-hidden className="pf-status-ponto" />
                <span className="pf-status-tipo">{t.agora.statusTipos[dados.status.tipo]}</span>
                {dados.status.texto ? <span>· {dados.status.texto}</span> : null}
                {dados.status.ate ? <span className="pf-status-ate">· {preencher(t.perfil.ate, { data: dataCurta(dados.status.ate, lang) })}</span> : null}
              </p>
            ) : null}
            {a.tocando ? (
              <p className="pf-tocando">
                <span aria-hidden className="pf-equalizador">
                  <i />
                  <i />
                  <i />
                </span>
                <span className="sr-only">{t.perfil.tocando}: </span>
                <span className="pf-tocando-texto">{a.tocando.texto}</span>
                {tocandoLink ? (
                  <a href={tocandoLink.href} target="_blank" rel="noopener noreferrer nofollow ugc" tabIndex={passarFoco} className="pf-tocando-link">
                    {preencher(t.perfil.ouvirEm, { dominio: tocandoLink.dominio })}
                  </a>
                ) : null}
              </p>
            ) : null}
          </div>
        ) : null}

        <BioFormatada bio={dados.bio} lang={lang} />

        {dados.campos.length > 0 ? (
          <dl className="pf-campos">
            {dados.campos.map((c, i) => {
              const link = /^https:\/\//i.test(c.valor) ? linkLimpo(c.valor) : null;
              return (
                <div key={`${i}-${c.rotulo}`} className="pf-campo">
                  <dt>{c.rotulo}</dt>
                  <dd>
                    {link ? (
                      <a href={link.href} target="_blank" rel="noopener noreferrer nofollow me" tabIndex={passarFoco} aria-label={preencher(t.perfil.linkDoCampo, { rotulo: c.rotulo, dominio: link.dominio })}>
                        <svg aria-hidden viewBox="0 0 16 16" className="pf-campo-icone">
                          <path d="M6.5 9.5l3-3M7 4.5l1-1a2.8 2.8 0 0 1 4 4l-1 1M9 11.5l-1 1a2.8 2.8 0 0 1-4-4l1-1" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                        </svg>
                        {link.dominio}
                        {new URL(link.href).pathname.length > 1 ? <span className="pf-campo-caminho">{new URL(link.href).pathname}</span> : null}
                      </a>
                    ) : (
                      c.valor
                    )}
                  </dd>
                </div>
              );
            })}
          </dl>
        ) : null}
        {depois}
      </div>
      <FaixaPropria faixa={a.faixa} altura={a.layout === "cartaz" ? 10 : 7} />
    </section>
  );
}
