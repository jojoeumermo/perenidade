// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// O nome do Vale o Escrito no menu e a frase de uma linha, nos 6 idiomas. Separado dos JSON completos
// (i18n/vale-o-escrito/) para o menu do topo, que é componente de cliente, não baixar os seis arquivos.
// Só pt é texto final; en, es, fr, ru e zh são rascunho até a revisão (docs/vale-o-escrito/ESPEC.md, seção 8).

export const ROTA_DO_OBSERVATORIO = "/vale-o-escrito";

export const MENU_DO_OBSERVATORIO: Record<string, { rotulo: string; descricao: string }> = {
  pt: { rotulo: "Vale o Escrito", descricao: "A teia do poder no Brasil: casos já registrados em fonte pública, com a situação jurídica escrita" },
  en: { rotulo: "Vale o Escrito", descricao: "Brazil's web of power: cases already on the public record, with legal status stated" },
  es: { rotulo: "Vale o Escrito", descricao: "La red del poder en Brasil: casos ya registrados en fuentes públicas, con la situación jurídica escrita" },
  fr: { rotulo: "Vale o Escrito", descricao: "La toile du pouvoir au Brésil : des cas déjà consignés dans des sources publiques, avec la situation juridique" },
  ru: { rotulo: "Vale o Escrito", descricao: "Паутина власти в Бразилии: случаи из открытых источников с указанием юридического статуса" },
  zh: { rotulo: "Vale o Escrito", descricao: "巴西权力之网：已见于公开来源的案件，并写明法律状态" },
};

export const menuDoObservatorio = (lang: string) => MENU_DO_OBSERVATORIO[lang] ?? MENU_DO_OBSERVATORIO.pt;
