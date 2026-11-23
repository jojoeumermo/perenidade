// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// O estúdio de cartaz e lambe-lambe (item 36). O cartaz é desenhado aqui, num <canvas>, com a identidade da organização (ou as cores
// da Alumia) e baixado como PNG ou impresso. O banco só guarda a identidade (cores, fonte e assinatura), que quem gerencia grava;
// nenhuma imagem, nenhum texto do cartaz vai ao servidor nem a serviço de fora.
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { contraste, CONTRASTE_MINIMO, desenharCartaz, erroDaIdentidade, familiaDaFonte, FONTES, IDENTIDADE_DA_ALUMIA, MODELOS, nomeDoArquivo, TAMANHOS_DO_CARTAZ, type Modelo } from "@/lib/rede/criacao/cartaz";
import type { Fonte, Identidade, OrgDoEstudio } from "@/lib/rede/criacao/cliente";
import { Botao } from "../ui/Botao";
import { criacao } from "./cliente";
import { useAcao } from "./Margem";
import { por, textoDoErro, type TextosDaCriacao } from "./textos";

type T = TextosDaCriacao;

export function Cartaz({ t }: { t: T }) {
  const c = t.cartaz;
  const id = useId();
  const [orgs, setOrgs] = useState<OrgDoEstudio[] | null>(null);
  const [erro, setErro] = useState("");
  const [org, setOrg] = useState<string>("");
  const [modelo, setModelo] = useState<Modelo>("cartaz");
  const [conteudo, setConteudo] = useState({ chamada: "", titulo: "", texto: "", quando: "", onde: "", assinatura: "" });
  const [editando, setEditando] = useState<Identidade | null>(null);
  const tela = useRef<HTMLCanvasElement>(null);
  const { ocupado, fazer, avisos } = useAcao(t);

  useEffect(() => {
    let vivo = true;
    criacao.estudioOrgs().then((l) => {
      if (!vivo) return;
      setOrgs(l);
      if (l[0]) {
        setOrg(l[0].handle);
        setConteudo((x) => ({ ...x, assinatura: l[0].identidade?.assinatura || l[0].nome }));
      }
    }, (e) => vivo && setErro(textoDoErro(t.erros, e)));
    return () => {
      vivo = false;
    };
  }, [t]);

  const escolhida = orgs?.find((o) => o.handle === org) ?? null;
  const identidade: Identidade = editando ?? escolhida?.identidade ?? IDENTIDADE_DA_ALUMIA;
  // A Archivo da Alumia como a casca a resolveu (o canvas não lê variável de CSS): a letra de quem está em volta da tela.
  const [archivo, setArchivo] = useState<string | undefined>(undefined);
  useEffect(() => {
    const el = tela.current?.parentElement;
    if (el) setArchivo(getComputedStyle(el).fontFamily || undefined);
  }, [orgs]);
  const familia = useMemo(() => familiaDaFonte(identidade.fonte, archivo), [identidade.fonte, archivo]);

  // Redesenha a cada mudança (depois de a fonte carregar, para a medida bater).
  useEffect(() => {
    const el = tela.current;
    const ctx = el?.getContext("2d");
    if (!el || !ctx) return;
    const { largura, altura } = TAMANHOS_DO_CARTAZ[modelo];
    el.width = largura;
    el.height = altura;
    let vivo = true;
    const pintar = () => vivo && desenharCartaz(ctx, modelo, identidade, conteudo, familia);
    pintar();
    document.fonts?.ready.then(pintar).catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [modelo, identidade, conteudo, familia]);

  const baixar = () => {
    tela.current?.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = nomeDoArquivo(conteudo.titulo, modelo);
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, "image/png");
  };

  const r = editando ? contraste(editando.texto, editando.fundo) : 0;
  const erroDaEdicao = editando ? erroDaIdentidade(editando) : null;
  const salvar = () => fazer(async () => {
    if (!editando || !escolhida) return;
    const salvo = await criacao.salvarIdentidade(escolhida.handle, editando);
    setOrgs((l) => (l ?? []).map((o) => (o.handle === escolhida.handle ? { ...o, identidade: salvo } : o)));
    setEditando(null);
    return c.salvo;
  });

  if (erro) return <p role="alert" className="cc-erro">{erro}</p>;
  if (!orgs) return <p className="cc-nota">{t.carregando}</p>;
  const campo = (chave: keyof typeof conteudo, rotulo: string, longo = false, max = 120) => (
    <label className="cc-campo">
      <span>{rotulo}</span>
      {longo
        ? <textarea value={conteudo[chave]} onChange={(e) => setConteudo({ ...conteudo, [chave]: e.target.value })} maxLength={max} />
        : <input value={conteudo[chave]} onChange={(e) => setConteudo({ ...conteudo, [chave]: e.target.value })} maxLength={max} />}
    </label>
  );

  return (
    <section className="cc-bloco" aria-labelledby={`${id}-t`}>
      <h2 id={`${id}-t`} className="al-cond">{c.titulo}</h2>
      <p className="cc-texto">{c.texto}</p>
      <div className="cc-estudio">
        <form className="cc-form" onSubmit={(e) => e.preventDefault()}>
          <div className="cc-grade">
            <label className="cc-campo">
              <span>{c.org}</span>
              <select value={org} onChange={(e) => { setOrg(e.target.value); setEditando(null); }}>
                {orgs.map((o) => <option key={o.handle} value={o.handle}>{o.nome}</option>)}
                <option value="">{c.semOrgOpcao}</option>
              </select>
            </label>
            <label className="cc-campo">
              <span>{c.modelo}</span>
              <select value={modelo} onChange={(e) => setModelo(e.target.value as Modelo)}>
                {MODELOS.map((m) => <option key={m} value={m}>{c.modelos[m]}</option>)}
              </select>
            </label>
          </div>
          {orgs.length === 0 && <p className="cc-nota">{c.semOrg}</p>}
          {campo("chamada", c.chamada, false, 80)}
          {campo("titulo", c.tituloCampo, false, 120)}
          {modelo !== "lambe" && campo("texto", c.textoCampo, true, 600)}
          <div className="cc-grade">
            {campo("quando", c.quando, false, 80)}
            {campo("onde", c.onde, false, 80)}
          </div>
          {campo("assinatura", c.assinatura, false, 80)}
          <p className="cc-nota">{c.cuidado}</p>
          <div className="cc-acoes">
            <Botao onClick={baixar} disabled={!conteudo.titulo.trim()}>{c.baixar}</Botao>
            <Botao variante="contorno" onClick={() => window.print()} disabled={!conteudo.titulo.trim()}>{c.imprimir}</Botao>
          </div>
        </form>
        <div>
          <canvas ref={tela} className="cc-tela" data-cc-imprimir="" role="img" aria-label={por(c.previa, { titulo: conteudo.titulo || "—" })} />
        </div>
      </div>

      {escolhida?.gerencio && (
        <div className="mt-6">
          <h3>{c.identidade}</h3>
          <p className="cc-texto">{c.identidadeTexto}</p>
          {!editando ? (
            <div className="cc-acoes">
              <span className="cc-amostras" aria-hidden>
                {[identidade.fundo, identidade.destaque, identidade.texto].map((cor) => <span key={cor} className="cc-amostra" style={{ background: cor }} />)}
              </span>
              <Botao variante="contorno" onClick={() => setEditando({ ...(escolhida.identidade ?? IDENTIDADE_DA_ALUMIA), assinatura: escolhida.identidade?.assinatura ?? escolhida.nome })}>{c.salvar}</Botao>
            </div>
          ) : (
            <form className="cc-form" onSubmit={(e) => { e.preventDefault(); void salvar(); }}>
              <div className="cc-grade">
                {(["fundo", "destaque", "texto"] as const).map((k) => (
                  <label key={k} className="cc-campo">
                    <span>{k === "texto" ? c.corTexto : c[k]}</span>
                    <input type="color" value={editando[k]} onChange={(e) => setEditando({ ...editando, [k]: e.target.value })} />
                  </label>
                ))}
                <label className="cc-campo">
                  <span>{c.fonte}</span>
                  <select value={editando.fonte} onChange={(e) => setEditando({ ...editando, fonte: e.target.value as Fonte })}>
                    {FONTES.map((f) => <option key={f} value={f}>{c.fontes[f]}</option>)}
                  </select>
                </label>
              </div>
              <label className="cc-campo"><span>{c.assinaturaDaOrg}</span><input value={editando.assinatura} onChange={(e) => setEditando({ ...editando, assinatura: e.target.value })} maxLength={80} /></label>
              <p className="cc-nota" role="status">{por(c.contraste, { n: r.toFixed(1) })}</p>
              {r < CONTRASTE_MINIMO && <p role="alert" className="cc-erro">{c.contrasteBaixo}</p>}
              {erroDaEdicao && erroDaEdicao !== "invalido:contraste" && <p role="alert" className="cc-erro">{textoDoErro(t.erros, new Error(erroDaEdicao))}</p>}
              <div className="cc-acoes">
                <Botao type="submit" disabled={ocupado || !!erroDaEdicao}>{c.salvar}</Botao>
                <Botao variante="fantasma" onClick={() => setEditando(null)}>{t.margem.cancelar}</Botao>
              </div>
            </form>
          )}
          {avisos}
        </div>
      )}
    </section>
  );
}
