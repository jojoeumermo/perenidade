// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import type { ContextoDoEncaixe, Encaixe } from "../encaixes";
import { atosNovos } from "@/lib/rede/atos/novos";
import { rotaNovaLigada } from "@/lib/rede/rotas-novas";
import type { DadosDoAto } from "@/lib/rede/tipos-atos";

/**
 * Encaixe da F2 (atos e organizar na rua): o que esta frente pendura nas telas comuns. As telas comuns só montam o encaixe com
 * a flag "alumia-2" ligada (casca nova da F1); desligada, nada daqui aparece. Regras do PLANO-ALUMIA §6: nenhuma lista de quem
 * confirmou, o mosaico mostra proporção e só a partir de 3, "Perto" é a cidade escrita (nada de GPS).
 *
 *   menu               "Chamados" passa a levar a /alumia/atos, com o nome "Atos" (prancha computador-inicio);
 *   anexosDoCartao     o chamado embutido no post ("16 NOV · Panfletagem no RU · Eu vou");
 *   tiposDoCompositor  o tipo "Ato" (prancha celular-escrever-ato);
 *   antesDePublicar    não deixa sair um ato com campo faltando (o servidor confere de novo);
 *   abasDaComunidade   a aba "Atos" da comunidade;
 *   colunaDireita      "Atos perto de você".
 * O emblema do item Atos ("2" no menu do computador; o ponto dourado na barra do celular) é quantos atos de quem a pessoa segue
 * ainda não apareceram na tela dos atos neste aparelho (lib/rede/atos/novos.ts).
 *
 * A faixa PRÓXIMO ATO + cartão do ato do alto do Início saem daqui como `TopoDoInicioEncaixado` (o contrato da F0 não tem um
 * ponto para o alto da linha): na junta, o TopoDaLinha2 da F1 troca os dublês FaixaProximoAtoDuble/CartaoDoAtoDuble por ele,
 * só na aba "Seguindo". Com as flags desligadas é nulo.
 */

// Só o nome do menu e do tipo, nos 6 idiomas (o resto dos textos vem sob demanda de i18n/rede/atos/).
const NOME: Record<string, { menu: string; tipo: string }> = {
  pt: { menu: "Atos", tipo: "Ato" },
  en: { menu: "Actions", tipo: "Action" },
  es: { menu: "Actos", tipo: "Acto" },
  fr: { menu: "Actions", tipo: "Action" },
  ru: { menu: "Акции", tipo: "Акция" },
  zh: { menu: "行动", tipo: "行动" },
};
const nome = (lang: string) => NOME[lang] ?? NOME.pt;

const FormularioDoAto = dynamic(() => import("./FormularioDoAto").then((m) => m.FormularioDoAto), { ssr: false });
const AnexoChamado = dynamic(() => import("./AnexoChamado").then((m) => m.AnexoChamado), { ssr: false });
const AtosPerto = dynamic(() => import("./AtosPerto").then((m) => m.AtosPerto), { ssr: false });
const AbaDosAtos = dynamic(() => import("./AbaDosAtos").then((m) => m.AbaDosAtos), { ssr: false });

const AVISO_DO_ATO: Record<string, string> = {
  pt: "Falta preencher o ato: nome, quando, onde, cidade e chamado.",
  en: "The action is incomplete: name, when, where, city and call.",
  es: "Falta completar el acto: nombre, cuándo, dónde, ciudad y convocatoria.",
  fr: "L'action est incomplète : nom, quand, où, ville et appel.",
  ru: "Акция не заполнена: название, когда, где, город и призыв.",
  zh: "行动还没填完：名称、时间、地点、城市和号召。",
};

/**
 * Com as flags desligadas ("rede-v2", "alumia-2" e a da rota "atos"), o encaixe fica VAZIO: o item "Chamados" continua como hoje
 * (apagado) e nada mais aparece. A leitura é a da montagem (NEXT_PUBLIC_RECURSOS), a mesma que o navegador enxerga.
 */
const LIGADO = rotaNovaLigada("atos");

export const encaixe: Encaixe = !LIGADO ? {} : {
  menu: [
    {
      chave: "atos",
      substitui: "chamados",
      rotulo: ({ lang }) => nome(lang).menu,
      icone: (
        <svg aria-hidden viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 21V4M5 5h13l-2.5 4 2.5 4H5" />
        </svg>
      ),
      href: ({ lang }) => `/${lang}/alumia/atos`,
      emblema: ({ situacao }) => (situacao.logado ? atosNovos() : null),
    },
  ],
  anexosDoCartao: [AnexoChamado],
  tiposDoCompositor: [{ tipo: "ato", rotulo: ({ lang }) => nome(lang).tipo, Formulario: FormularioDoAto }],
  antesDePublicar: [
    async (pedido, { lang }) => {
      if (pedido.tipo !== "ato") return { ok: true };
      const d = pedido.extras as Partial<DadosDoAto>;
      return d.pronto ? { ok: true } : { ok: false, aviso: AVISO_DO_ATO[lang] ?? AVISO_DO_ATO.pt, bloqueia: true };
    },
  ],
  abasDaComunidade: [{ chave: "atos", rotulo: ({ lang }) => nome(lang).menu, Componente: AbaDosAtos }],
  colunaDireita: [AtosPerto],
};

/** O alto do Início (faixa PRÓXIMO ATO + cartão do ato). Nulo com as flags desligadas: quem monta não mostra nada. */
export const TopoDoInicioEncaixado: ComponentType<ContextoDoEncaixe> | null = !LIGADO
  ? null
  : dynamic(() => import("./TopoDoInicio").then((m) => m.TopoDoInicio), { ssr: false });
