// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// 54. Reuniões recorrentes da organização (semanal, quinzenal ou mensal). As próximas datas e o .ics com o lembrete são feitos no
// aparelho (lib/rede/organizacao/regras.ts): o alarme fica no calendário de quem baixou, e o servidor não fica sabendo quem baixou.
import { useId, useState, type FormEvent } from "react";
import { confirmar } from "@/components/perguntar";
import { organizacao, type Reunioes } from "@/lib/rede/organizacao/cliente";
import { icsDaReuniao, proximasDatas, type ReuniaoRecorrente } from "@/lib/rede/organizacao/regras";
import { preencher } from "@/lib/rede/preencher";
import { baixarArquivo } from "../alcance/usar";
import { Botao } from "../ui/Botao";
import type { PropsDaSecaoDaOrg } from "./TelaDaOrganizacao";
import { dataCurta, fraseDoErro } from "./textos";
import { useCarga } from "./usar";

const LOCAIS = ["praca", "biblioteca", "sindicato", "escola", "universidade", "associacao", "online", "outro"] as const;
const hoje = () => new Date().toISOString().slice(0, 10);

export function SecaoReunioes({ t, lang, org }: PropsDaSecaoDaOrg) {
  const { dado, erro, carregando, recarregar, trocar } = useCarga<Reunioes>(`reunioes-${org.handle}`, () => organizacao.reunioes(org.handle));
  const [abrir, setAbrir] = useState(false);
  const [freq, setFreq] = useState("semanal");
  const [mensagem, setMensagem] = useState<{ texto: string; erro: boolean } | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const id = useId();
  const r = t.reunioes;
  const dias = r.dias as string[];

  async function criar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const p: Record<string, string> = { org: org.handle };
    for (const [k, v] of f.entries()) p[k] = String(v);
    setOcupado(true);
    try {
      await organizacao.criarReuniao(p);
      setMensagem({ texto: r.criada, erro: false });
      setAbrir(false);
      recarregar();
    } catch (x) {
      setMensagem({ texto: fraseDoErro(t, x), erro: true });
    } finally {
      setOcupado(false);
    }
  }

  async function apagar(x: ReuniaoRecorrente) {
    if (!(await confirmar(preencher(r.apagarPergunta, { titulo: x.titulo }), { sim: t.comum.sim, nao: t.comum.nao, perigo: true }))) return;
    try {
      await organizacao.apagarReuniao(x.id);
      if (dado) trocar({ ...dado, reunioes: dado.reunioes.filter((y) => y.id !== x.id) });
    } catch (e) {
      setMensagem({ texto: fraseDoErro(t, e), erro: true });
    }
  }

  const quando = (x: ReuniaoRecorrente) =>
    x.frequencia === "mensal"
      ? preencher(r.mensalDe, { n: (r.semanas as string[])[(x.semana_do_mes ?? 1) - 1] ?? "", dia: dias[x.dia_semana] ?? "", hora: x.hora })
      : preencher(x.frequencia === "semanal" ? r.semanalDe : r.quinzenalDe, { dia: dias[x.dia_semana] ?? "", hora: x.hora });

  return (
    <section className="or-bloco" aria-labelledby={`${id}-t`}>
      <h2 id={`${id}-t`} className="or-subtitulo">{r.titulo}</h2>
      <p className="or-miudo">{r.sobre}</p>
      {mensagem && <p className={mensagem.erro ? "or-erro" : "or-ok"} role={mensagem.erro ? "alert" : "status"}>{mensagem.texto}</p>}
      {erro ? <p className="or-erro" role="alert">{fraseDoErro(t, erro)}</p> : null}
      {carregando && !dado ? <p className="or-miudo" role="status">{t.comum.carregando}</p> : null}
      {dado?.posso_criar && (abrir ? (
        <form className="or-form" onSubmit={criar} aria-label={r.nova}>
          <label>{t.comum.titulo}<input type="text" name="titulo" required minLength={3} maxLength={120} /></label>
          <label>{r.frequencia}
            <select name="frequencia" value={freq} onChange={(e) => setFreq(e.target.value)}>
              <option value="semanal">{t.quadro.semanal}</option>
              <option value="quinzenal">{t.quadro.quinzenal}</option>
              <option value="mensal">{t.quadro.mensal}</option>
            </select>
          </label>
          {freq === "mensal" && (
            <label>{r.semanaDoMes}
              <select name="semana_do_mes" defaultValue="1">
                {(r.semanas as string[]).map((s, i) => <option key={s} value={i + 1}>{s}</option>)}
              </select>
            </label>
          )}
          <label>{r.dia}
            <select name="dia_semana" defaultValue="2">
              {dias.map((d, i) => <option key={d} value={i}>{d}</option>)}
            </select>
          </label>
          <label>{r.hora}<input type="time" name="hora" required defaultValue="19:00" /></label>
          <label>{r.duracao}<input type="number" name="duracao_min" min={15} max={480} step={15} defaultValue={90} /></label>
          <label>{r.localTipo}
            <select name="local_tipo" defaultValue="outro">
              {LOCAIS.map((l) => <option key={l} value={l}>{(r.locais as Record<string, string>)[l]}</option>)}
            </select>
          </label>
          <label>{r.local} {t.comum.opcional}<input type="text" name="local_texto" maxLength={140} /></label>
          <label>{r.inicio}<input type="date" name="inicio" defaultValue={hoje()} required /></label>
          <label>{r.fim} {t.comum.opcional}<input type="date" name="fim" /></label>
          <label>{r.lembrete}
            <select name="lembrete_min" defaultValue="60">
              <option value="0">{r.semLembrete}</option>
              <option value="15">{r.l15}</option>
              <option value="60">{r.l60}</option>
              <option value="1440">{r.l1440}</option>
            </select>
          </label>
          <div className="or-acoes">
            <Botao type="submit" disabled={ocupado}>{t.comum.salvar}</Botao>
            <Botao type="button" variante="fantasma" onClick={() => setAbrir(false)}>{t.comum.cancelar}</Botao>
          </div>
        </form>
      ) : (
        <div className="or-acoes"><Botao variante="contorno" onClick={() => setAbrir(true)}>{r.nova}</Botao></div>
      ))}
      {dado && dado.reunioes.length === 0 && <p className="or-miudo">{r.vazio}</p>}
      {dado && dado.reunioes.length > 0 && (
        <ul className="or-lista">
          {dado.reunioes.map((x) => (
            <li key={x.id} className="or-cartao">
              <h3>{x.titulo}</h3>
              <p className="or-etiqueta">{quando(x)}</p>
              {x.local_texto && <p>{x.local_texto}</p>}
              <p className="or-miudo">{preencher(r.proximas, { datas: proximasDatas(x, hoje(), 3).map((d) => dataCurta(lang, d)).join(" · ") })}</p>
              <div className="or-acoes">
                <Botao variante="contorno" tamanho="p" onClick={() => baixarArquivo(new Blob([icsDaReuniao(x)], { type: "text/calendar" }), `reuniao-${x.id.slice(0, 8)}.ics`)}>{r.baixar}</Botao>
                {dado.posso_criar && <Botao variante="fantasma" tamanho="p" onClick={() => apagar(x)}>{t.comum.apagar}</Botao>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
