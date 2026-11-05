// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// O movimento do painel (Framer Motion, pelo pacote "motion"). Tudo passa pelo MotionConfig da casca
// (reducedMotion="user"; no modo leve, "always"), então quem pediu menos movimento não vê nada se mexer.
// As seções usam só estes ajudantes ou m.* (de "motion/react-m"), nunca motion.*: a casca carrega os recursos sob
// demanda com LazyMotion strict.

import { AnimatePresence, type Transition } from "motion/react";
import * as m from "motion/react-m";
import { Children, isValidElement, type ReactNode } from "react";

/** As molas do painel: o menu, as entradas rápidas (contador, estrela) e as suaves (paleta, folha do celular). */
export const mola = {
  menu: { type: "spring", stiffness: 380, damping: 36, mass: 0.9 },
  rapida: { type: "spring", stiffness: 520, damping: 40 },
  suave: { type: "spring", stiffness: 260, damping: 30 },
} satisfies Record<string, Transition>;

/** A curva das transições curtas (a mesma das entradas em CSS). */
export const curva = [0.2, 0.7, 0.2, 1] as const;

/** Entra com opacidade e um deslize curto para cima. */
export function Surgir({ children, atraso = 0, className, as = "div" }: { children: ReactNode; atraso?: number; className?: string; as?: "div" | "section" | "li" }) {
  const Elemento = as === "section" ? m.section : as === "li" ? m.li : m.div;
  return (
    <Elemento className={className} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18, ease: curva, delay: atraso }}>
      {children}
    </Elemento>
  );
}

/**
 * Lista em que o item removido sai com altura e opacidade (e o novo entra). Cada filho precisa de "key"; com as="ul"
 * ou "ol", cada filho já vai dentro de um <li> (não mande <li>).
 * Ex.: <ListaAnimada as="ul" className="pn-lista">{itens.map((i) => <ItemDeLista key={i.id} … />)}</ListaAnimada>
 */
export function ListaAnimada({ children, as = "div", className, rotulo }: { children: ReactNode; as?: "div" | "ul" | "ol"; className?: string; rotulo?: string }) {
  const Caixa = as;
  const Item = as === "div" ? m.div : m.li;
  const itens = Children.toArray(children).filter(isValidElement);
  return (
    <Caixa className={className} aria-label={rotulo}>
      <AnimatePresence initial={false}>
        {itens.map((filho) => (
          <Item
            key={filho.key ?? undefined}
            style={{ overflow: "hidden" }}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.18, ease: curva }}
          >
            {filho}
          </Item>
        ))}
      </AnimatePresence>
    </Caixa>
  );
}

/** Número que muda com um pulinho de escala (0,8 para 1). O leitor de tela lê o número normal. */
export function ContagemAnimada({ valor, className }: { valor: number | string; className?: string }) {
  return (
    <AnimatePresence initial={false} mode="popLayout">
      <m.span key={String(valor)} className={className} initial={{ scale: 0.8, opacity: 0.4 }} animate={{ scale: 1, opacity: 1 }} exit={{ opacity: 0 }} transition={mola.rapida}>
        {valor}
      </m.span>
    </AnimatePresence>
  );
}
