// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// Leve e no seu tempo (/alumia/leve), frente 13D. Uma tela só para quem tem pouco pacote, rede fraca ou pouco tempo:
//   · Economia de dados: o modo leve do site (lib/prefs.ts) com o que a Alumia completa (leve.css e NaCasca.tsx);
//   · Escrever leve e a fila "Esperando a rede", que mora só neste aparelho;
//   · Início só em texto;
//   · Tempo de uso: o lembrete de pausa que já existe (B1) e a hora de parar, só neste aparelho;
//   · Silêncio dos avisos: a peça de avisos que já existe (components/rede/avisos/HorarioDeSilencio.tsx), aqui à mão.
import { useEffect, useId, useState } from "react";
import Link from "@/components/Link";
import { pedeEconomia, setPrefs, usePrefs } from "@/lib/prefs";
import { preencher } from "@/lib/rede/preencher";
import { carregarTextosDeAvisos, type TextosDeAvisos } from "@/lib/rede/textos-avisos";
import { useHydrated } from "@/lib/storage";
import { HorarioDeSilencio } from "../avisos/HorarioDeSilencio";
import { EsqueletoDaLinha } from "../Esqueletos";
import { AjusteDaPausa } from "../publicar/alumia2/LembreteDePausa";
import type { PropsDaTelaDoPacote } from "../registro";
import { Botao } from "../ui/Botao";
import { Faixa } from "../ui/Faixa";
import { useHoraDeParar } from "./aparelho";
import { EscreverLeve, FilaDoAparelho } from "./EscreverLeve";
import { LinhaSoTexto } from "./LinhaSoTexto";
import { minutosDoDia } from "./regras";
import { useTextosDoLeve, type TextosDoLeve } from "./textos";
import "./leve.css";

function Economia({ t }: { t: TextosDoLeve["economia"] }) {
  const prefs = usePrefs();
  const [automatico, setAutomatico] = useState(false);
  useEffect(() => {
    const id = window.setTimeout(() => setAutomatico(pedeEconomia()), 0);
    return () => window.clearTimeout(id);
  }, []);
  return (
    <>
      <button type="button" role="switch" aria-checked={prefs.light} className="lv-interruptor" onClick={() => setPrefs({ light: !prefs.light })}>
        <span className="min-w-0">
          <span className="lv-interruptor-titulo">{t.interruptor}</span>
          <span className="lv-interruptor-estado">{prefs.light ? t.ligada : t.desligada}</span>
        </span>
        <span className="lv-chave" aria-hidden />
      </button>
      {automatico && prefs.light ? <p className="lv-nota">{t.automatico}</p> : null}
    </>
  );
}

function HoraDeParar({ t }: { t: TextosDoLeve["tempo"] }) {
  const id = useId();
  const [hora, mudar] = useHoraDeParar();
  const [rascunho, setRascunho] = useState<string | null>(null);
  const [recado, setRecado] = useState("");
  const valor = rascunho ?? hora ?? "23:00";
  return (
    <div className="lv-caixa">
      <p className="lv-subtitulo" style={{ marginTop: "0.6rem" }}>{t.parar}</p>
      <p className="lv-dica">{t.pararDica}</p>
      <p className="lv-item-estado">{hora ? preencher(t.ligado, { hora }) : t.desligado}</p>
      <div className="lv-campo">
        <label htmlFor={`${id}-hora`}>
          {t.hora}
          <input id={`${id}-hora`} type="time" step={900} className="lv-hora" value={valor} onChange={(e) => setRascunho(e.target.value)} />
        </label>
        <Botao
          variante="contorno"
          tamanho="p"
          onClick={() => {
            if (minutosDoDia(valor) === null) return;
            mudar(valor);
            setRascunho(null);
            setRecado(t.salvo);
          }}
        >
          {t.guardar}
        </Botao>
        {hora ? (
          <Botao
            variante="fantasma"
            tamanho="p"
            onClick={() => {
              mudar(null);
              setRascunho(null);
              setRecado("");
            }}
          >
            {t.tirar}
          </Botao>
        ) : null}
      </div>
      <p className="lv-recado" role="status" aria-live="polite">
        {recado}
      </p>
    </div>
  );
}

