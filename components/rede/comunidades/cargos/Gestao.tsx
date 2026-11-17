// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// As ferramentas de quem cuida da chegada, cada uma atrás da permissão que a libera (o banco confere de novo em cada chamada):
//   · cargos (só a moderação): criar, trocar, apagar, convidar pelo @nome, tirar;
//   · boas_vindas: o texto e os interesses;
//   · regras: as regras e o "ler antes de postar";
//   · etiquetas: a lista fechada de etiquetas de pessoa, oferecer e tirar;
//   · fixar: o prazo de cada fixado;
//   · pedidos (para quem tem o cargo; a moderação já tem na aba Sobre): os pedidos de entrada e as perguntas.
import { useId, useRef, useState, type FormEvent } from "react";
import type { TextosDaRede } from "@/lib/rede/textos";
import { Confirmar } from "../../conversa/base3";
import { useTextosMod } from "../../moderacao/base";
import { PedidosEPerguntas } from "../../moderacao/comunidade/PedidosEPerguntas";
import { FichasDePermissao } from "./AbaChegada";
import { cargos } from "./cliente";
import { diasAte, fimDoPrazo, LIMITES, limparHandle, pode, PERMISSOES, PRAZOS_DO_FIXADO, type Cargo, type PainelDosCargos, type Permissao, type QuemDa } from "./regras";
import { por, type TextosDosCargos } from "./textos";

interface Props {
  t: TextosDosCargos;
  d: PainelDosCargos;
  slug: string;
  lang: string;
  s: TextosDaRede;
  aoErro: (e: unknown) => void;
  aoOk: (texto: string) => void;
  aoMudar: () => void;
}

/** Roda uma tarefa com o "ocupado" e os avisos de certo ou errado. */
function useRodar({ aoErro, aoOk, aoMudar }: Pick<Props, "aoErro" | "aoOk" | "aoMudar">) {
  const [ocupado, setOcupado] = useState(false);
  async function rodar(tarefa: () => Promise<unknown>, ok: string): Promise<boolean> {
    if (ocupado) return false;
    setOcupado(true);
    try {
      await tarefa();
      aoOk(ok);
      aoMudar();
      return true;
    } catch (e) {
      aoErro(e);
      return false;
    } finally {
      setOcupado(false);
    }
  }
  return { ocupado, rodar };
}

export default function Gestao(props: Props) {
  const { t, d } = props;
  return (
    <section className="cg-gestao" aria-labelledby="cg-gestao-titulo">
      <div className="cg-gestao-cabeca">
        <h2 id="cg-gestao-titulo" className="cg-titulo al-cond">{t.gestao.titulo}</h2>
        <p className="cg-lead">{t.gestao.dica}</p>
      </div>
      <div className="cg-gestao-grade">
        {d.modero && <EditorDeCargos {...props} />}
        {pode(d, "boas_vindas") && <EditorDeBoasVindas {...props} />}
        {pode(d, "regras") && <EditorDeRegras {...props} />}
        {pode(d, "etiquetas") && <EditorDeEtiquetas {...props} />}
        {pode(d, "fixar") && <PrazoDosFixados {...props} />}
        {pode(d, "pedidos") && !d.modero && <Pedidos {...props} />}
      </div>
    </section>
  );
}

/** Cada parte da gestão vem recolhida, com o título como resumo: a aba não vira uma parede de formulários abertos. */
function Bloco({ titulo, n, children, largo }: { titulo: string; n?: string; children: React.ReactNode; largo?: boolean }) {
  const id = useId();
  return (
    <details className={`cg-bloco cg-recolhe${largo ? " cg-largo" : ""}`}>
      <summary className="cg-bloco-resumo">
        <h3 id={id} className="cg-bloco-titulo al-cond">
          {n && <span className="cg-bloco-n" aria-hidden>{n}</span>}
          {titulo}
        </h3>
      </summary>
      <div className="cg-bloco-corpo">{children}</div>
    </details>
  );
}

// ── Cargos ────────────────────────────────────────────────────────────────────────────────────────────────────────────────

