// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import dynamic from "next/dynamic";
import type { ContextoDoEncaixe, Encaixe } from "../encaixes";

/**
 * Encaixe dos meus dados (onda 8, frente 8C): a seção de Ajustes com o caminho para /alumia/meus-dados (baixar uma cópia e apagar
 * a conta). Abre com a Alumia nova, como a página.
 */
const NOME: Record<string, string> = { pt: "Meus dados", en: "My data", es: "Mis datos", fr: "Mes données", ru: "Мои данные", zh: "我的数据" };

const SecaoNosAjustes = dynamic(() => import("./SecaoNosAjustes"), { ssr: false });

export const encaixe: Encaixe = {
  secoesDeAjustes: [{ chave: "meus-dados", titulo: ({ lang }) => NOME[lang] ?? NOME.pt, Componente: SecaoNosAjustes as React.ComponentType<ContextoDoEncaixe> }],
};
