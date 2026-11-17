// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState } from "react";
import { BackendError } from "@/lib/backend";
import { protecao } from "@/lib/rede/cliente-protecao";
import { carregarTextosDaProtecao, encher, quandoLegivel, type TextosDaProtecao } from "@/lib/rede/textos-protecao";
import { type MarcacaoPendente, type QuemPode, type Restrita, type SituacaoDaProtecao } from "@/lib/rede/tipos-protecao";
import type { ContextoDoEncaixe } from "../encaixes";
import { Botao } from "../ui/Botao";
import { PADROES_DE_LINK } from "./link-suspeito";
import "./protecao.css";

// Menções e marcações na mesma ordem, do mais fechado ao mais aberto (dois blocos vizinhos em ordens trocadas convidam ao erro).
const MARCAR: readonly QuemPode[] = ["ninguem", "seguindo", "todos"];
const MENCAO = MARCAR;

function Ladrilhos() {
  return (
    <span className="pt-ladrilhos" aria-hidden>
      <i />
      <i />
      <i />
    </span>
  );
}

/**
 * Em Ajustes (Segurança): a proteção contra ataque inteira. O modo protegido por um tempo, quem pode mencionar, as marcações (quem
 * pode, aprovar antes e as que esperam o aceite), as pessoas restritas e a lista aberta do aviso de link suspeito. Tudo é da
 * própria pessoa; nada aqui mostra o que os outros fizeram com ela.
 */
