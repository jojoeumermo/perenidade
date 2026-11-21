// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// A parte da comunidade da ação coletiva (Prompt 4): a pressão em parlamentar (89), as cartas de solidariedade (92), o questionário
// da base (93) e o rodízio de tarefas (122). A comunidade é escolhida entre as da própria pessoa; o banco confere tudo de novo.
import { useId, useState, type FormEvent } from "react";
import { confirmar } from "@/components/perguntar";
import { acaoColetiva, type Cartas, type Contato, type Frequencia, type Minhas, type Pergunta, type Pressoes, type Questionarios, type Rodizios, type SituacaoDaCarta } from "@/lib/rede/coletiva/cliente";
import { Botao } from "../ui/Botao";
import { useCarga } from "../memoria/usar";
import { com, dataCurta, fraseDoErro, type TextosDaColetiva } from "./textos";

type Props = { t: TextosDaColetiva; lang: string };
type Msg = { texto: string; erro: boolean } | null;

function Mensagem({ m }: { m: Msg }) {
  return m ? <p className={m.erro ? "ac-erro" : "ac-ok"} role={m.erro ? "alert" : "status"}>{m.texto}</p> : null;
}

/** Um contato por linha: e-mail, telefone (só números) ou site. */
export function lerContatos(texto: string): Contato[] {
  return texto.split("\n").map((l) => l.trim()).filter(Boolean).slice(0, 6).map((v) =>
    v.includes("@") ? { tipo: "email", valor: v } : /^https:\/\//i.test(v) ? { tipo: "site", valor: v } : { tipo: "telefone", valor: v });
}

/** As perguntas do questionário, uma por linha ("Pergunta? | a | b" escolha; "várias:" várias; "escala:"; "aberta:"). */
export function lerPerguntas(texto: string): Pergunta[] {
  return texto.split("\n").map((l) => l.trim()).filter(Boolean).slice(0, 12).map((l): Pergunta => {
    const [cabeca, ...ops] = l.split("|").map((x) => x.trim());
    const m = /^(escala|aberta|v[áa]rias):\s*(.*)$/i.exec(cabeca);
    if (m && /^escala$/i.test(m[1])) return { tipo: "escala", texto: m[2], opcoes: [] };
    if (m && /^aberta$/i.test(m[1])) return { tipo: "aberta", texto: m[2], opcoes: [] };
    if (m) return { tipo: "varias", texto: m[2], opcoes: ops.filter(Boolean) };
    return { tipo: "escolha", texto: cabeca, opcoes: ops.filter(Boolean) };
  });
}

export function AbaComunidade({ t, lang }: Props) {
  const minhas = useCarga<Minhas>("minhas", () => acaoColetiva.minhas());
  const [slug, setSlug] = useState<string | null>(null);
  const id = useId();
  const lista = minhas.dado?.comunidades ?? [];
  const escolhida = slug ?? lista[0]?.slug ?? null;
  if (minhas.erro) return <p className="ac-erro" role="alert">{fraseDoErro(t, minhas.erro)}</p>;
  if (!minhas.dado) return <p className="ac-miudo" role="status">{t.comum.carregando}</p>;
  if (!lista.length) return <p className="ac-miudo">{t.comum.semComunidade}</p>;
  return (
    <div className="ac-bloco">
      <div className="ac-form">
        <label htmlFor={`${id}-c`}>{t.comum.comunidade}</label>
        <select id={`${id}-c`} value={escolhida ?? ""} onChange={(e) => setSlug(e.target.value)}>
          {lista.map((c) => <option key={c.slug} value={c.slug}>{c.nome}</option>)}
        </select>
      </div>
      {escolhida && (
        <>
          <Pressao t={t} lang={lang} slug={escolhida} />
          <CartasDaComunidade t={t} lang={lang} slug={escolhida} />
          <QuestionariosDaComunidade t={t} lang={lang} slug={escolhida} />
          <RodiziosDaComunidade t={t} lang={lang} slug={escolhida} />
        </>
      )}
    </div>
  );
}

// ───── 89 · Pressão em parlamentar ─────
function Pressao({ t, slug }: Props & { slug: string }) {
  const { dado, erro, trocar, recarregar } = useCarga<Pressoes>(`p:${slug}`, () => acaoColetiva.pressoes(slug));
  const [abrir, setAbrir] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);
  const id = useId();
  const fazer = async (f: () => Promise<Pressoes>) => {
    try {
      trocar(await f());
      setMsg(null);
    } catch (x) {
      setMsg({ texto: fraseDoErro(t, x), erro: true });
    }
  };
  async function criar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    await fazer(() => acaoColetiva.criarPressao({ comunidade: slug, alvo: String(f.get("alvo")), cargo: String(f.get("cargo")), assunto: String(f.get("assunto")), mensagem: String(f.get("mensagem")), contatos: lerContatos(String(f.get("contatos"))) }));
    setAbrir(false);
  }
  return (
    <section className="ac-bloco" aria-labelledby={`${id}-t`} data-item="89">
      <h2 id={`${id}-t`} className="ac-subtitulo">{t.pressao.titulo}</h2>
      <p className="ac-miudo">{t.pressao.sobre}</p>
      <Mensagem m={msg} />
      {erro ? <p className="ac-erro" role="alert">{fraseDoErro(t, erro)}</p> : null}
      {dado?.modero && (abrir ? (
        <form className="ac-form" onSubmit={criar} aria-label={t.pressao.nova}>
          <label>{t.pressao.alvo}<input type="text" name="alvo" required minLength={3} maxLength={120} /></label>
          <label>{t.pressao.cargo} {t.comum.opcional}<input type="text" name="cargo" maxLength={80} /></label>
          <label>{t.pressao.assunto}<input type="text" name="assunto" required minLength={3} maxLength={140} /></label>
          <label>{t.pressao.mensagem}<textarea name="mensagem" required minLength={20} maxLength={2000} /></label>
          <label>{t.pressao.contatos}<textarea name="contatos" required /></label>
          <div className="ac-acoes"><Botao type="submit">{t.comum.salvar}</Botao><Botao variante="fantasma" onClick={() => setAbrir(false)}>{t.comum.cancelar}</Botao></div>
        </form>
      ) : <div className="ac-acoes"><Botao variante="contorno" onClick={() => setAbrir(true)}>{t.pressao.nova}</Botao></div>)}
      {dado && !dado.pressoes.length && <p className="ac-miudo">{t.pressao.vazio}</p>}
      <ul className="ac-lista">
        {dado?.pressoes.map((p) => {
          const assunto = encodeURIComponent(p.assunto);
          const corpo = encodeURIComponent(p.mensagem);
          return (
            <li key={p.id} className="ac-cartao">
              <p className="ac-etiqueta">{p.cargo}{p.encerrada ? ` · ${t.comum.encerrada}` : ""}</p>
              <h3>{p.alvo}: {p.assunto}</h3>
              <p>{p.mensagem}</p>
              <div className="ac-acoes">
                {p.contatos.map((c) => c.tipo === "email"
                  ? <a key={c.valor} className="ac-link" href={`mailto:${c.valor}?subject=${assunto}&body=${corpo}`}>{t.pressao.mandarEmail}: {c.valor}</a>
                  : c.tipo === "telefone"
                    ? <a key={c.valor} className="ac-link" href={`tel:+55${c.valor}`}>{t.pressao.ligar}: {c.valor}</a>
                    : <a key={c.valor} className="ac-link" href={c.valor} target="_blank" rel="noopener noreferrer nofollow">{t.pressao.site}</a>)}
              </div>
              <p className="ac-miudo" aria-live="polite">{p.total !== null ? com(t.pressao.total, { n: p.total }) : t.pressao.poucos}</p>
              {!p.encerrada && (
                <div className="ac-acoes">
                  <Botao variante={p.eu_mandei ? "fantasma" : "primario"} pressionado={p.eu_mandei} onClick={() => fazer(() => acaoColetiva.mandei(p.id, !p.eu_mandei))}>
                    {p.eu_mandei ? t.pressao.desfazer : t.pressao.mandei}
                  </Botao>
                  {dado.modero && (
                    <Botao variante="fantasma" onClick={async () => { if (await confirmar(t.pressao.encerrarPergunta, { sim: t.comum.sim, nao: t.comum.nao })) await fazer(() => acaoColetiva.encerrarPressao(p.id)); }}>
                      {t.comum.encerrar}
                    </Botao>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {erro ? <Botao variante="fantasma" onClick={recarregar}>↻</Botao> : null}
    </section>
  );
}

// ───── 92 · Cartas de solidariedade ─────
function CartasDaComunidade({ t, slug }: Props & { slug: string }) {
  const { dado, erro, trocar } = useCarga<Cartas>(`c:${slug}`, () => acaoColetiva.cartas(slug));
  const [abrir, setAbrir] = useState(false);
  const [escrevendo, setEscrevendo] = useState<string | null>(null);
  const [msg, setMsg] = useState<Msg>(null);
  const id = useId();
  const fazer = async (f: () => Promise<Cartas>) => {
    try {
      trocar(await f());
      setMsg(null);
      return true;
    } catch (x) {
      setMsg({ texto: fraseDoErro(t, x), erro: true });
      return false;
    }
  };
  async function baixar(campanha: string) {
    try {
      const e = await acaoColetiva.entregaDasCartas(campanha);
      const texto = [`${e.para}\n`, ...e.cartas.map((c) => `${c.texto}\n\n— ${c.assinatura || t.cartas.semAssinatura}\n`)].join("\n────────\n\n");
      const url = URL.createObjectURL(new Blob([texto], { type: "text/plain;charset=utf-8" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = "cartas.txt";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (x) {
      setMsg({ texto: fraseDoErro(t, x), erro: true });
    }
  }
  return (
    <section className="ac-bloco" aria-labelledby={`${id}-t`} data-item="92">
      <h2 id={`${id}-t`} className="ac-subtitulo">{t.cartas.titulo}</h2>
      <p className="ac-miudo">{t.cartas.sobre}</p>
      <Mensagem m={msg} />
      {erro ? <p className="ac-erro" role="alert">{fraseDoErro(t, erro)}</p> : null}
      {dado?.modero && (abrir ? (
        <form className="ac-form" aria-label={t.cartas.nova} onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          if (await fazer(() => acaoColetiva.abrirCampanhaDeCartas({ comunidade: slug, para: String(f.get("para")), situacao: String(f.get("situacao")) as SituacaoDaCarta, sobre: String(f.get("sobre")), entrega: String(f.get("entrega")) }))) setAbrir(false);
        }}>
          <label>{t.cartas.para}<input type="text" name="para" required minLength={3} maxLength={120} /></label>
          <label>{t.cartas.situacao}
            <select name="situacao">{(["presa", "demitida", "ameacada", "outra"] as const).map((s) => <option key={s} value={s}>{t.cartas.situacoes[s]}</option>)}</select>
          </label>
          <label>{t.comum.texto} {t.comum.opcional}<textarea name="sobre" maxLength={1000} /></label>
          <label>{t.cartas.entrega}<input type="text" name="entrega" maxLength={300} /></label>
          <div className="ac-acoes"><Botao type="submit">{t.comum.salvar}</Botao><Botao variante="fantasma" onClick={() => setAbrir(false)}>{t.comum.cancelar}</Botao></div>
        </form>
      ) : <div className="ac-acoes"><Botao variante="contorno" onClick={() => setAbrir(true)}>{t.cartas.nova}</Botao></div>)}
      {dado && !dado.campanhas.length && <p className="ac-miudo">{t.cartas.vazio}</p>}
      <ul className="ac-lista">
        {dado?.campanhas.map((c) => (
          <li key={c.id} className="ac-cartao">
            <p className="ac-etiqueta">{t.cartas.situacoes[c.situacao]}{c.encerrada ? ` · ${t.comum.encerrada}` : ""}</p>
            <h3>{c.para}</h3>
            {c.sobre && <p>{c.sobre}</p>}
            {c.entrega && <p className="ac-miudo">{c.entrega}</p>}
            <p className="ac-miudo">{c.aprovadas !== null ? com(t.cartas.aprovadas, { n: c.aprovadas }) : ""}</p>
            {c.minhas.length > 0 && (
              <>
                <h4>{t.cartas.minhas}</h4>
                <ul className="ac-lista">
                  {c.minhas.map((k) => (
                    <li key={k.id}>
                      <p>{k.texto}</p>
                      <div className="ac-acoes">
                        <span className="ac-miudo">{k.estado === "aprovada" ? t.cartas.aprovada : t.cartas.pendente}</span>
                        <Botao variante="fantasma" tamanho="p" onClick={() => fazer(() => acaoColetiva.apagarCarta(k.id))}>{t.comum.apagar}</Botao>
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            )}
            {!c.encerrada && dado.posso_escrever && (escrevendo === c.id ? (
              <form className="ac-form" aria-label={t.cartas.escrever} onSubmit={async (e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                if (await fazer(() => acaoColetiva.escreverCarta({ campanha: c.id, texto: String(f.get("texto")), assinar: f.get("assinar") === "on" }))) setEscrevendo(null);
              }}>
                <label>{t.comum.texto}<textarea name="texto" required minLength={20} maxLength={3000} /></label>
                <label className="ac-opcao"><input type="checkbox" name="assinar" />{t.cartas.assinar}</label>
                <div className="ac-acoes"><Botao type="submit">{t.cartas.enviar}</Botao><Botao variante="fantasma" onClick={() => setEscrevendo(null)}>{t.comum.cancelar}</Botao></div>
              </form>
            ) : <div className="ac-acoes"><Botao variante="contorno" onClick={() => setEscrevendo(c.id)}>{t.cartas.escrever}</Botao></div>)}
            {dado.modero && c.fila.length > 0 && (
              <>
                <h4>{t.cartas.fila}</h4>
                <ul className="ac-lista">
                  {c.fila.map((k) => (
                    <li key={k.id} className="ac-cartao">
                      <p>{k.texto}</p>
                      <p className="ac-miudo">— {k.assinatura || t.cartas.semAssinatura}</p>
                      <div className="ac-acoes">
                        <Botao tamanho="p" onClick={() => fazer(() => acaoColetiva.decidirCarta(k.id, true))}>{t.cartas.aprovar}</Botao>
                        <Botao variante="fantasma" tamanho="p" onClick={() => fazer(() => acaoColetiva.decidirCarta(k.id, false))}>{t.cartas.recusar}</Botao>
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            )}
            {dado.modero && (
              <div className="ac-acoes">
                <Botao variante="contorno" onClick={() => baixar(c.id)}>{t.cartas.entregaBaixar}</Botao>
                {!c.encerrada && <Botao variante="fantasma" onClick={() => fazer(() => acaoColetiva.encerrarCartas(c.id, false))}>{t.comum.encerrar}</Botao>}
              </div>
            )}
          </li>
        ))}
      </ul>
      <p className="ac-miudo">{t.cartas.juridico}</p>
    </section>
  );
}

// ───── 93 · Questionário da base ─────
function QuestionariosDaComunidade({ t, slug }: Props & { slug: string }) {
  const { dado, erro, trocar } = useCarga<Questionarios>(`q:${slug}`, () => acaoColetiva.questionarios(slug));
  const [abrir, setAbrir] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);
  const id = useId();
  const fazer = async (f: () => Promise<Questionarios>) => {
    try {
      trocar(await f());
      setMsg(null);
      return true;
    } catch (x) {
      setMsg({ texto: fraseDoErro(t, x), erro: true });
      return false;
    }
  };
  return (
    <section className="ac-bloco" aria-labelledby={`${id}-t`} data-item="93">
      <h2 id={`${id}-t`} className="ac-subtitulo">{t.questionario.titulo}</h2>
      <p className="ac-miudo">{t.questionario.sobre}</p>
      <Mensagem m={msg} />
      {erro ? <p className="ac-erro" role="alert">{fraseDoErro(t, erro)}</p> : null}
      {dado?.modero && (abrir ? (
        <form className="ac-form" aria-label={t.questionario.novo} onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          if (await fazer(() => acaoColetiva.criarQuestionario({ comunidade: slug, titulo: String(f.get("titulo")), sobre: String(f.get("sobre")), perguntas: lerPerguntas(String(f.get("perguntas"))) }))) setAbrir(false);
        }}>
          <label>{t.comum.titulo}<input type="text" name="titulo" required minLength={3} maxLength={120} /></label>
          <label>{t.comum.texto} {t.comum.opcional}<textarea name="sobre" maxLength={600} /></label>
          <label>{t.questionario.perguntas}<textarea name="perguntas" required /></label>
          <div className="ac-acoes"><Botao type="submit">{t.comum.salvar}</Botao><Botao variante="fantasma" onClick={() => setAbrir(false)}>{t.comum.cancelar}</Botao></div>
        </form>
      ) : <div className="ac-acoes"><Botao variante="contorno" onClick={() => setAbrir(true)}>{t.questionario.novo}</Botao></div>)}
      {dado && !dado.questionarios.length && <p className="ac-miudo">{t.questionario.vazio}</p>}
      <ul className="ac-lista">
        {dado?.questionarios.map((q) => (
          <li key={q.id} className="ac-cartao">
            <p className="ac-etiqueta">{q.aberto ? "" : t.comum.encerrada}</p>
            <h3>{q.titulo}</h3>
            {q.sobre && <p>{q.sobre}</p>}
            {q.ja_respondi ? <p className="ac-ok">{t.questionario.jaRespondi}</p> : q.aberto && dado.posso_responder ? (
              <form className="ac-form" aria-label={q.titulo} onSubmit={async (e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                const respostas = q.perguntas.map((p, i) => {
                  if (p.tipo === "varias") return f.getAll(`p${i}`).map(Number);
                  const v = f.get(`p${i}`);
                  if (v === null || v === "") return null;
                  return p.tipo === "aberta" ? String(v) : Number(v);
                });
                await fazer(() => acaoColetiva.responder(q.id, respostas));
              }}>
                {q.perguntas.map((p, i) => (
                  <fieldset key={i}>
                    <legend>{p.texto}</legend>
                    {p.tipo === "aberta" ? <textarea name={`p${i}`} maxLength={1000} aria-label={p.texto} />
                      : p.tipo === "escala" ? [1, 2, 3, 4, 5].map((n) => <label key={n} className="ac-opcao"><input type="radio" name={`p${i}`} value={n} />{n}</label>)
                        : p.opcoes.map((o, j) => <label key={j} className="ac-opcao"><input type={p.tipo === "varias" ? "checkbox" : "radio"} name={`p${i}`} value={j} />{o}</label>)}
                  </fieldset>
                ))}
                <div className="ac-acoes"><Botao type="submit">{t.questionario.responder}</Botao></div>
              </form>
            ) : null}
            <h4>{t.questionario.relatorio}</h4>
            {q.relatorio ? (
              <>
                <p className="ac-miudo">{q.relatorio.respostas !== null ? com(t.questionario.respostas, { n: q.relatorio.respostas }) : ""}</p>
                {q.relatorio.perguntas.map((p, i) => (
                  <div key={i}>
                    <p><strong>{p.texto}</strong></p>
                    {p.opcoes && <ul className="ac-miudo">{p.opcoes.map((o, j) => <li key={j}>{o.opcao}: {o.total ?? t.comum.menosDe3}</li>)}</ul>}
                    {p.escala && <ul className="ac-miudo">{p.escala.map((o) => <li key={o.valor}>{com(t.questionario.escala, { n: o.valor })}: {o.total ?? t.comum.menosDe3}</li>)}</ul>}
                    {p.abertas && (
                      <>
                        <p className="ac-miudo">{t.questionario.abertas}</p>
                        <ul>{p.abertas.map((a, j) => <li key={j}>{a}</li>)}</ul>
                      </>
                    )}
                  </div>
                ))}
              </>
            ) : <p className="ac-miudo">{t.questionario.semRelatorio}</p>}
            {dado.modero && q.aberto && <div className="ac-acoes"><Botao variante="fantasma" onClick={() => fazer(() => acaoColetiva.encerrarQuestionario(q.id, false))}>{t.comum.encerrar}</Botao></div>}
          </li>
        ))}
      </ul>
    </section>
  );
}

// ───── 122 · Rodízio de tarefas ─────
function RodiziosDaComunidade({ t, lang, slug }: Props & { slug: string }) {
  const { dado, erro, trocar } = useCarga<Rodizios>(`r:${slug}`, () => acaoColetiva.rodizios(slug));
  const [abrir, setAbrir] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);
  const id = useId();
  const fazer = async (f: () => Promise<Rodizios>) => {
    try {
      trocar(await f());
      setMsg(null);
      return true;
    } catch (x) {
      setMsg({ texto: fraseDoErro(t, x), erro: true });
      return false;
    }
  };
  const hoje = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
  return (
    <section className="ac-bloco" aria-labelledby={`${id}-t`} data-item="122">
      <h2 id={`${id}-t`} className="ac-subtitulo">{t.rodizio.titulo}</h2>
      <p className="ac-miudo">{t.rodizio.sobre}</p>
      <Mensagem m={msg} />
      {erro ? <p className="ac-erro" role="alert">{fraseDoErro(t, erro)}</p> : null}
      {dado?.modero && (abrir ? (
        <form className="ac-form" aria-label={t.rodizio.novo} onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          if (await fazer(() => acaoColetiva.criarRodizio({ comunidade: slug, tarefa: String(f.get("tarefa")), sobre: String(f.get("sobre")), frequencia: String(f.get("frequencia")) as Frequencia, comeca: String(f.get("comeca")) }))) setAbrir(false);
        }}>
          <label>{t.rodizio.tarefa}<input type="text" name="tarefa" required minLength={3} maxLength={80} /></label>
          <label>{t.comum.texto} {t.comum.opcional}<input type="text" name="sobre" maxLength={300} /></label>
          <label>{t.rodizio.frequencia}
            <select name="frequencia">{(["semanal", "quinzenal", "mensal"] as const).map((f) => <option key={f} value={f}>{t.rodizio.frequencias[f]}</option>)}</select>
          </label>
          <label>{t.rodizio.comeca}<input type="date" name="comeca" required min={hoje} defaultValue={hoje} /></label>
          <div className="ac-acoes"><Botao type="submit">{t.comum.salvar}</Botao><Botao variante="fantasma" onClick={() => setAbrir(false)}>{t.comum.cancelar}</Botao></div>
        </form>
      ) : <div className="ac-acoes"><Botao variante="contorno" onClick={() => setAbrir(true)}>{t.rodizio.novo}</Botao></div>)}
      {dado && !dado.rodizios.length && <p className="ac-miudo">{t.rodizio.vazio}</p>}
      <ul className="ac-lista">
        {dado?.rodizios.map((r) => (
          <li key={r.id} className="ac-cartao">
            <p className="ac-etiqueta">{t.rodizio.frequencias[r.frequencia]}{r.ativo ? "" : ` · ${t.comum.encerrada}`}</p>
            <h3>{r.tarefa}</h3>
            {r.sobre && <p>{r.sobre}</p>}
            <p className="ac-miudo">{r.pessoas !== null ? com(t.rodizio.pessoas, { n: r.pessoas }) : r.tem_gente ? t.rodizio.temGente : t.rodizio.semGente}</p>
            {r.estou && r.minhas_vezes.length > 0 && (
              <>
                <h4>{t.rodizio.minhasVezes}</h4>
                <ul className="ac-miudo">{r.minhas_vezes.map((d) => <li key={d}>{dataCurta(lang, d)}</li>)}</ul>
              </>
            )}
            {r.ativo && dado.posso_entrar && (
              <div className="ac-acoes">
                <Botao variante={r.estou ? "fantasma" : "primario"} pressionado={r.estou} onClick={() => fazer(() => acaoColetiva.entrarNoRodizio(r.id, !r.estou))}>{r.estou ? t.rodizio.sair : t.rodizio.entrar}</Botao>
                {dado.modero && <Botao variante="fantasma" onClick={() => fazer(() => acaoColetiva.encerrarRodizio(r.id, false))}>{t.comum.encerrar}</Botao>}
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
