// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useState } from "react";
import catalogo from "@/content/labs-externos/catalogo.json";
import { useI18n } from "../I18n";
import { GraficoOwid } from "./GraficoOwid";

type Forma = "local" | "sob-demanda" | "link";
interface Texto { descricao: string; aviso: string }
interface Lab {
  id: string;
  nome: string;
  areas: string[];
  forma: Forma;
  url: string;
  pagina: string;
  licenca: string;
  credito: string;
  conferido_em: string;
  pt: Texto;
  en: Texto;
}

export type AreaLab = "seguranca" | "sistemas" | "sociais" | "simulacoes" | "matematica" | "musica";

// Os textos de interface em es/fr/ru/zh são rascunho (as descrições dos laboratórios ficam em pt e en).
const TEXTOS: Record<string, { abrir: string; fechar: string; link: string; pagina: string; licenca: string; credito: string; local: string; demanda: string; so_link: string; nota: string; vazio: string }> = {
  pt: { abrir: "Abrir", fechar: "Fechar", link: "Abrir o site (nova aba)", pagina: "Página do projeto", licenca: "Licença", credito: "Crédito", local: "Cópia no próprio site, sem rastreio", demanda: "Carrega de fora só quando você abre", so_link: "Só link externo", nota: "Nada é carregado de fora antes de você abrir. Ao abrir um laboratório de fora, o seu navegador fala com o servidor dele.", vazio: "Nenhum laboratório externo ligado a esta área ainda." },
  en: { abrir: "Open", fechar: "Close", link: "Open the site (new tab)", pagina: "Project page", licenca: "Licence", credito: "Credit", local: "Copy hosted on this site, no tracking", demanda: "Loads from outside only when you open it", so_link: "External link only", nota: "Nothing is loaded from outside before you open it. Opening an outside lab makes your browser talk to its server.", vazio: "No external lab linked to this area yet." },
  es: { abrir: "Abrir", fechar: "Cerrar", link: "Abrir el sitio (nueva pestaña)", pagina: "Página del proyecto", licenca: "Licencia", credito: "Crédito", local: "Copia en este sitio, sin rastreo", demanda: "Se carga de fuera solo cuando lo abres", so_link: "Solo enlace externo", nota: "Nada se carga de fuera antes de que lo abras.", vazio: "Aún no hay laboratorios externos en esta área." },
  fr: { abrir: "Ouvrir", fechar: "Fermer", link: "Ouvrir le site (nouvel onglet)", pagina: "Page du projet", licenca: "Licence", credito: "Crédit", local: "Copie sur ce site, sans pistage", demanda: "Chargé de l'extérieur seulement à l'ouverture", so_link: "Lien externe seulement", nota: "Rien n'est chargé de l'extérieur avant que vous ouvriez.", vazio: "Aucun laboratoire externe pour ce domaine pour l'instant." },
  ru: { abrir: "Открыть", fechar: "Закрыть", link: "Открыть сайт (новая вкладка)", pagina: "Страница проекта", licenca: "Лицензия", credito: "Авторство", local: "Копия на этом сайте, без слежки", demanda: "Загружается извне только при открытии", so_link: "Только внешняя ссылка", nota: "Ничего не загружается извне, пока вы не откроете.", vazio: "Пока нет внешних лабораторий для этой области." },
  zh: { abrir: "打开", fechar: "关闭", link: "打开网站（新标签页）", pagina: "项目页面", licenca: "许可", credito: "署名", local: "本站托管副本，无追踪", demanda: "仅在你打开时才从外部加载", so_link: "仅外部链接", nota: "在你打开之前不会从外部加载任何内容。", vazio: "该领域暂无外部实验室。" },
};

/**
 * Laboratórios de terceiros com licença livre ou aberta (veja docs/LABS-EXTERNOS.md). Cada um só carrega quando a pessoa
 * clica em "Abrir": os de cópia local vêm do próprio domínio; os de fora vêm de quem os mantém, sem cópia nem alteração;
 * os "só link" nem chegam a ser embutidos. Sempre com licença e crédito à vista.
 */
export function LabsExternos({ area, compacto = false, ids }: { area?: AreaLab; compacto?: boolean; ids?: string[] }) {
  const { lang } = useI18n();
  const s = TEXTOS[lang] ?? TEXTOS.pt;
  const [aberto, setAberto] = useState<string | null>(null);
  const todos = catalogo as Lab[];
  const lista = ids ? ids.flatMap((id) => todos.filter((l) => l.id === id)) : todos.filter((l) => !area || l.areas.includes(area));
  const comGrafico = !ids && (!area || area === "sociais");
  if (lista.length === 0 && !comGrafico) return <p className="mt-6 text-ink-soft">{s.vazio}</p>;
  return (
    <div className={compacto ? "mt-4 space-y-3" : "mt-8 grid gap-4 md:grid-cols-2"}>
      {lista.map((lab) => {
        const tx = (lang === "pt" ? lab.pt : lab.en) ?? lab.pt;
        const embutido = lab.forma !== "link";
        const marca = lab.forma === "local" ? s.local : lab.forma === "sob-demanda" ? s.demanda : s.so_link;
        return (
          <article key={lab.id} className={`border border-rule bg-parchment-deep p-4 font-sans text-sm ${aberto === lab.id ? "md:col-span-2" : ""}`}>
            <h3 className="font-serif text-lg font-semibold">{lab.nome}</h3>
            <p className="text-ink-soft">{tx.descricao}</p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-ink-soft">{marca}</p>
            {aberto === lab.id && embutido ? (
              <>
                <iframe
                  src={lab.url}
                  title={lab.nome}
                  allowFullScreen
                  loading="lazy"
                  {...(lab.forma === "sob-demanda" ? { sandbox: "allow-scripts allow-same-origin allow-popups allow-forms allow-downloads allow-modals", referrerPolicy: "no-referrer" as const } : {})}
                  className="mt-3 h-[70vh] min-h-[22rem] w-full border-2 border-ink bg-white"
                />
                <button type="button" className="mt-2 cursor-pointer border-2 border-ink px-3 py-1 font-semibold hover:border-oxblood hover:text-oxblood" onClick={() => setAberto(null)}>{s.fechar}</button>
              </>
            ) : embutido ? (
              <button type="button" className="mt-3 cursor-pointer bg-ink px-4 py-2 font-semibold text-parchment hover:bg-oxblood" onClick={() => setAberto(lab.id)}>{s.abrir}</button>
            ) : (
              <a href={lab.url} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block bg-ink px-4 py-2 font-semibold text-parchment hover:bg-oxblood hover:text-parchment">{s.link} ↗</a>
            )}
            {tx.aviso && <p className="mt-3 text-xs text-ink-soft">{tx.aviso}</p>}
            <p className="mt-2 text-xs text-ink-soft">
              {s.credito}: {lab.credito} · {s.licenca}: {lab.licenca} ({lab.conferido_em}) ·{" "}
              <a href={lab.pagina} target="_blank" rel="noopener noreferrer" className="underline hover:text-oxblood">{s.pagina} ↗</a>
            </p>
          </article>
        );
      })}
      {comGrafico && (
        <div className="md:col-span-2">
          <GraficoOwid lang={lang} />
        </div>
      )}
      <p className="text-xs text-ink-soft md:col-span-2">{s.nota}</p>
    </div>
  );
}
