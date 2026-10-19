// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useCallback, useEffect, useState } from "react";
import { fill, plural } from "@/i18n/config";
import { errorText } from "@/i18n/core";
import type { Dict } from "@/i18n/types";
import { areaSlugs } from "@/lib/areas";
import { BackendError, hasBackend, rpc, useMe } from "@/lib/backend";
import { apagarPdf, baixarPdf, enderecoDaLicenca, enviarPdf, ErroDaGaveta, licencasDaGaveta, nomeDoArquivo, pdfValido, TERMO_VERSAO, tiposDeTrabalho, type Trabalho } from "@/lib/gaveta";
import { safeLink } from "@/lib/text";
import { L, useI18n } from "./I18n";

type S = Dict["drawer"];

const field = "mt-1 w-full border-2 border-ink bg-parchment-deep px-3 py-2";
const link = "cursor-pointer underline hover:text-oxblood";
const primary = "cursor-pointer bg-ink px-5 py-2.5 font-medium text-parchment hover:bg-oxblood disabled:cursor-not-allowed disabled:opacity-50";
const vazio = { titulo: "", tipo: "tcc", disciplina: "", curso: "", instituicao: "", ano: "", comentario: "", como: "link" as "link" | "arquivo", link: "", licenca: "CC BY 4.0", credito: "", termo: false, termo_nome: "" };

/** O botão de baixar: o PDF vem do depósito do instituto e é entregue com um nome legível. */
function Baixar({ trabalho, s }: { trabalho: Trabalho; s: S }) {
  const [estado, setEstado] = useState<"" | "baixando" | "falhou">("");
  async function baixar() {
    setEstado("baixando");
    try {
      const endereco = await baixarPdf(trabalho.arquivo);
      const a = document.createElement("a");
      a.href = endereco;
      a.download = nomeDoArquivo(trabalho.titulo);
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(endereco), 60_000);
      setEstado("");
    } catch {
      setEstado("falhou");
    }
  }
  return (
    <>
      <button type="button" className={primary} disabled={estado === "baixando"} onClick={() => void baixar()}>
        {estado === "baixando" ? s.downloading : s.download}
      </button>
      {estado === "falhou" && <span role="status" className="text-oxblood">{s.downloadFailed}</span>}
    </>
  );
}

