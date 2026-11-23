// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// O radar de projetos de lei (Prompt 4, item 90) e os modelos de documento (91). O que a pessoa segue fica SÓ neste aparelho
// (CHAVE_DO_RADAR, que o Sair rápido apaga); para cada projeto, a tela pede a situação à nossa rota (sem cookie), que busca nos
// dados abertos da Câmara ou do Senado e guarda na borda. Os documentos são montados aqui e não saem do aparelho.
import { useEffect, useId, useMemo, useState } from "react";
import {
  andou, CHAVE_DO_RADAR, chaveDoProjeto, lerProjeto, lerSeguidos, MAXIMO_SEGUIDOS, MODELOS, montarDocumento, prazoDaLai, dataPorExtenso,
  type Casa, type Modelo, type Seguido, type Situacao,
} from "@/lib/rede/coletiva/regras";
import { Botao } from "../ui/Botao";
import { com, escapar, imprimirSozinho, type TextosDaColetiva } from "./textos";

type Props = { t: TextosDaColetiva; lang: string };

function lerDoAparelho(): Seguido[] {
  try {
    return lerSeguidos(localStorage.getItem(CHAVE_DO_RADAR));
  } catch {
    return [];
  }
}
function guardarNoAparelho(lista: Seguido[]) {
  try {
    if (lista.length) localStorage.setItem(CHAVE_DO_RADAR, JSON.stringify(lista));
    else localStorage.removeItem(CHAVE_DO_RADAR);
  } catch {
    // sem armazenamento (janela anônima): o radar vale só enquanto a tela estiver aberta
  }
}

