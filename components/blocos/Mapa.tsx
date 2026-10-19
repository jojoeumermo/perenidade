// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { lerMapa, nomeDeLugar, REGIOES } from "@/lib/interativos-mais";
import { useI18n } from "../I18n";

// Mapa da aula desenhado aqui mesmo, sem servidor de mapas de fora (que veria quem estuda e quando): os contornos dos
// países vêm do Natural Earth (domínio público, pacote world-atlas) e só são baixados quando o bloco aparece. Pontos,
// rotas e países em destaque saem do texto do bloco; os nomes dos países aparecem no idioma do site.

const caixa = "no-print my-6 border-l-2 border-gold bg-parchment-deep p-4 font-sans text-sm";
const claro = "cursor-pointer border-2 border-ink px-3 py-1 font-medium hover:border-oxblood hover:text-oxblood";

type Anel = [number, number][];
interface Pais {
  id: string;
  nome: string;
  chaves: Set<string>;
  poligonos: Anel[][];
  caixa: [number, number, number, number];
}

/** Apelidos que a escola usa e o pacote de nomes não traz. */
const APELIDOS: Record<string, string> = { eua: "US", usa: "US", "estados unidos": "US", inglaterra: "GB", "gra bretanha": "GB", urss: "RU", holanda: "NL", "coreia do sul": "KR", "coreia do norte": "KP", "congo": "CG", "rd congo": "CD", "republica democratica do congo": "CD" };

const VW = 800;

