// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// O pouso solidário (Prompt 4, item 98) e a ficha de filiação cifrada (99), os dois sempre com uma organização com selo e os dois à
// espera da revisão jurídica (a flag fica desligada até lá). No pouso, ninguém vê a oferta ou o pedido de outra pessoa: só a gestão
// da organização, para combinar por mensagem. Na filiação, a ficha é cifrada AQUI para a chave de segurança de quem gere
// (lib/rede/coletiva/filiacao.ts); o banco não guarda quem mandou e não lê nada; o recibo fica só com a pessoa.
import { useId, useState } from "react";
import { confirmar } from "@/components/perguntar";
import { getClient } from "@/lib/backend";
import { acaoColetiva, type FiliacaoOrgs, type Pouso, type Pousos } from "@/lib/rede/coletiva/cliente";
import { abrirFiliacao, CAMPOS_DA_FICHA, fichaLimpa, fichasEmCsv, MAXIMO_DO_CAMPO, prepararFiliacao, type Ficha } from "@/lib/rede/coletiva/filiacao";
import { lerChaveDeSeguranca } from "@/lib/rede/seguranca-pessoal/guarda";
import { Botao } from "../ui/Botao";
import { useCarga } from "../memoria/usar";
import { com, dataCurta, fraseDoErro, type TextosDaColetiva } from "./textos";

type Props = { t: TextosDaColetiva; lang: string };
type Msg = { texto: string; erro: boolean } | null;

const hojeEmBrasilia = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());

export function AbaPouso({ t, lang }: Props) {
  return (
    <div className="ac-bloco">
      <PousoSolidario t={t} lang={lang} />
      <Filiacao t={t} lang={lang} />
    </div>
  );
}

