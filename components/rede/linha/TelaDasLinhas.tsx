// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import Link from "@/components/Link";
import { conversa } from "@/lib/rede/cliente-conversa";
import {
  apagarLinha,
  arrumarTema,
  BASES,
  criarLinha,
  fixarLinha,
  guardarLinhas,
  MAXIMO_DE_LINHAS,
  MAXIMO_NA_BARRA,
  moverLinha,
  NOME_MAXIMO,
  renomearLinha,
  TIPOS_DE_POST,
  type BaseDaLinha,
  type ErroDaLinha,
  type FiltroDaLinha,
  type LinhaMontada,
  type TipoNoFiltro,
} from "@/lib/rede/linha-aberta";
import { preencher } from "@/lib/rede/preencher";
import type { TextosDaLinha } from "@/lib/rede/textos-linha";
import { textoDoErro } from "../erros";
import { EsqueletoDaLinha } from "../Esqueletos";
import { Icone } from "../publicar/alumia2/icones";
import type { PropsDaTelaDoPacote } from "../registro";
import { avisarQueMudou, descreverLinha, previa, TrocaDeModo, useLinhasMontadas, useModoDaLinha, useTextosDaLinha } from "./base";
import { EmAlta } from "./EmAlta";
import { confirmar } from "@/components/perguntar";

type Pronta = "cidade" | "nucleos" | "estudo" | "tema";

interface Rascunho {
  nome: string;
  base: BaseDaLinha;
  tipos: TipoNoFiltro[];
  cidade: string;
  tags: string;
  nucleos: boolean;
  estudo: boolean;
}
const VAZIO: Rascunho = { nome: "", base: "tudo", tipos: [], cidade: "", tags: "", nucleos: false, estudo: false };

/** O filtro que o rascunho do formulário descreve (só o que o banco aceita). */
function filtroDoRascunho(r: Rascunho): FiltroDaLinha {
  const f: FiltroDaLinha = {};
  if (r.tipos.length) f.tipos = r.tipos;
  if (r.cidade.trim().length >= 2) f.cidade = r.cidade.trim().replace(/\s+/g, " ");
  const tags = [...new Set(r.tags.split(/[\s,]+/).map((x) => arrumarTema(x)).filter((x): x is string => !!x))].slice(0, 10);
  if (tags.length) f.tags = tags;
  if (r.nucleos) f.nucleos = true;
  if (r.estudo) f.estudo = true;
  return f;
}

/**
 * "Minhas linhas" (/alumia/linhas): as linhas que a pessoa monta com filtro aberto ("Só chamados da minha cidade", "Só núcleos",
 * "Só estudo e ENEM", por #tema), para criar, renomear, ordenar, pôr na barra do Início e apagar; os #temas que ela segue; e os
 * assuntos em alta com o critério escrito. As linhas ficam SÓ neste aparelho (lib/rede/linha-aberta.ts): o servidor recebe o
 * filtro na hora de buscar e não guarda. Cada linha mostra por extenso o que entra nela.
 */
