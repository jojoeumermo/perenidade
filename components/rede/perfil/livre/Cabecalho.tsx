// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// O cabeçalho do perfil livre: o MESMO componente na página do perfil e na prévia ao vivo do editor (o perfil muda enquanto a
// pessoa edita). Tudo vem da aparência conferida (lib/rede/aparencia.ts): a cor vira só variáveis CSS com "#rrggbb" calculado
// (com contraste garantido nos dois fundos e no botão), o clima e o modelo viram atributos de uma lista fechada, a capa e o rosto
// são desenhados a partir de palavras e dígitos. Nada de CSS, HTML ou URL livre. Alto contraste e e-ink passam por cima de tudo.
import { useRef, type CSSProperties, type ReactNode } from "react";
import { linkLimpo, variaveisDoAcento, type AparenciaDoPerfil } from "@/lib/rede/aparencia";
import { useFotoPublica } from "@/lib/rede/fotos-publicas";
import { dataCurta } from "@/lib/rede/org/contagem";
import { origemDaImagem } from "@/lib/rede/perfil";
import { preencher } from "@/lib/rede/preencher";
import type { CampoDoPerfil, StatusDoPerfil } from "@/lib/rede/tipos-org";
import type { ImagemDePerfil } from "@/lib/rede/tipos-perfil";
import type { PublicoDoStatus, StatusDaLista } from "@/lib/rede/secoes-perfil";
import { useTextosDasSecoes } from "../secoes/textos";
import { seloContagensLigado } from "@/lib/rede/selo-contagens/cliente";
import { SeloDeIdentidade } from "../../identidade/Selo";
import { SeloDaPessoa } from "../../selo-contagens/PecasDoSelo";
import { Avatar16 } from "../../ui/Avatar16";
import { Avatar } from "../Avatar";
import { PresencaRecente, useRostoProtegido } from "../../presenca/NoPerfil";
import { BioFormatada, CapaDeMosaico, FaixaPropria, RostoDePixels } from "./Pecas";
import type { TextosDoPerfilLivre } from "./textos";
import "./livre.css";

export interface DadosDoCabecalho {
  codinome: string;
  handle: string;
  pronomes: string | null;
  bio: string;
  /** O tipo é da lista fechada (com "na luta" e "ausente", onda 12); `publico` só chega à dona ('roda' = só a roda vê). */
  status: { tipo: StatusDoPerfil | StatusDaLista; texto: string; ate: string | null; publico?: PublicoDoStatus | null } | null;
  campos: CampoDoPerfil[];
  avatar: ImagemDePerfil;
  capa: ImagemDePerfil;
  /** Os selos que o banco mandou (rede_perfil_de): "coordenacao" e "equipe" viram o selo de verificado ao lado do nome (A10). */
  selos?: readonly string[];
}