export default function SecaoDaProtecao({ lang }: ContextoDoEncaixe) {
  const [t, setT] = useState<TextosDaProtecao | null>(null);
  const [st, setSt] = useState<SituacaoDaProtecao | null>(null);
  const [restritas, setRestritas] = useState<Restrita[]>([]);
  const [pendentes, setPendentes] = useState<MarcacaoPendente[]>([]);
  const [handle, setHandle] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [nota, setNota] = useState<{ parte: string; texto: string; erro?: boolean } | null>(null);
  const [falhou, setFalhou] = useState(false);

  useEffect(() => {
    let vivo = true;
    void carregarTextosDaProtecao(lang).then((x) => vivo && setT(x));
    Promise.all([protecao.situacao(), protecao.restritas(), protecao.pendentes()])
      .then(([a, b, c]) => {
        if (!vivo) return;
        setSt(a);
        setRestritas(b);
        setPendentes(c);
      })
      .catch(() => vivo && setFalhou(true));
    return () => {
      vivo = false;
    };
  }, [lang]);

  if (!t) return null;
  if (!st) return <p className="pt-chamada" role="status">{falhou ? t.erroAoLer : t.carregando}</p>;

  const fazer = async (parte: string, tarefa: () => Promise<string | void>) => {
    setOcupado(true);
    setNota(null);
    try {
      const texto = await tarefa();
      if (texto) setNota({ parte, texto });
    } catch (e) {
      const codigo = e instanceof BackendError ? e.code : "";
      const texto = codigo === "nao_encontrado" && parte === "restringir" ? t.restringir.naoAchou : codigo === "invalido:propria" ? t.restringir.propria : t.erro;
      setNota({ parte, texto, erro: true });
    } finally {
      setOcupado(false);
    }
  };
  const mostrarNota = (parte: string) =>
    nota?.parte === parte ? (
      // O "ligado até" do modo protegido já está no carimbo: a confirmação fica só para o leitor de tela.
      <p role="status" className={`pt-nota${nota.erro ? " pt-nota-erro" : ""}${parte === "blindagem" && !nota.erro ? " sr-only" : ""}`}>
        {nota.texto}
      </p>
    ) : null;

  const ligada = st.blindagem_ate !== null;
  const quando = st.blindagem_ate ? quandoLegivel(st.blindagem_ate, lang) : "";

  return (
    <div className="pt-secao">
      <p className="pt-chamada">{t.chamada}</p>

      {/* ───── Modo protegido ───── */}
      <section className="pt-parte pt-blindagem" data-ligada={ligada ? "" : undefined} aria-labelledby="pt-blindagem-t">
        <h3 id="pt-blindagem-t" className="pt-parte-titulo al-cond">
          <Ladrilhos />
          {t.blindagem.rotulo}
        </h3>
        {ligada ? (
          <>
            <p className="pt-carimbo al-cond">{encher(t.blindagem.ligada, { quando })}</p>
            <p className="pt-texto">{t.blindagem.ligadaTexto}</p>
            <div className="pt-acoes">
              <Botao variante="contorno" disabled={ocupado} onClick={() => void fazer("blindagem", async () => {
                await protecao.blindagem(0);
                setSt({ ...st, blindagem_ate: null });
                return t.blindagem.desligou;
              })}>
                {t.blindagem.desligar}
              </Botao>
            </div>
          </>
        ) : (
          <>
            <p className="pt-texto">{t.blindagem.texto}</p>
            <div className="pt-acoes">
              {([24, 168] as const).map((h) => (
                <Botao key={h} variante={h === 24 ? "primario" : "contorno"} disabled={ocupado} onClick={() => void fazer("blindagem", async () => {
                  const ate = await protecao.blindagem(h);
                  setSt({ ...st, blindagem_ate: ate });
                  return encher(t.blindagem.ligou, { quando: ate ? quandoLegivel(ate, lang) : "" });
                })}>
                  {h === 24 ? t.blindagem.ligar24 : t.blindagem.ligar7}
                </Botao>
              ))}
            </div>
          </>
        )}
        {mostrarNota("blindagem")}
      </section>

      {/* ───── Quem pode me mencionar ───── */}
      <section className="pt-parte" aria-labelledby="pt-mencao-t">
        <h3 id="pt-mencao-t" className="pt-parte-titulo al-cond">{t.mencao.rotulo}</h3>
        <p className="pt-texto">{t.mencao.texto}</p>
        <fieldset className="pt-escolhas">
          <legend className="sr-only">{t.mencao.rotulo}</legend>
          {MENCAO.map((q) => (
            <label key={q} className="pt-escolha">
              <input type="radio" name="pt-mencao" value={q} checked={st.mencao_quem === q} disabled={ocupado} onChange={() => void fazer("mencao", async () => {
                await protecao.preferir({ mencao_quem: q });
                setSt({ ...st, mencao_quem: q });
                return t.mencao.salvo;
              })} />
              {t.mencao.opcoes[q]}
            </label>
          ))}
        </fieldset>
        {mostrarNota("mencao")}
      </section>

      {/* ───── Marcações ───── */}
      <section className="pt-parte" aria-labelledby="pt-marcacao-t">
        <h3 id="pt-marcacao-t" className="pt-parte-titulo al-cond">{t.marcacao.rotulo}</h3>
        <p className="pt-texto">{t.marcacao.texto}</p>
        <fieldset className="pt-escolhas">
          <legend>{t.marcacao.quem}</legend>
          {MARCAR.map((q) => (
            <label key={q} className="pt-escolha">
              <input type="radio" name="pt-marcar" value={q} checked={st.marcar_quem === q} disabled={ocupado} onChange={() => void fazer("marcacao", async () => {
                await protecao.preferir({ marcar_quem: q });
                setSt({ ...st, marcar_quem: q });
                return t.mencao.salvo;
              })} />
              {t.marcacao.opcoes[q]}
            </label>
          ))}
        </fieldset>
        <label className="pt-marcar">
          <input type="checkbox" checked={st.marcar_aprovar} disabled={ocupado} onChange={(e) => {
            const v = e.currentTarget.checked;
            void fazer("marcacao", async () => {
              await protecao.preferir({ marcar_aprovar: v });
              setSt({ ...st, marcar_aprovar: v });
              return t.mencao.salvo;
            });
          }} />
          <span>
            <strong>{t.marcacao.aprovar}</strong>
            <span>{t.marcacao.aprovarTexto}</span>
          </span>
        </label>
        <h4 className="pt-parte-titulo al-cond" style={{ marginTop: "1rem", fontSize: "1rem" }}>{t.marcacao.pendentes}</h4>
        {pendentes.length === 0 ? (
          <p className="pt-vazio">{t.marcacao.nenhuma}</p>
        ) : (
          <ul className="pt-lista">
            {pendentes.map((m) => (
              <li key={m.post} className="pt-item">
                <div>
                  <strong>{encher(t.marcacao.de, { codinome: m.codinome })}</strong>
                  <small>{m.handle ? `@${m.handle} · ` : ""}{quandoLegivel(m.criado_em, lang)}</small>
                  <p>{m.trecho}</p>
                </div>
                <span className="pt-acoes">
                  <Botao variante="claro" tamanho="p" disabled={ocupado} onClick={() => void fazer("marcacao", async () => {
                    await protecao.decidir(m.post, true);
                    setPendentes((l) => l.filter((x) => x.post !== m.post));
                    return t.marcacao.aceitou;
                  })}>
                    {t.marcacao.aceitar}
                  </Botao>
                  <Botao variante="contorno" tamanho="p" disabled={ocupado} onClick={() => void fazer("marcacao", async () => {
                    await protecao.decidir(m.post, false);
                    setPendentes((l) => l.filter((x) => x.post !== m.post));
                    return t.marcacao.recusou;
                  })}>
                    {t.marcacao.recusar}
                  </Botao>
                </span>
              </li>
            ))}
          </ul>
        )}
        {mostrarNota("marcacao")}
      </section>

      {/* ───── Restritas ───── */}
      <section className="pt-parte" aria-labelledby="pt-restringir-t">
        <h3 id="pt-restringir-t" className="pt-parte-titulo al-cond">{t.restringir.rotulo}</h3>
        <p className="pt-texto">{t.restringir.texto}</p>
        <form
          className="pt-campo-linha"
          onSubmit={(e) => {
            e.preventDefault();
            const h = handle.trim().replace(/^@+/, "");
            if (!h) return;
            void fazer("restringir", async () => {
              await protecao.restringir(h, true);
              setHandle("");
              setRestritas(await protecao.restritas());
              return encher(t.restringir.restringiu, { handle: `@${h.toLowerCase()}` });
            });
          }}
        >
          <label htmlFor="pt-restringir-campo">{t.restringir.campo}</label>
          <input id="pt-restringir-campo" className="pt-campo" value={handle} onChange={(e) => setHandle(e.currentTarget.value)} maxLength={21} autoComplete="off" spellCheck={false} placeholder="@" />
          <Botao type="submit" variante="primario" disabled={ocupado || !handle.trim()}>{t.restringir.botao}</Botao>
        </form>
        {restritas.length === 0 ? (
          <p className="pt-vazio">{t.restringir.nenhuma}</p>
        ) : (
          <ul className="pt-lista">
            {restritas.map((r) => (
              <li key={r.handle} className="pt-item">
                <div>
                  <strong>{r.codinome}</strong>
                  <small>@{r.handle} · {encher(t.restringir.desde, { quando: quandoLegivel(r.desde, lang) })}</small>
                </div>
                <Botao variante="contorno" tamanho="p" disabled={ocupado} onClick={() => void fazer("restringir", async () => {
                  await protecao.restringir(r.handle, false);
                  setRestritas((l) => l.filter((x) => x.handle !== r.handle));
                  return encher(t.restringir.tirou, { handle: `@${r.handle}` });
                })}>
                  {t.restringir.tirar}
                </Botao>
              </li>
            ))}
          </ul>
        )}
        {mostrarNota("restringir")}
      </section>

      {/* ───── Aviso de link suspeito: a lista aberta ───── */}
      <section className="pt-parte" aria-labelledby="pt-link-t">
        <h3 id="pt-link-t" className="pt-parte-titulo al-cond">{t.link.rotulo}</h3>
        <p className="pt-texto">{t.link.texto}</p>
        <ol className="pt-padroes">
          {PADROES_DE_LINK.map((p) => (
            <li key={p.chave}>{t.link.motivos[p.chave]}</li>
          ))}
        </ol>
      </section>
    </div>
  );
}
