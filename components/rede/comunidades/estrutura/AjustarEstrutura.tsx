// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useId, useState } from "react";
import { estrutura as cliente } from "@/lib/rede/estrutura/cliente";
import { HERANCAS, REPOSTS, RESPOSTAS, UFS, nomeDoLugarValido } from "@/lib/rede/estrutura/regras";
import type { TextosDaEstrutura } from "@/lib/rede/estrutura/textos";
import type { Estrutura } from "@/lib/rede/estrutura/tipos";
import { preencher } from "@/lib/rede/preencher";
import type { TextosDaRede } from "@/lib/rede/textos";
import { mensagemDeErro } from "./base";

type Retorno = { texto: string; erro: boolean } | null;

/** Uma ação que fala com o banco: ocupado, o retorno escrito e o estado novo para a aba. */
function useAcao(s: TextosDaRede, te: TextosDaEstrutura, aoMudar: (e: Estrutura) => void) {
  const [ocupado, setOcupado] = useState(false);
  const [retorno, setRetorno] = useState<Retorno>(null);
  const rodar = async (tarefa: () => Promise<Estrutura | null>, feito: string) => {
    setOcupado(true);
    setRetorno(null);
    try {
      const novo = await tarefa();
      if (novo) aoMudar(novo);
      setRetorno({ texto: feito, erro: false });
    } catch (e) {
      setRetorno({ texto: mensagemDeErro(s, te, e), erro: true });
    } finally {
      setOcupado(false);
    }
  };
  return { ocupado, retorno, rodar };
}

function Retorno({ r }: { r: Retorno }) {
  if (!r) return null;
  return <p role={r.erro ? "alert" : "status"} className={r.erro ? "e10-erro" : "e10-status"}>{r.texto}</p>;
}

/**
 * O painel da moderação na aba Estrutura: comunidade de avisos e quem responde, quem traz reposts, a cidade e o bairro, morar dentro
 * de outra comunidade (com a herança de moderação), os pedidos de quem quer morar aqui e a organização com selo. Cada parte salva
 * sozinha; o banco confere tudo de novo.
 */