// ───── 98 · Pouso solidário ─────
function PousoSolidario({ t, lang }: Props) {
  const { dado, erro, trocar } = useCarga<Pousos>("pouso", () => acaoColetiva.pouso());
  const [msg, setMsg] = useState<Msg>(null);
  const id = useId();
  const fazer = async (f: () => Promise<Pousos>) => {
    try {
      trocar(await f());
      setMsg(null);
      return true;
    } catch (x) {
      setMsg({ texto: fraseDoErro(t, x), erro: true });
      return false;
    }
  };
  const hoje = hojeEmBrasilia();
  const linha = (p: Pouso) => `${p.cidade} · ${t.pouso.pessoas}: ${p.pessoas} · ${dataCurta(lang, p.de)} – ${dataCurta(lang, p.ate)}`;
  return (
    <section className="ac-bloco" aria-labelledby={`${id}-t`} data-item="98">
      <h2 id={`${id}-t`} className="ac-subtitulo">{t.pouso.titulo}</h2>
      <p className="ac-miudo">{t.pouso.sobre}</p>
      <p className="ac-miudo">{t.pouso.juridico}</p>
      {msg && <p className={msg.erro ? "ac-erro" : "ac-ok"} role={msg.erro ? "alert" : "status"}>{msg.texto}</p>}
      {erro ? <p className="ac-erro" role="alert">{fraseDoErro(t, erro)}</p> : null}
      {dado && (
        <>
          <h3 className="ac-subtitulo">{t.pouso.orgs}</h3>
          {!dado.orgs.length ? <p className="ac-miudo">{t.pouso.semOrgs}</p> : (
            <ul className="ac-lista">
              {dado.orgs.map((o) => (
                <li key={o.handle} className="ac-cartao">
                  <h4>{o.nome} (@{o.handle})</h4>
                  {o.sobre && <p>{o.sobre}</p>}
                  <form className="ac-form" onSubmit={async (e) => {
                    e.preventDefault();
                    const form = e.currentTarget;
                    const f = new FormData(form);
                    const ok = await fazer(() => acaoColetiva.porPouso({ org: o.handle, tipo: f.get("tipo") === "pedido" ? "pedido" : "oferta", cidade: String(f.get("cidade")), pessoas: Number(f.get("pessoas")), de: String(f.get("de")), ate: String(f.get("ate")), observacao: String(f.get("observacao")) }));
                    if (ok) form.reset();
                  }}>
                    <fieldset>
                      <legend>{t.pouso.titulo}</legend>
                      <label className="ac-opcao"><input type="radio" name="tipo" value="oferta" defaultChecked />{t.pouso.oferecer}</label>
                      <label className="ac-opcao"><input type="radio" name="tipo" value="pedido" />{t.pouso.pedir}</label>
                    </fieldset>
                    <label>{t.comum.cidade}<input type="text" name="cidade" required minLength={2} maxLength={80} /></label>
                    <label>{t.pouso.pessoas}<input type="number" name="pessoas" min={1} max={20} defaultValue={1} required /></label>
                    <label>{t.pouso.de}<input type="date" name="de" min={hoje} defaultValue={hoje} required /></label>
                    <label>{t.pouso.ate}<input type="date" name="ate" min={hoje} defaultValue={hoje} required /></label>
                    <label>{t.pouso.observacao}<textarea name="observacao" maxLength={300} /></label>
                    <div className="ac-acoes"><Botao type="submit">{t.comum.salvar}</Botao></div>
                  </form>
                </li>
              ))}
            </ul>
          )}
          {dado.meus.length > 0 && (
            <>
              <h3 className="ac-subtitulo">{t.pouso.meus}</h3>
              <ul className="ac-lista">
                {dado.meus.map((p) => (
                  <li key={p.id} className="ac-cartao">
                    <p className="ac-etiqueta">{p.tipo === "oferta" ? t.pouso.oferta : t.pouso.pedido} · @{p.org.handle}{p.estado === "combinado" ? ` · ${t.pouso.combinado}` : ""}</p>
                    <p>{linha(p)}</p>
                    {p.observacao && <p className="ac-miudo">{p.observacao}</p>}
                    <div className="ac-acoes"><Botao variante="fantasma" onClick={() => fazer(() => acaoColetiva.mudarPouso(p.id, "tirar"))}>{t.comum.tirar}</Botao></div>
                  </li>
                ))}
              </ul>
            </>
          )}
          {dado.gestao.map((g) => (
            <section key={g.handle} className="ac-bloco" aria-label={`${t.pouso.gestao} · @${g.handle}`}>
              <h3 className="ac-subtitulo">{t.pouso.gestao} · @{g.handle}</h3>
              <div className="ac-acoes">
                <Botao variante="contorno" onClick={() => fazer(() => acaoColetiva.abrirPouso(g.handle, !dado.orgs.some((o) => o.handle === g.handle), ""))}>
                  {dado.orgs.some((o) => o.handle === g.handle) ? t.pouso.fecharPouso : t.pouso.abrirPouso}
                </Botao>
              </div>
              <ul className="ac-lista">
                {[...g.ofertas, ...g.pedidos].map((p) => (
                  <li key={p.id} className="ac-cartao">
                    <p className="ac-etiqueta">{p.tipo === "oferta" ? t.pouso.oferta : t.pouso.pedido}{p.estado === "combinado" ? ` · ${t.pouso.combinado}` : ""}</p>
                    <p>{linha(p)}</p>
                    {p.observacao && <p className="ac-miudo">{p.observacao}</p>}
                    {p.handle && <p className="ac-miudo">{p.codinome} · <a className="ac-link" href={`/${lang}/alumia/u/${encodeURIComponent(p.handle)}`}>@{p.handle}</a></p>}
                    {p.estado !== "combinado" && <div className="ac-acoes"><Botao variante="contorno" onClick={() => fazer(() => acaoColetiva.mudarPouso(p.id, "combinado"))}>{t.pouso.marcarCombinado}</Botao></div>}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </>
      )}
    </section>
  );
}

// ───── 99 · Ficha de filiação cifrada ─────
function baixarTexto(nome: string, texto: string, tipo: string) {
  const url = URL.createObjectURL(new Blob([texto], { type: tipo }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function Filiacao({ t }: Props) {
  const { dado, erro, trocar, recarregar } = useCarga<FiliacaoOrgs>("filiacao", () => acaoColetiva.filiacaoOrgs());
  const [msg, setMsg] = useState<Msg>(null);
  const [recibo, setRecibo] = useState<{ codigo: string; recibo: string } | null>(null);
  const [baixadas, setBaixadas] = useState<string[]>([]);
  const id = useId();
  const falhou = (x: unknown) => setMsg({ texto: fraseDoErro(t, x), erro: true });

  async function mandar(handle: string, form: HTMLFormElement) {
    const entrada = Object.fromEntries(CAMPOS_DA_FICHA.map((c) => [c, String(new FormData(form).get(c) ?? "")]));
    const ficha = fichaLimpa(entrada);
    if (!ficha) return setMsg({ texto: t.erros.invalido, erro: true });
    try {
      const destinos = await acaoColetiva.destinosDaFiliacao(handle);
      const pronta = await prepararFiliacao(handle, destinos, ficha);
      await acaoColetiva.enviarFiliacao(pronta.pedido);
      form.reset();
      setRecibo({ codigo: pronta.pedido.id, recibo: pronta.recibo });
      setMsg(null);
    } catch (x) {
      falhou(x);
    }
  }

  async function lerFichas(handle: string) {
    try {
      const { data } = await (await getClient()).auth.getUser();
      const conta = data.user?.id;
      const par = conta ? await lerChaveDeSeguranca(conta) : null;
      if (!conta || !par) return setMsg({ texto: t.filiacao.semChave, erro: true });
      const fichas = await acaoColetiva.fichas(handle);
      const abertas: { id: string; dia: string; ficha: Ficha }[] = [];
      for (const f of fichas) {
        const ficha = await abrirFiliacao(f.id, conta, par.privada, f.embrulho, f.cifra);
        if (ficha) abertas.push({ id: f.id, dia: f.dia, ficha });
      }
      par.privada.fill(0);
      baixarTexto(`filiacoes-${handle}-${new Date().toISOString().slice(0, 10)}.csv`, fichasEmCsv(abertas), "text/csv;charset=utf-8");
      setBaixadas(abertas.map((a) => a.id));
      setMsg(null);
    } catch (x) {
      falhou(x);
    }
  }

  async function apagarBaixadas() {
    if (!(await confirmar(`${t.comum.apagar}?`, { sim: t.comum.sim, nao: t.comum.nao }))) return;
    try {
      for (const f of baixadas) await acaoColetiva.apagarFicha(f);
      setBaixadas([]);
      recarregar();
    } catch (x) {
      falhou(x);
    }
  }

  return (
    <section className="ac-bloco" aria-labelledby={`${id}-t`} data-item="99">
      <h2 id={`${id}-t`} className="ac-subtitulo">{t.filiacao.titulo}</h2>
      <p className="ac-miudo">{t.filiacao.sobre}</p>
      <p className="ac-miudo">{t.filiacao.juridico}</p>
      {msg && <p className={msg.erro ? "ac-erro" : "ac-ok"} role={msg.erro ? "alert" : "status"}>{msg.texto}</p>}
      {erro ? <p className="ac-erro" role="alert">{fraseDoErro(t, erro)}</p> : null}
      {recibo && (
        <div className="ac-cartao" role="status">
          <p><strong>{t.filiacao.codigo}:</strong> <code>{recibo.codigo}</code></p>
          <p><strong>{t.filiacao.recibo}:</strong> <code>{recibo.recibo}</code></p>
          <div className="ac-acoes"><Botao variante="contorno" onClick={() => baixarTexto("recibo-da-filiacao.txt", `${recibo.codigo}\n${recibo.recibo}\n`, "text/plain;charset=utf-8")}>{t.comum.baixar}</Botao></div>
        </div>
      )}
      {dado && (
        <>
          <h3 className="ac-subtitulo">{t.filiacao.orgs}</h3>
          {!dado.orgs.length ? <p className="ac-miudo">{t.filiacao.semOrgs}</p> : (
            <ul className="ac-lista">
              {dado.orgs.map((o) => (
                <li key={o.handle} className="ac-cartao">
                  <h4>{o.nome} (@{o.handle})</h4>
                  {o.sobre && <p>{o.sobre}</p>}
                  <form className="ac-form" aria-label={`${t.filiacao.titulo} · @${o.handle}`} onSubmit={(e) => { e.preventDefault(); void mandar(o.handle, e.currentTarget); }}>
                    {CAMPOS_DA_FICHA.map((c) => (
                      <label key={c}>{t.filiacao.campos[c]}{c === "nome" ? "" : ` ${t.comum.opcional}`}
                        {c === "observacao" ? <textarea name={c} maxLength={MAXIMO_DO_CAMPO[c]} />
                          : <input type={c === "nascimento" ? "date" : "text"} name={c} maxLength={MAXIMO_DO_CAMPO[c]} required={c === "nome"} autoComplete="off" />}
                      </label>
                    ))}
                    <div className="ac-acoes"><Botao type="submit">{t.filiacao.mandar}</Botao></div>
                  </form>
                </li>
              ))}
            </ul>
          )}
          <form className="ac-form" aria-label={t.filiacao.desfazer} onSubmit={async (e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const f = new FormData(form);
            try {
              await acaoColetiva.cancelarFiliacao(String(f.get("codigo")).trim(), String(f.get("recibo")).trim());
              form.reset();
              setMsg({ texto: t.filiacao.desfazer + " ✓", erro: false });
            } catch (x) {
              falhou(x);
            }
          }}>
            <h4>{t.filiacao.desfazer}</h4>
            <label>{t.filiacao.codigo}<input type="text" name="codigo" required autoComplete="off" spellCheck={false} /></label>
            <label>{t.filiacao.recibo}<input type="text" name="recibo" required autoComplete="off" spellCheck={false} /></label>
            <div className="ac-acoes"><Botao type="submit" variante="contorno">{t.filiacao.desfazer}</Botao></div>
          </form>
          {dado.gestao.map((g) => (
            <section key={g.handle} className="ac-cartao" aria-label={`${t.filiacao.gestao} · @${g.handle}`}>
              <h3>{t.filiacao.gestao} · @{g.handle}</h3>
              <p className="ac-miudo">{t.filiacao.chaveAviso}</p>
              {!g.minha_chave && <p className="ac-miudo">{t.filiacao.semChave}</p>}
              <p className="ac-miudo">{com(t.filiacao.fichas, { n: g.fichas })}</p>
              <div className="ac-acoes">
                {g.selo && <Botao variante="contorno" onClick={async () => { try { trocar(await acaoColetiva.abrirFiliacao(g.handle, !g.aberta, "")); } catch (x) { falhou(x); } }}>{g.aberta ? t.filiacao.fecharFiliacao : t.filiacao.abrirFiliacao}</Botao>}
                {g.minha_chave && g.fichas > 0 && <Botao onClick={() => lerFichas(g.handle)}>{t.filiacao.lerFichas}</Botao>}
                {baixadas.length > 0 && <Botao variante="fantasma" onClick={apagarBaixadas}>{t.comum.apagar}</Botao>}
              </div>
            </section>
          ))}
        </>
      )}
    </section>
  );
}
