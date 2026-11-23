// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// 59. Rota do ato sem internet. Quem chama o ato põe a rota (um GPX de um mapa livre, ou "lat, lon" por linha) e os pontos de apoio do
// percurso; quem vai guarda a rota neste aparelho antes de sair e vê o desenho sem internet. Nada pede a posição do aparelho, e o
// desenho não busca mapa em lugar nenhum (só a linha, o começo, o fim e os apoios). O guardado fica numa chave que o Sair rápido apaga.
import { useEffect, useId, useState, type ChangeEvent, type FormEvent } from "react";
import { organizacao, type AtoParaRota, type RotaVista } from "@/lib/rede/organizacao/cliente";
import {
  desenhoDaRota, distanciaKm, esquecerRota, gpxParaRota, guardarRota, lerRotasGuardadas, linhasParaPontos, TIPOS_DE_APOIO_DA_ROTA,
  type ApoioDaRota, type AtoDaRota, type RotaDoAto, type RotaGuardada,
} from "@/lib/rede/organizacao/regras";
import { idOk } from "@/lib/rede/tipos";
import { preencher } from "@/lib/rede/preencher";
import { Botao } from "../ui/Botao";
import type { PropsDaAbaSolta } from "./TelaDaOrganizacao";
import { diaEHora, fraseDoErro, type TextosDaOrganizacao } from "./textos";
import { useCarga } from "./usar";

