// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import { ImageResponse } from "next/og";

/**
 * A imagem de compartilhamento de cada página (1200 por 630): o título, uma linha de contexto e a marca, no desenho
 * dos cartazes do instituto. As letras vêm do Google Fonts já recortadas só com os caracteres do texto (o que permite
 * chinês e russo sem baixar a família inteira) e ficam em memória enquanto o processo dura.
 */
export const runtime = "nodejs";

const UA_ANTIGO = "Mozilla/5.0 (Macintosh; U; Intel Mac OS X 10_6_8; de-at) AppleWebKit/533.21.1 (KHTML, like Gecko) Version/5.0.5 Safari/533.21.1";
const fontes = new Map<string, Promise<ArrayBuffer | null>>();
/** Cada título diferente é uma entrada nova: sem teto, quem variasse o endereço enchia a memória do servidor. */
const MAXIMO_DE_FONTES = 200;

async function fonte(familia: string, peso: number, texto: string): Promise<ArrayBuffer | null> {
  const chave = `${familia}|${peso}|${texto}`;
  if (!fontes.has(chave)) {
    // A mais antiga sai primeiro (o Map guarda a ordem em que entraram).
    while (fontes.size >= MAXIMO_DE_FONTES) fontes.delete(fontes.keys().next().value!);
    fontes.set(
      chave,
      (async () => {
        try {
          const css = await fetch(`https://fonts.googleapis.com/css2?family=${encodeURIComponent(familia)}:wght@${peso}&text=${encodeURIComponent(texto)}`, { headers: { "User-Agent": UA_ANTIGO }, signal: AbortSignal.timeout(8000) });
          if (!css.ok) return null;
          const url = /src:\s*url\(([^)]+)\)\s*format\('(?:truetype|opentype|woff)'\)/.exec(await css.text())?.[1];
          if (!url) return null;
          const arquivo = await fetch(url, { signal: AbortSignal.timeout(8000) });
          return arquivo.ok ? await arquivo.arrayBuffer() : null;
        } catch {
          return null;
        }
      })(),
    );
    // Falha não fica guardada: na próxima tenta de novo.
    void fontes.get(chave)!.then((r) => { if (!r) fontes.delete(chave); });
  }
  return fontes.get(chave)!;
}

const limpar = (s: string | null, n: number) => (s ?? "").replace(/\s+/g, " ").trim().slice(0, n);

/** A marca do instituto (a mesma do cabeçalho do site), lida uma vez do próprio site. A marca nunca muda. */
let marca: Promise<string | null> | null = null;
function marcaDe(origem: string) {
  marca ??= fetch(new URL("/marca-192.png", origem), { signal: AbortSignal.timeout(8000) })
    .then(async (r) => (r.ok ? `data:image/png;base64,${Buffer.from(await r.arrayBuffer()).toString("base64")}` : null))
    .catch(() => null)
    .then((m) => {
      if (!m) marca = null;
      return m;
    });
  return marca;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lang = limpar(searchParams.get("l"), 2) || "pt";
  const titulo = limpar(searchParams.get("t"), 120) || "Instituto Lúcia";
  const sub = limpar(searchParams.get("s"), 160);
  const kicker = limpar(searchParams.get("k"), 60);
  const arroba = "@institutoluciaorg";
  const texto = [...new Set((titulo + sub + "Instituto Lúcia").split(""))].join("");
  const textoMono = [...new Set((kicker.toUpperCase() + arroba + "institutolucia.org").split(""))].join("");
  const familia = lang === "zh" ? "Noto Serif SC" : "EB Garamond";
  const [serif, serifNegrito, mono, logo] = await Promise.all([fonte(familia, 400, texto), fonte(familia, 700, texto), fonte("IBM Plex Mono", 500, textoMono), marcaDe(request.url)]);
  if (!serif) return Response.redirect(new URL("/cartao-lucia.png", request.url), 302);
  const tamanho = titulo.length > 80 ? 52 : titulo.length > 50 ? 62 : 76;
  const letraMono = mono ? "Plex Mono" : familia;
  // O desenho do Caderno do Povo: a tarja preta com a estrela e o rótulo, o título grande em letra de
  // livro, o fio de tinta e, embaixo, a marca, o nome e o @ do Instagram.
  return new ImageResponse(
    (
      <div style={{ width: 1200, height: 630, display: "flex", flexDirection: "column", backgroundColor: "#f4ecd8", color: "#17130e", fontFamily: familia }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: 70, padding: "0 64px", backgroundColor: "#1f1a14", borderBottom: "6px solid #c21f16" }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            <svg width="26" height="26" viewBox="0 0 24 24"><path d="M12 2.5l2.9 6.2 6.6.8-4.9 4.6 1.3 6.7L12 17.5l-5.9 3.3 1.3-6.7L2.5 9.5l6.6-.8z" fill="#c21f16" /></svg>
            <div style={{ display: "flex", marginLeft: 14, fontFamily: letraMono, fontSize: 22, letterSpacing: 5, color: "#f4ecd8" }}>{(kicker || "Instituto Lúcia").toUpperCase()}</div>
          </div>
          <div style={{ display: "flex", fontFamily: letraMono, fontSize: 22, color: "#e0837a" }}>{arroba}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", flexGrow: 1, padding: "0 64px" }}>
          <div style={{ display: "flex", fontSize: tamanho, fontWeight: 700, lineHeight: 1.04, maxWidth: 1060, letterSpacing: -0.5 }}>{titulo}</div>
          {sub ? <div style={{ display: "flex", fontSize: 30, lineHeight: 1.3, marginTop: 22, color: "#4a4032", maxWidth: 1000, fontStyle: "italic" }}>{sub}</div> : null}
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "0 64px", padding: "22px 0 30px", borderTop: "3px solid #17130e" }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            {logo ? (
              // eslint-disable-next-line @next/next/no-img-element -- imagem dentro do cartão gerado, não na página
              <img src={logo} width={66} height={66} alt="" />
            ) : null}
            <div style={{ display: "flex", fontSize: 38, fontWeight: 700, marginLeft: 18 }}>Instituto Lúcia</div>
          </div>
          <div style={{ display: "flex", fontFamily: letraMono, fontSize: 22, color: "#8a5a16" }}>institutolucia.org</div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts: [
        { name: familia, data: serif, weight: 400 },
        ...(serifNegrito ? [{ name: familia, data: serifNegrito, weight: 700 as const }] : []),
        ...(mono ? [{ name: "Plex Mono", data: mono, weight: 500 as const }] : []),
      ],
      headers: { "Cache-Control": "public, max-age=86400, s-maxage=604800, stale-while-revalidate=604800" },
    },
  );
}
