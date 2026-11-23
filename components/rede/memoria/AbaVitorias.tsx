// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// 116. Mural de vitórias: as conquistas das comunidades que a pessoa vê, da mais nova para a mais antiga. A mediação registra e
// tira; o mural não diz quem registrou. A fonte abre sem levar de onde veio.
import { useId, useState, type FormEvent } from "react";
import { confirmar } from "@/components/perguntar";
import { linkOk } from "@/lib/rede/memoria/regras";
import { memoriaDaLuta, type Mural } from "@/lib/rede/memoria/cliente";
import { preencher } from "@/lib/rede/preencher";
import { Botao } from "../ui/Botao";
import { dataCurta, fraseDoErroDaMemoria, type TextosDaMemoria } from "./textos";
import { useCarga } from "./usar";

export function AbaVitorias({ t, lang }: { t: TextosDaMemoria; lang: string }) {
  const { dado, erro, carregando, recarregar, trocar } = useCarga<Mural>("mural", () => memoriaDaLuta.mural(null));
  const [abrir, setAbrir] = useState(false);
  const [mensagem, setMensagem] = useState<{ texto: string; erro: boolean } | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const id = useId();

  async function registrar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const fonte = String(f.get("fonte") ?? "").trim();
    if (fonte && !linkOk(fonte)) return setMensagem({ texto: t.erros.invalido, erro: true });
    setOcupado(true);
    try {
      await memoriaDaLuta.registrarVitoria({
        comunidade: String(f.get("comunidade") ?? ""), titulo: String(f.get("titulo") ?? ""), texto: String(f.get("texto") ?? ""), quando: String(f.get("quando") ?? ""), fonte,
      });
      setMensagem({ texto: t.vitorias.registrada, erro: false });
      setAbrir(false);
      recarregar();
    } catch (x) {
      setMensagem({ texto: fraseDoErroDaMemoria(t, x), erro: true });
    } finally {
      setOcupado(false);
    }
  }

  async function tirar(vid: string, titulo: string) {
    if (!(await confirmar(preencher(t.vitorias.tirarPergunta, { titulo }), { sim: t.comum.sim, nao: t.comum.nao, perigo: true }))) return;
    try {
      await memoriaDaLuta.tirarVitoria(vid);
      if (dado) trocar({ ...dado, vitorias: dado.vitorias.filter((v) => v.id !== vid) });
    } catch (x) {
      setMensagem({ texto: fraseDoErroDaMemoria(t, x), erro: true });
    }
  }

  return (
    <section className="ml-bloco" aria-labelledby={`${id}-t`}>
      <h2 id={`${id}-t`} className="ml-subtitulo">{t.abas.vitorias}</h2>
      <p className="ml-miudo">{t.vitorias.sobre}</p>
      {mensagem && <p className={mensagem.erro ? "ml-erro" : "ml-ok"} role={mensagem.erro ? "alert" : "status"}>{mensagem.texto}</p>}
      {erro ? <p className="ml-erro" role="alert">{fraseDoErroDaMemoria(t, erro)}</p> : null}
      {carregando && !dado ? <p className="ml-miudo" role="status">{t.comum.carregando}</p> : null}
      {dado && dado.posso_registrar.length > 0 && (
        abrir ? (
          <form className="ml-form" onSubmit={registrar} aria-label={t.vitorias.registrar}>
            <label>{t.comum.comunidade}
              <select name="comunidade" required defaultValue={dado.posso_registrar[0]?.slug}>
                {dado.posso_registrar.map((c) => <option key={c.slug} value={c.slug}>{c.nome}</option>)}
              </select>
            </label>
            <label>{t.comum.titulo}<input type="text" name="titulo" required minLength={3} maxLength={140} /></label>
            <label>{t.comum.texto} {t.comum.opcional}<textarea name="texto" maxLength={1000} /></label>
            <label>{t.comum.data}<input type="date" name="quando" max={new Date().toISOString().slice(0, 10)} /></label>
            <label>{t.vitorias.fonte} {t.comum.opcional}<input type="url" name="fonte" inputMode="url" maxLength={500} placeholder="https://" /></label>
            <div className="ml-acoes">
              <Botao type="submit" disabled={ocupado}>{t.comum.salvar}</Botao>
              <Botao type="button" variante="fantasma" onClick={() => setAbrir(false)}>{t.comum.cancelar}</Botao>
            </div>
          </form>
        ) : (
          <div className="ml-acoes"><Botao variante="contorno" onClick={() => setAbrir(true)}>{t.vitorias.registrar}</Botao></div>
        )
      )}
      {dado && dado.vitorias.length === 0 && <p className="ml-miudo">{t.vitorias.vazio}</p>}
      {dado && dado.vitorias.length > 0 && (
        <ul className="ml-lista">
          {dado.vitorias.map((v) => (
            <li key={v.id} className="ml-cartao">
              <p className="ml-etiqueta">{dataCurta(lang, v.quando)} · {v.comunidade_nome}</p>
              <h3>{v.titulo}</h3>
              {v.texto && <p>{v.texto}</p>}
              <div className="ml-acoes">
                {v.fonte && linkOk(v.fonte) && <a className="ml-link" href={v.fonte} target="_blank" rel="noopener noreferrer nofollow">{t.vitorias.verFonte}</a>}
                {v.posso_tirar && <Botao variante="fantasma" tamanho="p" onClick={() => tirar(v.id, v.titulo)}>{t.comum.tirar}</Botao>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
