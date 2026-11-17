// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from "react";
import { EsqueletoDosAjustes } from "../../Esqueletos";
import { Confirmar, FaixaDaPrevia, Torradas, useTextosAlumia3, useTorrada } from "../../conversa/base3";
import type { PropsDaTelaDoPacote } from "../../registro";
import { Botao } from "../../ui/Botao";
import { EstadoDaAlumia } from "../../ui/Estado";
import { Faixa } from "../../ui/Faixa";
import { turmas } from "./cliente";
import { criarTextos, encher, Ladrilhos, Nota, textoDoErro } from "./comum";
import { codigoDoTexto, COMBINADOS_DE_EXEMPLO, diaEMes, enderecoDoConvite, fileiraDeSemanas, LIMITES_DA_TURMA, type Turma } from "./regras";
import { carregarTextosDaTurma, type TextosDaTurma } from "./textos";
import "./estudo.css";

type T = TextosDaTurma;
const useTextosDaTurma = criarTextos(carregarTextosDaTurma);

/**
 * As turmas de estudo (/alumia/turmas; frente 11C, L2-43). Turma pequena, que entra por código; o combinado da semana; cada pessoa
 * marca só a própria semana; a turma vê só o total, e só a partir de 3. A fileira do mosaico acende a semana que chegou a 3, sem
 * nome nenhum e sem palavra para a semana que não chegou. Computador primeiro: as turmas à esquerda, começar e entrar à direita.
 */
export default function TelaDasTurmas({ lang, s, situacao }: PropsDaTelaDoPacote) {
  const t = useTextosDaTurma(lang);
  const t3 = useTextosAlumia3(lang);
  const torradas = useTorrada();
  const [lista, setLista] = useState<Turma[] | null>(null);
  const [erro, setErro] = useState<unknown>(null);
  const [vez, setVez] = useState(0);
  const membro = situacao.logado && situacao.membro;
  const id = useId();

  useEffect(() => {
    if (!membro) return;
    let vivo = true;
    turmas.minhas().then(
      (r) => {
        if (!vivo) return;
        setLista(r);
        setErro(null);
      },
      (e: unknown) => vivo && setErro(e ?? new Error("falha")),
    );
    return () => {
      vivo = false;
    };
  }, [membro, vez]);

  const trocar = useCallback((nova: Turma) => setLista((l) => (l ? (l.some((x) => x.id === nova.id) ? l.map((x) => (x.id === nova.id ? nova : x)) : [...l, nova]) : [nova])), []);
  const tirar = useCallback((idDaTurma: string) => setLista((l) => (l ?? []).filter((x) => x.id !== idDaTurma)), []);

  if (!t || !t3) return <EsqueletoDosAjustes rotulo={s.estados.carregando} quantos={3} />;

  return (
    <article className="es-pagina" aria-labelledby={`${id}-titulo`}>
      <FaixaDaPrevia t={t3} />
      <header className="es-cabeca">
        <Faixa className="es-faixa" />
        <h1 id={`${id}-titulo`} className="es-titulo al-cond">{t.titulo}</h1>
        <p className="es-chamada">{t.chamada}</p>
      </header>

      {!membro ? (
        <EstadoDaAlumia icone="cadeado" texto={t.entre} />
      ) : (
        <div className="es-colunas">
          <section className="es-principal" aria-labelledby={`${id}-minhas`}>
            <h2 id={`${id}-minhas`} className="es-secao al-cond">{t.minhas.titulo}</h2>
            {erro && !lista ? (
              <EstadoDaAlumia erro texto={textoDoErro(t.erros, erro)}>
                <Botao variante="claro" onClick={() => setVez((n) => n + 1)}>{t.tentar}</Botao>
              </EstadoDaAlumia>
            ) : !lista ? (
              <div className="es-esqueleto" role="status" aria-label={s.estados.carregando}>
                <span />
                <span />
              </div>
            ) : lista.length === 0 ? (
              <EstadoDaAlumia mosaico titulo={t.minhas.vazioTitulo} texto={t.minhas.vazio} />
            ) : (
              <ul className="es-lista" role="list">
                {lista.map((x) => (
                  <li key={x.id}>
                    <CartaoDaTurma t={t} lang={lang} turma={x} aoMudar={trocar} aoSair={tirar} avisar={torradas.mostrar} />
                  </li>
                ))}
              </ul>
            )}
          </section>

          <aside className="es-lado" aria-label={t.lado}>
            <Entrar t={t} aoEntrar={(x) => { trocar(x); torradas.mostrar({ texto: encher(t.entrar.feito, { nome: x.nome }) }); }} cheio={(lista?.length ?? 0) >= LIMITES_DA_TURMA.turmasPorPessoa} />
            <Comecar t={t} aoCriar={(x) => { trocar(x); torradas.mostrar({ texto: encher(t.comecar.feito, { nome: x.nome }) }); }} cheio={(lista?.length ?? 0) >= LIMITES_DA_TURMA.turmasPorPessoa} />
            <ComoConta t={t} />
          </aside>
        </div>
      )}
      <Torradas estado={torradas} />
    </article>
  );
}