export default function TelaDasLinhas({ lang, s, situacao }: PropsDaTelaDoPacote) {
  const t = useTextosDaLinha(lang);
  const [modo, setModo] = useModoDaLinha();
  const linhas = useLinhasMontadas();
  const [r, setR] = useState<Rascunho>(VAZIO);
  const [aberto, setAberto] = useState(false);
  const [erro, setErro] = useState("");
  const [nota, setNota] = useState("");
  const [renomeando, setRenomeando] = useState<{ id: string; nome: string } | null>(null);
  const campoDoNome = useRef<HTMLInputElement>(null);
  const idForm = useId();
  const membro = situacao.logado && situacao.membro;

  if (!t) return <EsqueletoDaLinha rotulo={s.estados.carregando} quantos={3} />;

  const gravar = (novas: LinhaMontada[]) => {
    guardarLinhas(novas);
    avisarQueMudou();
  };
  const textoDoErroDaLinha = (e: ErroDaLinha, naBarra = false) =>
    e === "nome" ? preencher(t.linhas.erros.nome, { n: NOME_MAXIMO })
    : e === "muitas" ? preencher(naBarra ? t.linhas.erros.barraCheia : t.linhas.erros.muitas, { n: naBarra ? MAXIMO_NA_BARRA : MAXIMO_DE_LINHAS })
    : e === "vazia" ? t.linhas.erros.vazia
    : t.linhas.erros.repetida;

  function comecar(pronta: Pronta | null) {
    setErro("");
    setNota("");
    setR(
      pronta === "cidade" ? { ...VAZIO, nome: t!.linhas.prontaCidade, tipos: ["chamado"] }
      : pronta === "nucleos" ? { ...VAZIO, nome: t!.linhas.prontaNucleos, nucleos: true }
      : pronta === "estudo" ? { ...VAZIO, nome: t!.linhas.prontaEstudo, estudo: true }
      : pronta === "tema" ? { ...VAZIO, nome: "" }
      : VAZIO,
    );
    setAberto(true);
    requestAnimationFrame(() => {
      const alvo = pronta === "cidade" ? document.getElementById(`${idForm}-cidade`) : pronta === "tema" ? document.getElementById(`${idForm}-tags`) : campoDoNome.current;
      alvo?.scrollIntoView({ block: "center", behavior: "smooth" });
      (alvo as HTMLElement | null)?.focus({ preventScroll: true });
    });
  }

  function criar(e: FormEvent) {
    e.preventDefault();
    const filtro = filtroDoRascunho(r);
    if (r.tags.trim() && !filtro.tags) return setErro(t!.linhas.erros.tags);
    const nome = r.nome.trim() || (filtro.tags ? filtro.tags.map((x) => `#${x}`).join(" ").slice(0, NOME_MAXIMO) : "");
    const novas = criarLinha(linhas, { nome, base: r.base, filtro });
    if (typeof novas === "string") return setErro(textoDoErroDaLinha(novas));
    gravar(novas);
    setErro("");
    setAberto(false);
    setR(VAZIO);
    setNota(novas[novas.length - 1].fixada ? t!.linhas.criada : preencher(t!.linhas.criadaSemBarra, { n: MAXIMO_NA_BARRA }));
  }

  const filtroAgora = filtroDoRascunho(r);

  return (
    <div className="ro-pagina">
      <header className="ro-cabeca">
        <p className="ro-sobre al-cond">Alumia</p>
        <h1 className="al-cond">{t.linhas.titulo}</h1>
        <p className="ro-chamada">{t.linhas.chamada}</p>
        <p className="ro-aparelho">
          <Icone nome="cadeado" className="h-4 w-4 shrink-0" />
          {t.linhas.aparelho}
        </p>
      </header>

      <div className="ro-colunas">
        <div className="ro-coluna">
          <section className="ro-bloco" aria-labelledby="ro-ordem">
            <h2 id="ro-ordem" className="ro-titulo al-cond">{t.modo.rotulo}</h2>
            <div className="ro-ordem-linha">
              <TrocaDeModo t={t} modo={modo} aoMudar={setModo} grande />
              <Link href={`/${lang}/alumia/como-a-linha`} className="ro-barra-regra">
                <Icone nome="ajuda" className="h-4 w-4" />
                {t.modo.comoMontada}
              </Link>
            </div>
            <p className="ro-cinza">{modo === "roda" ? t.modo.rodaCurta : t.modo.chegadaCurta}. {t.modo.guardada}</p>
          </section>

          <section className="ro-bloco" aria-labelledby="ro-minhas">
            <h2 id="ro-minhas" className="ro-titulo al-cond">{t.linhas.minhas}</h2>
            <p role="status" className="ro-nota">{nota}</p>
            {linhas.length === 0 ? (
              <div className="ro-vazio-linhas">
                <p className="ro-cinza">
                  <strong>{t.linhas.nenhuma}</strong> {t.linhas.primeiraTexto}
                </p>
                {!aberto && (
                  <button type="button" className="al-botao al-botao-claro al-botao-m" onClick={() => comecar(null)}>
                    <Icone nome="mais" className="h-4 w-4" />
                    {t.linhas.primeira}
                  </button>
                )}
              </div>
            ) : (
              <ol className="ro-lista">
                {linhas.map((l, i) => (
                  <li key={l.id} className="ro-item">
                    <div className="ro-item-topo">
                      <span className="ro-item-n al-cond" aria-hidden>{String(i + 1).padStart(2, "0")}</span>
                      {renomeando?.id === l.id ? (
                        <form
                          className="ro-renomear"
                          onSubmit={(e) => {
                            e.preventDefault();
                            const novas = renomearLinha(linhas, l.id, renomeando.nome);
                            if (typeof novas === "string") return setErro(textoDoErroDaLinha(novas));
                            gravar(novas);
                            setErro("");
                            setRenomeando(null);
                          }}
                        >
                          <label className="sr-only" htmlFor={`${idForm}-r-${l.id}`}>{t.linhas.nome}</label>
                          <input id={`${idForm}-r-${l.id}`} className="ro-campo" value={renomeando.nome} maxLength={NOME_MAXIMO} autoFocus onChange={(e) => setRenomeando({ id: l.id, nome: e.target.value })} />
                          <button type="submit" className="al-botao al-botao-claro al-botao-p">{t.linhas.salvar}</button>
                          <button type="button" className="al-botao al-botao-contorno al-botao-p" onClick={() => setRenomeando(null)}>{t.linhas.cancelar}</button>
                        </form>
                      ) : (
                        <h3 className="ro-item-nome">
                          {l.nome}
                          {l.fixada && <span className="ro-item-barra al-cond">{t.linhas.naBarra}</span>}
                        </h3>
                      )}
                    </div>
                    <p className="ro-item-filtro">{descreverLinha(t, l.base, l.filtro)}</p>
                    <div className="ro-item-acoes">
                      <Link href={`/${lang}/alumia?linha=${l.id}`} className="al-botao al-botao-claro al-botao-p">{t.linhas.abrir}</Link>
                      <button
                        type="button"
                        className="ro-acao"
                        aria-pressed={l.fixada}
                        onClick={() => {
                          const novas = fixarLinha(linhas, l.id, !l.fixada);
                          if (typeof novas === "string") return setErro(textoDoErroDaLinha(novas, true));
                          setErro("");
                          gravar(novas);
                        }}
                      >
                        <Icone nome={l.fixada ? "visto" : "mais"} className="h-4 w-4" />
                        {l.fixada ? t.linhas.desafixar : t.linhas.fixar}
                      </button>
                      <button type="button" className="ro-acao" disabled={i === 0} aria-label={`${t.linhas.subir}: ${l.nome}`} title={t.linhas.subir} onClick={() => gravar(moverLinha(linhas, l.id, -1))}>
                        <Icone nome="setaCima" className="h-4 w-4" />
                      </button>
                      <button type="button" className="ro-acao" disabled={i === linhas.length - 1} aria-label={`${t.linhas.descer}: ${l.nome}`} title={t.linhas.descer} onClick={() => gravar(moverLinha(linhas, l.id, 1))}>
                        <Icone nome="setaCima" className="h-4 w-4 rotate-180" />
                      </button>
                      <button type="button" className="ro-acao" onClick={() => setRenomeando({ id: l.id, nome: l.nome })}>
                        <Icone nome="escrever" className="h-4 w-4" />
                        {t.linhas.renomear}
                      </button>
                      <button
                        type="button"
                        className="ro-acao ro-acao-apagar"
                        onClick={async () => {
                          if (!(await confirmar(preencher(t.linhas.apagarCerteza, { nome: l.nome })))) return;
                          gravar(apagarLinha(linhas, l.id));
                          setNota(t.linhas.apagada);
                        }}
                      >
                        <Icone nome="fechar" className="h-4 w-4" />
                        {t.linhas.apagar}
                      </button>
                    </div>
                  </li>
                ))}
              </ol>
            )}
            {erro && !aberto && <p role="alert" className="ro-erro">{erro}</p>}
          </section>

          <section className="ro-bloco" aria-labelledby="ro-prontas">
            <h2 id="ro-prontas" className="ro-titulo al-cond">{t.linhas.prontas}</h2>
            <div className="ro-prontas">
              {(
                [
                  ["cidade", t.linhas.prontaCidade, t.linhas.prontaCidadeTexto, "atos"],
                  ["nucleos", t.linhas.prontaNucleos, t.linhas.prontaNucleosTexto, "nucleos"],
                  ["estudo", t.linhas.prontaEstudo, t.linhas.prontaEstudoTexto, "livro"],
                  ["tema", t.linhas.prontaTema, t.linhas.prontaTemaTexto, "lupa"],
                ] as const
              ).map(([chave, nome, texto, icone], i) => (
                <button key={chave} type="button" className="ro-pronta" data-cor={i + 1} onClick={() => comecar(chave)}>
                  <span className="ro-pronta-icone" aria-hidden>
                    <Icone nome={icone} className="h-5 w-5" />
                  </span>
                  <strong className="al-cond">{nome}</strong>
                  <span>{texto}</span>
                </button>
              ))}
            </div>
            {!aberto && (
              <button type="button" className="al-botao al-botao-contorno al-botao-m mt-4" onClick={() => comecar(null)}>
                <Icone nome="mais" className="h-4 w-4" />
                {t.linhas.nova}
              </button>
            )}

            {aberto && (
              <form className="ro-form" onSubmit={criar} aria-labelledby={`${idForm}-titulo`}>
                <h3 id={`${idForm}-titulo`} className="ro-titulo al-cond">{t.linhas.nova}</h3>
                <label className="ro-rotulo" htmlFor={`${idForm}-nome`}>{t.linhas.nome}</label>
                <input ref={campoDoNome} id={`${idForm}-nome`} className="ro-campo" value={r.nome} maxLength={NOME_MAXIMO} onChange={(e) => setR({ ...r, nome: e.target.value })} aria-describedby={`${idForm}-nome-ajuda`} />
                <p id={`${idForm}-nome-ajuda`} className="ro-ajuda">{preencher(t.linhas.nomeAjuda, { n: NOME_MAXIMO })}</p>

                <label className="ro-rotulo" htmlFor={`${idForm}-base`}>{t.linhas.base}</label>
                <select id={`${idForm}-base`} className="ro-campo" value={r.base} onChange={(e) => setR({ ...r, base: e.target.value as BaseDaLinha })}>
                  {BASES.map((b) => (
                    <option key={b} value={b}>{t.linhas.bases[b]}</option>
                  ))}
                </select>

                <fieldset className="ro-grupo">
                  <legend className="ro-rotulo">{t.linhas.tipos}</legend>
                  <div className="ro-fichas">
                    {TIPOS_DE_POST.map((tipo) => (
                      <button
                        key={tipo}
                        type="button"
                        className="ro-ficha"
                        aria-pressed={r.tipos.includes(tipo)}
                        onClick={() => setR({ ...r, tipos: r.tipos.includes(tipo) ? r.tipos.filter((x) => x !== tipo) : [...r.tipos, tipo] })}
                      >
                        {t.linhas.tipo[tipo]}
                      </button>
                    ))}
                  </div>
                </fieldset>

                <label className="ro-rotulo" htmlFor={`${idForm}-cidade`}>{t.linhas.cidade}</label>
                <input id={`${idForm}-cidade`} className="ro-campo" value={r.cidade} maxLength={80} autoComplete="off" onChange={(e) => setR({ ...r, cidade: e.target.value })} aria-describedby={`${idForm}-cidade-ajuda`} />
                <p id={`${idForm}-cidade-ajuda`} className="ro-ajuda">{t.linhas.cidadeAjuda}</p>

                <label className="ro-rotulo" htmlFor={`${idForm}-tags`}>{t.linhas.tags}</label>
                <input id={`${idForm}-tags`} className="ro-campo" value={r.tags} maxLength={200} autoComplete="off" autoCapitalize="none" spellCheck={false} placeholder="#enem2026 #redacao" onChange={(e) => setR({ ...r, tags: e.target.value })} aria-describedby={`${idForm}-tags-ajuda`} />
                <p id={`${idForm}-tags-ajuda`} className="ro-ajuda">{t.linhas.tagsAjuda}</p>

                <div className="ro-fichas mt-3">
                  <button type="button" className="ro-ficha" aria-pressed={r.nucleos} onClick={() => setR({ ...r, nucleos: !r.nucleos })}>{t.linhas.nucleos}</button>
                  <button type="button" className="ro-ficha" aria-pressed={r.estudo} onClick={() => setR({ ...r, estudo: !r.estudo })}>{t.linhas.estudo}</button>
                </div>

                <div className="ro-entra" aria-live="polite">
                  <strong className="al-cond">{t.linhas.filtro}</strong>
                  <p>{descreverLinha(t, r.base, filtroAgora)}</p>
                </div>
                {erro && <p role="alert" className="ro-erro">{erro}</p>}
                <div className="ro-form-botoes">
                  <button type="submit" className="al-botao al-botao-primario al-botao-m">{t.linhas.criar}</button>
                  <button
                    type="button"
                    className="al-botao al-botao-contorno al-botao-m"
                    onClick={() => {
                      setAberto(false);
                      setErro("");
                    }}
                  >
                    {t.linhas.cancelar}
                  </button>
                </div>
              </form>
            )}
          </section>
        </div>

        <div className="ro-coluna ro-coluna-lado">
          <TemasSeguidos lang={lang} t={t} s={s} membro={membro} />
          <EmAlta lang={lang} t={t} membro={membro} />
        </div>
      </div>
    </div>
  );
}

