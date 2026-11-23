// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// A zine imprimível (item 37): a pessoa escolhe até 12 posts (os dela, abertos, e os de outras pessoas que já podem sair da Alumia),
// o banco devolve só os que podem, e a folha A4 dobrável é montada aqui. O PDF sai pelo "Imprimir" do navegador. Nada é gravado.
import { useEffect, useId, useState, type ReactNode } from "react";
import type { MeuPostParaZine, PostDaZine } from "@/lib/rede/criacao/cliente";
import { idDoPost, MAXIMO_DE_POSTS, montarZine, ORDEM_NA_FOLHA, type PaginaDaZine, type Zine as ZineMontada } from "@/lib/rede/criacao/zine";
import { Botao } from "../ui/Botao";
import { criacao } from "./cliente";
import { useAcao } from "./Margem";
import { por, textoDoErro, type TextosDaCriacao } from "./textos";

type T = TextosDaCriacao;

function Quadro({ invertida, children, className = "" }: { invertida: boolean; children: ReactNode; className?: string }) {
  return <div className={`livrinho-quadro cc-quadro ${invertida ? "rotate-180" : ""} ${className}`}>{children}</div>;
}

function Miolo({ pagina }: { pagina: PaginaDaZine }) {
  return (
    <>
      {pagina.partes.length === 0 ? <div className="cc-linhas" aria-hidden /> : pagina.partes.map((x, i) => (
        <div key={i}>
          {x.titulo && <h4>{x.titulo}</h4>}
          {x.autora && <small>{x.autora}</small>}
          <p>{x.texto}</p>
        </div>
      ))}
      <p className="cc-num">{pagina.numero}</p>
    </>
  );
}

function Folha({ t, zine }: { t: T; zine: ZineMontada }) {
  return (
    <div className="cc-folha" data-cc-imprimir="" role="img" aria-label={t.zine.previa}>
      <div className="folha-livrinho">
        {ORDEM_NA_FOLHA.map(({ pagina, invertida }) => {
          if (pagina === 1) return (
            <Quadro key={pagina} invertida={invertida} className="cc-capa">
              <h4>{zine.capa.titulo}</h4>
              {zine.capa.subtitulo && <p>{zine.capa.subtitulo}</p>}
            </Quadro>
          );
          if (pagina === 8) return (
            <Quadro key={pagina} invertida={invertida}>
              <div className="cc-linhas" aria-hidden />
              <p>{t.zine.contracapa}</p>
            </Quadro>
          );
          return <Quadro key={pagina} invertida={invertida}><Miolo pagina={zine.miolo[pagina - 2]} /></Quadro>;
        })}
      </div>
    </div>
  );
}