/** Uma turma: o combinado, o total da semana (a partir de 3), a marca da pessoa, a fileira das semanas, o convite e o que quem cuida muda. */
function CartaoDaTurma({ t, lang, turma, aoMudar, aoSair, avisar }: {
  t: T;
  lang: string;
  turma: Turma;
  aoMudar: (x: Turma) => void;
  aoSair: (id: string) => void;
  avisar: (x: { texto: string; erro?: boolean }) => void;
}) {
  const id = useId();
  const [ocupado, setOcupado] = useState(false);
  const [editando, setEditando] = useState(false);
  const [saindo, setSaindo] = useState(false);
  const botaoSair = useRef<HTMLButtonElement>(null);
  const fileira = fileiraDeSemanas(turma.semanas, turma.semana);

  async function fazer(acao: () => Promise<Turma>, feito?: string) {
    setOcupado(true);
    try {
      aoMudar(await acao());
      if (feito) avisar({ texto: feito });
    } catch (e) {
      avisar({ texto: textoDoErro(t.erros, e), erro: true });
    } finally {
      setOcupado(false);
    }
  }

  async function copiar() {
    const endereco = enderecoDoConvite(window.location.origin, lang, turma.codigo);
    try {
      await navigator.clipboard.writeText(endereco);
      avisar({ texto: t.convite.copiado });
    } catch {
      avisar({ texto: encher(t.convite.copieVoce, { endereco }), erro: true });
    }
  }

  const totalTexto = turma.total !== null ? encher(t.semana.total, { n: turma.total }) : t.semana.poucos;
  return (
    <article className="es-cartao es-turma" aria-labelledby={`${id}-nome`} data-marquei={turma.marquei || undefined}>
      <div className="es-cartao-topo">
        <Ladrilhos cores={["v", "d", "1", "2", "4", "3"]} />
        {turma.cuida && <span className="es-carimbo">{t.turma.cuida}</span>}
      </div>
      <h3 id={`${id}-nome`} className="es-cartao-titulo al-cond">{turma.nome}</h3>
      <p className="es-pessoas">{turma.pessoas !== null ? encher(t.turma.pessoas, { n: turma.pessoas }) : t.turma.poucasPessoas}</p>

      <div className="es-combinado">
        <p className="es-rotulo al-cond">{t.turma.combinado}</p>
        <p className="es-meta">{turma.meta}</p>
      </div>

      <div className="es-semana">
        <div className="es-semana-texto">
          <p className="es-rotulo al-cond">{encher(t.semana.titulo, { dia: diaEMes(turma.semana) })}</p>
          <p className="es-total" aria-live="polite">
            {turma.total !== null && <span className="es-total-n al-cond" data-al-numero>{turma.total}</span>}
            <span>{totalTexto}</span>
          </p>
        </div>
        <Botao
          variante={turma.marquei ? "claro" : "primario"}
          tamanho="g"
          pressionado={turma.marquei}
          disabled={ocupado}
          onClick={() => fazer(() => turmas.marcar(turma.id, !turma.marquei), turma.marquei ? t.semana.desmarcado : t.semana.marcado)}
        >
          {turma.marquei ? t.semana.fiz : t.semana.marcar}
        </Botao>
      </div>
      <p className="es-miudo">{turma.marquei ? t.semana.soVoce : t.semana.ninguemVe}</p>

      <figure className="es-fileira-bloco">
        <figcaption className="es-rotulo al-cond">{t.fileira.titulo}</figcaption>
        <ol className="es-fileira" role="list">
          {fileira.map((f) => (
            <li key={f.semana} data-acesa={f.total !== null || undefined}>
              <span className="es-fileira-ladrilho al-cond" aria-hidden>{f.total ?? ""}</span>
              <span className="es-fileira-dia">{diaEMes(f.semana)}</span>
              <span className="sr-only">{f.total !== null ? encher(t.fileira.acesa, { dia: diaEMes(f.semana), n: f.total }) : encher(t.fileira.apagada, { dia: diaEMes(f.semana) })}</span>
            </li>
          ))}
        </ol>
        <p className="es-miudo">{t.fileira.regra}</p>
      </figure>

      <div className="es-convite">
        <p className="es-rotulo al-cond">{t.convite.titulo}</p>
        <p className="es-codigo"><code>{turma.codigo}</code></p>
        <div className="es-acoes">
          <Botao variante="contorno" tamanho="m" onClick={copiar}>{t.convite.copiar}</Botao>
          {turma.cuida && (
            <Botao variante="fantasma" tamanho="m" disabled={ocupado} onClick={() => fazer(() => turmas.novoCodigo(turma.id), t.convite.novoFeito)}>{t.convite.novo}</Botao>
          )}
        </div>
        <p className="es-miudo">{t.convite.dica}</p>
      </div>

      {editando && turma.cuida ? (
        <EditarTurma t={t} turma={turma} aoFechar={() => setEditando(false)} aoSalvar={(nome, meta) => fazer(() => turmas.editar(turma.id, nome, meta), t.editar.feito).then(() => setEditando(false))} ocupado={ocupado} />
      ) : null}

      <div className="es-acoes es-rodape">
        {turma.cuida && !editando && <Botao variante="contorno" tamanho="m" onClick={() => setEditando(true)}>{t.editar.abrir}</Botao>}
        <Botao ref={botaoSair} variante="fantasma" tamanho="m" onClick={() => setSaindo(true)}>{t.sair.botao}</Botao>
      </div>
      <Confirmar
        aberto={saindo}
        titulo={encher(t.sair.titulo, { nome: turma.nome })}
        texto={turma.cuida ? t.sair.textoCuida : t.sair.texto}
        sim={t.sair.sim}
        nao={t.sair.nao}
        voltarPara={botaoSair}
        aoFechar={() => setSaindo(false)}
        aoSim={async () => {
          try {
            await turmas.sair(turma.id);
            aoSair(turma.id);
            avisar({ texto: encher(t.sair.feito, { nome: turma.nome }) });
          } catch (e) {
            avisar({ texto: textoDoErro(t.erros, e), erro: true });
          }
        }}
      />
    </article>
  );
}

