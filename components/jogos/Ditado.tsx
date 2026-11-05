// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState } from "react";
import { fill } from "@/i18n/config";
import { compararDitado, criarSorteio, ehPalavraSimples, primeiraFrase, sementeNova, sortear, type Verbete } from "@/lib/jogos/base";
import { Acoes, Aviso, Botao, LinkDaAula, Opcoes, Quadro, type PropsDoJogo } from "./comum";

/** Fala o texto com a voz em português do próprio navegador (speechSynthesis). Devolve false se o aparelho não tem voz. */
function falar(texto: string, devagar: boolean): boolean {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return false;
  const fala = new SpeechSynthesisUtterance(texto);
  fala.lang = "pt-BR";
  fala.rate = devagar ? 0.55 : 0.9;
  const vozes = window.speechSynthesis.getVoices();
  const voz = vozes.find((v) => v.lang.toLowerCase().startsWith("pt-br")) ?? vozes.find((v) => v.lang.toLowerCase().startsWith("pt"));
  if (voz) fala.voice = voz;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(fala);
  return true;
}

function sortearItem(verbetes: Verbete[], modo: "palavras" | "frases"): { texto: string; verbete: Verbete } {
  const rnd = criarSorteio(sementeNova());
  if (modo === "palavras") {
    const v = sortear(verbetes.filter((x) => ehPalavraSimples(x.termo) && x.termo.length >= 5), 1, rnd)[0] ?? verbetes[0];
    return { texto: v.termo, verbete: v };
  }
  const v = sortear(verbetes.filter((x) => { const f = primeiraFrase(x.resumo, 120); return f.length >= 25 && f.length <= 100 && f.endsWith("."); }), 1, rnd)[0] ?? verbetes[0];
  return { texto: primeiraFrase(v.resumo, 120), verbete: v };
}

/** Ditado: o navegador lê a palavra ou a frase do glossário em voz alta e a pessoa escreve. Sem voz, mostra o texto. */
export function Ditado({ verbetes, s, lang }: PropsDoJogo) {
  const [modo, setModo] = useState<"palavras" | "frases">("palavras");
  const [item, setItem] = useState(() => sortearItem(verbetes, "palavras"));
  const [escrito, setEscrito] = useState("");
  const [resultado, setResultado] = useState<"certo" | "acento" | "errado" | null>(null);
  const [semVoz, setSemVoz] = useState(() => typeof window !== "undefined" && !("speechSynthesis" in window));
  const [verTexto, setVerTexto] = useState(false);
  const t = s.ditado;

  useEffect(() => {
    return () => window.speechSynthesis?.cancel();
  }, []);

  const outro = (m = modo) => {
    setItem(sortearItem(verbetes, m));
    setEscrito("");
    setResultado(null);
    setVerTexto(false);
  };
  const ouvir = (devagar: boolean) => {
    if (!falar(item.texto, devagar)) setSemVoz(true);
  };
  const aviso = resultado === "certo" ? t.certo : resultado === "acento" ? fill(t.acento, { certa: item.texto }) : resultado === "errado" ? fill(t.errado, { certa: item.texto }) : "";

  return (
    <Quadro>
      <Opcoes nome={t.modo} valor={modo} opcoes={[["palavras", t.palavras], ["frases", t.frases]]} aoEscolher={(m) => { setModo(m); outro(m); }} />
      <p className="mt-3 max-w-2xl text-sm text-ink-soft">{t.instrucao}</p>
      <Acoes>
        <Botao onClick={() => ouvir(false)} disabled={semVoz}>{t.ouvir}</Botao>
        <Botao onClick={() => ouvir(true)} disabled={semVoz}>{t.devagar}</Botao>
        {semVoz && <Botao onClick={() => setVerTexto(true)}>{t.verTexto}</Botao>}
      </Acoes>
      {semVoz && <p className="mt-2 text-sm">{t.semVoz}</p>}
      {verTexto && <p lang="pt-BR" className="mt-2 font-serif text-lg">{item.texto}</p>}
      <label className="mt-4 block text-sm font-bold" htmlFor="campo-ditado">{t.campo}</label>
      <input
        id="campo-ditado"
        lang="pt-BR"
        value={escrito}
        onChange={(e) => { setEscrito(e.target.value); setResultado(null); }}
        onKeyDown={(e) => { if (e.key === "Enter" && escrito.trim()) setResultado(compararDitado(escrito, item.texto)); }}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        className="mt-1 w-full max-w-xl border-2 border-ink bg-white px-3 py-2 font-serif text-lg"
      />
      <Acoes>
        <Botao onClick={() => setResultado(compararDitado(escrito, item.texto))} disabled={!escrito.trim()}>{s.comum.conferir}</Botao>
        <Botao onClick={() => outro()}>{t.proximo}</Botao>
        {resultado && <LinkDaAula aula={item.verbete.aula} lang={lang} rotulo={s.comum.aula} />}
      </Acoes>
      <Aviso>{aviso}</Aviso>
    </Quadro>
  );
}