function Cartao({ trabalho, s }: { trabalho: Trabalho; s: S }) {
  const { lang, t } = useI18n();
  const area = t.areas[trabalho.disciplina as keyof typeof t.areas]?.[0] ?? trabalho.disciplina;
  const detalhes = [trabalho.curso, trabalho.instituicao, trabalho.ano ? String(trabalho.ano) : ""].filter(Boolean).join(" · ");
  const externo = trabalho.link && safeLink(trabalho.link) ? trabalho.link : "";
  return (
    <li id={`trabalho-${trabalho.id}`} className="scroll-mt-24 border-2 border-ink bg-parchment-deep">
      <p className="jornal-preto flex flex-wrap justify-between gap-x-4 px-4 py-1.5 font-mono text-xs uppercase tracking-widest">
        <span>{s.types[trabalho.tipo]} · {area}</span>
        <a href={enderecoDaLicenca[trabalho.licenca]} target="_blank" rel="noopener noreferrer license" className="underline">{trabalho.licenca}</a>
      </p>
      <div className="p-4">
        <h3 className="font-serif text-2xl font-semibold leading-tight">{trabalho.titulo}</h3>
        {detalhes && <p className="mt-1 font-sans text-sm text-ink-soft">{detalhes}</p>}
        <p className="mt-1 font-sans text-sm">{fill(s.credit, { name: trabalho.credito })}</p>
        <p className="mt-3 font-mono text-[0.65rem] uppercase tracking-widest text-gold">{s.why}</p>
        <p className="mt-1 whitespace-pre-line">{trabalho.comentario}</p>
        <p className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 font-sans text-sm">
          {externo ? (
            <a href={externo} target="_blank" rel="noopener noreferrer" className={primary}>{s.open} ↗</a>
          ) : (
            trabalho.arquivo && <Baixar trabalho={trabalho} s={s} />
          )}
          <L href={`/denunciar?item=${encodeURIComponent(`/${lang}/gaveta#trabalho-${trabalho.id}`)}`} className={`${link} text-ink-soft`}>{s.report}</L>
        </p>
      </div>
    </li>
  );
}

/** O envio de um trabalho: pede conta, o termo inteiro à vista, o aceite com o nome completo e um link ou o PDF. */
function Publicar({ s, termo, depois }: { s: S; termo: React.ReactNode; depois: () => void }) {
  const { t } = useI18n();
  const me = useMe();
  const [rascunho, setRascunho] = useState(vazio);
  // Veio de "Entregar pela Gaveta Aberta" num exercício: o formulário já sabe de qual exercício é a entrega.
  const [exercicio, setExercicio] = useState<{ id: string; titulo: string } | null>(null);
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("exercicio") ?? "";
    if (!/^[0-9a-f-]{36}$/.test(id)) return;
    let vivo = true;
    rpc<{ id: string; titulo: string; disciplina: string }>("exercicio_ver", { p_id: id })
      .then((x) => {
        if (!vivo) return;
        setExercicio({ id: x.id, titulo: x.titulo });
        setRascunho((r) => ({ ...r, tipo: "projeto", disciplina: x.disciplina, titulo: r.titulo || `${x.titulo}`.slice(0, 160), como: "link" }));
      })
      .catch(() => null);
    return () => {
      vivo = false;
    };
  }, []);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [estado, setEstado] = useState<"" | "enviando" | "enviado">("");
  const [erro, setErro] = useState("");
  const mudar = (campo: keyof typeof vazio) => (e: { target: { value: string } }) => setRascunho({ ...rascunho, [campo]: e.target.value });

  if (me.status === "loading") return null;
  if (me.status === "out") {
    return (
      <p className="mt-4 font-sans">
        {s.signInFirst} <L href="/entrar" className={link}>{s.signIn}</L>
      </p>
    );
  }
  if (estado === "enviado") return <p role="status" className="mt-4 border-l-2 border-ok pl-4 font-sans">{s.sent}</p>;

  const pronto =
    rascunho.titulo.trim().length >= 5 && rascunho.disciplina !== "" && rascunho.comentario.trim().length >= 40 && rascunho.credito.trim().length >= 2 &&
    rascunho.termo && rascunho.termo_nome.trim().length >= 5 && (rascunho.como === "link" ? /^https:\/\/\S+$/.test(rascunho.link.trim()) : arquivo !== null);

  async function enviar() {
    setEstado("enviando");
    setErro("");
    try {
      let caminho = "";
      if (rascunho.como === "arquivo" && arquivo) {
        try {
          caminho = await enviarPdf(arquivo);
        } catch (falha) {
          throw new ErroDaGaveta(falha instanceof ErroDaGaveta && falha.message === "formato" ? s.notPdf : s.uploadFailed);
        }
      }
      const { como, ...dados } = rascunho;
      await rpc("gaveta_enviar", { p: { ...dados, link: como === "link" ? rascunho.link.trim() : "", arquivo: caminho, termo_versao: TERMO_VERSAO, exercicio: exercicio?.id ?? "" } });
      setRascunho(vazio);
      setArquivo(null);
      setEstado("enviado");
      depois();
    } catch (falha) {
      setErro(falha instanceof ErroDaGaveta ? falha.message : errorText(t, falha instanceof BackendError ? falha.code : "falha"));
      setEstado("");
    }
  }

  return (
    <form id="publicar" className="mt-4 scroll-mt-24 space-y-4 font-sans text-sm" onSubmit={(e) => { e.preventDefault(); void enviar(); }}>
      {exercicio && (
        <div className="border-l-4 border-gold bg-parchment-deep p-3">
          <p className="font-semibold">{fill(s.exerciseFor, { titulo: exercicio.titulo })}</p>
          <p className="mt-1 text-ink-soft">{s.exerciseHint}</p>
        </div>
      )}
      <label className="block">
        {s.fieldTitle}
        <input value={rascunho.titulo} onChange={mudar("titulo")} required minLength={5} maxLength={160} className={field} />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          {s.fieldType}
          <select value={rascunho.tipo} onChange={mudar("tipo")} className={field}>
            {tiposDeTrabalho.map((tipo) => (
              <option key={tipo} value={tipo}>{s.types[tipo]}</option>
            ))}
          </select>
        </label>
        <label className="block">
          {s.fieldSubject}
          <select value={rascunho.disciplina} onChange={mudar("disciplina")} required className={field}>
            <option value="">{s.chooseSubject}</option>
            {areaSlugs.map((area) => (
              <option key={area} value={area}>{t.areas[area][0]}</option>
            ))}
          </select>
        </label>
        <label className="block">
          {s.fieldCourse}
          <input value={rascunho.curso} onChange={mudar("curso")} maxLength={120} className={field} />
        </label>
        <label className="block">
          {s.fieldInstitution}
          <input value={rascunho.instituicao} onChange={mudar("instituicao")} maxLength={160} className={field} />
        </label>
        <label className="block">
          {s.fieldYear}
          <input value={rascunho.ano} onChange={mudar("ano")} inputMode="numeric" pattern="[0-9]{4}" maxLength={4} className={field} />
        </label>
        <label className="block">
          {s.fieldCredit}
          <input value={rascunho.credito} onChange={mudar("credito")} required maxLength={120} className={field} />
        </label>
      </div>
      <label className="block">
        {s.fieldComment}
        <textarea value={rascunho.comentario} onChange={mudar("comentario")} required minLength={40} maxLength={2000} rows={5} className={field} />
        <span className="mt-1 block text-right font-mono text-xs text-ink-soft">{rascunho.comentario.length}/2000</span>
      </label>

      <fieldset>
        <legend className="font-medium">{s.how}</legend>
        <div className="mt-2 flex flex-wrap gap-x-6 gap-y-2">
          <label className="flex items-center gap-2">
            <input type="radio" name="como" checked={rascunho.como === "link"} onChange={() => setRascunho({ ...rascunho, como: "link" })} className="h-4 w-4" />
            {s.howLink}
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name="como" checked={rascunho.como === "arquivo"} onChange={() => setRascunho({ ...rascunho, como: "arquivo" })} className="h-4 w-4" />
            {s.howFile}
          </label>
        </div>
        {rascunho.como === "link" ? (
          <label className="mt-3 block">
            {s.fieldLink}
            <input value={rascunho.link} onChange={mudar("link")} type="url" inputMode="url" placeholder="https://" maxLength={500} className={`${field} font-mono`} />
          </label>
        ) : (
          <div className="mt-3">
            <label className="block">
              {s.fieldFile}
              <input
                type="file"
                accept="application/pdf,.pdf"
                onChange={async (e) => {
                  const escolhido = e.target.files?.[0] ?? null;
                  setErro("");
                  if (escolhido && !(await pdfValido(escolhido))) {
                    setArquivo(null);
                    setErro(s.notPdf);
                    e.target.value = "";
                    return;
                  }
                  setArquivo(escolhido);
                }}
                className="mt-1 block w-full"
              />
            </label>
            <p className="mt-2 border-l-2 border-gold pl-3 text-ink-soft">{s.fileWarning}</p>
          </div>
        )}
      </fieldset>

      <label className="block">
        {s.fieldLicense}
        <select value={rascunho.licenca} onChange={mudar("licenca")} className={field}>
          {licencasDaGaveta.map((licenca) => (
            <option key={licenca} value={licenca}>{(s.licenses as Record<string, string>)[licenca]}</option>
          ))}
        </select>
      </label>

      <section aria-labelledby="gaveta-termo" className="border-2 border-ink">
        <h3 id="gaveta-termo" className="jornal-preto px-4 py-2 font-black uppercase italic tracking-tight">{s.term}</h3>
        <div tabIndex={0} className="max-h-72 overflow-y-auto bg-parchment px-4 py-3 font-serif text-base">
          {termo}
        </div>
        <div className="space-y-3 border-t-2 border-ink bg-parchment-deep px-4 py-3">
          <label className="flex items-start gap-2 font-medium">
            <input type="checkbox" checked={rascunho.termo} onChange={(e) => setRascunho({ ...rascunho, termo: e.target.checked })} className="mt-0.5 h-4 w-4" />
            {fill(s.termAgree, { v: TERMO_VERSAO })}
          </label>
          <label className="block">
            {s.termName}
            <input value={rascunho.termo_nome} onChange={mudar("termo_nome")} autoComplete="name" maxLength={160} className={field} />
          </label>
          <L href="/gaveta/termo" className={link}>{s.termPage}</L>
        </div>
      </section>

      <button type="submit" className={primary} disabled={!pronto || estado === "enviando"}>
        {estado === "enviando" ? s.sending : s.send}
      </button>
      {erro && <p role="status" className="text-oxblood">{erro}</p>}
    </form>
  );
}

