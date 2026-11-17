// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
//
// Encaixe da frente 10D (acervo). Quem junta acrescenta `acervo` à lista de components/rede/encaixes.tsx (import de
// "./comunidades/acervo/encaixe") e faz a página da comunidade desenhar as abas encaixadas que não são a dos atos (hoje
// PaginaDaComunidadeAlumia.tsx só desenha a aba "atos" do encaixe). Pendura:
//   abasDaComunidade  a aba "Acervo": coleções, arquivo por mês, busca dentro da comunidade e exportar (só a moderação);
//   abasDoPerfil      as coleções da pessoa, numa fileira acima das abas do perfil (só aparece se houver coleção, ou para a dona).
// Os documentos e os arquivos do núcleo entram direto na página do núcleo (components/rede/comunidades/Nucleos.tsx, da frente).
// Tudo atrás de "alumia-2" (a casca nova); desligada, o encaixe fica vazio e nada muda.
import dynamic from "next/dynamic";
import { alumia2Ligada } from "@/lib/rede/rotas-novas";
import type { Encaixe } from "../../encaixes";

const NOME: Record<string, { aba: string; perfil: string }> = {
  pt: { aba: "Acervo", perfil: "Coleções" },
  en: { aba: "Archive", perfil: "Collections" },
  es: { aba: "Acervo", perfil: "Colecciones" },
  fr: { aba: "Fonds", perfil: "Collections" },
  ru: { aba: "Архив", perfil: "Подборки" },
  zh: { aba: "资料库", perfil: "合集" },
};
const nome = (lang: string) => NOME[lang] ?? NOME.pt;

const AbaDoAcervo = dynamic(() => import("./AbaDoAcervo").then((m) => m.AbaDoAcervo), { ssr: false });
const ColecoesDoPerfil = dynamic(() => import("./ColecoesDoPerfil").then((m) => m.ColecoesDoPerfil), { ssr: false });

export const encaixe: Encaixe = !alumia2Ligada()
  ? {}
  : {
      abasDaComunidade: [{ chave: "acervo", rotulo: ({ lang }) => nome(lang).aba, Componente: AbaDoAcervo }],
      abasDoPerfil: [{ chave: "colecoes", rotulo: ({ lang }) => nome(lang).perfil, Componente: ColecoesDoPerfil }],
    };
