// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import { TEXTOS_DO_NUCLEO, type TextosDoNucleo } from "@/i18n/escola/nucleo";
import { FRENTES_DE_ATUACAO, type MilitanteNoPainel } from "@/lib/escola/contratos";
import { type BancaListada, chamarNoBanco, type MilitanteDoPainel, type FuncaoDoNucleo, type FuncoesDoNucleo, proximaSegunda, type ResumoDoPainel } from "@/lib/escola/nucleo";
import { escolher, preencher } from "@/lib/escola/textos";
import { useI18n } from "../../I18n";
import { dataHora, dia, PAINEL_MUDOU, useLista } from "../comum";
import { Abas, Area, Botao, Campo, Cartao, Esqueleto, Selecao, Selo, Vazio } from "../ui";

type T = TextosDoNucleo;
type P = T["painel"];
type Aba = "militantes" | "bancas" | "pergunta" | "recados" | "nucleos";

/**
 * Ação do painel com o aviso no idioma do painel (os motivos de i18n/escola/nucleo, "erros"). Sempre no banco, sem a
 * prévia de desenvolvimento: as leituras (useLista) também vão direto ao banco.
 */
function useAgir(t: T, depois: () => void) {
  const [aviso, setAviso] = useState("");
  const [ocupado, setOcupado] = useState(false);
  async function agir<N extends FuncaoDoNucleo>(nome: N, args: FuncoesDoNucleo[N]["args"], sucesso: string) {
    setOcupado(true);
    setAviso("");
    const r = await chamarNoBanco(nome, args);
    setOcupado(false);
    if (!r.ok) {
      setAviso(t.erros[r.motivo]);
      return false;
    }
    setAviso(sucesso);
    depois();
    window.dispatchEvent(new Event(PAINEL_MUDOU));
    return true;
  }
  return { agir, aviso, ocupado };
}

function Aviso({ texto }: { texto: string }) {
  return (
    <p role="status" className="min-h-5 text-oxblood">
      {texto}
    </p>
  );
}

/** Militantes pelo codinome: degrau, frente, núcleo, quem acompanha (só Degrau 3) e "marcar banca". */
function Militantes({ t, resumo }: { t: T; resumo: ResumoDoPainel | null }) {
  const p = t.painel.militantes;
  const lista = useLista<MilitanteDoPainel[]>("escola_militantes_listar");
  const { agir, aviso, ocupado } = useAgir(t, lista.recarregar);
  if (lista.erro) return <Aviso texto={t.erros.falha} />;
  if (!lista.dados) return <Esqueleto rotulo={t.painel.carregando} />;
  if (lista.dados.length === 0) return <Vazio titulo={p.vazio} />;
  const quadros = lista.dados.filter((m) => m.degrau === 3);
  return (
    <div className="space-y-3">
      <Aviso texto={aviso} />
      <ul className="grid gap-3 lg:grid-cols-2">
        {lista.dados.map((m) => {
          const nome = m.codinome ?? p.semCodinome;
          return (
            <li key={m.usuario}>
              <Cartao
                titulo={<span data-original="">{nome}</span>}
                nivelDoTitulo={3}
                sobre={m.desde ? `${p.desde} ${dia(m.desde)}` : undefined}
                acoes={
                  <Botao pequeno disabled={ocupado} onClick={() => agir("escola_banca_marcar", { p: { militante: m.usuario, degrau: m.degrau } }, t.banca.marcada)}>
                    {p.marcarBanca}
                  </Botao>
                }
              >
                <div className="grid gap-2 sm:grid-cols-2">
                  <Selecao rotulo={p.degrau} value={m.degrau} disabled={ocupado} onChange={(e) => agir("escola_militante_ajustar", { p: { usuario: m.usuario, degrau: Number(e.target.value) as 1 | 2 | 3 } }, p.ajustado)}>
                    {[1, 2, 3].map((d) => (
                      <option key={d} value={d}>
                        {preencher(t.banca.degrau, { n: d })}
                      </option>
                    ))}
                  </Selecao>
                  <Selecao rotulo={p.frente} value={m.frente ?? ""} disabled={ocupado} onChange={(e) => agir("escola_militante_ajustar", { p: { usuario: m.usuario, frente: (e.target.value || null) as MilitanteNoPainel["frente"] } }, p.ajustado)}>
                    <option value="">{p.nenhum}</option>
                    {FRENTES_DE_ATUACAO.map((f) => (
                      <option key={f} value={f}>
                        {p.frentes[f]}
                      </option>
                    ))}
                  </Selecao>
                  <Selecao rotulo={p.nucleo} value={m.nucleo?.id ?? ""} disabled={ocupado} onChange={(e) => agir("escola_militante_ajustar", { p: { usuario: m.usuario, nucleo: e.target.value || null } }, p.ajustado)}>
                    <option value="">{p.nenhum}</option>
                    {(resumo?.nucleos ?? (m.nucleo ? [{ ...m.nucleo, cidade: "", militantes: 0 }] : [])).map((n) => (
                      <option key={n.id} value={n.id}>
                        {n.nome}
                      </option>
                    ))}
                  </Selecao>
                  <Selecao
                    rotulo={p.acompanha}
                    value={m.acompanha_id ?? ""}
                    disabled={ocupado}
                    onChange={(e) => agir("escola_acompanhar", { p_militante: m.usuario, p_acompanha: e.target.value || null }, p.ajustado)}
                  >
                    <option value="">{p.ninguem}</option>
                    {quadros
                      .filter((q) => q.usuario !== m.usuario)
                      .map((q) => (
                        <option key={q.usuario} value={q.usuario}>
                          {q.codinome ?? p.semCodinome}
                        </option>
                      ))}
                  </Selecao>
                </div>
              </Cartao>
            </li>
          );
        })}
      </ul>
      <p className="text-sm text-ink-soft">{t.painel.limite}</p>
    </div>
  );
}