function Silencio({ lang, membro, t }: { lang: string; membro: boolean; t: TextosDoLeve["silencio"] }) {
  const [ta, setTa] = useState<TextosDeAvisos | null>(null);
  useEffect(() => {
    let vivo = true;
    void carregarTextosDeAvisos(lang).then((x) => vivo && setTa(x));
    return () => {
      vivo = false;
    };
  }, [lang]);
  if (!membro) return <p className="lv-vazio">{t.visitante}</p>;
  return (
    <>
      <div className="lv-silencio">{ta ? <HorarioDeSilencio t={ta.prefs} membro={membro} /> : null}</div>
      <p className="mt-2">
        <Link href={`/${lang}/alumia/avisos`} className="lv-link">
          {t.abrir}
        </Link>
      </p>
    </>
  );
}

const PARTES = [
  { id: "lv-economia", cor: 1, chave: "economia" },
  { id: "lv-escrever", cor: 2, chave: "escrever" },
  { id: "lv-linha", cor: 3, chave: "linha" },
  { id: "lv-tempo", cor: 4, chave: "tempo" },
  { id: "lv-silencio", cor: 5, chave: "silencio" },
] as const;

export default function TelaLeve({ lang, s, situacao }: PropsDaTelaDoPacote) {
  const t = useTextosDoLeve(lang);
  const montado = useHydrated();
  if (!t || !montado) return <EsqueletoDaLinha rotulo={s.estados.carregando} quantos={3} />;
  const membro = Boolean(situacao.logado && situacao.membro);
  return (
    <section className="lv-tela" aria-labelledby="lv-titulo">
      <Faixa />
      <header className="lv-cabeca">
        <span className="lv-carimbo al-cond">{t.carimbo}</span>
        <h1 id="lv-titulo" className="al-cond lv-titulo">
          {t.titulo}
        </h1>
        <p className="lv-lead">{t.lead}</p>
        <nav aria-label={t.secoes}>
          <ul className="lv-ladrilhos">
            {PARTES.map((p) => (
              <li key={p.id}>
                <a href={`#${p.id}`} className={`lv-ladrilho al-cond lv-cor-${p.cor}`}>
                  {t.atalhos[p.chave]}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <section id="lv-economia" className="lv-bloco lv-cor-1" aria-labelledby="lv-economia-titulo">
        <h2 id="lv-economia-titulo" className="al-cond lv-secao">{t.economia.titulo}</h2>
        <p className="lv-dica">{t.economia.dica}</p>
        <Economia t={t.economia} />
      </section>

      <section id="lv-escrever" className="lv-bloco lv-cor-2" aria-labelledby="lv-escrever-titulo">
        <h2 id="lv-escrever-titulo" className="al-cond lv-secao">{t.escrever.titulo}</h2>
        <p className="lv-dica">{t.escrever.dica}</p>
        <EscreverLeve lang={lang} s={s} situacao={situacao} t={t} />
        <h3 id="lv-fila" className="lv-subtitulo">{t.fila.titulo}</h3>
        <FilaDoAparelho lang={lang} s={s} situacao={situacao} t={t} />
      </section>

      <section id="lv-linha" className="lv-bloco lv-cor-3" aria-labelledby="lv-linha-titulo">
        <h2 id="lv-linha-titulo" className="al-cond lv-secao">{t.linha.titulo}</h2>
        <p className="lv-dica">{t.linha.dica}</p>
        <LinhaSoTexto lang={lang} s={s} situacao={situacao} t={t.linha} />
      </section>

      <section id="lv-tempo" className="lv-bloco lv-cor-4" aria-labelledby="lv-tempo-titulo">
        <h2 id="lv-tempo-titulo" className="al-cond lv-secao">{t.tempo.titulo}</h2>
        <p className="lv-dica">{t.tempo.dica}</p>
        <div className="lv-caixa">
          <AjusteDaPausa />
        </div>
        <HoraDeParar t={t.tempo} />
      </section>

      <section id="lv-silencio" className="lv-bloco lv-cor-5" aria-labelledby="lv-silencio-titulo">
        <h2 id="lv-silencio-titulo" className="al-cond lv-secao">{t.silencio.titulo}</h2>
        <p className="lv-dica">{t.silencio.dica}</p>
        <Silencio lang={lang} membro={membro} t={t.silencio} />
      </section>
    </section>
  );
}
