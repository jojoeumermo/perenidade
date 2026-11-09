// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// O perfil de uma organização (PLANO-ALUMIA §3 "Org-Perfil"; não há prancha: segue a linguagem da computador-inicio e da
// traga-sua-organizacao). Capa em mosaico com a palavra da organização, selo com a data e a regra ("não é apoio do Instituto"),
// Seguir, Avisar quando postar, Entrar num núcleo; abas Posts, Atos, Prestação de contas (Como votamos), Consultas à base e
// Plenárias; ao lado (computador) ou embaixo (celular), a plenária ao vivo e os núcleos.
//
// Privacidade (PLANO-ALUMIA §6; LGPD art. 5º, II e art. 11): sem contagem de seguidores, sem lista de quem segue, de quem é de um
// núcleo ou de quem votou; pessoas na sala só agregadas e a partir de 3; quem cuida da conta nunca aparece.
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { dataCurta } from "@/lib/rede/org/contagem";
import { preencher } from "@/lib/rede/preencher";
import type { TextosDaOrg } from "@/lib/rede/textos-org";
import { ABAS_DA_ORG, type AbaDaOrg, type OrgPublica } from "@/lib/rede/tipos-org";
import { Mosaico } from "../mosaico/Mosaico";
import { Botao } from "../ui/Botao";
import { Carimbo } from "../ui/Carimbo";
import { Pilula } from "../ui/Pilula";
import { Abas } from "./Abas";
import { type AcoesDaOrg, BlocoDaPlenaria, CartaoDaConsulta, ComoVotamos, NucleosDaOrg } from "./Blocos";
import { type AcoesDeGestor, CuidarDaOrg } from "./CuidarDaOrg";
import { SeloDaOrg, SeloPequeno } from "./partes";
import "./org.css";

export interface PropsDoPerfilDaOrg {
  org: OrgPublica;
  t: TextosDaOrg;
  lang: string;
  acoes: AcoesDaOrg;
  /** A pessoa está logada e é membro da Alumia (pode seguir, pedir núcleo, perguntar). */
  membro: boolean;
  /** A aba Posts (a linha da organização; no exemplo, os posts de exemplo). */
  posts: ReactNode;
  /** A aba Atos (no exemplo, os atos de exemplo; no de verdade, a linha de atos da F2 quando houver). */
  atos?: ReactNode;
  /** Aba aberta de início ("nucleos" rola até os núcleos). */
  abaInicial?: string | null;
  /** O aviso de cima (o perfil de exemplo põe "Dados ilustrativos"). */
  aviso?: ReactNode;
  /** As ações de quem gerencia (só no perfil de verdade; aparecem só quando o banco diz `gerencio`). */
  cuidar?: AcoesDeGestor;
  /** Depois de uma ação de quem gerencia: recarregar o perfil. */
  aoMudar?: () => void;
}

