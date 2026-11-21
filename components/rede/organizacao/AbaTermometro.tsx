// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// 64. Termômetro do território: UBS, escola, linha de ônibus e iluminação de um município, avaliados de 1 a 5 com os problemas de uma
// lista fechada, uma vez por semestre. O agregado só aparece com 3 avaliações ou mais; com ele, o aparelho monta o texto da denúncia
// coletiva para levar à ouvidoria. O município escolhido não fica guardado em lugar nenhum.
import { useId, useState, type FormEvent } from "react";
import { mostrarParaCopiar } from "@/components/perguntar";
import { organizacao, type Lugares } from "@/lib/rede/organizacao/cliente";
import { denunciaColetiva, PROBLEMAS_DO_LUGAR, TIPOS_DE_LUGAR, type LugarDoTermometro } from "@/lib/rede/organizacao/regras";
import { UFS } from "@/lib/rede/mapa/lugar";
import { preencher } from "@/lib/rede/preencher";
import { Botao } from "../ui/Botao";
import type { PropsDaAbaSolta } from "./TelaDaOrganizacao";
import { fraseDoErro, type TextosDaOrganizacao } from "./textos";

function Avaliar({ t, lugar, aoMudar }: { t: TextosDaOrganizacao; lugar: LugarDoTermometro; aoMudar: (l: LugarDoTermometro) => void }) {
  const [erro, setErro] = useState<string | null>(null);
  const m = t.termometro;
  async function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    try {
      aoMudar(await organizacao.avaliarLugar(lugar.id, Number(f.get("nota")), f.getAll("problema").map(String)));
    } catch (x) {
      setErro(fraseDoErro(t, x));
    }
  }
  return (
    <form className="or-form" onSubmit={enviar} aria-label={preencher(m.avaliarEm, { nome: lugar.nome })}>
      {erro && <p className="or-erro" role="alert">{erro}</p>}
      <fieldset>
        <legend>{m.nota}</legend>
        <div className="or-acoes">
          {[1, 2, 3, 4, 5].map((n) => <label key={n} className="or-opcao"><input type="radio" name="nota" value={n} required />{n}</label>)}
        </div>
      </fieldset>
      <fieldset>
        <legend>{m.quaisProblemas}</legend>
        {PROBLEMAS_DO_LUGAR[lugar.tipo].map((p) => <label key={p} className="or-opcao"><input type="checkbox" name="problema" value={p} />{(m.problemas as Record<string, string>)[p] ?? p}</label>)}
      </fieldset>
      <div className="or-acoes"><Botao type="submit" tamanho="p">{m.avaliar}</Botao></div>
    </form>
  );
}

export function AbaTermometro({ t, lang }: PropsDaAbaSolta) {
  const [busca, setBusca] = useState<{ municipio: string; uf: string } | null>(null);
  const [dado, setDado] = useState<Lugares | null>(null);
  const [mensagem, setMensagem] = useState<{ texto: string; erro: boolean } | null>(null);
  const [abrir, setAbrir] = useState(false);
  const id = useId();
  const m = t.termometro;
  const tipos = m.tipos as Record<string, string>;

  async function procurar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const b = { municipio: String(f.get("municipio") ?? ""), uf: String(f.get("uf") ?? "") };
    try {
      setDado(await organizacao.lugares(b.municipio, b.uf));
      setBusca(b);
      setMensagem(null);
    } catch (x) {
      setMensagem({ texto: fraseDoErro(t, x), erro: true });
    }
  }

  async function criar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!busca) return;
    const f = new FormData(e.currentTarget);
    try {
      const l = await organizacao.criarLugar({ tipo: String(f.get("tipo")), nome: String(f.get("nome") ?? ""), municipio: busca.municipio, uf: busca.uf });
      setDado((d) => (d ? { ...d, lugares: [...d.lugares.filter((x) => x.id !== l.id), l] } : d));
      setAbrir(false);
    } catch (x) {
      setMensagem({ texto: fraseDoErro(t, x), erro: true });
    }
  }

  const trocar = (l: LugarDoTermometro) => {
    setDado((d) => (d ? { ...d, lugares: d.lugares.map((x) => (x.id === l.id ? l : x)) } : d));
    setMensagem({ texto: m.avaliado, erro: false });
  };

  return (
    <section className="or-bloco" aria-labelledby={`${id}-t`}>
      <h2 id={`${id}-t`} className="or-subtitulo">{m.titulo}</h2>
      <p className="or-miudo">{m.sobre}</p>
      <form className="or-escolha" onSubmit={procurar} aria-label={m.procurar}>
        <label>{m.municipio}<input type="text" name="municipio" required minLength={2} maxLength={80} style={{ minHeight: 44 }} /></label>
        <label>{m.uf}<select name="uf" required defaultValue="">{["", ...UFS].map((u) => <option key={u} value={u}>{u || "—"}</option>)}</select></label>
        <Botao type="submit">{m.procurar}</Botao>
      </form>
      {mensagem && <p className={mensagem.erro ? "or-erro" : "or-ok"} role={mensagem.erro ? "alert" : "status"}>{mensagem.texto}</p>}
      {dado && (abrir ? (
        <form className="or-form" onSubmit={criar} aria-label={m.novo}>
          <label>{m.tipo}<select name="tipo" defaultValue="ubs">{TIPOS_DE_LUGAR.map((k) => <option key={k} value={k}>{tipos[k]}</option>)}</select></label>
          <label>{m.nome}<input type="text" name="nome" required minLength={3} maxLength={100} placeholder={m.exemploNome} /></label>
          <div className="or-acoes">
            <Botao type="submit">{t.comum.salvar}</Botao>
            <Botao type="button" variante="fantasma" onClick={() => setAbrir(false)}>{t.comum.cancelar}</Botao>
          </div>
        </form>
      ) : (
        <div className="or-acoes"><Botao variante="contorno" onClick={() => setAbrir(true)}>{m.novo}</Botao></div>
      ))}
      {dado && dado.lugares.length === 0 && <p className="or-miudo">{m.vazio}</p>}
      {dado && dado.lugares.length > 0 && (
        <ul className="or-lista">
          {dado.lugares.map((l) => {
            const denuncia = denunciaColetiva(l, { tipos, problemas: m.problemas as Record<string, string>, modelo: m.modelo });
            return (
              <li key={l.id} className="or-cartao">
                <p className="or-etiqueta">{tipos[l.tipo]}</p>
                <h3>{l.nome}</h3>
                {l.resultado ? (
                  <>
                    <p><span className="or-numero">{preencher(m.media, { nota: Number(l.resultado.nota).toLocaleString(lang), n: l.resultado.avaliacoes })}</span></p>
                    {Object.keys(l.resultado.problemas).length > 0 && (
                      <ul className="or-lista">{Object.entries(l.resultado.problemas).map(([p, n]) => <li key={p}>{(m.problemas as Record<string, string>)[p] ?? p}: <span className="or-numero">{n}</span></li>)}</ul>
                    )}
                  </>
                ) : <p className="or-miudo">{m.poucas}</p>}
                {l.avaliei ? <p className="or-miudo">{m.jaAvaliou}</p> : <Avaliar t={t} lugar={l} aoMudar={trocar} />}
                {denuncia && <div className="or-acoes"><Botao variante="contorno" tamanho="p" onClick={() => void mostrarParaCopiar(m.denuncia, denuncia)}>{m.denuncia}</Botao></div>}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
