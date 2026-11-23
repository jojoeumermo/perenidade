// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// 60. Consenso por posições: concordo, concordo com ressalva, me abstenho, bloqueio. Cada pessoa de dentro se posiciona uma vez; aberto,
// ninguém vê parcial; fechado, cada total só a partir de 3 e, com 3 ou mais pessoas, se houve bloqueio (nunca quem).
import { useId, useState, type FormEvent } from "react";
import { organizacao, type Consenso, type Consensos, type Posicao } from "@/lib/rede/organizacao/cliente";
import { preencher } from "@/lib/rede/preencher";
import { Botao } from "../ui/Botao";
import type { PropsDaSecaoDaOrg } from "./TelaDaOrganizacao";
import { diaEHora, fraseDoErro } from "./textos";
import { useCarga } from "./usar";

const POSICOES: readonly Posicao[] = ["concordo", "ressalva", "abstenho", "bloqueio"];
const daqui = (dias: number) => { const d = new Date(Date.now() + dias * 864e5); d.setSeconds(0, 0); return new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 16); };

export function SecaoConsenso({ t, lang, org }: PropsDaSecaoDaOrg) {
  const { dado, erro, carregando, recarregar, trocar } = useCarga<Consensos>(`consensos-${org.handle}`, () => organizacao.consensos(org.handle));
  const [abrir, setAbrir] = useState(false);
  const [mensagem, setMensagem] = useState<{ texto: string; erro: boolean } | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const id = useId();
  const c = t.consenso;
  const nomes = c.posicoes as Record<string, string>;
  const trocarUm = (x: Consenso) => dado && trocar({ ...dado, consensos: dado.consensos.map((y) => (y.id === x.id ? x : y)) });

  async function criar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setOcupado(true);
    try {
      await organizacao.criarConsenso({ org: org.handle, proposta: String(f.get("proposta") ?? ""), fecha_em: new Date(String(f.get("fecha_em"))).toISOString() });
      setMensagem({ texto: c.criado, erro: false });
      setAbrir(false);
      recarregar();
    } catch (x) {
      setMensagem({ texto: fraseDoErro(t, x), erro: true });
    } finally {
      setOcupado(false);
    }
  }

  async function agir(fazer: () => Promise<Consenso>, texto?: string) {
    try {
      trocarUm(await fazer());
      if (texto) setMensagem({ texto, erro: false });
    } catch (x) {
      setMensagem({ texto: fraseDoErro(t, x), erro: true });
    }
  }

  return (
    <section className="or-bloco" aria-labelledby={`${id}-t`}>
      <h2 id={`${id}-t`} className="or-subtitulo">{c.titulo}</h2>
      <p className="or-miudo">{c.sobre}</p>
      {mensagem && <p className={mensagem.erro ? "or-erro" : "or-ok"} role={mensagem.erro ? "alert" : "status"}>{mensagem.texto}</p>}
      {erro ? <p className="or-erro" role="alert">{fraseDoErro(t, erro)}</p> : null}
      {carregando && !dado ? <p className="or-miudo" role="status">{t.comum.carregando}</p> : null}
      {dado?.posso_criar && (abrir ? (
        <form className="or-form" onSubmit={criar} aria-label={c.novo}>
          <label>{c.proposta}<textarea name="proposta" required minLength={5} maxLength={500} /></label>
          <label>{c.fecha}<input type="datetime-local" name="fecha_em" required defaultValue={daqui(3)} /></label>
          <div className="or-acoes">
            <Botao type="submit" disabled={ocupado}>{t.comum.salvar}</Botao>
            <Botao type="button" variante="fantasma" onClick={() => setAbrir(false)}>{t.comum.cancelar}</Botao>
          </div>
        </form>
      ) : (
        <div className="or-acoes"><Botao variante="contorno" onClick={() => setAbrir(true)}>{c.novo}</Botao></div>
      ))}
      {dado && dado.consensos.length === 0 && <p className="or-miudo">{c.vazio}</p>}
      {dado && dado.consensos.length > 0 && (
        <ul className="or-lista">
          {dado.consensos.map((x) => (
            <li key={x.id} className="or-cartao">
              <p className="or-etiqueta">{x.fechado ? t.horario.fechada : preencher(t.horario.fechaEm, { quando: diaEHora(lang, x.fecha_em) })}</p>
              <h3>{x.proposta}</h3>
              {!x.fechado && !x.votei && (
                <div className="or-acoes" role="group" aria-label={c.qual}>
                  {POSICOES.map((p) => <Botao key={p} variante={p === "bloqueio" ? "contorno" : "primario"} tamanho="p" onClick={() => agir(() => organizacao.posicionar(x.id, p), c.contado)}>{nomes[p]}</Botao>)}
                </div>
              )}
              {!x.fechado && x.votei && <p className="or-miudo">{c.jaVotou}</p>}
              {x.resultado && (
                <>
                  <p>{x.resultado.consenso === null ? c.poucos : x.resultado.consenso ? c.temConsenso : x.resultado.houve_bloqueio ? c.bloqueado : c.semConsenso}</p>
                  <ul className="or-lista">
                    {POSICOES.map((p) => <li key={p}>{nomes[p]}: <span className="or-numero">{x.resultado?.totais[p] ?? t.comum.menosDe3}</span></li>)}
                  </ul>
                  {x.resultado.votantes !== null && <p className="or-miudo">{preencher(c.votantes, { n: x.resultado.votantes })}</p>}
                </>
              )}
              {!x.fechado && x.posso_fechar && <div className="or-acoes"><Botao variante="fantasma" tamanho="p" onClick={() => agir(() => organizacao.fecharConsenso(x.id))}>{t.horario.fechar}</Botao></div>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
