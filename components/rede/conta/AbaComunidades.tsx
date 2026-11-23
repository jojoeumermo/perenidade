// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// Comunidades: o que cuidar em cada comunidade da pessoa. 114 guia de entrada, 127 quiz das regras, 80 escudo contra invasão, 105
// sala de cuidado e 78 abrir uma mediação restaurativa. Quem só é membro vê o guia e responde o quiz; a calibragem é da mediação
// (o banco confere de novo). Nenhuma lista de pessoas: quem encaminha ou convida digita o @.
import { useId, useState, type FormEvent } from "react";
import { conta, type ComunidadeMinha, type Cuidado, type Escudo, type Guia, type PassoDoGuia, type PerguntaDoQuiz, type Quiz } from "@/lib/rede/conta/cliente";
import { preencher } from "@/lib/rede/preencher";
import { Botao } from "../ui/Botao";
import { Abas } from "./Abas";
import { fraseDoErro, guarda, useCarga, type TextosDaConta } from "./textos";

type Msg = { texto: string; erro: boolean } | null;
const Aviso = ({ m }: { m: Msg }) => (m ? <p className={m.erro ? "ct-erro" : "ct-ok"} role={m.erro ? "alert" : "status"}>{m.texto}</p> : null);

// ── 114. Guia de entrada ──

/** O progresso do guia fica só neste aparelho (a chave começa com "lucia": o Sair rápido apaga). */
const chaveDoGuia = (slug: string) => `lucia:rede:conta:guia:${slug}`;

