// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState } from "react";
import Link from "@/components/Link";
import type { Dict } from "@/i18n/types";
import { hasBackend, rpc } from "@/lib/backend";
import { site } from "@/lib/site";

type Canais = { whatsapp: string; telegram: string };

/** O QR do endereço, para quem abriu a página no computador entrar pelo celular. A biblioteca só vem quando há canal. */
function Qr({ url }: { url: string }) {
  const [imagem, setImagem] = useState("");
  useEffect(() => {
    let vivo = true;
    import("qrcode")
      .then((qrcode) => qrcode.toDataURL(url, { errorCorrectionLevel: "M", margin: 1, width: 240, color: { dark: "#17130e", light: "#ffffff" } }))
      .then((dado) => vivo && setImagem(dado))
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [url]);
  // eslint-disable-next-line @next/next/no-img-element -- QR gerado no aparelho, em data URL
  return imagem ? <img src={imagem} alt="" width={120} height={120} className="h-[120px] w-[120px] border border-ink/30 max-md:hidden" /> : null;
}

/** Os dois canais do instituto (endereços guardados pela coordenação no painel › Site). */
export function ReceberNoCelular({ lang, s, jornal }: { lang: string; s: Dict["receba"]; jornal: string }) {
  const [canais, setCanais] = useState<Canais | null>(null);
  useEffect(() => {
    if (!hasBackend) {
      // Sem banco (cópia local sem configuração): os cartões mostram "em preparação".
      queueMicrotask(() => setCanais({ whatsapp: "", telegram: "" }));
      return;
    }
    rpc<Canais>("canais")
      .then(setCanais)
      .catch(() => setCanais({ whatsapp: "", telegram: "" }));
  }, []);

  const cartoes: [string, string, string, string][] = [
    [s.whatsappTitulo, s.whatsappTexto, s.whatsappBotao, canais?.whatsapp ?? ""],
    [s.telegramTitulo, s.telegramTexto, s.telegramBotao, canais?.telegram ?? ""],
  ];
  const nenhum = canais !== null && !canais.whatsapp && !canais.telegram;

  return (
    <div lang={lang}>
      <div className="grid gap-7 md:grid-cols-2">
        {cartoes.map(([titulo, texto, botao, url], i) => (
          <section key={titulo} className={`flex flex-col p-6 ${i ? "cartao-v" : "cartao"}`}>
            <h2 className="font-serif text-3xl font-semibold">{titulo}</h2>
            <p className="mt-2 text-lg text-ink-soft">{texto}</p>
            <div className="mt-auto pt-5">
              {canais === null ? (
                <p className="font-sans text-sm text-ink-soft">{s.carregando}</p>
              ) : url ? (
                <div className="flex flex-wrap items-end gap-5">
                  <a href={url} target="_blank" rel="noopener noreferrer" className="inline-block bg-ink px-5 py-3 font-sans font-semibold text-parchment no-underline hover:bg-oxblood">
                    {botao} →
                  </a>
                  <div className="font-sans text-xs text-ink-soft">
                    <Qr url={url} />
                    <p className="mt-1 max-w-[12rem] max-md:hidden">{s.qr}</p>
                  </div>
                </div>
              ) : (
                <p className="border-l-4 border-gold pl-3 font-sans text-sm text-ink-soft">{s.preparando}</p>
              )}
            </div>
          </section>
        ))}
      </div>

      {nenhum && (
        <section className="mt-10">
          <p className="rotulo">{s.outros}</p>
          <ul className="mt-3 space-y-2 font-sans">
            <li><a href={site.instagram} target="_blank" rel="noopener noreferrer" className="font-semibold underline hover:text-oxblood">{s.instagram}</a></li>
            <li><Link href={`${jornal}#boletim`} className="font-semibold underline hover:text-oxblood">{s.boletim}</Link></li>
          </ul>
        </section>
      )}

      <div className="mt-10 grid gap-4 font-sans text-sm md:grid-cols-2">
        <p className="border-l-4 border-ink pl-4">{s.encaminhar}</p>
        <p className="border-l-4 border-[#c21f16] pl-4">{s.seguranca}</p>
      </div>
    </div>
  );
}