export function Mapa({ spec }: { spec: string }) {
  const { t, lang } = useI18n();
  const mapa = useMemo(() => lerMapa(spec), [spec]);
  const [paises, setPaises] = useState<Pais[] | null>(null);
  const [falhou, setFalhou] = useState(false);
  const [vista, setVista] = useState<[number, number, number, number] | null>(null);
  const [escolhido, setEscolhido] = useState("");
  const arrasto = useRef<{ x: number; y: number; vista: [number, number, number, number] } | null>(null);
  const svg = useRef<SVGSVGElement>(null);

  useEffect(() => {
    let vivo = true;
    void Promise.all([
      import("world-atlas/countries-110m.json"),
      import("topojson-client"),
      import("i18n-iso-countries"),
      import("i18n-iso-countries/langs/pt.json"),
      import("i18n-iso-countries/langs/en.json"),
      (lang === "es" ? import("i18n-iso-countries/langs/es.json") : lang === "fr" ? import("i18n-iso-countries/langs/fr.json") : lang === "ru" ? import("i18n-iso-countries/langs/ru.json") : lang === "zh" ? import("i18n-iso-countries/langs/zh.json") : Promise.resolve(null) as Promise<unknown>).catch(() => null),
    ])
      .then(([atlas, topo, nomesMod, pt, en, local]) => {
        if (!vivo) return;
        const nomes = (nomesMod as unknown as { default?: typeof import("i18n-iso-countries") }).default ?? nomesMod;
        type Locale = Parameters<typeof nomes.registerLocale>[0];
        for (const dados of [pt, en, local]) if (dados) nomes.registerLocale(((dados as { default?: Locale }).default ?? dados) as Locale);
        const topologia = (atlas as { default?: unknown }).default ?? atlas;
        const colecao = topo.feature(topologia as never, (topologia as { objects: { countries: never } }).objects.countries) as unknown as { features: { id?: string; properties: { name: string }; geometry: { type: string; coordinates: unknown } | null }[] };
        const lista: Pais[] = [];
        for (const f of colecao.features) {
          if (!f.geometry) continue;
          const poligonos = (f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates) as Anel[][];
          const alfa2 = f.id ? nomes.numericToAlpha2(f.id) : undefined;
          const chaves = new Set<string>([nomeDeLugar(f.properties.name)]);
          if (alfa2) {
            chaves.add(alfa2.toLowerCase());
            const alfa3 = nomes.alpha2ToAlpha3(alfa2);
            if (alfa3) chaves.add(alfa3.toLowerCase());
            for (const l of ["pt", "en", lang]) {
              const todos = nomes.getName(alfa2, l, { select: "all" }) as string[] | undefined;
              for (const n of todos ?? []) chaves.add(nomeDeLugar(n));
            }
          }
          let [w, s, e, n] = [180, 90, -180, -90];
          for (const poligono of poligonos) for (const [lon, lat] of poligono[0] ?? []) {
            w = Math.min(w, lon);
            e = Math.max(e, lon);
            s = Math.min(s, lat);
            n = Math.max(n, lat);
          }
          const nome = (alfa2 && (nomes.getName(alfa2, lang) || nomes.getName(alfa2, "pt"))) || f.properties.name;
          lista.push({ id: alfa2 ?? f.properties.name, nome, chaves, poligonos, caixa: [w, s, e, n] });
        }
        setPaises(lista);
      })
      .catch(() => vivo && setFalhou(true));
    return () => {
      vivo = false;
    };
  }, [lang]);

  const acha = useCallback(
    (texto: string): Pais | null => {
      if (!paises) return null;
      const chave = nomeDeLugar(texto);
      const apelido = APELIDOS[chave];
      return paises.find((p) => (apelido ? p.id === apelido : p.chaves.has(chave))) ?? null;
    },
    [paises],
  );
  const destacados = useMemo(() => new Set(mapa.destaques.map((d) => acha(d)?.id).filter((x): x is string => Boolean(x))), [mapa.destaques, acha]);

  /** O enquadramento inicial: a região ou o país do "foco", ou o que cabe os pontos, rotas e destaques. */
  const inicial = useMemo((): [number, number, number, number] => {
    const foco = nomeDeLugar(mapa.foco);
    if (foco && REGIOES[foco]) return REGIOES[foco];
    const pais = foco ? acha(mapa.foco) : null;
    const caixas: [number, number, number, number][] = [];
    if (pais) caixas.push(pais.caixa);
    else {
      for (const p of mapa.pontos) caixas.push([p.lon, p.lat, p.lon, p.lat]);
      for (const r of mapa.rotas) for (const [lat, lon] of r.trecho) caixas.push([lon, lat, lon, lat]);
      for (const p of paises ?? []) if (destacados.has(p.id)) caixas.push(p.caixa);
    }
    if (!caixas.length) return REGIOES.mundo;
    let [w, s, e, n] = [Math.min(...caixas.map((c) => c[0])), Math.min(...caixas.map((c) => c[1])), Math.max(...caixas.map((c) => c[2])), Math.max(...caixas.map((c) => c[3]))];
    const folga = Math.max(4, (e - w) * 0.12, (n - s) * 0.12);
    [w, s, e, n] = [w - folga, s - folga, e + folga, n + folga];
    return [Math.max(-180, w), Math.max(-85, s), Math.min(180, e), Math.min(85, n)];
  }, [mapa, acha, paises, destacados]);
  const [w, s, e, n] = vista ?? inicial;

  if (falhou) return <pre className="text-sm">{spec}</pre>;
  const k = Math.cos((((s + n) / 2) * Math.PI) / 180) || 1;
  const VH = Math.max(260, Math.min(620, (VW * (n - s)) / ((e - w) * k)));
  const X = (lon: number) => ((lon - w) / (e - w)) * VW;
  const Y = (lat: number) => ((n - lat) / (n - s)) * VH;
  // Contorno que cruza a linha de data (Rússia, Fiji): as longitudes do lado oeste ganham 360° para o desenho seguir
  // contínuo, em vez de uma linha atravessando o mapa inteiro; o que passa da borda fica fora do quadro.
  const continuo = (anel: Anel): Anel => (anel.some(([lon], i) => i > 0 && Math.abs(lon - anel[i - 1][0]) > 180) ? anel.map(([lon, lat]) => [lon < 0 ? lon + 360 : lon, lat]) : anel);
  const caminho = (aneis: Anel[]) => aneis.map((anel) => continuo(anel).map(([lon, lat], i) => `${i ? "L" : "M"}${X(lon).toFixed(1)} ${Y(lat).toFixed(1)}`).join("") + "Z").join("");
  const zoom = (fator: number) => {
    const [cx, cy] = [(w + e) / 2, (s + n) / 2];
    const [mw, mh] = [((e - w) / 2) * fator, ((n - s) / 2) * fator];
    if (mw > 180 || mw < 0.5) return;
    setVista([Math.max(-180, cx - mw), Math.max(-85, cy - mh), Math.min(180, cx + mw), Math.min(85, cy + mh)]);
  };
  const rotulo = mapa.titulo || t.blocks.map;

  return (
    <figure className={caixa}>
      {mapa.titulo && <p className="mb-2 font-serif text-lg">{mapa.titulo}</p>}
      {!paises ? (
        <p className="py-10 text-center text-ink-soft">…</p>
      ) : (
        <svg
          ref={svg}
          viewBox={`0 0 ${VW} ${VH}`}
          role="img"
          aria-label={`${rotulo}. ${[...mapa.pontos.map((p) => p.rotulo), ...mapa.rotas.map((r) => r.rotulo)].filter(Boolean).join("; ")}`}
          className="w-full cursor-grab touch-none select-none border-2 border-ink text-ink active:cursor-grabbing"
          style={{ background: "color-mix(in srgb, var(--parchment) 72%, #3f7fa8 28%)" }}
          onPointerDown={(ev) => {
            arrasto.current = { x: ev.clientX, y: ev.clientY, vista: [w, s, e, n] };
            ev.currentTarget.setPointerCapture(ev.pointerId);
          }}
          onPointerMove={(ev) => {
            const a = arrasto.current;
            const r = svg.current?.getBoundingClientRect();
            if (!a || !r) return;
            const dLon = ((ev.clientX - a.x) / r.width) * (a.vista[2] - a.vista[0]);
            const dLat = ((ev.clientY - a.y) / r.height) * (a.vista[3] - a.vista[1]);
            if (Math.abs(ev.clientX - a.x) + Math.abs(ev.clientY - a.y) < 3) return;
            const [vw, vs, ve, vn] = a.vista;
            const desl = Math.max(-180 - vw, Math.min(180 - ve, -dLon));
            const subir = Math.max(-85 - vs, Math.min(85 - vn, dLat));
            setVista([vw + desl, vs + subir, ve + desl, vn + subir]);
          }}
          onPointerUp={() => (arrasto.current = null)}
        >
          {[-150, -120, -90, -60, -30, 0, 30, 60, 90, 120, 150].map((lon) => <line key={`m${lon}`} x1={X(lon)} y1={0} x2={X(lon)} y2={VH} stroke="currentColor" strokeOpacity={0.08} />)}
          {[-60, -30, 0, 30, 60].map((lat) => <line key={`p${lat}`} x1={0} y1={Y(lat)} x2={VW} y2={Y(lat)} stroke="currentColor" strokeOpacity={lat === 0 ? 0.25 : 0.08} strokeDasharray={lat === 0 ? "6 4" : undefined} />)}
          {paises.map((p) => {
            if (p.caixa[2] < w || p.caixa[0] > e || p.caixa[3] < s || p.caixa[1] > n) return null;
            const destaque = destacados.has(p.id);
            return (
              <path
                key={p.id + p.nome}
                d={p.poligonos.map(caminho).join("")}
                fillRule="evenodd"
                className="cursor-pointer hover:opacity-80"
                fill={destaque ? "var(--gold)" : escolhido === p.id ? "color-mix(in srgb, var(--gold) 35%, var(--parchment))" : "var(--parchment)"}
                stroke="var(--ink-soft)"
                strokeOpacity={0.5}
                strokeWidth={0.6}
                onClick={() => setEscolhido(p.id)}
              >
                <title>{p.nome}</title>
              </path>
            );
          })}
          <defs>
            <marker id="seta-mapa" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--oxblood)" />
            </marker>
          </defs>
          {mapa.rotas.map((r, i) => (
            <g key={`r${i}`}>
              <polyline points={r.trecho.map(([lat, lon]) => `${X(lon)},${Y(lat)}`).join(" ")} fill="none" stroke="var(--oxblood)" strokeWidth={2.5} strokeDasharray="7 4" markerEnd="url(#seta-mapa)" />
              {r.rotulo && <text x={X(r.trecho[0][1]) + 6} y={Y(r.trecho[0][0]) + 16} className="fill-oxblood font-sans text-[13px] font-semibold">{r.rotulo}</text>}
            </g>
          ))}
          {mapa.pontos.map((p, i) => (
            <g key={`p${i}`}>
              <circle cx={X(p.lon)} cy={Y(p.lat)} r={5.5} fill="var(--oxblood)" stroke="#fff" strokeWidth={1.5} />
              {p.rotulo && <text x={X(p.lon) + 8} y={Y(p.lat) - 6} className="fill-current font-sans text-[13px] font-semibold" paintOrder="stroke" stroke="var(--parchment)" strokeWidth={3}>{p.rotulo}</text>}
            </g>
          ))}
        </svg>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button type="button" className={claro} aria-label={t.blocks.zoomIn} onClick={() => zoom(0.6)}>+</button>
        <button type="button" className={claro} aria-label={t.blocks.zoomOut} onClick={() => zoom(1.6)}>−</button>
        <button type="button" className={claro} onClick={() => setVista(null)}>{t.blocks.resetView}</button>
        <span role="status" className="font-medium">{escolhido ? paises?.find((p) => p.id === escolhido)?.nome : t.blocks.mapHint}</span>
      </div>
      {(mapa.pontos.length > 0 || mapa.rotas.length > 0) && (
        <details className="mt-2 text-xs">
          <summary className="cursor-pointer">{t.blocks.places}</summary>
          <ul className="mt-1 list-disc pl-5">
            {mapa.pontos.map((p, i) => <li key={i}>{p.rotulo || "•"} ({p.lat.toFixed(2)}°, {p.lon.toFixed(2)}°)</li>)}
            {mapa.rotas.map((r, i) => <li key={`r${i}`}>{r.rotulo || "→"}: {r.trecho.map(([lat, lon]) => `${lat.toFixed(1)}°, ${lon.toFixed(1)}°`).join(" → ")}</li>)}
          </ul>
        </details>
      )}
      <figcaption className="mt-1 text-[11px] text-ink-soft">{t.blocks.mapCredit}</figcaption>
    </figure>
  );
}
