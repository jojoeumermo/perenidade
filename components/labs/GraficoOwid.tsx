// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import dados from "@/content/labs-externos/owid-expectativa-vida.json";

type Serie = [number, number][];

const TEXTOS: Record<string, { titulo: string; lead: string; tabela: string; ano: string; fonte: string; alt: string }> = {
  pt: { titulo: "Quanto se vive: Brasil e mundo, desde 1950", lead: "Expectativa de vida ao nascer: quantos anos viveria, em média, quem nascesse naquele ano se as chances de morrer em cada idade fossem as daquele ano.", tabela: "Ver os números (tabela)", ano: "Ano", fonte: "Dados", alt: "Gráfico de linhas da expectativa de vida ao nascer, Brasil e mundo, de 1950 a 2023" },
  en: { titulo: "How long people live: Brazil and the world since 1950", lead: "Period life expectancy at birth: the average years a person born that year would live if death rates at each age stayed as in that year.", tabela: "See the numbers (table)", ano: "Year", fonte: "Data", alt: "Line chart of life expectancy at birth, Brazil and the world, 1950 to 2023" },
};

/**
 * Gráfico próprio (SVG, sem biblioteca, sem rastreio) com dados do Our World in Data. Os números foram baixados em 04/11/2026
 * do CSV oficial do gráfico "Life expectancy" e gravados em content/labs-externos/owid-expectativa-vida.json (só de 1950 em diante:
 * série da ONU, World Population Prospects 2024, CC BY 3.0 IGO, processada pelo OWID, CC BY 4.0).
 */
export function GraficoOwid({ lang }: { lang: string }) {
  const s = TEXTOS[lang] ?? (lang === "pt" ? TEXTOS.pt : TEXTOS.en);
  const br = dados.series.Brasil as Serie;
  const mu = dados.series.Mundo as Serie;
  const L = 640, A = 300, mE = 44, mD = 16, mT = 16, mB = 32;
  const x0 = br[0][0], x1 = br[br.length - 1][0];
  const yMin = 40, yMax = 80;
  const px = (a: number) => mE + ((a - x0) / (x1 - x0)) * (L - mE - mD);
  const py = (v: number) => A - mB - ((v - yMin) / (yMax - yMin)) * (A - mB - mT);
  const linha = (d: Serie) => d.map(([a, v], i) => `${i ? "L" : "M"}${px(a).toFixed(1)} ${py(v).toFixed(1)}`).join(" ");
  const anos = [1950, 1970, 1990, 2010, 2023];
  const ultimo = (d: Serie) => d[d.length - 1];
  const decadas = br.filter(([a]) => a % 10 === 0 || a === x1);
  return (
    <figure className="border border-rule bg-parchment-deep p-4 font-sans text-sm">
      <h3 className="font-serif text-lg font-semibold">{s.titulo}</h3>
      <p className="text-ink-soft">{s.lead}</p>
      <svg viewBox={`0 0 ${L} ${A}`} role="img" aria-label={s.alt} className="mt-3 h-auto w-full">
        {[40, 50, 60, 70, 80].map((v) => (
          <g key={v}>
            <line x1={mE} x2={L - mD} y1={py(v)} y2={py(v)} stroke="currentColor" strokeOpacity="0.15" />
            <text x={mE - 6} y={py(v) + 4} textAnchor="end" fontSize="11" fill="currentColor">{v}</text>
          </g>
        ))}
        {anos.map((a) => (
          <text key={a} x={px(a)} y={A - 10} textAnchor="middle" fontSize="11" fill="currentColor">{a}</text>
        ))}
        <path d={linha(mu)} fill="none" stroke="currentColor" strokeWidth="2.5" strokeDasharray="6 4" />
        <path d={linha(br)} fill="none" stroke="#c21f16" strokeWidth="3" />
        <text x={px(ultimo(br)[0]) - 4} y={py(ultimo(br)[1]) - 8} textAnchor="end" fontSize="12" fontWeight="bold" fill="#c21f16">Brasil {ultimo(br)[1]}</text>
        <text x={px(ultimo(mu)[0]) - 4} y={py(ultimo(mu)[1]) + 16} textAnchor="end" fontSize="12" fontWeight="bold" fill="currentColor">{lang === "pt" ? "Mundo" : "World"} {ultimo(mu)[1]}</text>
      </svg>
      <details className="mt-2">
        <summary className="cursor-pointer font-semibold">{s.tabela}</summary>
        <table className="mt-2 w-full max-w-md text-left">
          <thead>
            <tr><th scope="col">{s.ano}</th><th scope="col">Brasil</th><th scope="col">{lang === "pt" ? "Mundo" : "World"}</th></tr>
          </thead>
          <tbody>
            {decadas.map(([a, v]) => (
              <tr key={a}><td>{a}</td><td>{v}</td><td>{mu.find(([b]) => b === a)?.[1]}</td></tr>
            ))}
          </tbody>
        </table>
      </details>
      <figcaption className="mt-3 text-xs text-ink-soft">
        {s.fonte}: Our World in Data (<a href={dados.pagina} target="_blank" rel="noopener noreferrer" className="underline hover:text-oxblood">ourworldindata.org/grapher/life-expectancy ↗</a>), CC BY 4.0; UN WPP (2024), CC BY 3.0 IGO, com processamento do Our World in Data. {dados.baixado_em}.
      </figcaption>
    </figure>
  );
}