export function LerGuia({ t, lang, slug, guia }: { t: TextosDaConta; lang: string; slug: string; guia: Guia }) {
  const [feitos, setFeitos] = useState<number[]>(() => {
    try {
      const x = JSON.parse(guarda.getItem(chaveDoGuia(slug)) ?? "[]");
      return Array.isArray(x) ? x.filter((n) => Number.isInteger(n)) : [];
    } catch {
      return [];
    }
  });
  function marcar(i: number, sim: boolean) {
    const novo = sim ? [...new Set([...feitos, i])] : feitos.filter((n) => n !== i);
    setFeitos(novo);
    guarda.setItem(chaveDoGuia(slug), JSON.stringify(novo));
  }
  if (guia.passos.length === 0) return <p className="ct-miudo">{t.guia.vazio}</p>;
  return (
    <div className="ct-bloco">
      <p className="ct-etiqueta">{preencher(t.guia.progresso, { feitos: feitos.filter((n) => n < guia.passos.length).length, total: guia.passos.length })}</p>
      <ol className="ct-lista">
        {guia.passos.map((p, i) => (
          <li key={i} className="ct-cartao">
            <h3 className="ct-cartao-titulo">{p.titulo}</h3>
            {p.texto && <p>{p.texto}</p>}
            <div className="ct-acoes">
              <label className="ct-opcao"><input type="checkbox" checked={feitos.includes(i)} onChange={(e) => marcar(i, e.target.checked)} />{t.guia.feito}</label>
              {p.link && <a className="ct-link" href={`/${lang}${p.link}`}>{t.guia.abrir}</a>}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

function EditarGuia({ t, slug, guia, aoMudar }: { t: TextosDaConta; slug: string; guia: Guia; aoMudar: (g: Guia) => void }) {
  const id = useId();
  const [passos, setPassos] = useState<PassoDoGuia[]>(guia.passos);
  const [msg, setMsg] = useState<Msg>(null);
  async function salvar(e: FormEvent) {
    e.preventDefault();
    try {
      aoMudar(await conta.salvarGuia(slug, passos));
      setMsg({ texto: t.comum.salvo, erro: false });
    } catch (x) {
      setMsg({ texto: fraseDoErro(t, x), erro: true });
    }
  }
  const mudar = (i: number, campo: keyof PassoDoGuia, v: string) => setPassos(passos.map((p, j) => (j === i ? { ...p, [campo]: v } : p)));
  return (
    <form className="ct-form" onSubmit={salvar}>
      {passos.map((p, i) => (
        <fieldset key={i}>
          <legend>{preencher(t.guia.passo, { n: i + 1 })}</legend>
          <label htmlFor={`${id}-t${i}`}>{t.guia.tituloDoPasso}<input id={`${id}-t${i}`} type="text" maxLength={80} value={p.titulo} onChange={(e) => mudar(i, "titulo", e.target.value)} /></label>
          <label htmlFor={`${id}-x${i}`}>{t.guia.textoDoPasso}<textarea id={`${id}-x${i}`} maxLength={400} value={p.texto} onChange={(e) => mudar(i, "texto", e.target.value)} /></label>
          <label htmlFor={`${id}-l${i}`}>{t.guia.linkDoPasso}<input id={`${id}-l${i}`} type="text" maxLength={200} value={p.link} onChange={(e) => mudar(i, "link", e.target.value)} /></label>
          <div className="ct-acoes"><Botao variante="fantasma" onClick={() => setPassos(passos.filter((_, j) => j !== i))}>{preencher(t.guia.tirar, { n: i + 1 })}</Botao></div>
        </fieldset>
      ))}
      <div className="ct-acoes">
        {passos.length < 6 && <Botao variante="contorno" onClick={() => setPassos([...passos, { titulo: "", texto: "", link: "" }])}>{t.guia.adicionar}</Botao>}
        <Botao type="submit">{t.comum.salvar}</Botao>
      </div>
      <Aviso m={msg} />
    </form>
  );
}

function SecaoGuia({ t, lang, c }: { t: TextosDaConta; lang: string; c: ComunidadeMinha }) {
  const { dado, erro, trocar } = useCarga<Guia>(`guia-${c.slug}`, () => conta.guia(c.slug));
  return (
    <section className="ct-bloco">
      <h3 className="ct-subtitulo al-cond">{t.guia.titulo}</h3>
      <p className="ct-miudo">{t.guia.sobre}</p>
      {erro ? <p className="ct-erro" role="alert">{fraseDoErro(t, erro)}</p> : null}
      {dado && (dado.posso_editar ? <EditarGuia key={JSON.stringify(dado.passos)} t={t} slug={c.slug} guia={dado} aoMudar={trocar} /> : <LerGuia key={c.slug} t={t} lang={lang} slug={c.slug} guia={dado} />)}
    </section>
  );
}

// ── 127. Quiz das regras ──

export function ResponderQuiz({ t, slug, quiz, aoAceitar }: { t: TextosDaConta; slug: string; quiz: Quiz; aoAceitar: () => void }) {
  const id = useId();
  const [r, setR] = useState<number[]>(() => quiz.perguntas.map(() => 0));
  const [msg, setMsg] = useState<Msg>(null);
  if (quiz.perguntas.length === 0) return <p className="ct-miudo">{t.quiz.vazio}</p>;
  if (quiz.aceitei) return <p className="ct-ok" role="status">{t.quiz.jaAceitei}</p>;
  async function enviar(e: FormEvent) {
    e.preventDefault();
    try {
      const x = await conta.responderQuiz(slug, r);
      if (x.ok) {
        setMsg({ texto: t.quiz.aceito, erro: false });
        aoAceitar();
      } else setMsg({ texto: preencher(t.quiz.errou, { n: x.erradas }), erro: true });
    } catch (x) {
      setMsg({ texto: fraseDoErro(t, x), erro: true });
    }
  }
  return (
    <form className="ct-form" onSubmit={enviar}>
      {quiz.perguntas.map((q, i) => (
        <fieldset key={i}>
          <legend>{q.pergunta}</legend>
          {q.opcoes.map((o, j) => (
            <label key={j} className="ct-opcao">
              <input type="radio" name={`${id}-q${i}`} checked={r[i] === j + 1} onChange={() => setR(r.map((v, k) => (k === i ? j + 1 : v)))} />
              {o}
            </label>
          ))}
        </fieldset>
      ))}
      <div className="ct-acoes"><Botao type="submit" disabled={r.some((v) => v === 0)}>{t.quiz.responder}</Botao></div>
      <Aviso m={msg} />
    </form>
  );
}

function EditarQuiz({ t, slug, quiz, aoMudar }: { t: TextosDaConta; slug: string; quiz: Quiz; aoMudar: (q: Quiz) => void }) {
  const id = useId();
  const [qs, setQs] = useState<PerguntaDoQuiz[]>(quiz.perguntas.map((q) => ({ pergunta: q.pergunta, opcoes: [...q.opcoes], certa: q.certa ?? 1 })));
  const [msg, setMsg] = useState<Msg>(null);
  async function salvar(e: FormEvent) {
    e.preventDefault();
    try {
      aoMudar(await conta.salvarQuiz(slug, qs));
      setMsg({ texto: t.comum.salvo, erro: false });
    } catch (x) {
      setMsg({ texto: fraseDoErro(t, x), erro: true });
    }
  }
  const mudar = (i: number, f: (q: PerguntaDoQuiz) => PerguntaDoQuiz) => setQs(qs.map((q, j) => (j === i ? f(q) : q)));
  return (
    <form className="ct-form" onSubmit={salvar}>
      {qs.map((q, i) => (
        <fieldset key={i}>
          <legend>{preencher(t.quiz.pergunta, { n: i + 1 })}</legend>
          <label htmlFor={`${id}-p${i}`}>{t.quiz.textoDaPergunta}<input id={`${id}-p${i}`} type="text" maxLength={200} value={q.pergunta} onChange={(e) => mudar(i, (x) => ({ ...x, pergunta: e.target.value }))} /></label>
          {q.opcoes.map((o, j) => (
            <div key={j} className="ct-escolha">
              <label htmlFor={`${id}-o${i}-${j}`}>{preencher(t.quiz.opcao, { n: j + 1 })}
                <input id={`${id}-o${i}-${j}`} type="text" maxLength={120} value={o} onChange={(e) => mudar(i, (x) => ({ ...x, opcoes: x.opcoes.map((y, k) => (k === j ? e.target.value : y)) }))} />
              </label>
              <label className="ct-opcao"><input type="radio" name={`${id}-c${i}`} checked={q.certa === j + 1} onChange={() => mudar(i, (x) => ({ ...x, certa: j + 1 }))} />{t.quiz.certa}</label>
            </div>
          ))}
          <div className="ct-acoes">
            {q.opcoes.length < 4 && <Botao variante="contorno" onClick={() => mudar(i, (x) => ({ ...x, opcoes: [...x.opcoes, ""] }))}>{t.quiz.adicionarOpcao}</Botao>}
            <Botao variante="fantasma" onClick={() => setQs(qs.filter((_, j) => j !== i))}>{preencher(t.quiz.tirarPergunta, { n: i + 1 })}</Botao>
          </div>
        </fieldset>
      ))}
      <div className="ct-acoes">
        {qs.length < 5 && <Botao variante="contorno" onClick={() => setQs([...qs, { pergunta: "", opcoes: ["", ""], certa: 1 }])}>{t.quiz.adicionarPergunta}</Botao>}
        <Botao type="submit">{t.comum.salvar}</Botao>
      </div>
      <Aviso m={msg} />
    </form>
  );
}

function SecaoQuiz({ t, c }: { t: TextosDaConta; c: ComunidadeMinha }) {
  const { dado, erro, trocar, recarregar } = useCarga<Quiz>(`quiz-${c.slug}`, () => conta.quiz(c.slug));
  return (
    <section className="ct-bloco">
      <h3 className="ct-subtitulo al-cond">{t.quiz.titulo}</h3>
      <p className="ct-miudo">{t.quiz.sobre}</p>
      {erro ? <p className="ct-erro" role="alert">{fraseDoErro(t, erro)}</p> : null}
      {dado && (dado.modero ? <EditarQuiz key={JSON.stringify(dado.perguntas)} t={t} slug={c.slug} quiz={dado} aoMudar={trocar} /> : <ResponderQuiz t={t} slug={c.slug} quiz={dado} aoAceitar={recarregar} />)}
    </section>
  );
}

// ── 80. Escudo ──

function SecaoEscudo({ t, lang, c }: { t: TextosDaConta; lang: string; c: ComunidadeMinha }) {
  const id = useId();
  const { dado, erro, trocar } = useCarga<Escudo>(`escudo-${c.slug}`, () => conta.escudo(c.slug));
  const [msg, setMsg] = useState<Msg>(null);
  async function salvar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    try {
      trocar(await conta.salvarEscudo(c.slug, { ligado: f.get("ligado") === "on", contas: Number(f.get("contas")), conta_dias: Number(f.get("conta_dias")), minutos: Number(f.get("minutos")), horas: Number(f.get("horas")) }));
      setMsg({ texto: t.comum.salvo, erro: false });
    } catch (x) {
      setMsg({ texto: fraseDoErro(t, x), erro: true });
    }
  }
  async function destravar() {
    try {
      trocar(await conta.salvarEscudo(c.slug, { destravar: true }));
    } catch (x) {
      setMsg({ texto: fraseDoErro(t, x), erro: true });
    }
  }
  return (
    <section className="ct-bloco">
      <h3 className="ct-subtitulo al-cond">{t.escudo.titulo}</h3>
      <p className="ct-miudo">{t.escudo.sobre}</p>
      {erro ? <p className="ct-erro" role="alert">{fraseDoErro(t, erro)}</p> : null}
      {dado && (
        <>
          <p className="ct-ok" role="status">{dado.travado_ate ? preencher(t.escudo.travado, { quando: new Intl.DateTimeFormat(lang, { dateStyle: "short", timeStyle: "short" }).format(new Date(dado.travado_ate)) }) : t.escudo.livre}</p>
          {dado.travado_ate && dado.modero && <div className="ct-acoes"><Botao variante="contorno" onClick={() => void destravar()}>{t.escudo.destravar}</Botao></div>}
          {dado.modero ? (
            <form className="ct-form" onSubmit={salvar} key={JSON.stringify(dado)}>
              <label className="ct-opcao"><input type="checkbox" name="ligado" defaultChecked={dado.ligado} />{t.escudo.ligado}</label>
              <label htmlFor={`${id}-c`}>{t.escudo.contas}<input id={`${id}-c`} name="contas" type="number" min={3} max={500} defaultValue={dado.contas} /></label>
              <label htmlFor={`${id}-d`}>{t.escudo.contaDias}<input id={`${id}-d`} name="conta_dias" type="number" min={1} max={90} defaultValue={dado.conta_dias} /></label>
              <label htmlFor={`${id}-m`}>{t.escudo.minutos}<input id={`${id}-m`} name="minutos" type="number" min={5} max={1440} defaultValue={dado.minutos} /></label>
              <label htmlFor={`${id}-h`}>{t.escudo.horas}<input id={`${id}-h`} name="horas" type="number" min={1} max={72} defaultValue={dado.horas} /></label>
              <div className="ct-acoes"><Botao type="submit">{t.comum.salvar}</Botao></div>
            </form>
          ) : (
            <p className="ct-miudo">{t.escudo.soMediacao}</p>
          )}
          <Aviso m={msg} />
        </>
      )}
    </section>
  );
}

// ── 105. Sala de cuidado ──

function SecaoCuidado({ t, c }: { t: TextosDaConta; c: ComunidadeMinha }) {
  const id = useId();
  const { dado, erro, trocar } = useCarga<Cuidado>(`cuidado-${c.slug}`, () => conta.cuidado(c.slug));
  const [msg, setMsg] = useState<Msg>(null);
  async function marcar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    try {
      trocar(await conta.marcarCuidado(c.slug, f.get("sala") === "on", String(f.get("texto") ?? "")));
      setMsg({ texto: t.comum.salvo, erro: false });
    } catch (x) {
      setMsg({ texto: fraseDoErro(t, x), erro: true });
    }
  }
  async function encaminhar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    try {
      await conta.encaminhar(c.slug, String(new FormData(form).get("handle") ?? ""));
      form.reset();
      setMsg({ texto: t.cuidado.enviado, erro: false });
    } catch (x) {
      setMsg({ texto: fraseDoErro(t, x), erro: true });
    }
  }
  return (
    <section className="ct-bloco">
      <h3 className="ct-subtitulo al-cond">{t.cuidado.titulo}</h3>
      <p className="ct-miudo">{t.cuidado.sobre}</p>
      {erro ? <p className="ct-erro" role="alert">{fraseDoErro(t, erro)}</p> : null}
      {dado && (
        <>
          <form className="ct-form" onSubmit={marcar} key={`${dado.sala}-${dado.texto}`}>
            <label className="ct-opcao"><input type="checkbox" name="sala" defaultChecked={dado.sala} />{t.cuidado.marcar}</label>
            <label htmlFor={`${id}-t`}>{t.cuidado.texto}<textarea id={`${id}-t`} name="texto" maxLength={600} defaultValue={dado.texto} /></label>
            <div className="ct-acoes"><Botao type="submit">{t.comum.salvar}</Botao></div>
          </form>
          {dado.sala && (
            <form className="ct-form" onSubmit={encaminhar}>
              <p className="ct-etiqueta">{t.cuidado.encaminhar}</p>
              <label htmlFor={`${id}-h`}>{t.cuidado.handle}<input id={`${id}-h`} name="handle" type="text" maxLength={21} autoComplete="off" /></label>
              <div className="ct-acoes"><Botao type="submit">{t.cuidado.enviar}</Botao></div>
            </form>
          )}
          <Aviso m={msg} />
        </>
      )}
    </section>
  );
}

// ── 78. Abrir uma mediação ──

function SecaoMediacao({ t, c }: { t: TextosDaConta; c: ComunidadeMinha }) {
  const id = useId();
  const [msg, setMsg] = useState<Msg>(null);
  async function abrir(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    try {
      await conta.abrirMediacao(c.slug, String(f.get("a") ?? ""), String(f.get("b") ?? ""));
      form.reset();
      setMsg({ texto: t.mediacao.aberta, erro: false });
    } catch (x) {
      setMsg({ texto: fraseDoErro(t, x), erro: true });
    }
  }
  return (
    <section className="ct-bloco">
      <h3 className="ct-subtitulo al-cond">{t.mediacao.titulo}</h3>
      <p className="ct-miudo">{t.mediacao.sobre}</p>
      <form className="ct-form" onSubmit={abrir}>
        <p className="ct-etiqueta">{t.mediacao.convidar}</p>
        <label htmlFor={`${id}-a`}>{t.mediacao.a}<input id={`${id}-a`} name="a" type="text" maxLength={21} autoComplete="off" /></label>
        <label htmlFor={`${id}-b`}>{t.mediacao.b}<input id={`${id}-b`} name="b" type="text" maxLength={21} autoComplete="off" /></label>
        <div className="ct-acoes"><Botao type="submit">{t.mediacao.abrir}</Botao></div>
      </form>
      <Aviso m={msg} />
    </section>
  );
}

export function AbaComunidades({ t, lang }: { t: TextosDaConta; lang: string }) {
  const id = useId();
  const { dado, erro } = useCarga<{ comunidades: ComunidadeMinha[] }>("minhas", () => conta.minhas());
  const [slug, setSlug] = useState<string | null>(null);
  const [secao, setSecao] = useState("guia");
  if (erro && !dado) return <p className="ct-erro" role="alert">{fraseDoErro(t, erro)}</p>;
  if (!dado) return <p className="ct-miudo" role="status">{t.comum.carregando}</p>;
  if (dado.comunidades.length === 0) return <p className="ct-miudo">{t.comunidades.nenhuma}</p>;
  const c = dado.comunidades.find((x) => x.slug === slug) ?? dado.comunidades[0];
  const secoes = ["guia", "quiz", ...(c.pedidos ? ["escudo"] : []), ...(c.modero ? ["cuidado", "mediacao"] : [])];
  const atual = secoes.includes(secao) ? secao : "guia";
  return (
    <div className="ct-bloco">
      <div className="ct-escolha">
        <label htmlFor={`${id}-c`}>{t.comunidades.qual}
          <select id={`${id}-c`} value={c.slug} onChange={(e) => setSlug(e.target.value)}>
            {dado.comunidades.map((x) => <option key={x.slug} value={x.slug}>{x.nome}</option>)}
          </select>
        </label>
      </div>
      <Abas chaves={secoes} atual={atual} rotulo={t.comunidades.secoes} nomes={(k) => (t.comunidades.secoesNomes as Record<string, string>)[k] ?? k} aoTrocar={setSecao} prefixo={`${id}-s`} classe="ct-sub" />
      <div role="tabpanel" id={`${id}-s-painel-${atual}`} aria-labelledby={`${id}-s-aba-${atual}`}>
        {atual === "guia" && <SecaoGuia key={c.slug} t={t} lang={lang} c={c} />}
        {atual === "quiz" && <SecaoQuiz key={c.slug} t={t} c={c} />}
        {atual === "escudo" && <SecaoEscudo key={c.slug} t={t} lang={lang} c={c} />}
        {atual === "cuidado" && <SecaoCuidado key={c.slug} t={t} c={c} />}
        {atual === "mediacao" && <SecaoMediacao key={c.slug} t={t} c={c} />}
      </div>
    </div>
  );
}
