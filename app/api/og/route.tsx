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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lang = limpar(searchParams.get("l"), 2) || "pt";
  const titulo = limpar(searchParams.get("t"), 120) || "Instituto Lúcia";
  const sub = limpar(searchParams.get("s"), 160);
  const kicker = limpar(searchParams.get("k"), 60);
  const texto = [...new Set((titulo + sub + kicker + "Instituto Lúcia institutolucia.org").split(""))].join("");
  const familia = lang === "zh" ? "Noto Serif SC" : "EB Garamond";
  const [serif, serifNegrito] = await Promise.all([fonte(familia, 400, texto), fonte(familia, 700, texto)]);
  if (!serif) return Response.redirect(new URL("/cartao-lucia.png", request.url), 302);
  const tamanho = titulo.length > 80 ? 48 : titulo.length > 50 ? 58 : 70;
  return new ImageResponse(
    (
      <div style={{ width: 1200, height: 630, display: "flex", background: "#f4ecd8", color: "#17130e", fontFamily: familia, position: "relative" }}>
        <div style={{ position: "absolute", left: 0, top: 0, width: 28, height: 630, background: "#c21f16" }} />
        <div style={{ position: "absolute", left: 28, top: 0, width: 1172, height: 14, background: "#17130e" }} />
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "70px 80px 60px 90px", width: 1200, height: 630 }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {kicker ? <div style={{ fontSize: 24, letterSpacing: 6, textTransform: "uppercase", color: "#8a5a16" }}>{kicker}</div> : null}
            <div style={{ fontSize: tamanho, fontWeight: 700, lineHeight: 1.1, marginTop: 18, maxWidth: 1000 }}>{titulo}</div>
            {sub ? <div style={{ fontSize: 30, lineHeight: 1.3, marginTop: 22, color: "#4a4032", maxWidth: 980 }}>{sub}</div> : null}
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center" }}>
              <div style={{ width: 54, height: 54, background: "#6e1f1a", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="34" height="34" viewBox="0 0 24 24"><path d="M12 2.5l2.9 6.2 6.6.8-4.9 4.6 1.3 6.7L12 17.5l-5.9 3.3 1.3-6.7L2.5 9.5l6.6-.8z" fill="#f4ecd8" /></svg>
              </div>
              <div style={{ fontSize: 36, fontWeight: 700, marginLeft: 18 }}>Instituto Lúcia</div>
            </div>
            <div style={{ fontSize: 24, color: "#8a5a16" }}>institutolucia.org</div>
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts: [{ name: familia, data: serif, weight: 400 }, ...(serifNegrito ? [{ name: familia, data: serifNegrito, weight: 700 as const }] : [])],
      headers: { "Cache-Control": "public, max-age=86400, s-maxage=604800, stale-while-revalidate=604800" },
    },
  );
}