function EditarTurma({ t, turma, aoFechar, aoSalvar, ocupado }: { t: T; turma: Turma; aoFechar: () => void; aoSalvar: (nome: string, meta: string) => void; ocupado: boolean }) {
  const id = useId();
  const [nome, setNome] = useState(turma.nome);
  const [meta, setMeta] = useState(turma.meta);
  return (
    <form
      className="es-form es-bloco"
      aria-label={t.editar.titulo}
      onSubmit={(e) => {
        e.preventDefault();
        aoSalvar(nome, meta);
      }}
    >
      <label className="es-campo" htmlFor={`${id}-nome`}>
        <span>{t.campos.nome}</span>
        <input id={`${id}-nome`} value={nome} onChange={(e) => setNome(e.target.value)} minLength={LIMITES_DA_TURMA.nomeMin} maxLength={LIMITES_DA_TURMA.nome} required />
      </label>
      <label className="es-campo" htmlFor={`${id}-meta`}>
        <span>{t.campos.meta}</span>
        <input id={`${id}-meta`} value={meta} onChange={(e) => setMeta(e.target.value)} minLength={LIMITES_DA_TURMA.metaMin} maxLength={LIMITES_DA_TURMA.meta} required />
      </label>
      <p className="es-miudo">{t.editar.aviso}</p>
      <div className="es-acoes">
        <Botao type="submit" variante="primario" tamanho="m" disabled={ocupado}>{t.editar.salvar}</Botao>
        <Botao variante="fantasma" tamanho="m" onClick={aoFechar}>{t.editar.cancelar}</Botao>
      </div>
    </form>
  );
}