/** As publicações da própria pessoa: em que pé estão, a nota da mediação e o botão de tirar do ar. */
function Minhas({ s, versao }: { s: S; versao: number }) {
  const { t } = useI18n();
  const me = useMe();
  const [lista, setLista] = useState<Trabalho[]>([]);
  const [aviso, setAviso] = useState("");
  const dentro = me.status === "in";
  const carregar = useCallback(() => {
    if (!dentro) return;
    rpc<Trabalho[]>("gaveta_minhas")
      .then(setLista)
      .catch(() => setLista([]));
  }, [dentro]);
  useEffect(carregar, [carregar, versao]);
  if (!dentro || lista.length === 0) return null;

  async function retirar(trabalho: Trabalho) {
    if (!window.confirm(s.withdrawConfirm)) return;
    try {
      const r = await rpc<{ arquivo: string }>("gaveta_retirar", { p_id: trabalho.id });
      if (r.arquivo) await apagarPdf(r.arquivo);
      setAviso(s.withdrawn);
      carregar();
    } catch (falha) {
      setAviso(errorText(t, falha instanceof BackendError ? falha.code : "falha"));
    }
  }

  return (
    <section className="mt-10">
      <h2 className="font-serif text-2xl font-semibold">{s.mine}</h2>
      <ul className="mt-3 divide-y divide-rule border-y border-rule font-sans text-sm">
        {lista.map((trabalho) => (
          <li key={trabalho.id} className="py-3">
            <p className="font-medium">{trabalho.titulo}</p>
            <p className="text-ink-soft">
              {s.types[trabalho.tipo]} · {(s.statuses as Record<string, string>)[trabalho.status ?? "pendente"]}
            </p>
            {trabalho.exercicio_titulo && <p className="text-xs text-ink-soft">{fill(s.exerciseFor, { titulo: trabalho.exercicio_titulo })}</p>}
            {trabalho.nota && <p className="mt-1">{s.note}: {trabalho.nota}</p>}
            {trabalho.retorno && <p className="mt-1 border-l-4 border-ok pl-2"><span className="text-ink-soft">{s.feedback}: </span>{trabalho.retorno}</p>}
            <button type="button" className={`${link} mt-1`} onClick={() => void retirar(trabalho)}>{s.withdraw}</button>
          </li>
        ))}
      </ul>
      {aviso && <p role="status" className="mt-2">{aviso}</p>}
    </section>
  );
}