export function PerfilDaOrg({ org, t, lang, acoes, membro, posts, atos, abaInicial, aviso, cuidar, aoMudar }: PropsDoPerfilDaOrg) {
  const tp = t.perfil;
  const id = useId();
  const inicial = (ABAS_DA_ORG as readonly string[]).includes(abaInicial ?? "") ? (abaInicial as AbaDaOrg) : "posts";
  const [aba, setAba] = useState<AbaDaOrg>(inicial);
  const [sigo, setSigo] = useState(org.sigo);
  const [sino, setSino] = useState(org.sino);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  const nucleosRef = useRef<HTMLElement>(null);
  const abasRef = useRef<HTMLDivElement>(null);

  const verNucleos = () => {
    nucleosRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    nucleosRef.current?.focus({ preventScroll: true });
  };

  useEffect(() => {
    if (abaInicial === "nucleos") verNucleos();
    else if (abaInicial && abaInicial !== "posts") abasRef.current?.scrollIntoView({ block: "start" });
  }, [abaInicial]);

  async function mudar<T>(f: () => Promise<T>, depois: (r: T) => void) {
    setOcupado(true);
    setErro("");
    try {
      depois(await f());
    } catch (e) {
      const codigo = typeof e === "object" && e !== null && "code" in e ? String((e as { code: unknown }).code) : "";
      setErro(codigo === "banco_desatualizado" || codigo === "sem_servico" ? t.erros.semBanco : t.erros.falha);
    } finally {
      setOcupado(false);
    }
  }

  const aoVivo = org.plenarias.find((p) => p.aoVivo) ?? null;
  const abertas = org.consultas.filter((c) => c.situacao === "aberta");

  const painel: Record<AbaDaOrg, ReactNode> = {
    posts,
    atos: atos ?? <p className="al-painel-vazio">{tp.vazioAtos}</p>,
    contas: <ComoVotamos votacoes={org.votacoes} t={t} lang={lang} />,
    consultas:
      org.consultas.length === 0 ? (
        <p className="al-painel-vazio">{t.consulta.vazio}</p>
      ) : (
        org.consultas.map((c) => <CartaoDaConsulta key={c.id} c={c} t={t} lang={lang} acoes={acoes} aoVerNucleos={verNucleos} />)
      ),
    plenarias:
      org.plenarias.length === 0 ? (
        <p className="al-painel-vazio">{t.plenaria.vazio}</p>
      ) : (
        org.plenarias.map((p) => <BlocoDaPlenaria key={p.id} p={p} t={t} lang={lang} acoes={acoes} podePerguntar={membro} />)
      ),
  };

  return (
    <div className="al-perfil al-perfil-org">
      {aviso}
      <div className="al-perfil-org-grade">
        <div className="al-perfil-org-principal">
          <div className="al-perfil-capa">
            <Mosaico palavra={org.palavra} semente={org.handle} proporcao={0.9} rotulo={preencher(tp.capa, { codinome: org.codinome, palavra: org.palavra })} className="al-perfil-capa-mosaico" />
          </div>
          <header className="al-perfil-cabeca">
            <div className="al-perfil-linha1">
              <div className="al-perfil-nomes">
                <p className="al-perfil-tipo">{t.tipos[org.tipo]}{org.cidade ? ` · ${org.cidade}` : ""}</p>
                <h1 className="al-cond al-perfil-nome">{org.codinome}</h1>
                <p className="al-perfil-handle">@{org.handle}</p>
              </div>
            </div>
            <div className="al-perfil-selo">
              {org.verificadaEm ? (
                <>
                  <SeloDaOrg t={t} lang={lang} desde={dataCurta(org.verificadaEm, lang)} />
                  <span>{t.selo.regra}</span>
                  {org.documento ? <span>{preencher(t.selo.conferido, { documento: org.documento })}</span> : null}
                </>
              ) : (
                <span>{t.selo.semSelo}</span>
              )}
            </div>
            {org.bio ? <p className="al-perfil-bio">{org.bio}</p> : null}
            <div className="al-perfil-acoes">
              <Botao
                variante={sigo ? "claro" : "primario"}
                pressionado={sigo}
                disabled={!membro || ocupado}
                onClick={() => void mudar(() => acoes.seguir(!sigo), (r) => setSigo(r.sigo))}
              >
                {sigo ? tp.seguindo : tp.seguir}
              </Botao>
              <Botao variante={sino ? "claro" : "contorno"} pressionado={sino} disabled={!membro || ocupado} onClick={() => void mudar(() => acoes.sino(!sino), (r) => setSino(r.sino))} title={tp.sinoAjuda}>
                {tp.sino}
              </Botao>
              <Botao variante="contorno" onClick={verNucleos} disabled={org.nucleos.length === 0}>
                {tp.entrarNucleo}
              </Botao>
            </div>
            {!membro ? <p className="al-perfil-nota">{tp.entreParaSeguir}</p> : null}
            {org.gerencio ? <p className="al-perfil-nota">{tp.gerencio}</p> : null}
            <p className="al-perfil-nota">{tp.semContagens}</p>
            {erro ? (
              <p className="al-perfil-erro" role="alert">
                {erro}
              </p>
            ) : null}
          </header>

          {org.gerencio && cuidar ? <CuidarDaOrg org={org} t={t} acoes={cuidar} aoMudar={aoMudar ?? (() => undefined)} /> : null}

          {abertas.length > 0 && aba !== "consultas" ? (
            <section className="al-perfil-bloco" aria-label={t.consulta.aberta}>
              <CartaoDaConsulta c={abertas[0]} t={t} lang={lang} acoes={acoes} aoVerNucleos={verNucleos} />
            </section>
          ) : null}

          <Abas ref={abasRef} id={id} abas={ABAS_DA_ORG} atual={aba} aoMudar={setAba} rotulos={tp.abas} rotulo={preencher(tp.abas.rotulo, { codinome: org.codinome })} />
          <div id={`${id}-painel`} role="tabpanel" aria-labelledby={`${id}-aba-${aba}`} className="al-painel">
            {painel[aba]}
          </div>
        </div>

        <aside className="al-perfil-org-lado">
          {aoVivo && aba !== "plenarias" ? (
            <section className="al-perfil-bloco" aria-label={t.plenaria.aoVivo}>
              <BlocoDaPlenaria p={aoVivo} t={t} lang={lang} acoes={acoes} podePerguntar={membro} />
            </section>
          ) : null}
          <section ref={nucleosRef} tabIndex={-1} className="al-perfil-bloco" aria-labelledby={`${id}-nucleos`} id="al-org-nucleos">
            <h2 id={`${id}-nucleos`} className="al-cond">
              {tp.nucleos.titulo}
            </h2>
            <NucleosDaOrg nucleos={org.nucleos} t={t} acoes={acoes} podeEntrar={membro} />
          </section>
        </aside>
      </div>
    </div>
  );
}