/** Entrar com o código (ou com o endereço colado). Se a página abriu com ?codigo=…, o campo já vem preenchido: entra só com o clique. */
function Entrar({ t, aoEntrar, cheio }: { t: T; aoEntrar: (x: Turma) => void; cheio: boolean }) {
  const id = useId();
  const [codigo, setCodigo] = useState(() => {
    if (typeof window === "undefined") return "";
    return codigoDoTexto(window.location.search);
  });
  const [ocupado, setOcupado] = useState(false);
  const [nota, setNota] = useState<{ texto: string; erro?: boolean } | null>(null);
  async function enviar(e: FormEvent) {
    e.preventDefault();
    const c = codigoDoTexto(codigo);
    if (!c) {
      setNota({ texto: t.erros.nao_encontrado, erro: true });
      return;
    }
    setOcupado(true);
    setNota(null);
    try {
      aoEntrar(await turmas.entrar(c));
      setCodigo("");
    } catch (erro) {
      setNota({ texto: textoDoErro(t.erros, erro), erro: true });
    } finally {
      setOcupado(false);
    }
  }
  return (
    <form className="es-cartao es-entrar" aria-labelledby={`${id}-t`} onSubmit={enviar}>
      <h2 id={`${id}-t`} className="es-cartao-titulo al-cond">{t.entrar.titulo}</h2>
      <p className="es-texto">{t.entrar.texto}</p>
      <label className="es-campo" htmlFor={`${id}-c`}>
        <span>{t.entrar.campo}</span>
        <input id={`${id}-c`} value={codigo} onChange={(e) => setCodigo(e.target.value)} autoComplete="off" spellCheck={false} placeholder="ab12cd34ef" required />
      </label>
      <Nota nota={nota} />
      <Botao type="submit" variante="claro" tamanho="m" disabled={ocupado || cheio}>{t.entrar.botao}</Botao>
      {cheio && <p className="es-miudo">{t.erros.limite_de_turmas}</p>}
    </form>
  );
}

function Comecar({ t, aoCriar, cheio }: { t: T; aoCriar: (x: Turma) => void; cheio: boolean }) {
  const id = useId();
  const [nome, setNome] = useState("");
  const [meta, setMeta] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [nota, setNota] = useState<{ texto: string; erro?: boolean } | null>(null);
  async function enviar(e: FormEvent) {
    e.preventDefault();
    setOcupado(true);
    setNota(null);
    try {
      aoCriar(await turmas.criar(nome, meta));
      setNome("");
      setMeta("");
    } catch (erro) {
      setNota({ texto: textoDoErro(t.erros, erro), erro: true });
    } finally {
      setOcupado(false);
    }
  }
  return (
    <form className="es-cartao es-comecar" aria-labelledby={`${id}-t`} onSubmit={enviar}>
      <h2 id={`${id}-t`} className="es-cartao-titulo al-cond">{t.comecar.titulo}</h2>
      <p className="es-texto">{t.comecar.texto}</p>
      <label className="es-campo" htmlFor={`${id}-n`}>
        <span>{t.campos.nome}</span>
        <input id={`${id}-n`} value={nome} onChange={(e) => setNome(e.target.value)} minLength={LIMITES_DA_TURMA.nomeMin} maxLength={LIMITES_DA_TURMA.nome} required placeholder={t.campos.nomeExemplo} />
      </label>
      <label className="es-campo" htmlFor={`${id}-m`}>
        <span>{t.campos.meta}</span>
        <input id={`${id}-m`} value={meta} onChange={(e) => setMeta(e.target.value)} minLength={LIMITES_DA_TURMA.metaMin} maxLength={LIMITES_DA_TURMA.meta} required list={`${id}-sugestoes`} placeholder={COMBINADOS_DE_EXEMPLO[0]} />
        <datalist id={`${id}-sugestoes`}>
          {COMBINADOS_DE_EXEMPLO.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </label>
      <Nota nota={nota} />
      <Botao type="submit" variante="primario" tamanho="m" disabled={ocupado || cheio}>{t.comecar.botao}</Botao>
    </form>
  );
}

/** A regra aberta: o que a turma vê e o que ninguém vê. */
function ComoConta({ t }: { t: T }) {
  return (
    <section className="es-cartao es-regra" aria-label={t.regra.titulo}>
      <h2 className="es-cartao-titulo al-cond">{t.regra.titulo}</h2>
      <ul className="es-itens" role="list">
        {t.regra.itens.map((item, i) => (
          <li key={i}>
            <span className="es-item-ladrilho" data-cor={["v", "d", "1", "2", "4"][i % 5]} aria-hidden />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