const armazem = () => {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

/** O desenho da rota (SVG, sem mapa de fundo) e a lista dos apoios. */
export function DesenhoDaRota({ t, rota, titulo }: { t: TextosDaOrganizacao; rota: RotaDoAto; titulo: string }) {
  const d = desenhoDaRota(rota);
  const tipos = t.rota.tipos as Record<string, string>;
  if (!d) return null;
  return (
    <figure className="or-bloco" style={{ margin: 0 }}>
      <svg className="or-mapa" viewBox="0 0 320 320" role="img" aria-label={preencher(t.rota.desenho, { titulo, km: distanciaKm(rota.pontos) })}>
        <polyline points={d.linha} />
        <circle cx={d.inicio[0]} cy={d.inicio[1]} r={7} />
        <text x={d.inicio[0] + 9} y={d.inicio[1] - 6}>{t.rota.saida}</text>
        <circle cx={d.fim[0]} cy={d.fim[1]} r={7} />
        <text x={d.fim[0] + 9} y={d.fim[1] - 6}>{t.rota.chegada}</text>
        {d.apoios.map((a) => (
          <g key={a.n}>
            <rect x={a.x - 8} y={a.y - 8} width={16} height={16} rx={3} fill="var(--al-superficie)" stroke="currentColor" />
            <text x={a.x} y={a.y + 4} textAnchor="middle">{a.n}</text>
          </g>
        ))}
      </svg>
      <figcaption className="or-miudo">{preencher(t.rota.km, { km: distanciaKm(rota.pontos) })} {t.rota.semMapa}</figcaption>
      {rota.apoios.length > 0 && (
        <ol className="or-lista" style={{ listStyle: "decimal", paddingLeft: "1.5rem" }}>
          {rota.apoios.map((a, i) => <li key={i}>{a.nome} ({tipos[a.tipo] ?? a.tipo})</li>)}
        </ol>
      )}
    </figure>
  );
}

function Editor({ t, ato, rota, aoSalvar }: { t: TextosDaOrganizacao; ato: string; rota: RotaDoAto | null; aoSalvar: (r: RotaVista) => void }) {
  const [texto, setTexto] = useState(() => (rota?.pontos ?? []).map((p) => p.join(", ")).join("\n"));
  const [apoios, setApoios] = useState<ApoioDaRota[]>(rota?.apoios ?? []);
  const [mensagem, setMensagem] = useState<{ texto: string; erro: boolean } | null>(null);
  const id = useId();
  const r = t.rota;

  async function lerArquivo(e: ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    if (!arquivo || arquivo.size > 5_000_000) return;
    const lida = gpxParaRota(await arquivo.text());
    if (lida.pontos.length < 2) return setMensagem({ texto: r.gpxVazio, erro: true });
    setTexto(lida.pontos.map((p) => p.join(", ")).join("\n"));
    if (lida.apoios.length) setApoios(lida.apoios);
    setMensagem({ texto: preencher(r.gpxLido, { n: lida.pontos.length, a: lida.apoios.length }), erro: false });
  }

  function porApoio(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const [p] = linhasParaPontos(String(f.get("onde") ?? ""));
    if (!p) return setMensagem({ texto: r.coordenadaRuim, erro: true });
    setApoios((a) => [...a, { lat: p[0], lon: p[1], tipo: String(f.get("tipo") ?? "outro"), nome: String(f.get("nome") ?? "").trim() }].slice(0, 30));
    e.currentTarget.reset();
  }

  async function salvar() {
    try {
      aoSalvar(await organizacao.salvarRota(ato, { pontos: linhasParaPontos(texto), apoios }));
      setMensagem({ texto: r.salva, erro: false });
    } catch (x) {
      setMensagem({ texto: fraseDoErro(t, x), erro: true });
    }
  }

  return (
    <div className="or-form">
      <p className="or-miudo">{r.comoDesenhar}</p>
      {mensagem && <p className={mensagem.erro ? "or-erro" : "or-ok"} role={mensagem.erro ? "alert" : "status"}>{mensagem.texto}</p>}
      <label htmlFor={`${id}-gpx`}>{r.gpx}<input id={`${id}-gpx`} type="file" accept=".gpx,application/gpx+xml,application/xml,text/xml" onChange={lerArquivo} /></label>
      <label htmlFor={`${id}-pts`}>{r.pontos}<textarea id={`${id}-pts`} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="-23.5505, -46.6333" spellCheck={false} /></label>
      <form className="or-bloco" onSubmit={porApoio} aria-label={r.novoApoio}>
        <label>{r.apoioNome}<input type="text" name="nome" required minLength={2} maxLength={80} /></label>
        <label>{r.apoioTipo}
          <select name="tipo" defaultValue="agua">{TIPOS_DE_APOIO_DA_ROTA.map((k) => <option key={k} value={k}>{(r.tipos as Record<string, string>)[k]}</option>)}</select>
        </label>
        <label>{r.apoioOnde}<input type="text" name="onde" required placeholder="-23.5498, -46.6350" /></label>
        <div className="or-acoes"><Botao type="submit" variante="contorno" tamanho="p">{r.novoApoio}</Botao></div>
      </form>
      {apoios.length > 0 && (
        <ul className="or-lista">
          {apoios.map((a, i) => (
            <li key={i} className="or-acoes"><span>{i + 1}. {a.nome}</span><Botao variante="fantasma" tamanho="p" onClick={() => setApoios((x) => x.filter((_, j) => j !== i))}>{t.comum.tirar}</Botao></li>
          ))}
        </ul>
      )}
      <div className="or-acoes"><Botao onClick={salvar}>{r.salvar}</Botao></div>
    </div>
  );
}

export function AbaRota({ t, lang }: PropsDaAbaSolta) {
  const [guardadas, setGuardadas] = useState<RotaGuardada[]>([]);
  const [escolhido, setEscolhido] = useState<string | null>(null);
  const { dado: atos, erro: erroAtos } = useCarga<AtoParaRota[]>("rota-atos", () => organizacao.rotaAtos());
  const { dado: vista, erro, trocar } = useCarga<RotaVista>(escolhido ? `rota-${escolhido}` : null, () => organizacao.rota(escolhido as string));
  const [mensagem, setMensagem] = useState<string | null>(null);
  const id = useId();
  const r = t.rota;

  useEffect(() => {
    const ato = new URLSearchParams(window.location.search).get("ato");
    queueMicrotask(() => {
      setGuardadas(lerRotasGuardadas(armazem()));
      if (ato && idOk(ato)) setEscolhido(ato);
    });
  }, []);

  const guardar = (ato: AtoDaRota, rota: RotaDoAto) => {
    setGuardadas(guardarRota(armazem(), { ato, rota }));
    setMensagem(r.guardada);
  };

  return (
    <section className="or-bloco" aria-labelledby={`${id}-t`}>
      <h2 id={`${id}-t`} className="or-subtitulo">{r.titulo}</h2>
      <p className="or-miudo">{r.sobre}</p>
      {mensagem && <p className="or-ok" role="status">{mensagem}</p>}
      {guardadas.length > 0 && (
        <>
          <h3 className="or-etiqueta">{r.noAparelho}</h3>
          <ul className="or-lista">
            {guardadas.map((g) => (
              <li key={g.ato.id} className="or-cartao">
                <h3>{g.ato.titulo}</h3>
                <p className="or-miudo">{diaEHora(lang, g.ato.inicio)} · {g.ato.ponto}, {g.ato.cidade}</p>
                <DesenhoDaRota t={t} rota={g.rota} titulo={g.ato.titulo} />
                <div className="or-acoes"><Botao variante="fantasma" tamanho="p" onClick={() => setGuardadas(esquecerRota(armazem(), g.ato.id))}>{r.esquecer}</Botao></div>
              </li>
            ))}
          </ul>
        </>
      )}
      {erroAtos ? <p className="or-miudo">{r.semInternet}</p> : null}
      {atos && atos.length === 0 && <p className="or-miudo">{r.nenhumAto}</p>}
      {atos && atos.length > 0 && (
        <div className="or-escolha">
          <label htmlFor={`${id}-ato`}>{r.qualAto}
            <select id={`${id}-ato`} value={escolhido ?? ""} onChange={(e) => setEscolhido(e.target.value || null)}>
              <option value="">{r.escolha}</option>
              {atos.map((a) => <option key={a.id} value={a.id}>{a.titulo} · {diaEHora(lang, a.inicio)}{a.chamo ? ` (${r.voceChama})` : ""}</option>)}
            </select>
          </label>
        </div>
      )}
      {erro ? <p className="or-erro" role="alert">{fraseDoErro(t, erro)}</p> : null}
      {vista && (
        <div className="or-cartao">
          <h3>{vista.ato.titulo}</h3>
          <p className="or-miudo">{diaEHora(lang, vista.ato.inicio)} · {vista.ato.ponto}, {vista.ato.cidade}</p>
          {vista.rota ? <DesenhoDaRota t={t} rota={vista.rota} titulo={vista.ato.titulo} /> : <p className="or-miudo">{r.semRota}</p>}
          {vista.rota && <div className="or-acoes"><Botao onClick={() => guardar(vista.ato, vista.rota as RotaDoAto)}>{r.guardar}</Botao></div>}
          {vista.posso_desenhar && <Editor key={vista.ato.id} t={t} ato={vista.ato.id} rota={vista.rota} aoSalvar={trocar} />}
        </div>
      )}
    </section>
  );
}