function EditorDeCargos(props: Props) {
  const { t, d } = props;
  const [editando, setEditando] = useState<string | "novo" | null>(null);
  return (
    <Bloco titulo={t.cargos.titulo} n="C" largo>
      <ul className="cg-cargos-edit">
        {d.cargos.map((k) => (
          <li key={k.id} className="cg-cargo-edit">
            {editando === k.id ? (
              <FormularioDeCargo {...props} cargo={k} aoFechar={() => setEditando(null)} />
            ) : (
              <div className="cg-cargo-linha">
                <div>
                  <p className="cg-cartao-nome al-cond">{k.nome}</p>
                  <FichasDePermissao t={t} permissoes={k.permissoes} />
                </div>
                <button type="button" className="al-botao al-botao-contorno al-botao-p" onClick={() => setEditando(k.id)}>{t.gestao.editar}</button>
              </div>
            )}
            <PessoasDoCargo {...props} cargo={k} />
          </li>
        ))}
      </ul>
      {editando === "novo" ? (
        <FormularioDeCargo {...props} cargo={null} aoFechar={() => setEditando(null)} />
      ) : d.cargos.length < LIMITES.cargos ? (
        <button type="button" className="al-botao al-botao-primario al-botao-m cg-novo" onClick={() => setEditando("novo")}>{t.gestao.novoCargo}</button>
      ) : (
        <p className="cg-nota">{por(t.gestao.limiteCargos, { n: LIMITES.cargos })}</p>
      )}
    </Bloco>
  );
}