/** As bancas (todas, para a coordenação): a situação, o balanço e o registro do que a banca decidiu. */
function Bancas({ t }: { t: T }) {
  const p = t.painel.bancas;
  const lista = useLista<BancaListada[]>("escola_bancas_listar");
  const { agir, aviso, ocupado } = useAgir(t, lista.recarregar);
  const [balancos, setBalancos] = useState<Record<string, string>>({});
  if (lista.erro) return <Aviso texto={t.erros.falha} />;
  if (!lista.dados) return <Esqueleto rotulo={t.painel.carregando} />;
  if (lista.dados.length === 0) return <Vazio titulo={p.vazio} texto={t.kit.banca.texto} />;
  return (
    <div className="space-y-3">
      <p className="max-w-3xl text-sm text-ink-soft">{t.kit.banca.texto}</p>
      <Aviso texto={aviso} />
      <ul className="grid gap-3 lg:grid-cols-2">
        {lista.dados.map((b) => (
          <li key={b.id}>
            <Cartao
              titulo={<span data-original="">{b.militante.codinome ?? t.painel.militantes.semCodinome}</span>}
              nivelDoTitulo={3}
              sobre={`${preencher(t.banca.degrau, { n: b.degrau })} · ${b.quando ? dataHora(b.quando) : t.banca.semData}`}
              acoes={<Selo tom={b.situacao === "aprovada" ? "ok" : b.situacao === "refazer" ? "aviso" : "info"}>{t.banca.situacao[b.situacao]}</Selo>}
            >
              {b.balanco ? (
                <p className="whitespace-pre-line text-sm" data-original="">
                  {b.balanco}
                </p>
              ) : b.situacao === "marcada" && b.decido ? (
                <div className="space-y-2">
                  <Area rotulo={t.banca.balancoRotulo} rows={4} maxLength={2000} value={balancos[b.id] ?? ""} onChange={(e) => setBalancos({ ...balancos, [b.id]: e.target.value })} />
                  <div className="flex flex-wrap gap-2">
                    <Botao variante="principal" disabled={ocupado || (balancos[b.id] ?? "").trim().length < 10} onClick={() => agir("escola_banca_decidir", { p_id: b.id, p_situacao: "aprovada", p_balanco: balancos[b.id] ?? "" }, t.banca.decidida)}>
                      {t.banca.aprovar}
                    </Botao>
                    <Botao disabled={ocupado || (balancos[b.id] ?? "").trim().length < 10} onClick={() => agir("escola_banca_decidir", { p_id: b.id, p_situacao: "refazer", p_balanco: balancos[b.id] ?? "" }, t.banca.decidida)}>
                      {t.banca.refazer}
                    </Botao>
                  </div>
                </div>
              ) : null}
            </Cartao>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** A pergunta geradora: a desta semana ou de uma semana que vem (sempre uma segunda-feira). */
function Pergunta({ t, resumo, recarregar }: { t: T; resumo: ResumoDoPainel | null; recarregar: () => void }) {
  const p = t.painel.pergunta;
  const semanaAtual = resumo?.semana ?? "";
  const [semana, setSemana] = useState("");
  const [texto, setTexto] = useState<string | null>(null);
  const { agir, aviso, ocupado } = useAgir(t, recarregar);
  const escolhida = semana || semanaAtual;
  const daSemana = resumo?.perguntas.find((q) => q.semana === escolhida)?.texto ?? "";
  const opcoes = semanaAtual ? [semanaAtual, ...[1, 2, 3, 4].map((n) => somarDias(semanaAtual, 7 * n))] : [proximaSegunda()];
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Cartao titulo={p.titulo} sobre={p.texto}>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            agir("escola_pergunta_definir", { p: { semana: escolhida, texto: texto ?? daSemana } }, p.salva).then((ok) => ok && setTexto(null));
          }}
        >
          <Selecao rotulo={p.semana} value={escolhida} onChange={(e) => (setSemana(e.target.value), setTexto(null))}>
            {opcoes.map((s) => (
              <option key={s} value={s}>
                {dia(s)}
              </option>
            ))}
          </Selecao>
          <Area rotulo={p.rotulo} rows={3} maxLength={300} value={texto ?? daSemana} onChange={(e) => setTexto(e.target.value)} />
          <Botao type="submit" variante="principal" disabled={ocupado || !escolhida}>
            {p.salvar}
          </Botao>
          <Aviso texto={aviso} />
        </form>
      </Cartao>
      <Cartao titulo={p.recentes}>
        {!resumo || resumo.perguntas.length === 0 ? (
          <p className="text-sm text-ink-soft">{p.nenhuma}</p>
        ) : (
          <ul className="space-y-2">
            {resumo.perguntas.map((q) => (
              <li key={q.semana}>
                <strong>{dia(q.semana)}</strong> · <span data-original="">{q.texto}</span>
              </li>
            ))}
          </ul>
        )}
      </Cartao>
    </div>
  );
}

const hojeEmBrasilia = () => new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "America/Sao_Paulo" }).format(new Date());

