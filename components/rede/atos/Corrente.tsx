// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// CORRENTE DE SOLIDARIEDADE URGENTE (ALUMIA-FUNCOES-E-IDEIAS §2.1, ideia 7): uma organização com selo pede gente com hora marcada
// ("precisamos de 30 pessoas às 5h na ocupação Esperança") para uma CIDADE ESCRITA. A barra de elos fecha conforme as respostas
// "Eu vou" (só a partir de 3, em passos de 10 %; nunca um número de pessoas, nunca quem). Quando a meta é atingida, a corrente fecha
// com um estalo e para de aparecer. A organização vê o total exato; ninguém mais.
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Botao } from "../ui/Botao";
import { Icone } from "./partes";
import { frase, useCorrentes } from "./usar";
import { elosFechados } from "@/lib/rede/atos/corrente";
import { MOLAS, podeMexer, vibrar } from "@/lib/rede/atos/movimento";
import { dataCurta, dataOk, doCampoLocal } from "@/lib/rede/atos/tempo";
import { atos as cliente } from "@/lib/rede/cliente-atos";
import { preencherAto, type TextosDosAtos } from "@/lib/rede/textos-atos";
import type { Corrente, OrgQuePosso } from "@/lib/rede/tipos-atos";
import "./atos.css";

const ELOS = 10;

/** A barra de elos: 10 elos de corrente; os fechados ficam em pé, travados um no outro; os abertos, soltos e tortos. */
export function BarraDeElos({ elos, fechada, t }: { elos: number | null; fechada: boolean; t: TextosDosAtos }) {
  const n = fechada ? ELOS : elosFechados(elos, ELOS);
  const svg = useRef<SVGSVGElement>(null);
  const antes = useRef<number | null>(null);
  useEffect(() => {
    const velho = antes.current;
    antes.current = n;
    if (velho === null || velho === n || !podeMexer() || !svg.current) return;
    // os elos que acabaram de fechar giram e travam, um depois do outro
    for (let i = Math.min(velho, n); i < Math.max(velho, n); i++) {
      svg.current.querySelector(`[data-elo="${i}"]`)?.animate(
        [{ rotate: n > velho ? "-70deg" : "0deg", scale: n > velho ? 0.6 : 1 }, { rotate: "0deg", scale: 1 }],
        { duration: MOLAS.quique.duracao, easing: MOLAS.quique.easing, delay: (i - Math.min(velho, n)) * 60 },
      );
    }
    // fechou: estalo (a corrente inteira dá um tranco)
    if (fechada) svg.current.animate([{ scale: 1 }, { scale: 1.06 }, { scale: 1 }], { duration: 380, easing: "cubic-bezier(.3,1.6,.5,1)", delay: 260 });
  }, [n, fechada]);
  const rotulo = fechada ? t.corrente.fechada : elos === null ? t.corrente.barraVazia : preencherAto(t.corrente.barra, { pct: Math.round(elos * 100) });
  return (
    <svg ref={svg} className="al-corrente-barra" data-fechada={fechada ? "" : undefined} viewBox={`0 0 ${ELOS * 26 + 8} 30`} role="img" aria-label={rotulo}>
      {Array.from({ length: ELOS }, (_, i) => {
        const fechado = i < n;
        const x = 4 + i * 26;
        return (
          <g key={i} data-elo={i} data-fechado={fechado ? "" : undefined} style={{ transformOrigin: `${x + 15}px 15px` }}>
            <rect
              x={x}
              y={fechado ? 7 : 9}
              width={30}
              height={fechado ? 16 : 12}
              rx={8}
              fill="none"
              strokeWidth={fechado ? 4 : 2.5}
              className="al-corrente-elo"
              transform={fechado ? undefined : `rotate(${i % 2 ? 14 : -14} ${x + 15} 15)`}
              strokeDasharray={fechado ? undefined : "34 10"}
            />
          </g>
        );
      })}
    </svg>
  );
}