function FormularioDeCargo({ t, slug, cargo, aoFechar, ...resto }: Props & { cargo: Cargo | null; aoFechar: () => void }) {
  const [nome, setNome] = useState(cargo?.nome ?? "");
  const [descricao, setDescricao] = useState(cargo?.descricao ?? "");
  const [marcadas, setMarcadas] = useState<Permissao[]>(cargo?.permissoes ?? []);
  const [apagando, setApagando] = useState(false);
  const apagarRef = useRef<HTMLButtonElement>(null);
  const { ocupado, rodar } = useRodar(resto);
  const id = useId();
  async function salvar(e: FormEvent) {
    e.preventDefault();
    if (await rodar(() => cargos.salvarCargo(slug, cargo?.id ?? null, { nome: nome.trim(), descricao: descricao.trim(), permissoes: marcadas }), t.gestao.salvo)) aoFechar();
  }
  return (
    <form className="cg-form" onSubmit={(e) => void salvar(e)}>
      <label className="cg-campo">
        {t.gestao.nome}
        <input value={nome} onChange={(e) => setNome(e.target.value)} minLength={LIMITES.cargoNomeMin} maxLength={LIMITES.cargoNome} required placeholder={t.gestao.nomeExemplo} />
      </label>
      <label className="cg-campo">
        {t.gestao.descricao}
        <textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} maxLength={LIMITES.cargoDescricao} rows={2} placeholder={t.gestao.descricaoExemplo} />
      </label>
      <fieldset className="cg-permissoes">
        <legend>{t.gestao.permissoesTitulo}</legend>
        {PERMISSOES.map((p) => (
          <label key={p} className="cg-permissao">
            <input type="checkbox" checked={marcadas.includes(p)} onChange={(e) => setMarcadas((m) => (e.target.checked ? [...m, p] : m.filter((x) => x !== p)))} aria-describedby={`${id}-${p}`} />
            <span>
              <strong>{t.permissoes[p].nome}</strong>
              <span id={`${id}-${p}`}>{t.permissoes[p].texto}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <div className="cg-acoes">
        <button type="submit" className="al-botao al-botao-primario al-botao-m" aria-disabled={ocupado ? "true" : undefined}>{ocupado ? t.gestao.salvando : t.gestao.salvar}</button>
        <button type="button" className="al-botao al-botao-contorno al-botao-m" onClick={aoFechar}>{t.gestao.cancelar}</button>
        {cargo && <button ref={apagarRef} type="button" className="al-botao al-botao-fantasma al-botao-m cg-perigo" onClick={() => setApagando(true)}>{t.gestao.apagar}</button>}
      </div>
      {cargo && (
        <Confirmar
          aberto={apagando}
          titulo={t.gestao.apagar}
          texto={por(t.gestao.apagarPergunta, { nome: cargo.nome })}
          sim={t.gestao.apagar}
          nao={t.gestao.cancelar}
          aoSim={() => void rodar(() => cargos.apagarCargo(slug, cargo.id), t.gestao.apagado).then((ok) => ok && aoFechar())}
          aoFechar={() => setApagando(false)}
          voltarPara={apagarRef}
        />
      )}
    </form>
  );
}

function PessoasDoCargo({ t, d, slug, cargo, ...resto }: Props & { cargo: Cargo }) {
  const [handle, setHandle] = useState("");
  const { ocupado, rodar } = useRodar(resto);
  const pessoas = (d.gestao.pessoas ?? []).filter((x) => x.cargo === cargo.id);
  async function convidar(e: FormEvent) {
    e.preventDefault();
    const h = limparHandle(handle);
    if (!h) return;
    if (await rodar(() => cargos.convidar(slug, cargo.id, h), t.gestao.convidou)) setHandle("");
  }
  return (
    <div className="cg-pessoas">
      <p className="cg-pessoas-titulo">{t.gestao.quemTem}</p>
      {pessoas.length === 0 ? (
        <p className="cg-nota">{t.gestao.ninguem}</p>
      ) : (
        <ul className="cg-pessoas-lista">
          {pessoas.map((x) => (
            <li key={x.usuario}>
              <span className="cg-pessoa-nome">{x.codinome}</span>
              {x.handle && <span className="cg-pessoa-handle">@{x.handle}</span>}
              <span className="cg-pessoa-situacao" data-situacao={x.situacao}>{x.situacao === "ativo" ? t.gestao.ativo : t.gestao.convidado}</span>
              <button type="button" className="al-botao al-botao-fantasma al-botao-p" disabled={ocupado} onClick={() => void rodar(() => cargos.tirar(slug, cargo.id, x.usuario), t.gestao.tirouPessoa)}>
                {t.gestao.tirar}
              </button>
            </li>
          ))}
        </ul>
      )}
      <form className="cg-linha" onSubmit={(e) => void convidar(e)}>
        <label className="cg-campo">
          {t.gestao.convidar}
          <input value={handle} onChange={(e) => setHandle(e.target.value)} placeholder={t.gestao.convidarExemplo} autoComplete="off" spellCheck={false} />
        </label>
        <button type="submit" className="al-botao al-botao-contorno al-botao-m" aria-disabled={ocupado ? "true" : undefined}>{t.gestao.convidarBotao}</button>
      </form>
    </div>
  );
}

// ── Boas-vindas e interesses ──────────────────────────────────────────────────────────────────────────────────────────────

function EditorDeBoasVindas({ t, d, slug, ...resto }: Props) {
  const [texto, setTexto] = useState(d.chegada.boas_vindas);
  const [lista, setLista] = useState(d.chegada.interesses.map((i) => ({ nome: i.nome, texto: i.texto })));
  const { ocupado, rodar } = useRodar(resto);
  async function salvar(e: FormEvent) {
    e.preventDefault();
    await rodar(() => cargos.salvarChegada(slug, { boas_vindas: texto.trim(), interesses: lista.filter((i) => i.nome.trim()).map((i) => ({ nome: i.nome.trim(), texto: i.texto.trim() })) }), t.gestao.salvo);
  }
  const trocar = (n: number, campo: "nome" | "texto", valor: string) => setLista((l) => l.map((x, i) => (i === n ? { ...x, [campo]: valor } : x)));
  return (
    <Bloco titulo={t.gestao.boasTitulo} n="B">
      <form className="cg-form" onSubmit={(e) => void salvar(e)}>
        <label className="cg-campo">
          {t.gestao.boasCampo}
          <textarea value={texto} onChange={(e) => setTexto(e.target.value)} maxLength={LIMITES.boasVindas} rows={4} placeholder={t.gestao.boasExemplo} />
        </label>
        <fieldset className="cg-lista-edit">
          <legend>{por(t.gestao.interessesTitulo, { n: LIMITES.interesses })}</legend>
          {lista.map((i, n) => (
            <div key={n} className="cg-item-edit">
              <label className="cg-campo">
                {t.gestao.interesseNome}
                <input value={i.nome} onChange={(e) => trocar(n, "nome", e.target.value)} maxLength={LIMITES.interesseNome} placeholder={t.gestao.interesseNomeExemplo} />
              </label>
              <label className="cg-campo">
                {t.gestao.interesseTexto}
                <input value={i.texto} onChange={(e) => trocar(n, "texto", e.target.value)} maxLength={LIMITES.interesseTexto} placeholder={t.gestao.interesseTextoExemplo} />
              </label>
              <button type="button" className="al-botao al-botao-fantasma al-botao-p cg-tirar" aria-label={`${t.gestao.tirar}: ${i.nome}`} onClick={() => setLista((l) => l.filter((_, k) => k !== n))}>{t.gestao.tirar}</button>
            </div>
          ))}
          {lista.length < LIMITES.interesses && (
            <button type="button" className="al-botao al-botao-contorno al-botao-p" onClick={() => setLista((l) => [...l, { nome: "", texto: "" }])}>{t.gestao.novoInteresse}</button>
          )}
        </fieldset>
        <div className="cg-acoes">
          <button type="submit" className="al-botao al-botao-primario al-botao-m" aria-disabled={ocupado ? "true" : undefined}>{ocupado ? t.gestao.salvando : t.gestao.salvar}</button>
        </div>
      </form>
    </Bloco>
  );
}

// ── Regras ────────────────────────────────────────────────────────────────────────────────────────────────────────────────

function EditorDeRegras({ t, d, slug, ...resto }: Props) {
  const [antes, setAntes] = useState(d.chegada.regras_antes);
  const [regras, setRegras] = useState(d.regras.map((r) => ({ titulo: r.titulo, texto: r.texto })));
  const { ocupado, rodar } = useRodar(resto);
  async function salvar(e: FormEvent) {
    e.preventDefault();
    const limpas = regras.filter((r) => r.titulo.trim()).map((r) => ({ titulo: r.titulo.trim(), texto: r.texto.trim() }));
    await rodar(async () => {
      if (limpas.length) await cargos.salvarRegras(slug, limpas);
      if (antes !== d.chegada.regras_antes) await cargos.salvarChegada(slug, { regras_antes: antes });
    }, t.gestao.salvo);
  }
  const trocar = (n: number, campo: "titulo" | "texto", valor: string) => setRegras((l) => l.map((x, i) => (i === n ? { ...x, [campo]: valor } : x)));
  return (
    <Bloco titulo={t.gestao.regrasTitulo} n="R">
      <form className="cg-form" onSubmit={(e) => void salvar(e)}>
        <label className="cg-interruptor">
          <input type="checkbox" role="switch" checked={antes} onChange={(e) => setAntes(e.target.checked)} />
          <span>
            <strong>{t.gestao.regrasAntes}</strong>
            <span>{t.gestao.regrasAntesDica}</span>
          </span>
        </label>
        <fieldset className="cg-lista-edit">
          <legend className="cg-so-leitor">{t.gestao.regrasTitulo}</legend>
          {regras.map((r, n) => (
            <div key={n} className="cg-item-edit">
              <label className="cg-campo">
                {por(t.gestao.regraTitulo, { n: n + 1 })}
                <input value={r.titulo} onChange={(e) => trocar(n, "titulo", e.target.value)} minLength={3} maxLength={80} />
              </label>
              <label className="cg-campo">
                {t.gestao.regraTexto}
                <input value={r.texto} onChange={(e) => trocar(n, "texto", e.target.value)} maxLength={500} />
              </label>
              {regras.length > 1 && (
                <button type="button" className="al-botao al-botao-fantasma al-botao-p cg-tirar" aria-label={`${t.gestao.tirar}: ${r.titulo}`} onClick={() => setRegras((l) => l.filter((_, k) => k !== n))}>{t.gestao.tirar}</button>
              )}
            </div>
          ))}
          {regras.length < 20 && (
            <button type="button" className="al-botao al-botao-contorno al-botao-p" onClick={() => setRegras((l) => [...l, { titulo: "", texto: "" }])}>{t.gestao.novaRegra}</button>
          )}
        </fieldset>
        <div className="cg-acoes">
          <button type="submit" className="al-botao al-botao-primario al-botao-m" aria-disabled={ocupado ? "true" : undefined}>{ocupado ? t.gestao.salvando : t.gestao.salvar}</button>
        </div>
      </form>
    </Bloco>
  );
}

// ── Etiquetas de pessoa ───────────────────────────────────────────────────────────────────────────────────────────────────

function EditorDeEtiquetas({ t, d, slug, ...resto }: Props) {
  const [lista, setLista] = useState(d.etiquetas.map((e) => ({ id: e.id as string | undefined, nome: e.nome, quem_da: e.quem_da })));
  const [oferecer, setOferecer] = useState({ etiqueta: d.etiquetas.find((e) => e.quem_da === "moderacao")?.id ?? "", handle: "" });
  const [tirar, setTirar] = useState("");
  const { ocupado, rodar } = useRodar(resto);
  const daModeracao = d.etiquetas.filter((e) => e.quem_da === "moderacao");
  async function salvar(e: FormEvent) {
    e.preventDefault();
    await rodar(() => cargos.salvarEtiquetas(slug, lista.filter((x) => x.nome.trim()).map((x) => ({ ...(x.id ? { id: x.id } : {}), nome: x.nome.trim(), quem_da: x.quem_da }))), t.gestao.salvo);
  }
  const trocar = (n: number, mudanca: Partial<{ nome: string; quem_da: QuemDa }>) => setLista((l) => l.map((x, i) => (i === n ? { ...x, ...mudanca } : x)));
  return (
    <Bloco titulo={por(t.gestao.etiquetasTitulo, { n: LIMITES.etiquetas })} n="E">
      <form className="cg-form" onSubmit={(e) => void salvar(e)}>
        <fieldset className="cg-lista-edit">
          <legend className="cg-so-leitor">{por(t.gestao.etiquetasTitulo, { n: LIMITES.etiquetas })}</legend>
          {lista.map((x, n) => (
            <div key={x.id ?? `nova-${n}`} className="cg-item-edit">
              <label className="cg-campo">
                {t.gestao.etiquetaNome}
                <input value={x.nome} onChange={(e) => trocar(n, { nome: e.target.value })} maxLength={LIMITES.etiqueta} placeholder={t.gestao.etiquetaNomeExemplo} />
              </label>
              <label className="cg-campo">
                {t.gestao.quemDa}
                <select value={x.quem_da} onChange={(e) => trocar(n, { quem_da: e.target.value as QuemDa })}>
                  <option value="pessoa">{t.gestao.quemDaPessoa}</option>
                  <option value="moderacao">{t.gestao.quemDaModeracao}</option>
                </select>
              </label>
              <button type="button" className="al-botao al-botao-fantasma al-botao-p cg-tirar" aria-label={`${t.gestao.tirar}: ${x.nome}`} onClick={() => setLista((l) => l.filter((_, k) => k !== n))}>{t.gestao.tirar}</button>
            </div>
          ))}
          {lista.length < LIMITES.etiquetas && (
            <button type="button" className="al-botao al-botao-contorno al-botao-p" onClick={() => setLista((l) => [...l, { id: undefined, nome: "", quem_da: "pessoa" }])}>{t.gestao.novaEtiqueta}</button>
          )}
        </fieldset>
        <div className="cg-acoes">
          <button type="submit" className="al-botao al-botao-primario al-botao-m" aria-disabled={ocupado ? "true" : undefined}>{ocupado ? t.gestao.salvando : t.gestao.salvar}</button>
        </div>
      </form>
      <div className="cg-depois">
        <p className="cg-pessoas-titulo">{t.gestao.oferecerTitulo}</p>
        <p className="cg-nota">{t.gestao.oferecerDica}</p>
        {daModeracao.length === 0 ? (
          <p className="cg-vazio">{t.gestao.semOferecer}</p>
        ) : (
          <form
            className="cg-linha"
            onSubmit={(e) => {
              e.preventDefault();
              const h = limparHandle(oferecer.handle);
              if (h && oferecer.etiqueta) void rodar(() => cargos.oferecerEtiqueta(slug, oferecer.etiqueta, h), t.gestao.ofereceu).then((ok) => ok && setOferecer((o) => ({ ...o, handle: "" })));
            }}
          >
            <label className="cg-campo">
              {t.gestao.etiquetaNome}
              <select value={oferecer.etiqueta} onChange={(e) => setOferecer((o) => ({ ...o, etiqueta: e.target.value }))}>
                {daModeracao.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
              </select>
            </label>
            <label className="cg-campo">
              {t.gestao.convidarExemplo}
              <input value={oferecer.handle} onChange={(e) => setOferecer((o) => ({ ...o, handle: e.target.value }))} autoComplete="off" spellCheck={false} />
            </label>
            <button type="submit" className="al-botao al-botao-contorno al-botao-m">{t.gestao.oferecer}</button>
          </form>
        )}
        <form
          className="cg-linha cg-depois-p"
          onSubmit={(e) => {
            e.preventDefault();
            const h = limparHandle(tirar);
            if (h) void rodar(() => cargos.tirarEtiqueta(slug, h), t.gestao.tirouEtiqueta).then((ok) => ok && setTirar(""));
          }}
        >
          <label className="cg-campo">
            {t.gestao.tirarEtiqueta}
            <input value={tirar} onChange={(e) => setTirar(e.target.value)} placeholder={t.gestao.convidarExemplo} autoComplete="off" spellCheck={false} />
          </label>
          <button type="submit" className="al-botao al-botao-contorno al-botao-m">{t.gestao.tirar}</button>
        </form>
      </div>
    </Bloco>
  );
}

// ── Prazo dos fixados ─────────────────────────────────────────────────────────────────────────────────────────────────────

function PrazoDosFixados({ t, d, slug, ...resto }: Props) {
  const { ocupado, rodar } = useRodar(resto);
  const fixados = d.gestao.fixados ?? [];
  return (
    <Bloco titulo={t.gestao.fixadosTitulo} n="F">
      <p className="cg-nota cg-sem-margem">{t.gestao.fixadosDica}</p>
      {fixados.length === 0 ? (
        <p className="cg-vazio cg-depois-p">{t.gestao.fixadosVazio}</p>
      ) : (
        <ul className="cg-fixados">
          {fixados.map((f) => {
            const falta = diasAte(f.ate);
            return (
              <li key={f.post} className="cg-fixado">
                <p className="cg-fixado-trecho">{f.trecho}</p>
                <p className="cg-fixado-prazo">{falta === null ? t.gestao.semPrazo : falta <= 1 ? t.gestao.saiHoje : por(t.gestao.saiEm, { n: falta })}</p>
                <fieldset className="cg-prazos" disabled={ocupado}>
                  <legend className="cg-so-leitor">{t.gestao.fixadosTitulo}</legend>
                  {PRAZOS_DO_FIXADO.map((dias) => (
                    <label key={dias ?? "sem"} className="cg-prazo">
                      <input
                        type="radio"
                        name={`cg-prazo-${f.post}`}
                        checked={dias === null ? f.ate === null : false}
                        onChange={() => void rodar(() => cargos.fixarPrazo(slug, f.post, fimDoPrazo(dias)), t.gestao.salvo)}
                      />
                      <span>{dias === null ? t.gestao.semPrazo : por(t.gestao.dias, { n: dias })}</span>
                    </label>
                  ))}
                </fieldset>
              </li>
            );
          })}
        </ul>
      )}
    </Bloco>
  );
}

// ── Pedidos (para quem tem o cargo) ───────────────────────────────────────────────────────────────────────────────────────

function Pedidos({ t, d, slug, lang, s, aoMudar }: Props) {
  const sm = useTextosMod(lang);
  return (
    <Bloco titulo={t.gestao.pedidosTitulo} n="P" largo>
      {typeof d.gestao.pedidos === "number" && d.gestao.pedidos > 0 && <p className="cg-selo al-cond">{por(t.gestao.pedidosEsperando, { n: d.gestao.pedidos })}</p>}
      {sm ? <PedidosEPerguntas slug={slug} lang={lang} s={s} sm={sm} restrita={d.tipo === "restrita"} aoMudar={aoMudar} /> : <p className="cg-nota" role="status">{t.carregando}</p>}
    </Bloco>
  );
}