const somarDias = (iso: string, n: number) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/** Recados da formação: para toda a Escola ou para um núcleo, até uma data. */
function Recados({ t, resumo, recarregar }: { t: T; resumo: ResumoDoPainel | null; recarregar: () => void }) {
  const p = t.painel.recados;
  const hoje = hojeEmBrasilia();
  const [texto, setTexto] = useState("");
  const [ate, setAte] = useState("");
  const [nucleo, setNucleo] = useState("");
  const { agir, aviso, ocupado } = useAgir(t, recarregar);
  const nomes = new Map((resumo?.nucleos ?? []).map((n) => [n.id, n.nome]));
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Cartao titulo={p.titulo} sobre={p.texto}>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            agir("escola_recado_salvar", { p: { texto, ate, nucleo: nucleo || null } }, p.salvo).then((ok) => ok && (setTexto(""), setAte("")));
          }}
        >
          <Area rotulo={p.rotulo} rows={3} maxLength={400} required value={texto} onChange={(e) => setTexto(e.target.value)} />
          <div className="grid gap-2 sm:grid-cols-2">
            <Campo rotulo={p.ate} type="date" required min={hoje || undefined} value={ate} onChange={(e) => setAte(e.target.value)} />
            <Selecao rotulo={p.para} value={nucleo} onChange={(e) => setNucleo(e.target.value)}>
              <option value="">{p.todos}</option>
              {(resumo?.nucleos ?? []).map((n) => (
                <option key={n.id} value={n.id}>
                  {n.nome}
                </option>
              ))}
            </Selecao>
          </div>
          <Botao type="submit" variante="principal" disabled={ocupado || texto.trim().length < 3 || !ate}>
            {p.salvar}
          </Botao>
          <Aviso texto={aviso} />
        </form>
      </Cartao>
      <Cartao titulo={t.painel.abas.recados}>
        {!resumo || resumo.recados.length === 0 ? (
          <p className="text-sm text-ink-soft">{p.nenhum}</p>
        ) : (
          <ul className="space-y-3">
            {resumo.recados.map((r) => {
              const vencido = r.ate < hoje;
              return (
                <li key={r.id} className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <p data-original="">{r.texto}</p>
                    <p className="text-sm text-ink-soft">
                      {r.nucleo ? (nomes.get(r.nucleo) ?? "") : p.todos} · {p.ate} {dia(r.ate)}
                      {vencido && <> · <Selo tom="aviso">{p.vencido}</Selo></>}
                    </p>
                  </div>
                  <Botao pequeno perigo disabled={ocupado} onClick={() => agir("escola_recado_salvar", { p: { id: r.id, texto: r.texto, ate: r.ate, apagar: true } }, p.apagado)}>
                    {p.apagar}
                  </Botao>
                </li>
              );
            })}
          </ul>
        )}
      </Cartao>
    </div>
  );
}