/** A Gaveta Aberta: a lista do que já foi publicado, com filtros, e o formulário de quem quer publicar. */
export function Gaveta({ s, termo }: { s: S; /** O termo de cessão já montado no servidor (content/paginas/gaveta-termo.md). */ termo: React.ReactNode }) {
  const { lang, t } = useI18n();
  const [disciplina, setDisciplina] = useState("");
  const [tipo, setTipo] = useState("");
  const [busca, setBusca] = useState("");
  const [digitado, setDigitado] = useState("");
  const [lista, setLista] = useState<Trabalho[] | null>(null);
  /** O código do erro; o texto sai na hora de mostrar, para a busca não depender do dicionário. */
  const [erro, setErro] = useState("");
  const [versao, setVersao] = useState(0);

  useEffect(() => {
    const relogio = window.setTimeout(() => setBusca(digitado.trim()), 300);
    return () => window.clearTimeout(relogio);
  }, [digitado]);

  useEffect(() => {
    if (!hasBackend) return;
    let cancelado = false;
    rpc<Trabalho[]>("gaveta_listar", { p: { disciplina, tipo, busca } })
      .then((dados) => {
        if (!cancelado) {
          setLista(dados);
          setErro("");
        }
      })
      .catch((falha: unknown) => {
        if (!cancelado) {
          setLista([]);
          setErro(falha instanceof BackendError ? falha.code : "falha");
        }
      });
    return () => {
      cancelado = true;
    };
  }, [disciplina, tipo, busca, versao]);

  if (!hasBackend) return <p className="mt-8 font-sans text-sm text-ink-soft">{s.offline}</p>;

  return (
    <>
      <section aria-label={s.filters} className="mt-8 grid gap-3 font-sans text-sm sm:grid-cols-3">
        <select value={disciplina} onChange={(e) => setDisciplina(e.target.value)} aria-label={s.allSubjects} className={field}>
          <option value="">{s.allSubjects}</option>
          {areaSlugs.map((area) => (
            <option key={area} value={area}>{t.areas[area][0]}</option>
          ))}
        </select>
        <select value={tipo} onChange={(e) => setTipo(e.target.value)} aria-label={s.allTypes} className={field}>
          <option value="">{s.allTypes}</option>
          {tiposDeTrabalho.map((id) => (
            <option key={id} value={id}>{s.types[id]}</option>
          ))}
        </select>
        <input type="search" value={digitado} onChange={(e) => setDigitado(e.target.value)} placeholder={s.search} aria-label={s.search} className={field} />
      </section>
      {erro && <p role="status" className="mt-4 font-sans text-oxblood">{errorText(t, erro)}</p>}
      {lista === null ? (
        <p className="mt-6 font-sans text-sm text-ink-soft">{s.loading}</p>
      ) : (
        <>
          <p className="mt-6 font-mono text-xs uppercase tracking-widest text-ink-soft" role="status">{plural(lang, lista.length, s.count)}</p>
          {lista.length === 0 ? <p className="mt-2 font-sans text-ink-soft">{s.empty}</p> : (
            <ul className="mt-3 space-y-5">
              {lista.map((trabalho) => (
                <Cartao key={trabalho.id} trabalho={trabalho} s={s} />
              ))}
            </ul>
          )}
        </>
      )}
      <section id="publicar" className="no-print mt-12 scroll-mt-24 border-2 border-ink bg-parchment-deep p-5 sm:p-6">
        <h2 className="font-serif text-2xl font-semibold">{s.publishTitle}</h2>
        <p className="mt-1 font-sans text-sm text-ink-soft">{s.publishLead}</p>
        <Publicar s={s} termo={termo} depois={() => setVersao((v) => v + 1)} />
      </section>
      <Minhas s={s} versao={versao} />
    </>
  );
}
