// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { CSSProperties } from "react";
import { NOME_REDE } from "@/lib/rede/alumia";
import type { TextosDaRede } from "@/lib/rede/textos";
import { Lampiao } from "./ui/Lampiao";
import { VoltarAoSite } from "./VoltarAoSite";
// O visual da Alumia (T18): só as telas dela baixam esta folha de estilo.
import "@/styles/alumia.css";

export { enderecoDoSite } from "./VoltarAoSite";

// Enquanto a Alumia está aberta, a casca do site (faixa de avisos, cabeçalho, barra do celular, abas de baixo e rodapé) sai de
// cena: a Alumia é uma rede social à parte, com a própria barra e o botão "Voltar ao site". A saída rápida do modo seguro e o
// widget de acessibilidade continuam (não estão nesta lista), como o "voltar ao topo" e o "Pular para o conteúdo" do site (que leva
// ao <main>, onde a faixa da Alumia é a primeira coisa). Os enfeites do site (o fio das fitas e a festa) também saem.
const SEM_O_SITE = [".cabecalho-site", ".faixa-de-avisos", ".fio-das-fitas", ".festa", ".barra-do-celular", ".abas-do-celular", ".rodape-do-site"]
  .map((seletor) => `body:has(.alumia-moldura) ${seletor}`)
  .join(", ");

/**
 * A moldura da Alumia, em todas as telas dela (app/[lang]/alumia/layout.tsx): uma faixa fina no alto com o botão "Voltar ao
 * site" e o nome da rede. Componente de servidor, sem leitura de disco: só recebe os textos de um idioma.
 */
export function MolduraDaAlumia({ lang, s, children }: { lang: string; s: TextosDaRede; children: React.ReactNode }) {
  return (
    <div className="alumia-moldura">
      <style>{`${SEM_O_SITE} { display: none !important; } body:has(.alumia-moldura) { --altura-topo: 0px; }`}</style>
      <nav aria-label={s.alumia.rotuloDaFaixa} className="no-print border-b-[3px] border-[#c21f16] bg-[#1f1a14] text-[#f4ecd8]">
        <div className="mx-auto flex min-h-11 max-w-[1280px] items-center gap-3 px-4 font-sans text-sm">
          <VoltarAoSite lang={lang} longo={s.alumia.voltarAoSite} curto={s.alumia.voltarCurto} />
          <p className="ml-auto flex items-center gap-2 truncate">
            <MarcaDaAlumia />
            <span className="font-serif text-base font-extrabold tracking-wide">{NOME_REDE}</span>
            <span className="hidden text-xs opacity-80 md:inline">{s.alumia.lema}</span>
          </p>
        </div>
      </nav>
      {children}
    </div>
  );
}

/**
 * O sinal da Alumia na faixa do alto e na casca de hoje: o lampião da marca (components/rede/ui/Lampiao.tsx). Fora da Alumia nova
 * não há os tokens dela, então o papel do lampião é a cor do texto em volta e o vidro deixa ver o fundo: vale no tema claro e no
 * escuro do site. `tamanho` é a altura em pixels.
 */
export function MarcaDaAlumia({ tamanho = 22 }: { tamanho?: number }) {
  return (
    <span className="inline-flex shrink-0" style={{ "--al-texto": "currentColor", "--al-fundo": "transparent" } as CSSProperties}>
      <Lampiao tamanho={tamanho} />
    </span>
  );
}
