// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useMemo, useRef, useState } from "react";
import { fill } from "@/i18n/config";
import { criarSorteio, mascarar, palavrasParaLetras, primeiraFrase, sementeNova, soLetras, sortear } from "@/lib/jogos/base";
import { gerarCruzadas, type Cruzadas as Jogo } from "@/lib/jogos/grades";
import { Acoes, Aviso, Botao, LinkDaAula, Quadro, type PropsDoJogo } from "./comum";

function montar(verbetes: PropsDoJogo["verbetes"]) {
  const rnd = criarSorteio(sementeNova());
  const palavras = palavrasParaLetras(verbetes, 4, 9);
  for (let i = 0; i < 6; i++) {
    const itens = sortear(palavras, 14, rnd).map((p) => ({ palavra: p.palavra, dica: mascarar(primeiraFrase(p.resumo, 120), p.termo), aula: p.aula }));
    const jogo = gerarCruzadas(itens, rnd);
    if (jogo && jogo.entradas.length >= 5) return { jogo, aulas: new Map(itens.map((x) => [x.palavra, x.aula])) };
  }
  return null;
}

/** Palavras cruzadas: as palavras são termos do glossário e as dicas, as definições com o termo escondido. */
export function Cruzadas({ verbetes, s, lang }: PropsDoJogo) {
  const [partida, setPartida] = useState(() => montar(verbetes));
  const [digitado, setDigitado] = useState<Record<string, string>>({});
  const [conferido, setConferido] = useState(false);
  const [aviso, setAviso] = useState("");
  const celulas = useRef(new Map<string, HTMLInputElement>());
  const direcao = useRef<"H" | "V">("H");
  const t = s.cruzadas;

  const jogo: Jogo | null = partida?.jogo ?? null;
  const chave = (r: number, c: number) => `${r},${c}`;
  const novo = () => {
    setPartida(montar(verbetes));
    setDigitado({});
    setConferido(false);
    setAviso("");
  };
  const foco = (r: number, c: number) => celulas.current.get(chave(r, c))?.focus();
  const andar = (r: number, c: number, dr: number, dc: number) => {
    if (!jogo) return;
    let rr = r + dr;
    let cc = c + dc;
    while (rr >= 0 && rr < jogo.linhas && cc >= 0 && cc < jogo.colunas) {
      if (jogo.letras[rr][cc]) return foco(rr, cc);
      rr += dr;
      cc += dc;
    }
  };

  const estado = useMemo(() => {
    if (!jogo) return { certas: 0, erradas: new Set<string>(), total: 0 };
    let certas = 0;
    let total = 0;
    const erradas = new Set<string>();
    jogo.letras.forEach((linha, r) => linha.forEach((letra, c) => {
      if (!letra) return;
      total++;
      const v = digitado[chave(r, c)];
      if (v === letra) certas++;
      else if (v) erradas.add(chave(r, c));
    }));
    return { certas, erradas, total };
  }, [jogo, digitado]);
  const completo = estado.total > 0 && estado.certas === estado.total;

  if (!jogo || !partida) {
    return (
      <Quadro>
        <p>{t.semPalavras}</p>
        <Acoes><Botao onClick={novo}>{s.comum.novo}</Botao></Acoes>
      </Quadro>
    );
  }

  const aoDigitar = (r: number, c: number, valor: string) => {
    const letra = soLetras(valor).slice(-1);
    setDigitado((d) => ({ ...d, [chave(r, c)]: letra }));
    setConferido(false);
    if (letra) {
      // Segue na direção da palavra: horizontal se a casa da direita é uma casa de letra, senão vertical.
      const dirH = jogo.letras[r][c + 1] ? "H" : jogo.letras[r + 1]?.[c] ? "V" : direcao.current;
      const dir = direcao.current === "V" && jogo.letras[r + 1]?.[c] ? "V" : dirH;
      direcao.current = dir;
      if (dir === "H") andar(r, c, 0, 1);
      else andar(r, c, 1, 0);
    }
  };
  const aoTecla = (e: React.KeyboardEvent, r: number, c: number) => {
    const mapa: Record<string, [number, number]> = { ArrowRight: [0, 1], ArrowLeft: [0, -1], ArrowDown: [1, 0], ArrowUp: [-1, 0] };
    if (mapa[e.key]) {
      e.preventDefault();
      direcao.current = e.key === "ArrowRight" || e.key === "ArrowLeft" ? "H" : "V";
      andar(r, c, ...mapa[e.key]);
    } else if (e.key === "Backspace" && !digitado[chave(r, c)]) {
      e.preventDefault();
      if (direcao.current === "H") andar(r, c, 0, -1);
      else andar(r, c, -1, 0);
    }
  };
  const conferir = () => {
    setConferido(true);
    if (completo) setAviso(t.completo);
    else setAviso(t.faltam);
  };
  const mostrar = () => {
    const tudo: Record<string, string> = {};
    jogo.letras.forEach((linha, r) => linha.forEach((l, c) => l && (tudo[chave(r, c)] = l)));
    setDigitado(tudo);
    setConferido(false);
  };
  const lista = (dir: "H" | "V") => jogo.entradas.filter((e) => e.dir === dir);

  return (
    <Quadro>
      <p className="max-w-2xl text-sm text-ink-soft">{t.instrucao}</p>
      <div className="mt-4 flex flex-col gap-6 lg:flex-row">
        <div className="overflow-x-auto pb-2" lang="pt-BR">
          <div role="group" aria-label={s.treino.jogos.cruzadas.nome} className="grid w-max gap-0.5" style={{ gridTemplateColumns: `repeat(${jogo.colunas}, 2.25rem)` }}>
            {jogo.letras.flatMap((linha, r) =>
              linha.map((letra, c) => {
                if (!letra) return <span key={chave(r, c)} aria-hidden className="h-9 w-9 bg-ink/85" />;
                const k = chave(r, c);
                const errada = conferido && estado.erradas.has(k);
                const numero = jogo.numeros[r][c];
                return (
                  <span key={k} className="relative h-9 w-9">
                    {numero > 0 && <span aria-hidden className="pointer-events-none absolute left-0.5 top-0 font-mono text-[0.6rem] leading-none text-ink-soft">{numero}</span>}
                    <input
                      ref={(el) => {
                        if (el) celulas.current.set(k, el);
                        else celulas.current.delete(k);
                      }}
                      value={digitado[k] ?? ""}
                      maxLength={2}
                      autoComplete="off"
                      autoCapitalize="characters"
                      spellCheck={false}
                      aria-label={`${fill(t.casa, { r: r + 1, c: c + 1 })}${numero ? `, ${fill(t.numero, { n: numero })}` : ""}`}
                      aria-invalid={errada || undefined}
                      onChange={(e) => aoDigitar(r, c, e.target.value)}
                      onKeyDown={(e) => aoTecla(e, r, c)}
                      onFocus={(e) => e.target.select()}
                      className={`h-9 w-9 border-2 bg-white text-center font-mono text-base font-bold uppercase text-ink focus:outline-2 focus:outline-offset-1 focus:outline-prelo-texto ${errada ? "border-[#c21f16] bg-[#fde8e6]" : "border-ink"}`}
                    />
                  </span>
                );
              }),
            )}
          </div>
        </div>
        <div className="grid flex-1 gap-4 text-sm sm:grid-cols-2 lg:grid-cols-1" lang="pt-BR">
          {(["H", "V"] as const).map((dir) => (
            <section key={dir}>
              <h4 className="font-mono text-xs font-bold uppercase tracking-[0.12em]">{dir === "H" ? t.horizontais : t.verticais}</h4>
              <ul className="mt-1.5 space-y-1.5">
                {lista(dir).map((e) => (
                  <li key={`${e.numero}${dir}`}>
                    <strong>{e.numero}.</strong> {e.dica} <span className="text-ink-soft">({e.palavra.length})</span>{" "}
                    {conferido && completo && <LinkDaAula aula={partida.aulas.get(e.palavra)} lang={lang} rotulo={s.comum.aula} />}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
      <Acoes>
        <Botao onClick={conferir}>{s.comum.conferir}</Botao>
        <Botao onClick={mostrar}>{s.comum.mostrar}</Botao>
        <Botao onClick={novo}>{s.comum.novo}</Botao>
      </Acoes>
      <Aviso tom={aviso === t.completo ? "fim" : aviso === t.faltam ? "erro" : undefined}>{aviso}</Aviso>
    </Quadro>
  );
}