function Nucleos({ p, resumo }: { p: P; resumo: ResumoDoPainel | null }) {
  return (
    <Cartao titulo={p.nucleos.titulo} sobre={p.nucleos.texto}>
      {!resumo || resumo.nucleos.length === 0 ? (
        <p className="text-sm text-ink-soft">{p.nucleos.nenhum}</p>
      ) : (
        <ul className="divide-y divide-rule">
          {resumo.nucleos.map((n) => (
            <li key={n.id} className="flex items-baseline justify-between gap-3 py-2">
              <span>
                <strong data-original="">{n.nome}</strong> {n.cidade && <span className="text-sm text-ink-soft">· {n.cidade}</span>}
              </span>
              <span className="text-sm">{preencher(p.nucleos.militantes, { n: n.militantes })}</span>
            </li>
          ))}
        </ul>
      )}
    </Cartao>
  );
}

/**
 * O painel da Escola de Formação, para a coordenação (PLANO-ESCOLA.md, F4): militantes pelo codinome (núcleo, frente,
 * degrau, quem acompanha), bancas de passagem com o balanço coletivo sem nota, a pergunta geradora da semana, os recados
 * da formação e os núcleos da Alumia. Tudo pelas funções do banco (supabase/migracoes/20261108-escola-nucleo.sql), que
 * recusam quem não é coordenação; nenhuma mostra nome civil nem e-mail. Os textos vêm de i18n/escola/nucleo, no idioma
 * do painel.
 */
export function PainelDaEscola() {
  const { lang } = useI18n();
  const t = escolher(TEXTOS_DO_NUCLEO, lang);
  const p = t.painel;
  const [aba, setAba] = useState<Aba>("militantes");
  const resumo = useLista<ResumoDoPainel>("escola_painel_resumo");
  const dados = resumo.dados;
  return (
    <div className="pn-tela" data-painel-da-escola="">
      <p className="max-w-3xl text-sm text-ink-soft">{p.lead}</p>
      {resumo.erro && <Aviso texto={t.erros.falha} />}
      <Abas<Aba>
        rotulo={t.tela.abas.rotulo}
        valor={aba}
        aoMudar={setAba}
        opcoes={[
          { id: "militantes", nome: p.abas.militantes },
          { id: "bancas", nome: p.abas.bancas },
          { id: "pergunta", nome: p.abas.pergunta },
          { id: "recados", nome: p.abas.recados },
          { id: "nucleos", nome: p.abas.nucleos },
        ]}
        painel={(id) =>
          id === "militantes" ? (
            <Militantes t={t} resumo={dados} />
          ) : id === "bancas" ? (
            <Bancas t={t} />
          ) : id === "pergunta" ? (
            <Pergunta t={t} resumo={dados} recarregar={resumo.recarregar} />
          ) : id === "recados" ? (
            <Recados t={t} resumo={dados} recarregar={resumo.recarregar} />
          ) : (
            <Nucleos p={p} resumo={dados} />
          )
        }
      />
    </div>
  );
}
