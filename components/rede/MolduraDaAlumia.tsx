// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import type { TextosDaRede } from "@/lib/rede/textos";
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
 * A moldura da Alumia, em todas as telas dela (app/[lang]/comunidade/layout.tsx): uma faixa fina no alto com o botão "Voltar ao
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
            <span className="font-serif text-base font-extrabold tracking-wide">Alumia</span>
            <span className="hidden text-xs opacity-80 md:inline">{s.alumia.lema}</span>
          </p>
        </div>
      </nav>
      {children}
    </div>
  );
}

/** O sinal da Alumia: uma chama pequena (desenho próprio, sem imagem de fora). */
export function MarcaDaAlumia({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className={className}>
      <path d="M12 2.5c1.8 3 5.5 5.6 5.5 10.2A5.5 5.5 0 0 1 12 18.2a5.5 5.5 0 0 1-5.5-5.5c0-2.6 1.4-4.2 2.6-5.4.2 1.6.9 2.8 2.1 3.4C11 8.4 11.3 5.2 12 2.5z" fill="#f0a020" />
      <path d="M12 11c1.1 1.2 2.4 2.3 2.4 4a2.4 2.4 0 0 1-4.8 0c0-1.6 1.3-2.7 2.4-4z" fill="#c21f16" />
      <path d="M7 21h10" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" />
    </svg>
  );
}
