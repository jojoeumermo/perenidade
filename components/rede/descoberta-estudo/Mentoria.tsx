// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// Item 71: mentoria entre pares. Veterana (conta com 90 dias ou mais) se oferece numa trilha; caloura pede e o banco sorteia uma
// veterana com vaga na mesma trilha. Ninguém vê a lista de veteranas nem quantas são; feito o par, só as duas se veem (codinome e @)
// para combinar por mensagem. Qualquer uma encerra, e o par some.
import { useId, useState } from "react";
import Link from "@/components/Link";
import { confirmar } from "@/components/perguntar";
import { de } from "@/lib/rede/descoberta-estudo/cliente";
import { useNomesDasTrilhas } from "../estudo/conquistas/usarNomesDasTrilhas";
import { Botao } from "../ui/Botao";
import { Bloco, Mensagem, fraseDoErro, por, useAcao, useLeitura, type PropsDaParte } from "./comum";

export default function Mentoria({ t, lang }: PropsDaParte) {
  const id = useId();
  const k = t.mentoria;
  const trilhas = useNomesDasTrilhas(lang);
  const minhas = useLeitura("mentorias", () => de.mentorias());
  const acao = useAcao(t, minhas.recarregar);
  const [trilha, setTrilha] = useState("");
  const [vagas, setVagas] = useState(1);
  const escolhida = trilha || trilhas.lista[0]?.slug || "";
  const ha = useLeitura(escolhida ? `ha:${escolhida}` : null, () => de.haMentoria(escolhida));
  if (minhas.erro) return <p className="de-erro" role="alert">{fraseDoErro(t, minhas.erro)}</p>;
  if (!minhas.dado || !trilhas.pronta) return <p role="status" className="de-miudo">{t.carregando}</p>;
  const m = minhas.dado;
  return (
    <div className="de-colunas">
      <Bloco titulo={k.titulo} ajuda={k.ajuda}>
        <h3 className="de-form-titulo">{k.pares}</h3>
        {m.pares.length === 0 ? <p className="de-miudo">{k.semPar}</p> : (
          <ul className="de-lista">
            {m.pares.map((p) => (
              <li key={p.id} className="de-item">
                <strong>{trilhas.nome(p.trilha)}</strong>
                <span>{por(p.papel === "veterana" ? k.vocePara : k.paraVoce, { codinome: p.codinome })}</span>
                <div className="de-acoes">
                  {p.handle && <Link href={`/${lang}/alumia/u/${p.handle}`} className="al-botao al-botao-contorno al-botao-m">{por(k.conversar, { handle: p.handle })}</Link>}
                  <Botao variante="fantasma" disabled={acao.ocupado} onClick={async () => {
                    if (await confirmar(k.encerrarConfirmar)) void acao.fazer(async () => (await de.encerrarMentoria(p.id), k.encerrada));
                  }}>{k.encerrar}</Botao>
                </div>
              </li>
            ))}
          </ul>
        )}
        <Mensagem mensagem={acao.mensagem} />
        <p className="de-miudo">{k.privacidade}</p>
      </Bloco>
      <div className="de-bloco">
        <div className="de-form">
          <label className="de-campo" htmlFor={`${id}-trilha`}>
            <span>{k.trilha}</span>
            <select id={`${id}-trilha`} className="al2-campo" value={escolhida} onChange={(e) => setTrilha(e.target.value)}>
              {trilhas.lista.map((x) => <option key={x.slug} value={x.slug}>{x.titulo}</option>)}
            </select>
          </label>
          <h3 className="de-form-titulo">{k.querAjuda}</h3>
          <p className="de-miudo">{ha.dado ? (ha.dado.ha ? k.ha : k.naoHa) : t.carregando}</p>
          <Botao disabled={acao.ocupado || !escolhida || !ha.dado?.ha} onClick={() => void acao.fazer(async () => {
            const r = await de.pedirMentoria(escolhida);
            return r.par ? por(k.feito, { codinome: r.par.codinome }) : k.naoHa;
          })}>{k.pedir}</Botao>
        </div>
        <div className="de-form">
          <h3 className="de-form-titulo">{k.querAjudar}</h3>
          {!m.veterana ? <p className="de-miudo">{k.cedo}</p> : (
            <>
              <label className="de-campo" htmlFor={`${id}-vagas`}>
                <span>{k.vagas}</span>
                <select id={`${id}-vagas`} className="al2-campo" value={vagas} onChange={(e) => setVagas(Number(e.target.value))}>
                  {[1, 2, 3].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </label>
              <Botao variante="contorno" disabled={acao.ocupado || !escolhida} onClick={() => void acao.fazer(async () => (await de.oferecerMentoria(escolhida, vagas), k.oferecido))}>{k.oferecer}</Botao>
            </>
          )}
          {m.ofertas.length > 0 && (
            <ul className="de-lista">
              {m.ofertas.map((o) => (
                <li key={o.trilha} className="de-item de-item-linha">
                  <span>{por(k.minhaOferta, { trilha: trilhas.nome(o.trilha), vagas: o.vagas })}</span>
                  <Botao variante="fantasma" disabled={acao.ocupado} onClick={() => void acao.fazer(async () => (await de.oferecerMentoria(o.trilha, 0), k.tirada))}>{k.tirar}</Botao>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
