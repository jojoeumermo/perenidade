// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// A primeira vez na Alumia (P5, A12): no alto do Início, para quem entrou, um passeio de quatro passos (a linha, as comunidades,
// os núcleos e as turmas, a Segurança) que dá para pular a qualquer hora; depois, a lista de primeiros passos (o rosto, duas
// comunidades, gente dos pacotes, o botão de Segurança), que a pessoa marca e esconde quando quiser.
// O que já foi visto e marcado fica só neste aparelho (localStorage, uma conveniência): nada vai ao servidor, nada vira perfil de
// comportamento. Sem armazenamento (janela anônima), o passeio aparece de novo e continua dando para pular.
import "./lei.css";
import { useId, useState } from "react";
import Link from "@/components/Link";
import { localePath } from "@/i18n/config";
import type { ContextoDoEncaixe } from "../encaixes";
import { por } from "./textos";
import { useTextosDaLei } from "./usarTextos";

const CHAVE = "alumia:primeira-vez:1";

type Fase = "passeio" | "lista" | "fim";
interface Guardado {
  fase: Fase;
  feitos: number[];
}

function lerGuardado(): Guardado {
  try {
    const bruto = window.localStorage.getItem(CHAVE);
    const lido = bruto ? (JSON.parse(bruto) as Partial<Guardado>) : null;
    const fase: Fase = lido?.fase === "lista" || lido?.fase === "fim" ? lido.fase : "passeio";
    const feitos = Array.isArray(lido?.feitos) ? lido.feitos.filter((n): n is number => Number.isInteger(n) && n >= 0 && n < 10) : [];
    return { fase, feitos };
  } catch {
    return { fase: "passeio", feitos: [] };
  }
}

function guardar(g: Guardado) {
  try {
    window.localStorage.setItem(CHAVE, JSON.stringify(g));
  } catch {
    // sem armazenamento: só não lembra depois de recarregar
  }
}

export default function PrimeiraVez({ lang, situacao }: ContextoDoEncaixe) {
  const t = useTextosDaLei(lang);
  // Só no navegador (o encaixe carrega sem servidor): lê o que ficou guardado neste aparelho.
  const [estado, setEstado] = useState<Guardado>(lerGuardado);
  const [passo, setPasso] = useState(0);
  const id = useId();

  if (!situacao.logado || !situacao.membro || !t || estado.fase === "fim") return null;
  const p = t.primeiraVez;
  const mudar = (g: Guardado) => {
    guardar(g);
    setEstado(g);
  };
  const link = (href: string) => localePath(lang, href);

  if (estado.fase === "passeio") {
    const atual = p.passos[passo];
    const ultimo = passo === p.passos.length - 1;
    return (
      <section className="le-pv" aria-labelledby={`${id}-t`} aria-describedby={`${id}-d`}>
        <p className="le-pv-alto">
          <span>{p.rotulo}</span>
          <span aria-live="polite">{por(p.passo, { n: passo + 1, total: p.passos.length })}</span>
        </p>
        <h2 id={`${id}-t`} className="al-cond">{atual.titulo}</h2>
        <p id={`${id}-d`}>{atual.texto}</p>
        {atual.links.length > 0 && (
          <p className="le-pv-links">
            {atual.links.map((l) => (
              <Link key={l.href} href={link(l.href)}>{l.rotulo}</Link>
            ))}
          </p>
        )}
        <ol className="le-pv-pontos" aria-hidden>
          {p.passos.map((_, i) => (
            <li key={i} data-atual={i === passo || undefined} />
          ))}
        </ol>
        <div className="le-pv-acoes">
          <button type="button" className="al-botao al-botao-contorno al-botao-m" onClick={() => mudar({ ...estado, fase: "lista" })}>
            {p.pular}
          </button>
          <span className="le-pv-avanco">
            {passo > 0 && (
              <button type="button" className="al-botao al-botao-claro al-botao-m" onClick={() => setPasso(passo - 1)}>
                {p.voltar}
              </button>
            )}
            <button type="button" className="al-botao al-botao-primario al-botao-m" onClick={() => (ultimo ? mudar({ ...estado, fase: "lista" }) : setPasso(passo + 1))}>
              {ultimo ? p.comecar : p.proximo}
            </button>
          </span>
        </div>
      </section>
    );
  }

  const l = p.lista;
  const todos = l.itens.every((_, i) => estado.feitos.includes(i));
  const marcar = (i: number, feito: boolean) =>
    mudar({ ...estado, feitos: feito ? [...new Set([...estado.feitos, i])] : estado.feitos.filter((n) => n !== i) });
  return (
    <section className="le-pv" aria-labelledby={`${id}-t`}>
      <p className="le-pv-alto">
        <span>{p.rotulo}</span>
      </p>
      <h2 id={`${id}-t`} className="al-cond">{l.titulo}</h2>
      <p>{todos ? l.pronto : l.texto}</p>
      <ul className="le-pv-lista">
        {l.itens.map((item, i) => (
          <li key={item.link}>
            <input id={`${id}-${i}`} type="checkbox" checked={estado.feitos.includes(i)} onChange={(e) => marcar(i, e.target.checked)} />
            <label htmlFor={`${id}-${i}`} className="sr-only">{item.texto}</label>
            <Link href={link(item.link)} data-feito={estado.feitos.includes(i) || undefined}>{item.texto}</Link>
          </li>
        ))}
      </ul>
      <div className="le-pv-acoes">
        <button type="button" className="al-botao al-botao-claro al-botao-m" onClick={() => { setPasso(0); mudar({ ...estado, fase: "passeio" }); }}>
          {l.rever}
        </button>
        <button type="button" className="al-botao al-botao-contorno al-botao-m" onClick={() => mudar({ ...estado, fase: "fim" })}>
          {l.esconder}
        </button>
      </div>
    </section>
  );
}