export function AjustarEstrutura({ s, te, dado, aoMudar }: { lang: string; s: TextosDaRede; te: TextosDaEstrutura; dado: Estrutura; aoMudar: (e: Estrutura) => void }) {
  const a = te.ajustar;
  const id = useId();
  const regras = useAcao(s, te, aoMudar);
  const lugar = useAcao(s, te, aoMudar);
  const casa = useAcao(s, te, aoMudar);
  const org = useAcao(s, te, aoMudar);

  const [soLeitura, setSoLeitura] = useState(dado.so_leitura);
  const [respostas, setRespostas] = useState(dado.respostas);
  const [reposts, setReposts] = useState(dado.reposts);
  const [uf, setUf] = useState(dado.local?.uf ?? "");
  const [municipio, setMunicipio] = useState(dado.local?.municipio ?? "");
  const [bairro, setBairro] = useState(dado.local?.bairro ?? "");
  const [mae, setMae] = useState("");
  const [heranca, setHeranca] = useState(dado.heranca);
  const [handle, setHandle] = useState("");
  const lugarOk = nomeDoLugarValido(municipio) && nomeDoLugarValido(bairro) && (!municipio.trim() || uf !== "");

  return (
    <section className="e10-secao e10-ajustar" aria-labelledby={`${id}-t`}>
      <h3 id={`${id}-t`} className="e10-secao-titulo e10-cond"><span className="e10-ladrilho" aria-hidden>⚙</span>{a.titulo}</h3>
      <p className="e10-lead">{a.intro}</p>

      <div className="e10-grade e10-grade-2 e10-blocos">
        {/* Comunidade de avisos, respostas e reposts. */}
        <form
          className="e10-campos"
          onSubmit={(ev) => {
            ev.preventDefault();
            void regras.rodar(() => cliente.salvar(dado.comunidade, { so_leitura: soLeitura, respostas, reposts }), te.salvo);
          }}
        >
          <label className="e10-chave">
            <input type="checkbox" checked={soLeitura} onChange={(ev) => setSoLeitura(ev.target.checked)} />
            {a.soLeitura}
          </label>
          <label className="e10-campo">
            {a.respostas}
            <select value={respostas} onChange={(ev) => setRespostas(ev.target.value as typeof respostas)} disabled={!soLeitura}>
              {RESPOSTAS.map((r) => <option key={r} value={r}>{a.respostasOpcoes[r]}</option>)}
            </select>
          </label>
          <label className="e10-campo">
            {a.reposts}
            <select value={reposts} onChange={(ev) => setReposts(ev.target.value as typeof reposts)}>
              {REPOSTS.map((r) => <option key={r} value={r}>{a.repostsOpcoes[r]}</option>)}
            </select>
          </label>
          <div className="e10-acoes">
            <button type="submit" className="al-botao al-botao-primario al-botao-m" disabled={regras.ocupado}>{a.salvarRegras}</button>
          </div>
          <Retorno r={regras.retorno} />
        </form>

        {/* Cidade e bairro escritos. */}
        <form
          className="e10-campos"
          onSubmit={(ev) => {
            ev.preventDefault();
            if (!lugarOk) return;
            void lugar.rodar(() => cliente.salvar(dado.comunidade, { uf, municipio, bairro }), te.salvo);
          }}
        >
          <p className="e10-campo e10-sem-margem">{a.local}</p>
          <p className="e10-nota e10-sem-margem">{a.localAjuda}</p>
          <div className="e10-campos e10-campos-3">
            <label className="e10-campo">
              {a.uf}
              <select value={uf} onChange={(ev) => setUf(ev.target.value)}>
                <option value="">{a.ufVazia}</option>
                {UFS.map((u) => <option key={u} value={u}>{u} · {te.ufs[u]}</option>)}
              </select>
            </label>
            <label className="e10-campo">
              {a.municipio}
              <input value={municipio} onChange={(ev) => setMunicipio(ev.target.value)} maxLength={80} placeholder={a.municipioExemplo} autoComplete="off" />
            </label>
            <label className="e10-campo">
              {a.bairro}
              <input value={bairro} onChange={(ev) => setBairro(ev.target.value)} maxLength={80} placeholder={a.bairroExemplo} autoComplete="off" disabled={!municipio.trim()} />
            </label>
          </div>
          <div className="e10-acoes">
            <button type="submit" className="al-botao al-botao-primario al-botao-m" disabled={lugar.ocupado || !lugarOk}>{a.salvarLocal}</button>
          </div>
          <Retorno r={lugar.retorno} />
        </form>

        {/* Morar dentro de outra comunidade, com a herança. */}
        <div className="e10-campos">
          <p className="e10-campo e10-sem-margem">{a.mae}</p>
          {!dado.pode_ser_filha ? (
            <p className="e10-vazio">{a.naoPodeSerFilha}</p>
          ) : dado.mae || dado.mae_pedido ? (
            <div className="e10-pedido">
              <p>{dado.mae ? preencher(te.estrutura.herancaTexto[dado.heranca], { mae: dado.mae.nome }) : preencher(a.maeEsperando, { mae: dado.mae_pedido!.nome })}</p>
              <button type="button" className="al-botao al-botao-contorno al-botao-p" disabled={casa.ocupado}
                onClick={() => void casa.rodar(() => cliente.pedirMae(dado.comunidade, null), te.salvo)}>
                {preencher(a.maeSair, { mae: (dado.mae ?? dado.mae_pedido)!.nome })}
              </button>
            </div>
          ) : (
            <form
              className="e10-campos"
              onSubmit={(ev) => {
                ev.preventDefault();
                const alvo = mae.trim().replace(/^.*\/c\//, "").replace(/\/.*$/, "").toLowerCase();
                if (alvo) void casa.rodar(() => cliente.pedirMae(dado.comunidade, alvo), te.enviado);
              }}
            >
              <p className="e10-nota e10-sem-margem">{a.maeAjuda}</p>
              <label className="e10-campo">
                {a.maeCampo}
                <input value={mae} onChange={(ev) => setMae(ev.target.value)} placeholder={a.maeExemplo} autoCapitalize="none" spellCheck={false} maxLength={120} />
              </label>
              <div className="e10-acoes">
                <button type="submit" className="al-botao al-botao-primario al-botao-m" disabled={casa.ocupado || !mae.trim()}>{te.enviar}</button>
              </div>
            </form>
          )}
          {dado.pode_ser_filha && (
            <fieldset className="e10-escolhas">
              <legend>{a.heranca}</legend>
              {HERANCAS.map((h) => (
                <label key={h} className="e10-escolha">
                  <input type="radio" name={`${id}-heranca`} value={h} checked={heranca === h} disabled={casa.ocupado}
                    onChange={() => {
                      setHeranca(h);
                      void casa.rodar(() => cliente.salvar(dado.comunidade, { heranca: h }), te.salvo);
                    }} />
                  {a.herancaOpcoes[h]}
                </label>
              ))}
              <p className="e10-nota">{a.herancaAjuda}</p>
            </fieldset>
          )}
          <Retorno r={casa.retorno} />
        </div>

        {/* A organização com selo. */}
        <div className="e10-campos">
          <p className="e10-campo e10-sem-margem">{a.org}</p>
          {dado.org || dado.org_pedido ? (
            <div className="e10-pedido">
              <p>{dado.org ? `${dado.org.codinome || ""} @${dado.org.handle}`.trim() : preencher(a.orgEsperando, { handle: dado.org_pedido!.handle })}</p>
              <button type="button" className="al-botao al-botao-contorno al-botao-p" disabled={org.ocupado}
                onClick={() => void org.rodar(() => cliente.pedirOrg(dado.comunidade, null), te.salvo)}>
                {preencher(a.orgSair, { handle: (dado.org ?? dado.org_pedido)!.handle })}
              </button>
            </div>
          ) : (
            <form
              className="e10-campos"
              onSubmit={(ev) => {
                ev.preventDefault();
                const alvo = handle.trim().replace(/^@+/, "");
                if (alvo) void org.rodar(() => cliente.pedirOrg(dado.comunidade, alvo), te.enviado);
              }}
            >
              <p className="e10-nota e10-sem-margem">{a.orgAjuda}</p>
              <label className="e10-campo">
                {a.orgCampo}
                <input value={handle} onChange={(ev) => setHandle(ev.target.value)} placeholder={a.orgExemplo} autoCapitalize="none" spellCheck={false} maxLength={40} />
              </label>
              <div className="e10-acoes">
                <button type="submit" className="al-botao al-botao-primario al-botao-m" disabled={org.ocupado || !handle.trim()}>{te.enviar}</button>
              </div>
            </form>
          )}
          <Retorno r={org.retorno} />
        </div>

        {/* Quem pediu para morar aqui; logo abaixo, com título próprio, as filhas que já moram (para deixar de abrigar). */}
        {dado.pedidos_filhas?.length ? (
          <div className="e10-campos e10-largo">
            <p className="e10-campo e10-sem-margem">{a.pedidosFilhas}</p>
            <ul className="e10-pedidos">
              {(dado.pedidos_filhas ?? []).map((f) => (
                <li key={f.slug} className="e10-pedido">
                  <p>{preencher(f.heranca === "mae" ? a.pedidoFilhaHerda : a.pedidoFilha, { nome: f.nome })}</p>
                  <button type="button" className="al-botao al-botao-primario al-botao-p" disabled={casa.ocupado}
                    onClick={() => void casa.rodar(() => cliente.decidirFilha(dado.comunidade, f.slug, true), te.salvo)}>{te.aceitar}</button>
                  <button type="button" className="al-botao al-botao-contorno al-botao-p" disabled={casa.ocupado}
                    onClick={() => void casa.rodar(() => cliente.decidirFilha(dado.comunidade, f.slug, false), te.salvo)}>{te.recusar}</button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {dado.filhas.length ? (
          <div className="e10-campos e10-largo">
            <p className="e10-campo e10-sem-margem">{a.filhasAqui}</p>
            <ul className="e10-pedidos">
              {dado.filhas.map((f) => (
                <li key={f.slug} className="e10-pedido">
                  <p><strong>{f.nome}</strong></p>
                  <button type="button" className="al-botao al-botao-contorno al-botao-p" disabled={casa.ocupado}
                    onClick={() => void casa.rodar(() => cliente.decidirFilha(dado.comunidade, f.slug, false), te.salvo)}>{a.tirarFilha}</button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </section>
  );
}
