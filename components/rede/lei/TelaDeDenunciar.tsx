// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// A página de denúncia da própria Alumia (P5, A5): antes, "Denunciar" levava à página do site do instituto (direitos autorais do
// acervo, com o desenho do site). Aqui, com o desenho da Alumia: num post, o caminho é o próprio post (Denunciar, com protocolo);
// esta página é para o resto (um perfil, uma comunidade, um problema com os dados, quem está sem conta). Vai para a mesma fila de
// denúncias do banco (public.denunciar: exposição de dados chega na hora à coordenação). Abre sem conta, como a do site.
// Nada da pessoa vai junto: sem nome, sem e-mail (quem entrou fica como autor da denúncia no banco, como no site).
import { useSearchParams } from "next/navigation";
import { useId, useState } from "react";
import { BackendError, hasBackend, rpc } from "@/lib/backend";
import type { PropsDaTelaDoPacote } from "../registro";
import { CabecaDaLei, CarregandoALei, Rico } from "./base";
import { useTextosDaLei } from "./usarTextos";

export default function TelaDeDenunciar({ lang, s }: PropsDaTelaDoPacote) {
  const t = useTextosDaLei(lang);
  const busca = useSearchParams();
  const id = useId();
  const [item, setItem] = useState(() => (busca.get("item") ?? "").slice(0, 300));
  const [motivo, setMotivo] = useState(0);
  const [detalhes, setDetalhes] = useState("");
  const [isca, setIsca] = useState("");
  const [estado, setEstado] = useState<{ f: "pronto" | "enviando" | "enviada" | "erro"; codigo?: string }>({ f: "pronto" });
  if (!t) return <CarregandoALei rotulo={s.estados.carregando} />;
  const d = t.denunciar;
  const pronta = item.trim().length > 0 && detalhes.trim().length >= 20;

  const enviar = async () => {
    setEstado({ f: "enviando" });
    try {
      await rpc("denunciar", { p_alvo: item.trim(), p_motivo: d.motivos[motivo], p_detalhes: detalhes.trim(), p_site: isca, p_urgente: motivo === 0 });
      setDetalhes("");
      setEstado({ f: "enviada" });
    } catch (erro) {
      setEstado({ f: "erro", codigo: erro instanceof BackendError ? erro.code : "falha" });
    }
  };

  return (
    <article className="le-pagina le-denunciar">
      <CabecaDaLei lang={lang} t={t} titulo={d.titulo} chamada={d.chamada} />
      <div className="le-denunciar-corpo">
        <p className="le-texto"><Rico lang={lang} texto={d.comoPost} /></p>
        <p className="le-denunciar-urgente">{d.urgente}</p>
        {estado.f === "enviada" ? (
          <p role="status" className="le-ok">{d.enviada}</p>
        ) : (
          <form className="le-form" onSubmit={(e) => { e.preventDefault(); if (pronta && estado.f !== "enviando") void enviar(); }}>
            <div className="le-campo">
              <label htmlFor={`${id}-item`}>{d.item}</label>
              <input id={`${id}-item`} value={item} onChange={(e) => setItem(e.target.value)} maxLength={300} aria-describedby={`${id}-item-dica`} autoComplete="off" spellCheck={false} />
              <p id={`${id}-item-dica`} className="le-ajuda">{d.itemDica}</p>
            </div>
            <div className="le-campo">
              <label htmlFor={`${id}-motivo`}>{d.motivo}</label>
              <select id={`${id}-motivo`} value={motivo} onChange={(e) => setMotivo(Number(e.target.value))}>
                {d.motivos.map((m, i) => (
                  <option key={m} value={i}>{m}</option>
                ))}
              </select>
            </div>
            <div className="le-campo">
              <label htmlFor={`${id}-detalhes`}>{d.detalhes}</label>
              <textarea id={`${id}-detalhes`} value={detalhes} onChange={(e) => setDetalhes(e.target.value)} rows={6} maxLength={4000} aria-describedby={`${id}-detalhes-dica`} />
              <p id={`${id}-detalhes-dica`} className="le-ajuda">{d.detalhesDica}</p>
            </div>
            {/* A isca: invisível para gente, robôs preenchem (o banco recusa a denúncia que vem com ela). */}
            <div aria-hidden style={{ position: "absolute", left: "-9999px", width: 0, height: 0, overflow: "hidden" }}>
              <label>
                Site
                <input tabIndex={-1} autoComplete="off" value={isca} onChange={(e) => setIsca(e.target.value)} />
              </label>
            </div>
            {!hasBackend ? (
              <p className="le-ajuda">{d.semServico}</p>
            ) : (
              <div className="le-acoes">
                <button type="submit" className="al-botao al-botao-primario al-botao-m" disabled={!pronta || estado.f === "enviando"}>
                  {estado.f === "enviando" ? t.comum.enviando : d.enviar}
                </button>
              </div>
            )}
            {!pronta && hasBackend && <p className="le-ajuda" style={{ marginTop: "0.6rem" }}>{d.faltaAlgo}</p>}
            {estado.f === "erro" && <p role="alert" className="le-erro">{t.comum.erro}</p>}
          </form>
        )}
        <p className="le-nota"><Rico lang={lang} texto={t.comum.contato} /></p>
      </div>
    </article>
  );
}
