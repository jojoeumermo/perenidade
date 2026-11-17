// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// O painel da lei para a mediação: os contadores com prazo (conteúdo ilegal aberto, vencendo e vencido; denúncias vencidas; contas
// retidas por precaução; recursos abertos e vencidos) e as três listas, com as decisões que cabem aqui (liberar ou manter uma
// conta retida; manter ou desfazer um recurso). Quem junta pendura este componente no painel de controle da Alumia; ele não
// depende de nada do painel. As listas não dizem quem denunciou nem quem recorreu (o banco não devolve).
import "./lei.css";
import { useCallback, useEffect, useState } from "react";
import Link from "@/components/Link";
import { codigoDoErro, quando } from "./base";
import { type ContaRetida, lei, type PainelDaLeiDados, type RecursoAberto } from "./cliente";
import { por, type TextosDaLei } from "./textos";
import { useTextosDaLei } from "./usarTextos";

function Prazo({ lang, t, ate, vencido }: { lang: string; t: TextosDaLei; ate: string; vencido: boolean }) {
  return (
    <span className={`le-selo al-cond${vencido ? " le-selo-alerta" : ""}`}>
      {por(vencido ? t.painel.venceu : t.painel.ate, { quando: quando(lang, ate) })}
    </span>
  );
}

/** Um cartão com decisão: motivo obrigatório e dois botões. */
function Decidir({ t, rotulos, aoDecidir }: { t: TextosDaLei; rotulos: [string, string]; aoDecidir: (qual: 0 | 1, motivo: string) => Promise<string | null> }) {
  const [motivo, setMotivo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const ir = async (qual: 0 | 1) => {
    setEnviando(true);
    setErro(await aoDecidir(qual, motivo.trim()));
    setEnviando(false);
  };
  const curto = motivo.trim().length < 10;
  return (
    <>
      <textarea aria-label={t.painel.motivo} placeholder={t.painel.motivo} value={motivo} maxLength={500} onChange={(e) => setMotivo(e.target.value)} />
      <div className="le-acoes">
        <button type="button" className="al-botao al-botao-contorno al-botao-p" disabled={enviando || curto} onClick={() => ir(0)}>{rotulos[0]}</button>
        <button type="button" className="al-botao al-botao-primario al-botao-p" disabled={enviando || curto} onClick={() => ir(1)}>{rotulos[1]}</button>
      </div>
      {erro && <p className="le-erro" role="alert">{(t.painel.erros as Record<string, string>)[erro] ?? t.comum.erro}</p>}
    </>
  );
}

export function PainelDaLei({ lang }: { lang: string }) {
  const t = useTextosDaLei(lang);
  const [dados, setDados] = useState<PainelDaLeiDados | null>(null);
  const [estado, setEstado] = useState<"carregando" | "pronto" | "sem_permissao" | "erro">("carregando");

  const carregar = useCallback(() => {
    lei.painel().then(
      (d) => {
        setDados(d);
        setEstado("pronto");
      },
      (e) => setEstado(codigoDoErro(e) === "sem_permissao" ? "sem_permissao" : "erro"),
    );
  }, []);
  useEffect(carregar, [carregar]);

  if (!t) return null;
  const p = t.painel;
  if (estado === "sem_permissao") return <p className="le-vazio">{p.semPermissao}</p>;
  if (estado === "erro") return <p className="le-erro" role="alert">{t.comum.erro}</p>;
  if (!dados) return <p className="le-vazio" aria-live="polite">{t.comum.carregando}</p>;
  const c = dados.contadores;

  const decidirMenor = (r: ContaRetida) => async (qual: 0 | 1, motivo: string) => {
    try {
      await lei.decidirMenor(r.id, qual === 0 ? "liberar" : "manter", motivo);
      carregar();
      return null;
    } catch (e) {
      return codigoDoErro(e);
    }
  };
  const rever = (x: RecursoAberto) => async (qual: 0 | 1, motivo: string) => {
    try {
      await lei.rever(x.id, qual === 0 ? "mantido" : "revertido", motivo);
      carregar();
      return null;
    } catch (e) {
      return codigoDoErro(e);
    }
  };

  const contadores: { n: number; rotulo: string; sub?: string; alerta: boolean }[] = [
    { n: c.ilegais, rotulo: p.contadores.ilegais, sub: `${c.ilegais_vencendo} ${p.contadores.ilegaisVencendo} · ${c.ilegais_vencidas} ${p.contadores.ilegaisVencidas}`, alerta: c.ilegais_vencidas > 0 },
    { n: c.denuncias_vencidas, rotulo: p.contadores.denunciasVencidas, alerta: c.denuncias_vencidas > 0 },
    { n: c.retidas, rotulo: p.contadores.retidas, sub: `${c.retidas_vencidas} ${p.contadores.retidasVencidas}`, alerta: c.retidas_vencidas > 0 },
    { n: c.recursos, rotulo: p.contadores.recursos, sub: `${c.recursos_vencidos} ${p.contadores.recursosVencidos}`, alerta: c.recursos_vencidos > 0 },
  ];

  return (
    <section className="le-painel" aria-labelledby="le-painel-t">
      <h2 id="le-painel-t" className="al-cond">{p.titulo}</h2>
      <p>{p.chamada}</p>
      <ul className="le-contadores">
        {contadores.map((k) => (
          <li key={k.rotulo} className="le-contador" data-alerta={k.alerta ? "sim" : undefined}>
            <strong>{k.n}</strong>
            <span>{k.rotulo}</span>
            {k.sub && <small>{k.sub}</small>}
          </li>
        ))}
      </ul>

      <h3 className="le-lista-titulo al-cond">{p.ilegaisTitulo}</h3>
      {dados.ilegais.length === 0 ? <p className="le-vazio">{p.vazio}</p> : (
        <ul className="le-cartoes">
          {dados.ilegais.map((d) => (
            <li key={d.id} className="le-cartao" data-vencido={d.vencida ? "sim" : undefined}>
              <div className="le-cartao-topo">
                <Prazo lang={lang} t={t} ate={d.responder_ate} vencido={d.vencida} />
                <span>{por(p.protocolo, { protocolo: d.protocolo })}</span>
                <span>{d.alvo_tipo}</span>
              </div>
              {d.texto && <p>{d.texto}</p>}
              {d.trecho && <blockquote>{d.trecho}</blockquote>}
              <Link href={`/${lang}/alumia/moderacao`} className="le-link">{p.abrirFila}</Link>
            </li>
          ))}
        </ul>
      )}

      <h3 className="le-lista-titulo al-cond">{p.retidasTitulo}</h3>
      {dados.retidas.length === 0 ? <p className="le-vazio">{p.vazio}</p> : (
        <ul className="le-cartoes">
          {dados.retidas.map((r) => (
            <li key={r.id} className="le-cartao" data-vencido={r.vencida ? "sim" : undefined}>
              <div className="le-cartao-topo">
                <Prazo lang={lang} t={t} ate={r.responder_ate} vencido={r.vencida} />
                <strong>{r.conta}</strong>
                {r.protocolo && <span>{por(p.protocolo, { protocolo: r.protocolo })}</span>}
              </div>
              {r.texto && <blockquote>{r.texto}</blockquote>}
              {r.pode ? <Decidir t={t} rotulos={[p.liberar, p.manter]} aoDecidir={decidirMenor(r)} /> : <p>{p.denunciou}</p>}
            </li>
          ))}
        </ul>
      )}

      <h3 className="le-lista-titulo al-cond">{p.recursosTitulo}</h3>
      {dados.recursos.length === 0 ? <p className="le-vazio">{p.vazio}</p> : (
        <ul className="le-cartoes">
          {dados.recursos.map((x) => (
            <li key={x.id} className="le-cartao" data-vencido={x.vencido ? "sim" : undefined}>
              <div className="le-cartao-topo">
                <Prazo lang={lang} t={t} ate={x.responder_ate} vencido={x.vencido} />
                <span className="le-selo al-cond">{x.acao.acao}</span>
                {x.conta && <strong>{x.conta}</strong>}
                <span>{x.acao.regra}</span>
              </div>
              {x.trecho && <blockquote>{x.trecho}</blockquote>}
              <p>{x.acao.motivo}</p>
              <blockquote>{x.texto}</blockquote>
              {x.minha ? <p>{p.minha}</p> : <Decidir t={t} rotulos={[p.manterRecurso, p.reverter]} aoDecidir={rever(x)} />}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default PainelDaLei;