// ───── 90 · Radar de projetos de lei ─────
export function AbaLeis({ t }: Props) {
  const id = useId();
  // A tela só roda no aparelho (registro com ssr: false): a lista vem do armazenamento já no primeiro desenho.
  const [seguidos, setSeguidos] = useState<Seguido[]>(lerDoAparelho);
  const [situacoes, setSituacoes] = useState<Record<string, Situacao | null | "falhou">>({});
  const [casa, setCasa] = useState<Casa>("camara");
  const [numero, setNumero] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const chaves = seguidos.map((s) => s.chave).join("|");
  useEffect(() => {
    let vivo = true;
    for (const chave of chaves ? chaves.split("|") : []) {
      fetch(`/api/rede/coletiva/radar?p=${encodeURIComponent(chave)}`, { credentials: "omit" })
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
        .then((j: { situacao: Situacao | null }) => vivo && setSituacoes((s) => ({ ...s, [chave]: j.situacao })))
        .catch(() => vivo && setSituacoes((s) => ({ ...s, [chave]: "falhou" })));
    }
    return () => { vivo = false; };
  }, [chaves]);
  const mudar = (lista: Seguido[]) => { setSeguidos(lista); guardarNoAparelho(lista); };
  return (
    <section className="ac-bloco" aria-labelledby={`${id}-t`} data-item="90">
      <h2 id={`${id}-t`} className="ac-subtitulo">{t.leis.titulo}</h2>
      <p className="ac-miudo">{t.leis.sobre}</p>
      <form className="ac-form" onSubmit={(e) => {
        e.preventDefault();
        const p = lerProjeto(numero, casa);
        if (!p) return setErro(t.leis.invalido);
        if (seguidos.length >= MAXIMO_SEGUIDOS) return setErro(t.leis.maximo);
        const chave = chaveDoProjeto(p);
        setErro(null);
        setNumero("");
        if (!seguidos.some((s) => s.chave === chave)) mudar([...seguidos, { chave, visto: "" }]);
      }}>
        <label>{t.leis.casa}
          <select value={casa} onChange={(e) => setCasa(e.target.value as Casa)}>
            {(["camara", "senado"] as const).map((c) => <option key={c} value={c}>{t.leis.casas[c]}</option>)}
          </select>
        </label>
        <label>{t.leis.numero}<input type="text" value={numero} onChange={(e) => setNumero(e.target.value)} maxLength={20} autoComplete="off" /></label>
        <div className="ac-acoes"><Botao type="submit">{t.leis.seguir}</Botao></div>
      </form>
      {erro && <p className="ac-erro" role="alert">{erro}</p>}
      {!seguidos.length && <p className="ac-miudo">{t.leis.vazio}</p>}
      <ul className="ac-lista">
        {seguidos.map((s) => {
          const sit = situacoes[s.chave];
          const [c, sigla, n, ano] = s.chave.split(":");
          const atual = sit && sit !== "falhou" ? sit : null;
          return (
            <li key={s.chave} className="ac-cartao">
              <p className="ac-etiqueta">{t.leis.casas[c as Casa]}{atual && s.visto && andou(s, atual) ? ` · ${t.leis.andou}` : ""}</p>
              <h3>{sigla} {n}/{ano}</h3>
              {sit === undefined ? <p className="ac-miudo" role="status">{t.comum.carregando}</p>
                : atual ? (
                  <>
                    {atual.ementa && <p>{atual.ementa}</p>}
                    <p className="ac-miudo">{[atual.situacao, atual.orgao, atual.quando.slice(0, 10)].filter(Boolean).join(" · ")}</p>
                  </>
                ) : <p className="ac-miudo">{t.leis.semSituacao}</p>}
              <div className="ac-acoes">
                {atual && andou(s, atual) && <Botao variante="contorno" onClick={() => mudar(seguidos.map((x) => (x.chave === s.chave ? { ...x, visto: atual.quando } : x)))}>{t.leis.visto}</Botao>}
                {atual?.link && <a className="ac-link" href={atual.link} target="_blank" rel="noopener noreferrer nofollow">{t.leis.fonte}</a>}
                <Botao variante="fantasma" onClick={() => mudar(seguidos.filter((x) => x.chave !== s.chave))}>{t.leis.parar}</Botao>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// ───── 91 · Modelos de documento ─────
export function AbaDocumentos({ t }: Props) {
  const id = useId();
  const [modelo, setModelo] = useState<Modelo>("lai");
  const [dados, setDados] = useState({ quem: "", para: "", assunto: "", texto: "", cidade: "" });
  const [copiado, setCopiado] = useState(false);
  const hoje = useMemo(() => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date()), []);
  const documento = montarDocumento(modelo, dados, hoje);
  const prazo = prazoDaLai(hoje);
  const campo = (k: keyof typeof dados) => ({ value: dados[k], onChange: (e: { target: { value: string } }) => { setDados((d) => ({ ...d, [k]: e.target.value })); setCopiado(false); } });
  async function copiar() {
    try {
      await navigator.clipboard.writeText(documento);
      setCopiado(true);
    } catch {
      setCopiado(false);
    }
  }
  const baixar = `data:text/plain;charset=utf-8,${encodeURIComponent(documento)}`;
  return (
    <section className="ac-bloco" aria-labelledby={`${id}-t`} data-item="91">
      <h2 id={`${id}-t`} className="ac-subtitulo">{t.documentos.titulo}</h2>
      <p className="ac-miudo">{t.documentos.sobre}</p>
      <form className="ac-form" onSubmit={(e) => e.preventDefault()}>
        <label>{t.documentos.modelo}
          <select value={modelo} onChange={(e) => setModelo(e.target.value as Modelo)}>
            {MODELOS.map((m) => <option key={m} value={m}>{t.documentos.modelos[m]}</option>)}
          </select>
        </label>
        <label>{t.documentos.quem}<input type="text" maxLength={160} {...campo("quem")} /></label>
        <label>{t.documentos.para}<input type="text" maxLength={200} {...campo("para")} /></label>
        <label>{t.documentos.assunto}<input type="text" maxLength={200} {...campo("assunto")} /></label>
        <label>{t.documentos.texto}<textarea maxLength={6000} {...campo("texto")} /></label>
        <label>{t.comum.cidade}<input type="text" maxLength={80} {...campo("cidade")} /></label>
      </form>
      {modelo === "lai" && <p className="ac-miudo">{com(t.documentos.prazo, { resposta: dataPorExtenso(prazo.resposta), prorrogada: dataPorExtenso(prazo.prorrogada) })}</p>}
      <h3 className="ac-subtitulo">{t.documentos.pronto}</h3>
      <pre className="ac-documento" aria-label={t.documentos.pronto}>{documento}</pre>
      <div className="ac-acoes">
        <Botao variante="contorno" onClick={copiar}>{t.comum.copiar}</Botao>
        <a className="al-botao al-botao-contorno al-botao-m" href={baixar} download={`${modelo}.txt`}>{t.comum.baixar}</a>
        <Botao variante="contorno" onClick={() => imprimirSozinho(t.documentos.modelos[modelo], `<pre>${escapar(documento)}</pre>`, "@page{margin:2.5cm}pre{font:12pt/1.6 serif;white-space:pre-wrap}")}>{t.comum.imprimir}</Botao>
        {copiado && <span className="ac-ok" role="status">{t.comum.copiado}</span>}
      </div>
    </section>
  );
}
