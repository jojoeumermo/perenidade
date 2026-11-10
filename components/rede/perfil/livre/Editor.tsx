// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// O editor do perfil livre (/alumia/editar-perfil com a Alumia nova): a pessoa mexe e o PRÓPRIO cabeçalho do perfil muda na hora
// (prévia ao vivo, o mesmo componente da página), com desfazer/refazer (Ctrl+Z, Ctrl+Shift+Z), aviso de mudança não salva e um
// "Salvar" só. Só valores escolhidos ou conferidos saem daqui (lib/rede/aparencia.ts); o banco confere tudo de novo.
import { useCallback, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Link from "@/components/Link";
import {
  APARENCIA_PADRAO, arrumarAbas, arrumarPalavraDaCapa, DURACOES, LAYOUTS_DO_PERFIL, LIMITES_DA_APARENCIA, linkLimpo, mesmaAparencia, PALETA_DO_PERFIL, CORES_DA_PALETA,
  rostoSorteado, rostoValido, TEMAS_DO_PERFIL, type AparenciaDoPerfil, type CorDaPaleta, type LayoutDoPerfil, type TemaDoPerfil,
} from "@/lib/rede/aparencia";
import { redePerfil } from "@/lib/rede/cliente-perfil";
import { BIO_MAXIMA } from "@/lib/rede/perfil";
import { preencher } from "@/lib/rede/preencher";
import { enderecos, type Post } from "@/lib/rede/tipos";
import { LIMITES, STATUS_DO_PERFIL, type CampoDoPerfil, type ExtrasDoPerfil, type PedidoDeExtras, type StatusDoPerfil } from "@/lib/rede/tipos-org";
import type { PerfilMeu } from "@/lib/rede/tipos-perfil";
import { codigoDoErro, textoDoErro } from "../../erros";
import { EsqueletoDaLinha } from "../../Esqueletos";
import type { PropsDaTelaDoPacote } from "../../registro";
import { CabecalhoDoPerfil, estiloDoAcento } from "./Cabecalho";
import { aparenciaDe, extrasDe, meuDaPrevia, meusPosts, previa, salvarAparencia, salvarExtras, guardarMeuNaPrevia, trocarCodinome, type OrgNoPerfil } from "./dados";
import { CartoesDeEscolha, EditorDePixels, EscolhaDeCor, OrdemDasAbas, TearDaFaixa } from "./Ferramentas";
import { comTransicao } from "./PaginaDoPerfil";
import { CapaDeMosaico, FaixaPropria, RostoDePixels } from "./Pecas";
import { useTextosDoPerfilLivre, type TextosDoPerfilLivre } from "./textos";
import "./editor.css";

// ───────────────────────────── O rascunho e o histórico ─────────────────────────────

interface StatusEditado {
  tipo: StatusDoPerfil;
  texto: string;
  horas: number;
  /** Até quando (só para a prévia mostrar; o banco conta as horas a partir do salvar). */
  ate: string;
}

const daquiA = (horas: number) => new Date(Date.now() + horas * 3600e3).toISOString();

interface Rascunho {
  aparencia: AparenciaDoPerfil;
  orgs: OrgNoPerfil[];
  codinome: string;
  bio: string;
  pronomes: string;
  campos: CampoDoPerfil[];
  /** `undefined` = não mexeu (fica o que está, com o prazo de antes). */
  status: StatusEditado | null | undefined;
  statusAtual: ExtrasDoPerfil["status"];
}

interface Historico {
  passado: Rascunho[];
  atual: Rascunho;
  futuro: Rascunho[];
  grupo: string;
  quando: number;
}

type Acao = { tipo: "mudar"; f: (r: Rascunho) => Rascunho; grupo: string } | { tipo: "desfazer" } | { tipo: "refazer" } | { tipo: "repor"; r: Rascunho } | { tipo: "fechar" };

function historico(h: Historico, a: Acao): Historico {
  switch (a.tipo) {
    case "mudar": {
      const novo = a.f(h.atual);
      if (JSON.stringify(novo) === JSON.stringify(h.atual)) return h;
      const agora = Date.now();
      // Digitação e traços seguidos no mesmo campo viram UM passo do desfazer.
      const junta = a.grupo !== "" && a.grupo === h.grupo && agora - h.quando < 900;
      return { passado: junta ? h.passado : [...h.passado, h.atual].slice(-80), atual: novo, futuro: [], grupo: a.grupo, quando: agora };
    }
    case "desfazer":
      if (h.passado.length === 0) return h;
      return { passado: h.passado.slice(0, -1), atual: h.passado[h.passado.length - 1], futuro: [h.atual, ...h.futuro], grupo: "", quando: 0 };
    case "refazer":
      if (h.futuro.length === 0) return h;
      return { passado: [...h.passado, h.atual], atual: h.futuro[0], futuro: h.futuro.slice(1), grupo: "", quando: 0 };
    case "repor":
      return { passado: [], atual: a.r, futuro: [], grupo: "", quando: 0 };
    case "fechar":
      return { ...h, grupo: "" };
  }
}

const SECOES = ["cores", "rosto", "capa", "sobre", "abas", "vitrine", "agora", "conta"] as const;
type Secao = (typeof SECOES)[number];

const CODINOME_OK = /^[\p{L}0-9][\p{L}0-9 .'_-]*$/u;
const codinomeValido = (c: string) => c.trim().length >= 3 && c.trim().length <= 30 && CODINOME_OK.test(c.trim()) && !/(https?|www\.|@)/i.test(c);

function textoDoErroLivre(t: TextosDoPerfilLivre, s: PropsDaTelaDoPacote["s"], e: unknown): string {
  const codigo = codigoDoErro(e).replace(":", "_");
  const erros = t.sobre.erros as Record<string, string>;
  return erros[codigo] ?? textoDoErro(s, e);
}

// ───────────────────────────── A tela ─────────────────────────────

export default function EditorDoPerfil({ lang, s, situacao, conta }: PropsDaTelaDoPacote & { conta: ReactNode }) {
  const t = useTextosDoPerfilLivre(lang);
  const [base, setBase] = useState<{ meu: PerfilMeu; rascunho: Rascunho } | null>(null);
  const [falha, setFalha] = useState("");

  useEffect(() => {
    if (!situacao.membro) return;
    let vivo = true;
    (async () => {
      try {
        const meu = previa() ? meuDaPrevia() : await redePerfil.meu();
        const handle = meu.handle;
        const [lida, extras] = handle ? await Promise.all([aparenciaDe(handle), extrasDe(handle)]) : [{ aparencia: { ...APARENCIA_PADRAO }, orgs: [] }, null];
        if (!vivo) return;
        setBase({
          meu,
          rascunho: {
            aparencia: lida.aparencia,
            orgs: lida.orgs,
            codinome: meu.codinome ?? "",
            bio: meu.bio,
            pronomes: extras?.pronomes ?? "",
            campos: extras?.campos ?? [],
            status: undefined,
            statusAtual: extras?.status ?? null,
          },
        });
      } catch (e) {
        if (vivo) setFalha(textoDoErro(s, e));
      }
    })();
    return () => {
      vivo = false;
    };
  }, [situacao.membro, s]);

  if (!t) return <EsqueletoDaLinha rotulo={s.estados.carregando} quantos={3} />;
  if (!situacao.logado || !situacao.membro) {
    return (
      <p className="pfe-vazio" role="status">
        {t.editor.entrar}
      </p>
    );
  }
  if (falha) return <p className="pfe-vazio" role="alert">{falha}</p>;
  if (!base) return <EsqueletoDaLinha rotulo={s.estados.carregando} quantos={3} />;
  if (!base.meu.handle) return <div className="pfe-conta-so">{conta}</div>;
  return <Editor key={base.meu.id} meu={base.meu} inicial={base.rascunho} t={t} lang={lang} s={s} conta={conta} />;
}

function Editor({ meu, inicial, t, lang, s, conta }: { meu: PerfilMeu; inicial: Rascunho; t: TextosDoPerfilLivre; lang: string; s: PropsDaTelaDoPacote["s"]; conta: ReactNode }) {
  const handle = meu.handle!;
  const [salvo, setSalvo] = useState(inicial);
  const [h, despachar] = useReducer(historico, { passado: [], atual: inicial, futuro: [], grupo: "", quando: 0 });
  const r = h.atual;
  const [secao, setSecao] = useState<Secao>("cores");
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState<{ texto: string; erro: boolean } | null>(null);
  // A prévia: "compacta" (capa, rosto e nome; o começo em telas estreitas), "inteira" ou "fechada". Lado a lado (≥ 1280 px) ela
  // fica sempre inteira, fixa na coluna da esquerda.
  const [modoDaPrevia, setModoDaPrevia] = useState<"compacta" | "inteira" | "fechada">("compacta");
  const previaAberta = modoDaPrevia !== "fechada";
  const [compacta, setCompacta] = useState(false);
  const sentinela = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const dialogo = useRef<HTMLDialogElement>(null);
  const [saida, setSaida] = useState<string | null>(null);

  const mudar = useCallback((f: (r: Rascunho) => Rascunho, grupo = "") => despachar({ tipo: "mudar", f, grupo }), []);
  const ap = (f: (a: AparenciaDoPerfil) => AparenciaDoPerfil, grupo = "") => mudar((x) => ({ ...x, aparencia: f(x.aparencia) }), grupo);

  const sujo = useMemo(
    () =>
      !mesmaAparencia(r.aparencia, salvo.aparencia) ||
      r.codinome.trim() !== salvo.codinome.trim() ||
      r.bio.trim() !== salvo.bio.trim() ||
      r.pronomes.trim() !== salvo.pronomes.trim() ||
      JSON.stringify(r.campos) !== JSON.stringify(salvo.campos) ||
      r.status !== undefined,
    [r, salvo],
  );
  const problemas = useMemo(() => {
    const p: string[] = [];
    if (!codinomeValido(r.codinome)) p.push(t.sobre.erros.invalido_codinome);
    if (r.campos.some((c) => /^https?:\/\//i.test(c.valor.trim()) && !linkLimpo(c.valor.trim()))) p.push(t.sobre.linkRuim);
    if (r.aparencia.tocando?.link && !linkLimpo(r.aparencia.tocando.link)) p.push(t.sobre.linkRuim);
    if (r.aparencia.capa && !r.aparencia.capa.palavra.trim()) p.push(t.capa.palavraVazia);
    return p;
  }, [r, t]);

  // Sair com mudança não salva: o navegador pergunta.
  useEffect(() => {
    if (!sujo) return;
    const f = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", f);
    return () => window.removeEventListener("beforeunload", f);
  }, [sujo]);

  // Sair pela navegação da própria Alumia (links do menu, da barra do celular, "Ver meu perfil") com mudança não salva: em vez de
  // perder tudo calado, um diálogo pergunta (salvar, descartar ou ficar). O clique é pego na captura, antes do roteador do Next.
  useEffect(() => {
    if (!sujo) return;
    const f = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || (a.target && a.target !== "_self") || a.hasAttribute("download")) return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      e.preventDefault();
      e.stopPropagation();
      setSaida(url.pathname + url.search + url.hash);
    };
    document.addEventListener("click", f, true);
    return () => document.removeEventListener("click", f, true);
  }, [sujo]);
  useEffect(() => {
    const d = dialogo.current;
    if (!d) return;
    if (saida && !d.open) d.showModal();
    else if (!saida && d.open) d.close();
  }, [saida]);

  // A barra fica com a mini prévia (rosto, nome, faixa) quando a prévia grande sai da tela.
  useEffect(() => {
    const el = sentinela.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const o = new IntersectionObserver(([x]) => setCompacta(!x.isIntersecting), { threshold: 0 });
    o.observe(el);
    return () => o.disconnect();
  }, [previaAberta]);

  const salvar = useCallback(async (): Promise<boolean> => {
    if (salvando || !sujo || problemas.length) return false;
    setSalvando(true);
    setAviso(null);
    try {
      let novo = { ...r };
      if (!mesmaAparencia(r.aparencia, salvo.aparencia)) {
        const tc = r.aparencia.tocando;
        const limpa: AparenciaDoPerfil = {
          ...r.aparencia,
          // Rosto com menos de 6 ladrilhos não vale: fica o rosto de sempre.
          rosto: r.aparencia.rosto && rostoValido(r.aparencia.rosto) ? r.aparencia.rosto : null,
          tocando: tc && tc.texto.trim() ? { ...tc, texto: tc.texto.trim(), link: tc.link ? (linkLimpo(tc.link)?.href ?? null) : null } : null,
          destaques: r.aparencia.destaques.map((d) => ({ ...d, titulo: d.titulo.trim() })).filter((d) => d.titulo),
        };
        const lida = await salvarAparencia(handle, limpa, r.orgs);
        novo = { ...novo, aparencia: lida.aparencia, orgs: lida.orgs.length ? lida.orgs : r.orgs.filter((o) => lida.aparencia.orgs.includes(o.handle)) };
      }
      if (r.codinome.trim() !== salvo.codinome.trim()) novo.codinome = await trocarCodinome(handle, r.codinome.trim());
      if (r.bio.trim() !== salvo.bio.trim()) {
        if (previa()) guardarMeuNaPrevia(handle, { bio: r.bio.trim() });
        else await redePerfil.editar({ bio: r.bio.trim() });
        novo.bio = r.bio.trim();
      }
      const pedido: PedidoDeExtras = {};
      if (r.pronomes.trim() !== salvo.pronomes.trim()) pedido.pronomes = r.pronomes.trim() || null;
      if (JSON.stringify(r.campos) !== JSON.stringify(salvo.campos)) pedido.campos = r.campos.filter((c) => c.rotulo.trim() && c.valor.trim()).map((c) => ({ rotulo: c.rotulo.trim(), valor: limparValor(c.valor) }));
      if (r.status !== undefined) pedido.status = r.status ? { tipo: r.status.tipo, texto: r.status.texto.trim(), horas: r.status.horas } : null;
      if (Object.keys(pedido).length) {
        const ex = await salvarExtras(handle, pedido, { status: r.statusAtual, pronomes: salvo.pronomes || null, campos: salvo.campos, destaques: [] });
        novo = { ...novo, pronomes: ex.pronomes ?? "", campos: ex.campos, status: undefined, statusAtual: ex.status };
      }
      setSalvo(novo);
      despachar({ tipo: "repor", r: novo });
      setAviso({ texto: t.editor.salvo, erro: false });
      return true;
    } catch (e) {
      setAviso({ texto: preencher(t.editor.erroSalvar, { erro: textoDoErroLivre(t, s, e) }), erro: true });
      return false;
    } finally {
      setSalvando(false);
    }
  }, [salvando, sujo, problemas, r, salvo, handle, t, s]);

  // Atalhos: Ctrl+Z, Ctrl+Shift+Z / Ctrl+Y, Ctrl+S. Dentro de campo de texto, o desfazer do próprio campo vale.
  useEffect(() => {
    const f = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const k = e.key.toLowerCase();
      const emTexto = (e.target as HTMLElement)?.matches?.("input[type=text], input:not([type]), textarea");
      if (k === "s") {
        e.preventDefault();
        void salvar();
      } else if (k === "z" && !emTexto) {
        e.preventDefault();
        despachar({ tipo: e.shiftKey ? "refazer" : "desfazer" });
      } else if (k === "y" && !emTexto) {
        e.preventDefault();
        despachar({ tipo: "refazer" });
      }
    };
    window.addEventListener("keydown", f);
    return () => window.removeEventListener("keydown", f);
  }, [salvar]);

  const statusParaVer = r.status === undefined ? r.statusAtual : r.status ? { tipo: r.status.tipo, texto: r.status.texto, ate: r.status.ate } : null;
  const dados = { codinome: r.codinome.trim() || meu.codinome || "", handle, pronomes: r.pronomes.trim() || null, bio: r.bio, status: statusParaVer, campos: r.campos.filter((c) => c.rotulo.trim() && c.valor.trim()), avatar: meu.avatar, capa: meu.capa };

  const painel: Record<Secao, () => ReactNode> = {
    cores: () => (
      <>
        <EscolhaDeCor acento={r.aparencia.acento} aoMudar={(acento) => ap((a) => ({ ...a, acento }), "cor")} t={t} />
        <CartoesDeEscolha<TemaDoPerfil>
          rotulo={t.cores.tema}
          opcoes={TEMAS_DO_PERFIL}
          valor={r.aparencia.tema}
          aoMudar={(tema) => comTransicao(() => ap((a) => ({ ...a, tema })))}
          nomes={t.cores.temas}
          ajudas={t.cores.temasAjuda}
          desenho={(v) => <span className={`pfe-mini-tema pfe-mini-tema-${v}`} />}
        />
        <CartoesDeEscolha<LayoutDoPerfil>
          rotulo={t.cores.layout}
          opcoes={LAYOUTS_DO_PERFIL}
          valor={r.aparencia.layout}
          aoMudar={(layout) => comTransicao(() => ap((a) => ({ ...a, layout })))}
          nomes={t.cores.layouts}
          ajudas={t.cores.layoutsAjuda}
          desenho={(v) => (
            <span className={`pfe-mini-layout pfe-mini-layout-${v}`}>
              <i className="c" />
              <i className="r" />
              <i className="n" />
              <i className="n2" />
            </span>
          )}
        />
        <TearDaFaixa faixa={r.aparencia.faixa} aoMudar={(faixa) => ap((a) => ({ ...a, faixa }), "faixa")} t={t} />
      </>
    ),
    rosto: () => (
      <div className="pfe-bloco">
        <h3 className="pfe-titulo">{t.rosto.titulo}</h3>
        <p className="pfe-ajuda">{t.rosto.ajuda}</p>
        <Alternador
          rotulo={t.rosto.titulo}
          valor={r.aparencia.rosto ? "mosaico" : "sempre"}
          opcoes={[
            ["mosaico", t.rosto.modo.mosaico],
            ["sempre", t.rosto.modo.sempre],
          ]}
          aoMudar={(v) => ap((a) => ({ ...a, rosto: v === "mosaico" ? (a.rosto ?? rostoSorteado(Date.now() % 100000)) : null }))}
        />
        {r.aparencia.rosto !== null ? (
          <EditorDePixels
            px={r.aparencia.rosto}
            aoMudar={(px, traco) => mudar((x) => ({ ...x, aparencia: { ...x.aparencia, rosto: px } }), traco ? "traco" : "")}
            aoTracoFim={() => despachar({ tipo: "fechar" })}
            aoSortear={() => ap((a) => ({ ...a, rosto: rostoSorteado(Math.floor(Math.random() * 1e9)) }))}
            t={t}
          />
        ) : (
          <p className="pfe-ajuda">{t.rosto.desenhoOuFoto}</p>
        )}
      </div>
    ),
    capa: () => (
      <div className="pfe-bloco">
        <h3 className="pfe-titulo">{t.capa.titulo}</h3>
        <p className="pfe-ajuda">{t.capa.ajuda}</p>
        <Alternador
          rotulo={t.capa.titulo}
          valor={r.aparencia.capa ? "mosaico" : "sempre"}
          opcoes={[
            ["mosaico", t.capa.modo.mosaico],
            ["sempre", t.capa.modo.sempre],
          ]}
          aoMudar={(v) => ap((a) => ({ ...a, capa: v === "mosaico" ? (a.capa ?? { tipo: "mosaico", palavra: arrumarPalavraDaCapa(r.codinome).slice(0, 10) || "LUTA", semente: 1 }) : null }))}
        />
        {r.aparencia.capa ? (
          <div className="pfe-campos-linha">
            <label className="pfe-campo pfe-campo-largo">
              <span>{t.capa.palavra}</span>
              <input
                type="text"
                value={r.aparencia.capa.palavra}
                maxLength={10}
                autoCapitalize="characters"
                spellCheck={false}
                aria-invalid={!r.aparencia.capa.palavra.trim()}
                aria-describedby="pfe-capa-ajuda"
                onChange={(e) => {
                  const palavra = arrumarPalavraDaCapa(e.target.value);
                  ap((a) => (a.capa ? { ...a, capa: { ...a.capa, palavra } } : a), "palavra");
                }}
              />
            </label>
            <button type="button" className="al-botao al-botao-contorno al-botao-m pfe-embaralhar" onClick={() => ap((a) => (a.capa ? { ...a, capa: { ...a.capa, semente: Math.floor(Math.random() * 10000) } } : a))}>
              <svg aria-hidden viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round">
                <path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5" />
              </svg>
              {t.capa.embaralhar}
            </button>
            <small id="pfe-capa-ajuda" className="pfe-campo-ajuda">
              {r.aparencia.capa.palavra.trim() ? t.capa.palavraAjuda : <span className="pfe-erro">{t.capa.palavraVazia}</span>}
            </small>
          </div>
        ) : (
          <p className="pfe-ajuda">{t.capa.desenhoOuFoto}</p>
        )}
      </div>
    ),
    sobre: () => <Sobre r={r} mudar={mudar} t={t} />,
    abas: () => <OrdemDasAbas abas={r.aparencia.abas} aoMudar={(abas) => ap((a) => ({ ...a, abas: arrumarAbas(abas) }))} t={t} />,
    vitrine: () => <Vitrine r={r} mudar={mudar} t={t} handle={handle} />,
    agora: () => <Agora r={r} mudar={mudar} t={t} />,
    conta: () => (
      <div className="pfe-bloco pfe-conta">
        <h3 className="pfe-titulo">{t.conta.titulo}</h3>
        <p className="pfe-ajuda">{t.conta.ajuda}</p>
        {conta ?? <ContaDeExemplo t={t} />}
      </div>
    ),
  };

  const rotuloDaSecao = (x: Secao) => t.abasDoEditor[x];

  return (
    <div className="pfe" style={estiloDoAcento(r.aparencia.acento)}>
      <header className="pfe-topo">
        <div>
          <h1 className="al-cond pfe-h1">{t.editor.titulo}</h1>
          <p className="pfe-ajuda">{t.editor.subtitulo}</p>
        </div>
        <Link href={enderecos.perfil(lang, handle)} className="al-botao al-botao-contorno al-botao-p">
          {t.editor.verPerfil}
        </Link>
      </header>
      {previa() ? (
        <p className="pfe-nota-previa" role="note">
          {t.editor.previaExemplo}
        </p>
      ) : null}

      <div className="pfe-corpo">
        <div className="pfe-lado-previa">
          <div className="pfe-previa-moldura" data-modo={modoDaPrevia}>
            <div className="pfe-previa-rotulo">
              <span className="pfe-ao-vivo">
                <i aria-hidden />
                {t.editor.previa}
              </span>
              <span className="pfe-previa-botoes">
                {previaAberta ? (
                  <button type="button" className="pfe-link pfe-so-estreito" aria-expanded={modoDaPrevia === "inteira"} aria-controls="pfe-previa" onClick={() => comTransicao(() => setModoDaPrevia((m) => (m === "inteira" ? "compacta" : "inteira")))}>
                    {modoDaPrevia === "inteira" ? t.editor.verCompacta : t.editor.verInteira}
                  </button>
                ) : null}
                <button type="button" className="pfe-link" aria-expanded={previaAberta} aria-controls="pfe-previa" onClick={() => comTransicao(() => setModoDaPrevia((m) => (m === "fechada" ? "compacta" : "fechada")))}>
                  {previaAberta ? t.editor.esconderPrevia : t.editor.mostrarPrevia}
                </button>
              </span>
            </div>
            {previaAberta ? (
              <div id="pfe-previa" className="pfe-previa">
                <CabecalhoDoPerfil dados={dados} aparencia={r.aparencia} t={t} lang={lang} previa nivel={2} acoes={<span className="al-botao al-botao-primario al-botao-m">{t.perfil.editar}</span>} />
                <div aria-hidden className="pfe-previa-abas">
                  {r.aparencia.abas.map((a, i) => (
                    <span key={a} data-atual={i === 0 ? "" : undefined} style={{ viewTransitionName: `pfe-previa-aba-${a}` }}>
                      {(t.abas.curtos as Partial<Record<string, string>>)[a] ?? t.abas.nomes[a]}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
            <div ref={sentinela} aria-hidden />
          </div>
        </div>

        <div className="pfe-lado-controles">
          <div className="pfe-barra-secoes" data-compacta={compacta || !previaAberta ? "" : undefined} data-secao={secao}>
            <div className="pfe-mini" aria-hidden>
              {r.aparencia.rosto ? <RostoDePixels px={r.aparencia.rosto} tamanho={28} /> : <span className="pfe-mini-rosto" />}
              <span className="pfe-mini-nome">{dados.codinome}</span>
              <FaixaPropria faixa={r.aparencia.faixa} altura={4} className="pfe-mini-faixa" />
              {secao === "capa" && r.aparencia.capa ? <CapaDeMosaico capa={r.aparencia.capa} acento={r.aparencia.acento} className="pfe-mini-capa" /> : null}
            </div>
            <nav aria-label={t.editor.secoes}>
              <ul className="pfe-secoes">
                {SECOES.map((x) => (
                  <li key={x}>
                    <button type="button" className="pfe-secao" aria-current={secao === x ? "true" : undefined} onClick={() => comTransicao(() => setSecao(x))}>
                      {rotuloDaSecao(x)}
                    </button>
                  </li>
                ))}
              </ul>
            </nav>
          </div>

          <section key={secao} className="pfe-painel" aria-label={rotuloDaSecao(secao)}>
            {painel[secao]()}
          </section>

          <p className="pfe-seguro">
        <svg aria-hidden viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6l7-3z" />
        </svg>
        {t.editor.seguro}
      </p>

          <div className="pfe-salvar" data-sujo={sujo ? "" : undefined} role="region" aria-label={t.editor.salvar}>
        <p className="pfe-salvar-estado" role="status" aria-live="polite" data-estado={aviso?.erro || problemas.length ? "erro" : sujo ? "sujo" : "salvo"}>
          <i aria-hidden className="pfe-salvar-ponto" />
          {aviso ? <span className={aviso.erro ? "pfe-erro" : "pfe-ok"}>{aviso.texto}</span> : problemas.length ? <span className="pfe-erro">{problemas[0]}</span> : sujo ? t.editor.mudancas : t.editor.semMudancas}
        </p>
        <div className="pfe-salvar-botoes">
          <button type="button" className="pfe-icone" disabled={h.passado.length === 0} onClick={() => despachar({ tipo: "desfazer" })} aria-label={t.editor.desfazer} title={`${t.editor.desfazer} (Ctrl+Z)`}>
            <svg aria-hidden viewBox="0 0 24 24"><path d="M9 14L4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
          <button type="button" className="pfe-icone" disabled={h.futuro.length === 0} onClick={() => despachar({ tipo: "refazer" })} aria-label={t.editor.refazer} title={`${t.editor.refazer} (Ctrl+Shift+Z)`}>
            <svg aria-hidden viewBox="0 0 24 24"><path d="M15 14l5-5-5-5M20 9H10a6 6 0 0 0 0 12h3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
          {sujo ? (
            <button type="button" className="al-botao al-botao-fantasma al-botao-m" onClick={() => despachar({ tipo: "repor", r: salvo })}>
              {t.editor.descartar}
            </button>
          ) : null}
          <button type="button" className="al-botao al-botao-primario al-botao-m pfe-botao-salvar" disabled={!sujo || salvando || problemas.length > 0} onClick={() => void salvar()} aria-keyshortcuts="Control+S">
            {salvando ? t.editor.salvando : t.editor.salvar}
          </button>
        </div>
        <p className="sr-only">{t.editor.atalhos}</p>
      </div>
        </div>
      </div>

      <dialog ref={dialogo} className="pfe-dialogo" aria-labelledby="pfe-sair-titulo" aria-describedby="pfe-sair-texto" onClose={() => setSaida(null)} onCancel={() => setSaida(null)}>
        <h2 id="pfe-sair-titulo" className="al-cond">{t.editor.sairTitulo}</h2>
        <p id="pfe-sair-texto">{problemas.length ? problemas[0] : t.editor.sairTexto}</p>
        <div className="pfe-dialogo-botoes">
          <button type="button" className="al-botao al-botao-fantasma al-botao-m" autoFocus onClick={() => setSaida(null)}>
            {t.editor.sairFicar}
          </button>
          <button
            type="button"
            className="al-botao al-botao-contorno al-botao-m"
            onClick={() => {
              const destino = saida;
              despachar({ tipo: "repor", r: salvo });
              setSaida(null);
              if (destino) setTimeout(() => router.push(destino), 0);
            }}
          >
            {t.editor.sairDescartar}
          </button>
          <button
            type="button"
            className="al-botao al-botao-primario al-botao-m pfe-botao-salvar"
            disabled={salvando || problemas.length > 0}
            onClick={async () => {
              const destino = saida;
              if (await salvar()) {
                setSaida(null);
                if (destino) setTimeout(() => router.push(destino), 0);
              }
            }}
          >
            {salvando ? t.editor.salvando : t.editor.sairSalvar}
          </button>
        </div>
      </dialog>
    </div>
  );
}

/** A conta na prévia: os blocos de verdade pedem o banco; aqui eles aparecem com dados de exemplo, só de mostra. */
function ContaDeExemplo({ t }: { t: TextosDoPerfilLivre }) {
  return (
    <div className="pfe-conta-exemplo">
      <p className="pfe-nota-previa pfe-nota-conta" role="note">
        {t.conta.previa}
      </p>
      <ul className="pfe-conta-lista">
        {t.conta.exemplo.map(([rotulo, valor]) => (
          <li key={rotulo}>
            <span>
              <strong>{rotulo}</strong>
              <small>{valor}</small>
            </span>
            <button type="button" className="al-botao al-botao-contorno al-botao-p" disabled aria-disabled>
              {t.conta.mudar}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** O link do campo vai limpo (sem rastreio); texto fica como está. */
function limparValor(v: string): string {
  const x = v.trim();
  if (!/^https:\/\//i.test(x)) return x;
  return linkLimpo(x)?.href ?? x;
}

function Alternador<V extends string>({ rotulo, valor, opcoes, aoMudar }: { rotulo: string; valor: V; opcoes: [V, string][]; aoMudar: (v: V) => void }) {
  return (
    <div role="radiogroup" aria-label={rotulo} className="pfe-alternador">
      {opcoes.map(([v, nome], i) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={valor === v}
          tabIndex={valor === v ? 0 : -1}
          onClick={() => aoMudar(v)}
          onKeyDown={(e) => {
            if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) return;
            e.preventDefault();
            const n = opcoes[(i + (e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 1) + opcoes.length) % opcoes.length][0];
            // O grupo é guardado ANTES do quadro seguinte: lá o React já zerou o currentTarget do evento.
            const grupo = e.currentTarget.parentElement;
            aoMudar(n);
            requestAnimationFrame(() => grupo?.querySelector<HTMLElement>("[aria-checked=true]")?.focus());
          }}
        >
          {nome}
        </button>
      ))}
    </div>
  );
}

// ───────────────────────────── Sobre: codinome, pronomes, bio, campos ─────────────────────────────

function Sobre({ r, mudar, t }: { r: Rascunho; mudar: (f: (r: Rascunho) => Rascunho, grupo?: string) => void; t: TextosDoPerfilLivre }) {
  const bio = useRef<HTMLTextAreaElement>(null);
  function envolver(marca: string) {
    const el = bio.current;
    if (!el) return;
    const [a, b] = [el.selectionStart, el.selectionEnd];
    const meio = r.bio.slice(a, b) || "texto";
    const novo = `${r.bio.slice(0, a)}${marca}${meio}${marca}${r.bio.slice(b)}`.slice(0, BIO_MAXIMA);
    mudar((x) => ({ ...x, bio: novo }));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(a + marca.length, a + marca.length + meio.length);
    });
  }
  const campos = r.campos;
  const mudarCampo = (i: number, c: Partial<CampoDoPerfil>, grupo: string) => mudar((x) => ({ ...x, campos: x.campos.map((y, j) => (j === i ? { ...y, ...c } : y)) }), grupo);
  const moverCampo = (i: number, d: -1 | 1) =>
    comTransicao(() =>
      mudar((x) => {
        const n = [...x.campos];
        const j = i + d;
        if (j < 0 || j >= n.length) return x;
        [n[i], n[j]] = [n[j], n[i]];
        return { ...x, campos: n };
      }),
    );
  return (
    <>
      <div className="pfe-bloco">
        <label className="pfe-campo">
          <span>{t.sobre.codinome}</span>
          <input type="text" value={r.codinome} maxLength={30} aria-invalid={!codinomeValido(r.codinome)} aria-describedby="pfe-codinome-ajuda" onChange={(e) => mudar((x) => ({ ...x, codinome: e.target.value }), "codinome")} />
          <small id="pfe-codinome-ajuda">{codinomeValido(r.codinome) ? t.sobre.codinomeAjuda : t.sobre.erros.invalido_codinome}</small>
        </label>
        <label className="pfe-campo">
          <span>{t.sobre.pronomes}</span>
          <input type="text" value={r.pronomes} maxLength={LIMITES.pronomes} aria-describedby="pfe-pronomes-ajuda" onChange={(e) => mudar((x) => ({ ...x, pronomes: e.target.value }), "pronomes")} />
          <small id="pfe-pronomes-ajuda">{t.sobre.pronomesAjuda}</small>
        </label>
        <div className="pfe-campo">
          <span id="pfe-bio-rotulo">{t.sobre.bio}</span>
          <div className="pfe-bio-barra" role="toolbar" aria-label={t.sobre.bio}>
            <button type="button" className="pfe-icone" onClick={() => envolver("**")} aria-label={t.sobre.negrito}>
              <b aria-hidden>B</b>
            </button>
            <button type="button" className="pfe-icone" onClick={() => envolver("_")} aria-label={t.sobre.italico}>
              <i aria-hidden>I</i>
            </button>
            <span className="pfe-contador">{preencher(t.sobre.contador, { n: r.bio.length, max: BIO_MAXIMA })}</span>
          </div>
          <textarea ref={bio} value={r.bio} rows={4} maxLength={BIO_MAXIMA} aria-labelledby="pfe-bio-rotulo" aria-describedby="pfe-bio-ajuda" onChange={(e) => mudar((x) => ({ ...x, bio: e.target.value }), "bio")} />
          <small id="pfe-bio-ajuda">{t.sobre.bioAjuda}</small>
        </div>
      </div>
      <div className="pfe-bloco">
        <h3 className="pfe-titulo">{t.sobre.campos}</h3>
        <p className="pfe-ajuda">{t.sobre.camposAjuda}</p>
        <ol className="pfe-lista-campos">
          {campos.map((c, i) => {
            const ehLink = /^https?:\/\//i.test(c.valor.trim());
            const l = ehLink ? linkLimpo(c.valor.trim()) : null;
            return (
              <li key={i} className="pfe-item-campo" style={{ viewTransitionName: `pfe-campo-${i}` }}>
                <input type="text" value={c.rotulo} maxLength={LIMITES.rotulo} placeholder={t.sobre.rotulo} aria-label={`${t.sobre.rotulo} ${i + 1}`} onChange={(e) => mudarCampo(i, { rotulo: e.target.value }, `rotulo-${i}`)} />
                <input type="text" value={c.valor} maxLength={LIMITES.valor} placeholder={t.sobre.valor} aria-label={`${t.sobre.valor} ${i + 1}`} aria-invalid={ehLink && !l} onChange={(e) => mudarCampo(i, { valor: e.target.value }, `valor-${i}`)} onBlur={() => l && l.tirados > 0 && mudarCampo(i, { valor: l.href }, "")} />
                <span className="pfe-item-acoes">
                  <button type="button" className="pfe-icone" disabled={i === 0} aria-label={preencher(t.sobre.subir, { n: i + 1 })} onClick={() => moverCampo(i, -1)}>
                    <svg aria-hidden viewBox="0 0 16 16"><path d="M4 10l4-4 4 4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
                  </button>
                  <button type="button" className="pfe-icone" disabled={i === campos.length - 1} aria-label={preencher(t.sobre.descer, { n: i + 1 })} onClick={() => moverCampo(i, 1)}>
                    <svg aria-hidden viewBox="0 0 16 16"><path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
                  </button>
                  <button type="button" className="pfe-icone" aria-label={preencher(t.sobre.remover, { n: i + 1 })} onClick={() => comTransicao(() => mudar((x) => ({ ...x, campos: x.campos.filter((_, j) => j !== i) })))}>
                    <svg aria-hidden viewBox="0 0 16 16"><path d="M4 4l8 8M12 4l-8 8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
                  </button>
                </span>
                {ehLink ? (
                  <p className={`pfe-item-link ${l ? "pfe-ok" : "pfe-erro"}`}>
                    {l ? (
                      <>
                        <svg aria-hidden viewBox="0 0 16 16" width="14" height="14"><path d="M3 8.5l3 3 7-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
                        {preencher(t.sobre.linkLimpo, { dominio: l.dominio })}
                        {l.tirados > 0 ? ` · ${preencher(t.sobre.rastreioTirado, { n: l.tirados })}` : ""}
                      </>
                    ) : (
                      t.sobre.linkRuim
                    )}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ol>
        {campos.length < 6 ? (
          <button type="button" className="al-botao al-botao-contorno al-botao-p" onClick={() => mudar((x) => ({ ...x, campos: [...x.campos, { rotulo: "", valor: "" }] }))}>
            + {t.sobre.adicionar}
          </button>
        ) : null}
      </div>
    </>
  );
}

// ───────────────────────────── Vitrine: fixados, destaques, organizações ─────────────────────────────

function Vitrine({ r, mudar, t, handle }: { r: Rascunho; mudar: (f: (r: Rascunho) => Rascunho, grupo?: string) => void; t: TextosDoPerfilLivre; handle: string }) {
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [org, setOrg] = useState("");
  useEffect(() => {
    let vivo = true;
    meusPosts(handle).then((l) => vivo && setPosts(l));
    return () => {
      vivo = false;
    };
  }, [handle]);
  const a = r.aparencia;
  const resumo = (p: Post) => (p.titulo ?? p.texto).replace(/\s+/g, " ").slice(0, 110);
  const ap = (f: (a: AparenciaDoPerfil) => AparenciaDoPerfil, grupo = "") => mudar((x) => ({ ...x, aparencia: f(x.aparencia) }), grupo);
  const orgLimpa = org.trim().replace(/^@/, "").toLowerCase();
  const orgOk = /^[a-z0-9_]{3,20}$/.test(orgLimpa);
  return (
    <>
      <div className="pfe-bloco">
        <h3 className="pfe-titulo">{t.vitrine.fixados}</h3>
        <p className="pfe-ajuda">{t.vitrine.fixadosAjuda}</p>
        {posts === null ? (
          <p className="pfe-ajuda" role="status">…</p>
        ) : posts.length === 0 ? (
          <p className="pfe-ajuda">{t.vitrine.semPosts}</p>
        ) : (
          <ul className="pfe-posts">
            {posts.map((p) => {
              const n = a.fixados.indexOf(p.id);
              const destaque = a.destaques.find((d) => d.ref === p.id);
              return (
                <li key={p.id} className="pfe-post" data-fixado={n >= 0 ? "" : undefined}>
                  <span className="pfe-post-texto">
                    {n >= 0 ? <span className="pfe-post-numero">{n + 1}</span> : null}
                    {resumo(p)}
                  </span>
                  <span className="pfe-post-acoes">
                    <button
                      type="button"
                      className="al-botao al-botao-contorno al-botao-p"
                      aria-pressed={n >= 0}
                      disabled={n < 0 && a.fixados.length >= LIMITES_DA_APARENCIA.fixados}
                      onClick={() => ap((x) => ({ ...x, fixados: n >= 0 ? x.fixados.filter((y) => y !== p.id) : [...x.fixados, p.id] }))}
                    >
                      {n >= 0 ? t.vitrine.desafixar : t.vitrine.fixar}
                    </button>
                    {!destaque ? (
                      <button
                        type="button"
                        className="al-botao al-botao-fantasma al-botao-p"
                        disabled={a.destaques.length >= LIMITES_DA_APARENCIA.destaques}
                        onClick={() =>
                          ap((x) => ({
                            ...x,
                            destaques: [...x.destaques, { tipo: p.chamado?.tipo === "ato" ? "ato" : "post", ref: p.id, titulo: resumo(p).slice(0, LIMITES_DA_APARENCIA.tituloDestaque).trim(), cor: CORES_DA_PALETA[x.destaques.length % CORES_DA_PALETA.length] }],
                          }))
                        }
                      >
                        ★ {t.vitrine.virarDestaque}
                      </button>
                    ) : null}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        {a.fixados.length >= LIMITES_DA_APARENCIA.fixados ? <p className="pfe-ajuda">{t.vitrine.cheio}</p> : null}
      </div>

      <div className="pfe-bloco">
        <h3 className="pfe-titulo">{t.vitrine.destaques}</h3>
        <p className="pfe-ajuda">{t.vitrine.destaquesAjuda}</p>
        <ul className="pfe-destaques">
          {a.destaques.map((d, i) => (
            <li key={d.ref} className="pfe-destaque" style={{ ["--c" as string]: PALETA_DO_PERFIL[d.cor] }}>
              <span className="pfe-destaque-tipo">{d.tipo === "ato" ? t.vitrine.ato : t.vitrine.post}</span>
              <input
                type="text"
                value={d.titulo}
                maxLength={LIMITES_DA_APARENCIA.tituloDestaque}
                aria-label={`${t.vitrine.tituloDestaque} ${i + 1}`}
                onChange={(e) => ap((x) => ({ ...x, destaques: x.destaques.map((y, j) => (j === i ? { ...y, titulo: e.target.value } : y)) }), `destaque-${i}`)}
                onBlur={() => !d.titulo.trim() && ap((x) => ({ ...x, destaques: x.destaques.filter((_, j) => j !== i) }))}
              />
              <div role="radiogroup" aria-label={t.vitrine.corDoDestaque} className="pfe-amostras pfe-amostras-pp">
                {CORES_DA_PALETA.map((c) => (
                  <button key={c} type="button" role="radio" aria-checked={d.cor === c} className="pfe-amostra" style={{ ["--c" as string]: PALETA_DO_PERFIL[c] }} onClick={() => ap((x) => ({ ...x, destaques: x.destaques.map((y, j) => (j === i ? { ...y, cor: c as CorDaPaleta } : y)) }))}>
                    <span className="sr-only">{t.cores.paleta[c]}</span>
                  </button>
                ))}
              </div>
              <button type="button" className="pfe-link" onClick={() => comTransicao(() => ap((x) => ({ ...x, destaques: x.destaques.filter((_, j) => j !== i) })))}>
                {t.vitrine.tirar}
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="pfe-bloco">
        <h3 className="pfe-titulo">{t.vitrine.orgs}</h3>
        <p className="pfe-ajuda">{t.vitrine.orgsAjuda}</p>
        <form
          className="pfe-campos-linha"
          onSubmit={(e) => {
            e.preventDefault();
            if (!orgOk || a.orgs.includes(orgLimpa) || a.orgs.length >= LIMITES_DA_APARENCIA.orgs) return;
            mudar((x) => ({ ...x, aparencia: { ...x.aparencia, orgs: [...x.aparencia.orgs, orgLimpa] }, orgs: [...x.orgs, { handle: orgLimpa, codinome: orgLimpa }] }));
            setOrg("");
          }}
        >
          <label className="pfe-campo pfe-campo-largo">
            <span>{t.vitrine.orgHandle}</span>
            <input type="text" value={org} maxLength={21} autoCapitalize="none" spellCheck={false} aria-invalid={org !== "" && !orgOk} onChange={(e) => setOrg(e.target.value)} />
            <small>{org !== "" && !orgOk ? t.vitrine.orgRuim : t.vitrine.orgConferida}</small>
          </label>
          <button type="submit" className="al-botao al-botao-contorno al-botao-m" disabled={!orgOk || a.orgs.length >= LIMITES_DA_APARENCIA.orgs}>
            {t.vitrine.mostrarOrg}
          </button>
        </form>
        <ul className="pfe-chips">
          {a.orgs.map((o) => (
            <li key={o}>
              <span>{r.orgs.find((x) => x.handle === o)?.codinome ?? o}</span>
              <small>@{o}</small>
              <button type="button" className="pfe-icone" aria-label={`${t.vitrine.tirar} @${o}`} onClick={() => mudar((x) => ({ ...x, aparencia: { ...x.aparencia, orgs: x.aparencia.orgs.filter((y) => y !== o) }, orgs: x.orgs.filter((y) => y.handle !== o) }))}>
                <svg aria-hidden viewBox="0 0 16 16"><path d="M4 4l8 8M12 4l-8 8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}

// ───────────────────────────── Agora: status com prazo e "tocando agora" ─────────────────────────────

function Agora({ r, mudar, t }: { r: Rascunho; mudar: (f: (r: Rascunho) => Rascunho, grupo?: string) => void; t: TextosDoPerfilLivre }) {
  const [agora] = useState(() => Date.now());
  const status: StatusEditado | null = r.status === undefined ? (r.statusAtual ? { tipo: r.statusAtual.tipo, texto: r.statusAtual.texto, horas: 24, ate: r.statusAtual.ate ?? new Date(agora + 24 * 3600e3).toISOString() } : null) : r.status;
  const tocando = r.aparencia.tocando;
  const horasDoTocando = tocando ? Math.max(1, Math.round((new Date(tocando.ate).getTime() - agora) / 3600e3)) : 8;
  const duracaoMaisPerto = (h: number) => DURACOES.reduce((m, d) => (Math.abs(d - h) < Math.abs(m - h) ? d : m), DURACOES[0]);
  const link = tocando?.link ? linkLimpo(tocando.link) : null;
  const opcoesStatus = ["nenhum", ...STATUS_DO_PERFIL] as const;
  return (
    <>
      <div className="pfe-bloco">
        <h3 className="pfe-titulo" id="pfe-status">{t.agora.status}</h3>
        <p className="pfe-ajuda">{t.agora.statusAjuda}</p>
        <div role="radiogroup" aria-labelledby="pfe-status" className="pfe-pilulas">
          {opcoesStatus.map((o) => {
            const marcado = o === "nenhum" ? status === null : status?.tipo === o;
            return (
              <button
                key={o}
                type="button"
                role="radio"
                aria-checked={marcado}
                className="pfe-pilula"
                onClick={() => mudar((x) => ({ ...x, status: o === "nenhum" ? null : { tipo: o, texto: status?.texto ?? "", horas: status?.horas ?? 24, ate: daquiA(status?.horas ?? 24) } }))}
              >
                {o === "nenhum" ? t.agora.semStatus : t.agora.statusTipos[o]}
              </button>
            );
          })}
        </div>
        {status ? (
          <div className="pfe-campos-linha">
            <label className="pfe-campo pfe-campo-largo">
              <span>{t.agora.statusTexto}</span>
              <input type="text" value={status.texto} maxLength={LIMITES.statusTexto} onChange={(e) => mudar((x) => ({ ...x, status: { ...status, texto: e.target.value } }), "status-texto")} />
            </label>
            <label className="pfe-campo">
              <span>{t.agora.duracao}</span>
              <select value={duracaoMaisPerto(status.horas)} onChange={(e) => mudar((x) => ({ ...x, status: { ...status, horas: Number(e.target.value), ate: daquiA(Number(e.target.value)) } }))}>
                {DURACOES.map((d) => (
                  <option key={d} value={d}>
                    {t.agora.duracoes[String(d) as keyof typeof t.agora.duracoes]}
                  </option>
                ))}
              </select>
            </label>
          </div>
        ) : null}
      </div>

      <div className="pfe-bloco">
        <h3 className="pfe-titulo">{t.agora.tocando}</h3>
        <p className="pfe-ajuda">{t.agora.tocandoAjuda}</p>
        <div className="pfe-campos-linha">
          <label className="pfe-campo pfe-campo-largo">
            <span>{t.agora.tocandoTexto}</span>
            <input
              type="text"
              value={tocando?.texto ?? ""}
              maxLength={LIMITES_DA_APARENCIA.tocando}
              onChange={(e) => {
                const texto = e.target.value;
                mudar((x) => ({ ...x, aparencia: { ...x.aparencia, tocando: texto ? { texto, link: x.aparencia.tocando?.link ?? null, ate: x.aparencia.tocando?.ate ?? daquiA(8) } : null } }), "tocando");
              }}
            />
          </label>
          {tocando ? (
            <button type="button" className="al-botao al-botao-fantasma al-botao-m" onClick={() => mudar((x) => ({ ...x, aparencia: { ...x.aparencia, tocando: null } }))}>
              {t.agora.tirar}
            </button>
          ) : null}
        </div>
        {tocando ? (
          <div className="pfe-campos-linha">
            <label className="pfe-campo pfe-campo-largo">
              <span>{t.agora.tocandoLink}</span>
              <input
                type="url"
                inputMode="url"
                value={tocando.link ?? ""}
                maxLength={200}
                placeholder="https://"
                aria-invalid={Boolean(tocando.link) && !link}
                onChange={(e) => mudar((x) => ({ ...x, aparencia: { ...x.aparencia, tocando: x.aparencia.tocando ? { ...x.aparencia.tocando, link: e.target.value.trim() || null } : null } }), "tocando-link")}
                onBlur={() => link && link.tirados > 0 && mudar((x) => ({ ...x, aparencia: { ...x.aparencia, tocando: x.aparencia.tocando ? { ...x.aparencia.tocando, link: link.href } : null } }))}
              />
              {tocando.link ? <small className={link ? "pfe-ok" : "pfe-erro"}>{link ? `${preencher(t.sobre.linkLimpo, { dominio: link.dominio })}${link.tirados ? ` · ${preencher(t.sobre.rastreioTirado, { n: link.tirados })}` : ""}` : t.sobre.linkRuim}</small> : null}
            </label>
            <label className="pfe-campo">
              <span>{t.agora.duracao}</span>
              <select
                value={duracaoMaisPerto(horasDoTocando)}
                onChange={(e) => {
                  const ate = daquiA(Number(e.target.value));
                  mudar((x) => ({ ...x, aparencia: { ...x.aparencia, tocando: x.aparencia.tocando ? { ...x.aparencia.tocando, ate } : null } }));
                }}
              >
                {DURACOES.map((d) => (
                  <option key={d} value={d}>
                    {t.agora.duracoes[String(d) as keyof typeof t.agora.duracoes]}
                  </option>
                ))}
              </select>
            </label>
          </div>
        ) : null}
      </div>
    </>
  );
}