export function Zine({ t }: { t: T }) {
  const z = t.zine;
  const id = useId();
  const [meus, setMeus] = useState<MeuPostParaZine[] | null>(null);
  const [erro, setErro] = useState("");
  const [escolhidos, setEscolhidos] = useState<{ id: string; rotulo: string }[]>([]);
  const [colado, setColado] = useState("");
  const [codigoRuim, setCodigoRuim] = useState(false);
  const [capa, setCapa] = useState({ titulo: "", subtitulo: "" });
  const [esconder, setEsconder] = useState(false);
  const [montada, setMontada] = useState<{ posts: PostDaZine[]; fora: number } | null>(null);
  const { ocupado, fazer, avisos } = useAcao(t);

  useEffect(() => {
    let vivo = true;
    criacao.zineMeus().then((l) => vivo && setMeus(l), (e) => vivo && setErro(textoDoErro(t.erros, e)));
    return () => {
      vivo = false;
    };
  }, [t]);

  const marcado = (pid: string) => escolhidos.some((x) => x.id === pid);
  const alternar = (p: MeuPostParaZine) => {
    setMontada(null);
    setEscolhidos((l) => (l.some((x) => x.id === p.id) ? l.filter((x) => x.id !== p.id) : l.length >= MAXIMO_DE_POSTS ? l : [...l, { id: p.id, rotulo: p.titulo || p.texto.slice(0, 60) }]));
  };
  const acrescentar = () => {
    const pid = idDoPost(colado);
    setCodigoRuim(!pid);
    if (!pid || marcado(pid) || escolhidos.length >= MAXIMO_DE_POSTS) return;
    setMontada(null);
    setEscolhidos((l) => [...l, { id: pid, rotulo: pid.slice(0, 8) }]);
    setColado("");
  };
  const mover = (i: number, d: -1 | 1) => {
    setMontada(null);
    setEscolhidos((l) => {
      const n = [...l];
      const j = i + d;
      if (j < 0 || j >= n.length) return l;
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });
  };
  const montar = () => fazer(async () => {
    const r = await criacao.zinePosts(escolhidos.map((x) => x.id));
    setMontada({ posts: r.itens, fora: r.fora });
  });
  const zine = montada ? montarZine(montada.posts, { titulo: capa.titulo, subtitulo: capa.subtitulo, esconderAutora: esconder }) : null;

  if (erro) return <p role="alert" className="cc-erro">{erro}</p>;
  return (
    <section className="cc-bloco" aria-labelledby={`${id}-t`}>
      <h2 id={`${id}-t`} className="al-cond">{z.titulo}</h2>
      <p className="cc-texto">{z.texto}</p>
      <p className="cc-aviso">{z.regra}</p>

      <h3>{z.meus}</h3>
      {!meus ? <p className="cc-nota">{t.carregando}</p> : meus.length === 0 ? <p className="cc-nota">{z.semMeus}</p> : (
        <ul className="cc-lista">
          {meus.map((p) => (
            <li key={p.id}>
              <label className="cc-marcar">
                <input type="checkbox" checked={marcado(p.id)} onChange={() => alternar(p)} disabled={!marcado(p.id) && escolhidos.length >= MAXIMO_DE_POSTS} />
                <span>{p.titulo ? <strong>{p.titulo}. </strong> : null}{p.texto}</span>
              </label>
            </li>
          ))}
        </ul>
      )}

      <form className="cc-form mt-4" onSubmit={(e) => { e.preventDefault(); acrescentar(); }}>
        <label className="cc-campo"><span>{z.outro}</span><input value={colado} onChange={(e) => { setColado(e.target.value); setCodigoRuim(false); }} inputMode="url" /></label>
        {codigoRuim && <p role="alert" className="cc-erro">{z.codigoRuim}</p>}
        <div className="cc-acoes"><Botao type="submit" variante="contorno" disabled={!colado.trim() || escolhidos.length >= MAXIMO_DE_POSTS}>{z.acrescentar}</Botao></div>
      </form>

      <h3 className="mt-5">{por(z.escolhidos, { n: escolhidos.length })}</h3>
      {escolhidos.length === 0 ? <p className="cc-nota">{z.nenhumEscolhido}</p> : (
        <ol className="cc-lista">
          {escolhidos.map((x, i) => (
            <li key={x.id} className="cc-item">
              <div><strong>{i + 1}.</strong> {x.rotulo}</div>
              <div className="cc-acoes">
                <Botao variante="fantasma" tamanho="p" className="cc-seta" onClick={() => mover(i, -1)} disabled={i === 0} aria-label={`${z.subir}: ${x.rotulo}`}>↑</Botao>
                <Botao variante="fantasma" tamanho="p" className="cc-seta" onClick={() => mover(i, 1)} disabled={i === escolhidos.length - 1} aria-label={`${z.descer}: ${x.rotulo}`}>↓</Botao>
                <Botao variante="fantasma" tamanho="p" onClick={() => { setMontada(null); setEscolhidos((l) => l.filter((y) => y.id !== x.id)); }}>{z.tirar}</Botao>
              </div>
            </li>
          ))}
        </ol>
      )}

      <form className="cc-form mt-4" onSubmit={(e) => { e.preventDefault(); void montar(); }}>
        <div className="cc-grade">
          <label className="cc-campo"><span>{z.capa}</span><input value={capa.titulo} onChange={(e) => setCapa({ ...capa, titulo: e.target.value })} maxLength={80} /></label>
          <label className="cc-campo"><span>{z.subtitulo}</span><input value={capa.subtitulo} onChange={(e) => setCapa({ ...capa, subtitulo: e.target.value })} maxLength={120} /></label>
        </div>
        <label className="cc-marcar"><input type="checkbox" checked={esconder} onChange={(e) => setEsconder(e.target.checked)} /><span>{z.esconderAutora}</span></label>
        <div className="cc-acoes">
          <Botao type="submit" disabled={ocupado || escolhidos.length === 0}>{z.montar}</Botao>
          {zine && <Botao variante="contorno" onClick={() => window.print()}>{z.imprimir}</Botao>}
        </div>
        {avisos}
      </form>

      {montada && montada.fora > 0 && <p className="cc-aviso mt-3" role="status">{por(z.fora, { n: montada.fora })}</p>}
      {zine && zine.cortados > 0 && <p className="cc-nota">{z.cortados}</p>}
      {zine && (
        <>
          <details className="mt-4">
            <summary className="cc-marcar">{z.como}</summary>
            <ol className="cc-texto list-decimal pl-6">{z.passos.map((p) => <li key={p}>{p}</li>)}</ol>
          </details>
          <Folha t={t} zine={zine} />
        </>
      )}
    </section>
  );
}
