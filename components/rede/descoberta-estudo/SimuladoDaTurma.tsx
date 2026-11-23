// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// Item 69: o simulado ao vivo da turma (as turmas da onda 11). Quem cuida abre com questões do banco e um prazo; cada pessoa responde
// até o fim. No fim, o banco apaga as respostas e guarda só a faixa de cada questão (e só com 3 pessoas ou mais); a pessoa confere a
// dela neste aparelho, com o gabarito. Nenhum placar, nenhum nome, nenhum número de pessoas.
import { useId, useState } from "react";
import Link from "@/components/Link";
import { de, type Simulado } from "@/lib/rede/descoberta-estudo/cliente";
import { acertos, guardarRespostas, minhasRespostas } from "@/lib/rede/descoberta-estudo/simulado";
import { Botao } from "../ui/Botao";
import { Bloco, Mensagem, fraseDoErro, por, useAcao, useLeitura, type PropsDaParte, type T } from "./comum";

const LETRAS = ["A", "B", "C", "D", "E"];
const hora = (lang: string, iso: string) => new Intl.DateTimeFormat(lang, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

function Aberto({ s, t, lang, depois }: { s: Simulado; t: T; lang: string; depois: () => void }) {
  const [resp, setResp] = useState<number[]>(() => minhasRespostas(s.id) ?? s.questoes.map(() => -1));
  const acao = useAcao(t, depois);
  const k = t.simulado;
  return (
    <div className="de-bloco">
      <p className="de-miudo">{por(k.ate, { hora: hora(lang, s.fecha) })}{s.respondi ? ` · ${k.respondido}` : ""}</p>
      {s.questoes.map((q, i) => (
        <fieldset key={q.id} className="de-pergunta">
          <legend>{`${i + 1}. ${q.enunciado}`}</legend>
          {q.alternativas.map((alt, j) => (
            <label key={j} className="de-marca">
              <input type="radio" name={`de-sim-${s.id}-${i}`} checked={resp[i] === j} onChange={() => setResp(resp.map((x, n) => (n === i ? j : x)))} />
              <span>{`${LETRAS[j]}) ${alt}`}</span>
            </label>
          ))}
        </fieldset>
      ))}
      <Botao disabled={acao.ocupado} onClick={() => void acao.fazer(async () => {
        guardarRespostas(s.id, resp);
        await de.responderSimulado(s.id, resp);
        return k.enviado;
      })}>{s.respondi ? k.trocar : k.enviar}</Botao>
      <Mensagem mensagem={acao.mensagem} />
    </div>
  );
}

function Fechado({ s, t }: { s: Simulado; t: T }) {
  const k = t.simulado;
  const minhas = minhasRespostas(s.id);
  const n = acertos(s.questoes, minhas);
  return (
    <div className="de-bloco">
      {n !== null ? <p className="de-texto">{por(k.voce, { n, total: s.questoes.length })}</p> : <p className="de-miudo">{k.semAsSuas}</p>}
      {!s.resultado && <p className="de-miudo">{k.semResultado}</p>}
      <ol className="de-lista">
        {s.questoes.map((q, i) => (
          <li key={q.id} className="de-item">
            <strong>{q.enunciado}</strong>
            {typeof q.certa === "number" && <span>{por(k.gabarito, { letra: LETRAS[q.certa], alternativa: q.alternativas[q.certa] ?? "" })}</span>}
            {minhas && minhas[i] >= 0 && <span className="de-miudo">{por(k.suaResposta, { letra: LETRAS[minhas[i]] })}</span>}
            {q.faixa && <span className="de-etiqueta">{k.faixas[q.faixa]}</span>}
            {q.explicacao && <p className="de-miudo">{q.explicacao}</p>}
          </li>
        ))}
      </ol>
    </div>
  );
}

function Abrir({ turma, t, depois }: { turma: string; t: T; depois: () => void }) {
  const id = useId();
  const k = t.simulado;
  const banco = useLeitura("banco", () => de.bancoDeQuestoes(null));
  const [titulo, setTitulo] = useState("");
  const [minutos, setMinutos] = useState(60);
  const [escolhidas, setEscolhidas] = useState<string[]>([]);
  const acao = useAcao(t, depois);
  return (
    <div className="de-form">
      <h3 className="de-form-titulo">{k.abrirTitulo}</h3>
      <label className="de-campo" htmlFor={`${id}-t`}><span>{k.nome}</span><input id={`${id}-t`} className="al2-campo" value={titulo} maxLength={80} onChange={(e) => setTitulo(e.target.value)} /></label>
      <label className="de-campo" htmlFor={`${id}-m`}>
        <span>{k.duracao}</span>
        <select id={`${id}-m`} className="al2-campo" value={minutos} onChange={(e) => setMinutos(Number(e.target.value))}>
          {[15, 30, 45, 60, 90, 120, 180].map((m) => <option key={m} value={m}>{por(k.minutos, { n: m })}</option>)}
        </select>
      </label>
      <fieldset className="de-pergunta">
        <legend>{por(k.questoes, { n: escolhidas.length })}</legend>
        {!banco.dado ? <p className="de-miudo">{t.carregando}</p> : banco.dado.itens.map((q) => (
          <label key={q.id} className="de-marca">
            <input type="checkbox" checked={escolhidas.includes(q.id)} onChange={(e) => setEscolhidas(e.target.checked ? [...escolhidas, q.id].slice(0, 20) : escolhidas.filter((x) => x !== q.id))} />
            <span>{q.enunciado}</span>
          </label>
        ))}
      </fieldset>
      <Botao disabled={acao.ocupado || escolhidas.length < 3} onClick={() => void acao.fazer(async () => {
        await de.abrirSimulado(turma, titulo, escolhidas, minutos);
        setEscolhidas([]);
        setTitulo("");
        return k.aberto;
      })}>{k.abrir}</Botao>
      <Mensagem mensagem={acao.mensagem} />
    </div>
  );
}

export default function SimuladoDaTurma({ t, lang }: PropsDaParte) {
  const id = useId();
  const k = t.simulado;
  const inicio = useLeitura("inicio", () => de.inicio());
  const [escolhida, setEscolhida] = useState<string | null>(null);
  const turmas = inicio.dado?.turmas ?? [];
  const turma = escolhida ?? turmas[0]?.id ?? null;
  const lista = useLeitura(turma ? `sim:${turma}` : null, () => de.simulados(turma ?? ""));
  const acao = useAcao(t, lista.recarregar);
  if (inicio.erro) return <p className="de-erro" role="alert">{fraseDoErro(t, inicio.erro)}</p>;
  if (!inicio.dado) return <p role="status" className="de-miudo">{t.carregando}</p>;
  if (!turma) return <Bloco titulo={k.titulo} ajuda={k.ajuda}><p className="de-miudo">{k.semTurma} <Link href={`/${lang}/alumia/turmas`}>{k.turmas}</Link></p></Bloco>;
  return (
    <div className="de-colunas">
      <Bloco titulo={k.titulo} ajuda={k.ajuda}>
        <label className="de-campo de-campo-comunidade" htmlFor={`${id}-turma`}>
          <span>{k.turma}</span>
          <select id={`${id}-turma`} className="al2-campo" value={turma} onChange={(e) => setEscolhida(e.target.value)}>
            {turmas.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}
          </select>
        </label>
        {lista.erro ? <p className="de-erro" role="alert">{fraseDoErro(t, lista.erro)}</p> : !lista.dado ? <p role="status" className="de-miudo">{t.carregando}</p> : lista.dado.itens.length === 0 ? <p className="de-miudo">{k.nenhum}</p> : (
          <ul className="de-lista">
            {lista.dado.itens.map((s) => (
              <li key={s.id} className="de-item">
                <strong className="de-item-titulo">{s.titulo}</strong>
                {s.fechado ? <Fechado s={s} t={t} /> : <Aberto s={s} t={t} lang={lang} depois={lista.recarregar} />}
                {!s.fechado && lista.dado?.cuido && <Botao variante="fantasma" disabled={acao.ocupado} onClick={() => void acao.fazer(async () => (await de.encerrarSimulado(s.id), k.encerrado))}>{k.encerrar}</Botao>}
              </li>
            ))}
          </ul>
        )}
        <Mensagem mensagem={acao.mensagem} />
        <p className="de-miudo">{k.privacidade}</p>
      </Bloco>
      {lista.dado?.cuido && <Abrir turma={turma} t={t} depois={lista.recarregar} />}
    </div>
  );
}