function CartaoDaCorrente({ k, t, lang, aoMudar }: { k: Corrente; t: TextosDosAtos; lang: string; aoMudar: (k: Corrente) => void }) {
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [fechouAgora, setFechouAgora] = useState(false);
  const cartao = useRef<HTMLElement>(null);
  const antes = useRef(k.fechada);
  // fechou agora (a meta foi atingida com esta tela aberta): um clarão dourado varre o cartão, e o aviso diz que fechou
  useEffect(() => {
    const era = antes.current;
    antes.current = k.fechada;
    if (era || !k.fechada) return;
    queueMicrotask(() => setFechouAgora(true));
    vibrar([10, 40, 10]);
    if (podeMexer()) {
      cartao.current?.animate(
        [
          { boxShadow: "0 0 0 0 transparent, inset 0 0 0 0 transparent" },
          { boxShadow: "0 0 0 3px var(--al-dourado), inset 0 0 60px color-mix(in srgb, var(--al-dourado) 45%, transparent)", offset: 0.3 },
          { boxShadow: "0 0 0 0 transparent, inset 0 0 0 0 transparent" },
        ],
        { duration: 1300, easing: "cubic-bezier(.2,.7,.3,1)", delay: 300 },
      );
    }
  }, [k.fechada]);
  const alternar = async () => {
    setOcupado(true);
    setErro(null);
    const sim = !k.vou_eu;
    if (sim) vibrar([10]);
    aoMudar({ ...k, vou_eu: sim });
    try {
      aoMudar(await cliente.correnteVou(k.id, sim));
    } catch (e) {
      aoMudar(k);
      setErro(frase(t, e));
    } finally {
      setOcupado(false);
    }
  };
  // a mesma escrita de data dos atos ("qua 11/11, 5h")
  const quando = dataOk(k.quando) ? dataCurta(k.quando, lang) : null;
  return (
    <article ref={cartao} className="al-corrente" data-fechada={k.fechada ? "" : undefined} aria-labelledby={`al-corrente-${k.id}`}>
      <p className="al-corrente-cabeca">
        <span className="al-cond al-corrente-rotulo">{t.corrente.titulo}</span>
        {k.org.handle ? <span className="al-corrente-org">{preencherAto(t.corrente.chama, { handle: k.org.handle })}</span> : null}
      </p>
      <h3 id={`al-corrente-${k.id}`} className="al-corrente-texto">
        {k.texto}
      </h3>
      <p className="al-corrente-meta">
        {quando ? <>{quando} · </> : null}
        {k.cidade} · {preencherAto(t.corrente.meta, { n: k.meta })}
      </p>
      <BarraDeElos elos={k.elos} fechada={k.fechada} t={t} />
      <p className="al-corrente-elos" aria-hidden>
        {k.fechada ? t.corrente.fechada : k.elos === null ? t.corrente.poucos : preencherAto(t.corrente.elos, { pct: Math.round(k.elos * 100) })}
      </p>
      {k.total !== null ? <p className="al-corrente-total">{preencherAto(t.corrente.total, { n: k.total })}</p> : null}
      {k.fechada && !k.vou_eu ? null : (
        <Botao variante={k.vou_eu ? "claro" : "primario"} pressionado={k.vou_eu} aria-busy={ocupado} onClick={() => void alternar()} icone={k.vou_eu ? Icone.visto(18) : undefined} className="al-corrente-botao">
          {k.vou_eu ? t.corrente.voceVai : t.corrente.vou}
        </Botao>
      )}
      <p role="status" className="al-ato-aviso al-corrente-fechou">
        {fechouAgora ? t.corrente.fechouAgora : ""}
      </p>
      {erro ? (
        <p role="alert" className="al-ato-erro">
          {erro}
        </p>
      ) : null}
    </article>
  );
}