/** O selo de verificado da equipe e da coordenação (o papel no banco; some quando o papel sai). Não é apoio do instituto a ninguém. */
function SeloVerificado({ selos, t }: { selos?: readonly string[]; t: TextosDoPerfilLivre }) {
  const coordenacao = selos?.includes("coordenacao") ?? false;
  if (!coordenacao && !selos?.includes("equipe")) return null;
  const texto = coordenacao ? t.perfil.verificadoCoordenacao : t.perfil.verificadoEquipe;
  return (
    <span className="pf-verificado" title={texto}>
      <svg aria-hidden viewBox="0 0 16 16" width="18" height="18">
        <rect x={0.5} y={0.5} width={15} height={15} rx={4} fill="var(--al-vermelho, #e8321f)" />
        <path d="M4 8.3 6.7 11 12 5.2" fill="none" stroke="var(--al-sobre-vermelho, #fff)" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="sr-only">{texto}</span>
    </span>
  );
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
  logado = false,
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
  /** Quem vê tem conta (prompt 4: o "ativo recentemente" e a foto protegida só se pedem com conta). */
  logado?: boolean;
}) {
  const a = aparencia;
  const capaImagem = a.capa ? null : origemDaImagem(dados.capa, "capa");
  const tamanhoDoRosto = a.layout === "centro" ? 112 : a.layout === "cartaz" ? 76 : 92;
  const Titulo = nivel === 1 ? "h1" : "h2";
  const tocandoLink = a.tocando?.link ? linkLimpo(a.tocando.link) : null;
  const passarFoco = previa ? -1 : undefined;

  const cartaz = a.layout === "cartaz";
  const ts = useTextosDasSecoes(lang);
  // Os rótulos de antes vêm dos textos do perfil livre; os dois da onda 12, dos textos das seções.
  const rotuloDoStatus = (tipo: StatusDoPerfil | StatusDaLista): string =>
    (t.agora.statusTipos as Record<string, string>)[tipo] ?? (ts?.status.tipos as Record<string, string> | undefined)?.[tipo] ?? "";
  const fotoPublica = useFotoPublica(dados.handle);
  // Prompt 4, item 1: a foto que a dona protegeu (desligado, ou na prévia do editor, a moldura de sempre, sem nada a mais).
  const refDoRosto = useRef<HTMLDivElement>(null);
  const protecao = useRostoProtegido(refDoRosto, previa ? null : dados.handle, lang, logado);
  const rosto = (
    <div ref={refDoRosto} className="pf-rosto-moldura" style={{ width: tamanhoDoRosto, height: tamanhoDoRosto }} {...protecao.atributos}>
      {fotoPublica ? (
        // Quem escolheu aparecer com nome e foto: a foto vale em todo lugar, também aqui (o Avatar16 a desenha).
        <Avatar16 handle={dados.handle} tamanho={tamanhoDoRosto} />
      ) : a.rosto ? (
        <RostoDePixels px={a.rosto} tamanho={tamanhoDoRosto} />
      ) : origemDaImagem(dados.avatar, "avatar") ? (
        <Avatar imagem={dados.avatar} codinome={dados.codinome} tamanho={tamanhoDoRosto} />
      ) : (
        // Sem rosto desenhado nem imagem: o mesmo mosaico de 16 cartões que a pessoa tem nos cartões da linha (nunca iniciais).
        <Avatar16 handle={dados.handle} tamanho={tamanhoDoRosto} />
      )}
      {protecao.camada}
    </div>
  );
  const nomes = (
    <div className="pf-nomes">
      <Titulo className="al-cond pf-nome">
        {dados.codinome}
        <SeloVerificado selos={dados.selos} t={t} />
      </Titulo>
      <p className="pf-handle">
        <span>@{dados.handle}</span>
        {dados.pronomes ? <span className="pf-pronomes">{dados.pronomes}</span> : null}
        <SeloDeIdentidade handle={dados.handle} lang={lang} />
        {/* O selo de verificado das pessoas (Prompt 4, item 3): só fora da prévia do editor e com a flag. */}
        {!previa && seloContagensLigado() ? <SeloDaPessoa handle={dados.handle} lang={lang} /> : null}
        {previa ? null : <PresencaRecente handle={dados.handle} lang={lang} logado={logado} />}
      </p>
    </div>
  );
  // O status vira carimbo inclinado sobre a capa (como o CONFIRMADO das pranchas); o leitor de tela ouve o status inteiro
  // na linha "agora", logo depois do nome.
  const temDetalheDoStatus = Boolean(dados.status && (dados.status.texto || dados.status.ate));

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
          <CapaDeMosaico capa={a.capa} acento={a.acento} alta={cartaz} />
        ) : capaImagem ? (
          // eslint-disable-next-line @next/next/no-img-element -- desenho do projeto ou WebP já reencodado (sem EXIF).
          <img src={capaImagem} alt="" aria-hidden width={900} height={300} decoding="async" className="pf-capa-imagem" />
        ) : (
          <div aria-hidden className="pf-capa-vazia" />
        )}
        {cartaz ? <div aria-hidden className="pf-capa-veu" /> : null}
        {dados.status ? (
          <span aria-hidden className="al-cond pf-carimbo" data-tipo={dados.status.tipo} key={dados.status.tipo}>
            {rotuloDoStatus(dados.status.tipo)}
          </span>
        ) : null}
        {cartaz ? (
          <div className="pf-cartaz">
            {rosto}
            {nomes}
          </div>
        ) : null}
      </div>

      <div className="pf-cabeca">
        {cartaz ? (
          acoes ? <div className="pf-acoes pf-acoes-cartaz">{acoes}</div> : null
        ) : (
          <div className="pf-identidade">
            {rosto}
            {nomes}
            {acoes ? <div className="pf-acoes">{acoes}</div> : null}
          </div>
        )}

        {dados.status || a.tocando ? (
          <div className="pf-agora">
            {dados.status ? (
              <p className={temDetalheDoStatus ? "pf-status" : "sr-only"}>
                <span aria-hidden className="pf-status-ponto" />
                <span className="sr-only">{rotuloDoStatus(dados.status.tipo)}: </span>
                {dados.status.texto ? <span className="pf-status-texto">{dados.status.texto}</span> : null}
                {dados.status.ate ? <span className="pf-status-ate">{preencher(t.perfil.ate, { data: dataCurta(dados.status.ate, lang) })}</span> : null}
              </p>
            ) : null}
            {dados.status?.publico === "roda" && ts ? <p className="pf-status-roda">{ts.status.soRoda}</p> : null}
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