/**
 * Os #temas que a pessoa segue (20261110-alumia-comunidade.sql: rede_alumia_seguir_tag). Seguir um #tema é acompanhar o assunto
 * sem seguir pessoas; ninguém vê a lista de ninguém. Daqui a pessoa segue, deixa de seguir e abre a linha dos temas dela.
 */
function TemasSeguidos({ lang, t, s, membro }: { lang: string; t: TextosDaLinha; s: PropsDaTelaDoPacote["s"]; membro: boolean }) {
  const [tags, setTags] = useState<string[] | null>(previa() ? ["enem2026", "moradia", "passelivre"] : null);
  const [campo, setCampo] = useState("");
  const [erro, setErro] = useState("");
  const id = useId();

  useEffect(() => {
    if (previa() || !membro) return;
    let vivo = true;
    conversa.tagsSeguidas().then(
      (r) => vivo && setTags(r.tags),
      (e) => vivo && setErro(textoDoErro(s, e)),
    );
    return () => {
      vivo = false;
    };
  }, [membro, s]);

  async function mudar(tag: string, sim: boolean) {
    setErro("");
    try {
      if (!previa()) await conversa.seguirTag(tag, sim);
      setTags((atual) => {
        const base = (atual ?? []).filter((x) => x !== tag);
        return sim ? [...base, tag].sort() : base;
      });
    } catch (e) {
      setErro(textoDoErro(s, e));
    }
  }

  if (!membro && !previa()) return null;
  return (
    <section className="ro-bloco" aria-labelledby={`${id}-titulo`}>
      <h2 id={`${id}-titulo`} className="ro-titulo al-cond">{t.linhas.temasSeguidos}</h2>
      <p className="ro-cinza">{t.linhas.temasSeguidosTexto}</p>
      <form
        className="ro-tema-form"
        onSubmit={(e) => {
          e.preventDefault();
          const tag = arrumarTema(campo);
          if (!tag) return setErro(t.linhas.temaInvalido);
          setCampo("");
          void mudar(tag, true);
        }}
      >
        <label className="sr-only" htmlFor={`${id}-campo`}>{t.linhas.temaCampo}</label>
        <input id={`${id}-campo`} className="ro-campo" value={campo} maxLength={41} placeholder="#tema" autoComplete="off" autoCapitalize="none" spellCheck={false} onChange={(e) => setCampo(e.target.value)} />
        <button type="submit" className="al-botao al-botao-claro al-botao-p">{t.linhas.temaSeguir}</button>
      </form>
      {erro && <p role="alert" className="ro-erro">{erro}</p>}
      {tags === null ? (
        <p className="ro-cinza" aria-busy="true">…</p>
      ) : tags.length === 0 ? (
        <p className="ro-cinza">{t.linhas.temaNenhum}</p>
      ) : (
        <>
          <ul className="ro-fichas mt-3">
            {tags.map((tag) => (
              <li key={tag} className="ro-ficha ro-ficha-tema">
                <Link href={`/${lang}/alumia/tag/${tag}`}>#{tag}</Link>
                <button type="button" aria-label={preencher(t.linhas.temaDeixar, { tag })} title={preencher(t.linhas.temaDeixar, { tag })} onClick={() => void mudar(tag, false)}>
                  <Icone nome="fechar" className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
          <Link href={`/${lang}/alumia?linha=temas`} className="ro-barra-regra mt-3">
            <Icone nome="chevron" className="h-4 w-4" />
            {t.linhas.verTemas}
          </Link>
        </>
      )}
    </section>
  );
}