/** A lista de atos simples (perfil de exemplo, até a F2 dar a linha de atos da organização). */
export function ListaDeAtos({ atos, t, lang }: { atos: { id: string; nome: string; quando: string; onde: string; situacao: "confirmado" | "adiado" | "cancelado" }[]; t: TextosDaOrg; lang: string }) {
  const fmt = (iso: string, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(lang === "pt" ? "pt-BR" : lang, { ...o, timeZone: "America/Sao_Paulo" }).format(new Date(iso));
  if (atos.length === 0) return <p className="al-painel-vazio">{t.perfil.vazioAtos}</p>;
  return (
    <ul className="al-lista-simples">
      {atos.map((a) => (
        <li key={a.id} className="al-ato-linha">
          <span className="al-ato-dia al-cond">
            <b>{fmt(a.quando, { day: "2-digit" })}</b>
            <span>{fmt(a.quando, { month: "short" }).replace(".", "")}</span>
          </span>
          <span className="al-ato-info">
            <strong className={a.situacao === "cancelado" ? "al-riscado" : undefined}>{a.nome}</strong>
            <span>
              {a.onde} · {fmt(a.quando, { weekday: "short", hour: "2-digit", minute: "2-digit" })}
            </span>
          </span>
          <Carimbo situacao={a.situacao} texto={t.pagina.ferramentas.atos.carimbos[a.situacao]} tamanho="p" />
        </li>
      ))}
    </ul>
  );
}

/** Os posts de exemplo (aba Posts do perfil de exemplo). */
export function PostsDeExemplo({ posts, org, t, lang }: { posts: { id: string; quando: string; comunidade: string; cor: 1 | 2 | 3 | 4 | 5; texto: string }[]; org: OrgPublica; t: Pick<TextosDaOrg, "selo">; lang: string }) {
  return (
    <ul className="al-lista-simples">
      {posts.map((p) => (
        <li key={p.id}>
          <span className="al-post-exemplo-topo">
            <b>{org.codinome}</b>
            {org.verificadaEm ? <SeloPequeno t={t} lang={lang} /> : null}
            <span>@{org.handle} · {p.quando}</span>
            <Pilula texto={p.comunidade} cor={p.cor} />
          </span>
          <p className="al-post-exemplo-texto">{p.texto}</p>
        </li>
      ))}
    </ul>
  );
}