/** O formulário de abrir corrente (só para quem gerencia uma organização com selo). */
type CampoDaCorrente = "texto" | "cidade" | "meta" | "hora";
function AbrirCorrente({ t, cidade, orgs, aoAbrir }: { t: TextosDosAtos; cidade: string; orgs: OrgQuePosso[]; aoAbrir: (k: Corrente) => void }) {
  const [aberto, setAberto] = useState(false);
  const [org, setOrg] = useState(orgs[0]?.id ?? "");
  const [texto, setTexto] = useState("");
  const [onde, setOnde] = useState(cidade);
  const [meta, setMeta] = useState("30");
  const [hora, setHora] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  // a validação é nossa (frases nos 6 idiomas, ao lado do campo), não o balão do navegador
  const [ruim, setRuim] = useState<CampoDaCorrente | null>(null);
  const [ok, setOk] = useState(false);
  const base = useId();
  const forma = useRef<HTMLFormElement>(null);
  const botaoAbrir = useRef<HTMLButtonElement>(null);
  const voltar = useRef(false);
  // abrir leva o foco ao primeiro campo; fechar (deixar para depois, Esc ou depois de abrir a corrente) devolve ao botão
  useEffect(() => {
    if (aberto) forma.current?.querySelector<HTMLElement>("select, textarea")?.focus();
    else if (voltar.current) {
      voltar.current = false;
      botaoAbrir.current?.focus();
    }
  }, [aberto]);
  const fechar = () => {
    voltar.current = true;
    setErro(null);
    setRuim(null);
    setAberto(false);
  };
  if (!aberto) {
    return (
      <div className="al-corrente-abrir">
        <Botao ref={botaoAbrir} variante="contorno" onClick={() => setAberto(true)} aria-expanded={false}>
          {t.corrente.abrir}
        </Botao>
        <span role="status" className="al-ato-copiado">
          {ok ? t.corrente.aberta : ""}
        </span>
      </div>
    );
  }
  const conferir = (): [CampoDaCorrente, string] | null => {
    const n = Number(meta);
    if (texto.trim().length < 10) return ["texto", t.corrente.erroTexto];
    if (onde.trim().length < 2) return ["cidade", t.corrente.erroCidade];
    if (!Number.isInteger(n) || n < 3 || n > 5000) return ["meta", t.corrente.erroMeta];
    if (hora) {
      const iso = doCampoLocal(hora);
      if (!iso || new Date(iso).getTime() <= Date.now()) return ["hora", t.corrente.erroHora];
    }
    return null;
  };
  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    const problema = conferir();
    if (problema) {
      setRuim(problema[0]);
      setErro(problema[1]);
      forma.current?.querySelector<HTMLElement>(`[data-campo="${problema[0]}"]`)?.focus();
      return;
    }
    setOcupado(true);
    setErro(null);
    setRuim(null);
    try {
      const k = await cliente.correnteAbrir({ org, texto: texto.trim(), cidade: onde.trim(), meta: Number(meta), quando: hora ? doCampoLocal(hora) : null });
      aoAbrir(k);
      setTexto("");
      setOk(true);
      window.setTimeout(() => setOk(false), 5000);
      fechar();
    } catch (e2) {
      setErro(frase(t, e2));
    } finally {
      setOcupado(false);
    }
  };
  // cada campo diz se está com problema e aponta para a frase do erro
  const marca = (c: CampoDaCorrente) => ({
    "data-campo": c,
    "aria-invalid": ruim === c || undefined,
    "aria-describedby": ruim === c ? `${base}-erro` : undefined,
  });
  const mudou = (c: CampoDaCorrente) => {
    if (ruim === c) {
      setRuim(null);
      setErro(null);
    }
  };
  return (
    <form
      ref={forma}
      className="al-corrente-form"
      onSubmit={enviar}
      noValidate
      aria-labelledby={`${base}-t`}
      onKeyDown={(e) => {
        if (e.key === "Escape" && !ocupado) {
          e.preventDefault();
          fechar();
        }
      }}
    >
      <h3 id={`${base}-t`} className="al-cond">
        {t.corrente.abrir}
      </h3>
      <p className="al-atos-ajuda">{t.corrente.abrirAjuda}</p>
      {orgs.length > 1 ? (
        <label>
          {t.corrente.como}
          <select className="al-ato-form-campo" value={org} onChange={(e) => setOrg(e.target.value)}>
            {orgs.map((o) => (
              <option key={o.id} value={o.id}>
                {o.handle ? `@${o.handle}` : o.nome}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <label>
        {t.corrente.texto}
        <textarea
          className="al-ato-form-campo"
          value={texto}
          onChange={(e) => {
            setTexto(e.target.value);
            mudou("texto");
          }}
          maxLength={140}
          rows={2}
          placeholder={t.corrente.textoExemplo}
          {...marca("texto")}
        />
      </label>
      <div className="al-corrente-form-linha">
        <label>
          {t.corrente.cidade}
          <input
            className="al-ato-form-campo"
            value={onde}
            onChange={(e) => {
              setOnde(e.target.value);
              mudou("cidade");
            }}
            maxLength={80}
            autoComplete="address-level2"
            {...marca("cidade")}
          />
        </label>
        <label>
          {t.corrente.metaRotulo}
          <input
            className="al-ato-form-campo"
            type="number"
            inputMode="numeric"
            min={3}
            max={5000}
            value={meta}
            onChange={(e) => {
              setMeta(e.target.value);
              mudou("meta");
            }}
            {...marca("meta")}
          />
        </label>
        <label>
          {t.corrente.horaRotulo}
          <input
            className="al-ato-form-campo"
            type="datetime-local"
            value={hora}
            onChange={(e) => {
              setHora(e.target.value);
              mudou("hora");
            }}
            {...marca("hora")}
          />
        </label>
      </div>
      <div className="al-ato-org-botoes">
        <Botao type="submit" variante="primario" aria-busy={ocupado} disabled={ocupado}>
          {t.corrente.publicar}
        </Botao>
        <Botao variante="fantasma" onClick={fechar} disabled={ocupado}>
          {t.corrente.deixar}
        </Botao>
      </div>
      {erro ? (
        <p id={`${base}-erro`} role="alert" className="al-ato-erro">
          {erro}
        </p>
      ) : null}
    </form>
  );
}

/** As correntes abertas da cidade escrita (tela dos atos e coluna da direita). Sem corrente e sem poder abrir: nada aparece. */
/**
 * `dobra`: o título de um cartão recolhível (a tela dos atos põe as correntes dobradas embaixo do próximo ato, para o fim da tela
 * continuar sendo o próximo ato e o gesto de passar não brigar com elas). A contagem é de correntes, nunca de pessoas.
 */
export function Correntes({ t, lang, cidade, logado, podeAbrir = true, compacta = false, dobra }: { t: TextosDosAtos; lang: string; cidade: string | null; logado: boolean; podeAbrir?: boolean; compacta?: boolean; dobra?: string }) {
  const { lista, trocar, juntar } = useCorrentes(cidade, logado);
  const [orgs, setOrgs] = useState<OrgQuePosso[]>([]);
  useEffect(() => {
    if (!logado || !podeAbrir) return;
    let vivo = true;
    cliente
      .correntePosso()
      .then((o) => vivo && setOrgs(o))
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [logado, podeAbrir]);
  const visiveis = (lista ?? []).filter((k) => !k.fechada || k.vou_eu);
  if (!cidade || (!visiveis.length && !orgs.length)) return null;
  const secao = (
    <section className={`al-correntes${compacta ? " al-correntes-compacta" : ""}`} aria-label={t.corrente.titulo}>
      {visiveis.map((k) => (
        <CartaoDaCorrente key={k.id} k={k} t={t} lang={lang} aoMudar={trocar} />
      ))}
      {orgs.length && !compacta ? <AbrirCorrente t={t} cidade={cidade} orgs={orgs} aoAbrir={juntar} /> : null}
    </section>
  );
  if (!dobra) return secao;
  return (
    <details className="al-correntes-dobra">
      <summary>
        <span className="al-correntes-dobra-elo" aria-hidden>
          {Icone.corrente(20)}
        </span>
        <span className="al-correntes-dobra-titulo">{dobra}</span>
        {visiveis.length ? <span className="al-correntes-dobra-n">{visiveis.length}</span> : null}
      </summary>
      {secao}
    </details>
  );
}
