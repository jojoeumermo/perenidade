// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import Link from "@/components/Link";
import { lerTrechos } from "@/lib/rede/texto/formatado";
import { enderecos } from "@/lib/rede/tipos";
import { trechosComMencoes } from "@/lib/rede/tipos-conversa";
import { enderecoDoPerfilRemoto } from "@/lib/rede/fediverso/tela/tipos";
import { fediversoNaTela } from "../fediverso/encaixe";
import { Formula } from "../texto/Formula";
import "../texto/texto.css";

const CLASSE_DA_MENCAO = "font-bold text-[#c21f16] hover:underline";

/**
 * O texto com as menções (@nome) viradas em link para o perfil, e nada mais. Não confere se a pessoa existe: o perfil que não
 * existe, está invisível ou bloqueou quem lê responde "não encontrado" (a matriz decide), e o link nunca revela o contrário.
 */
export function SoMencoes({ texto, lang }: { texto: string; lang: string }) {
  const trechos = trechosComMencoes(texto);
  // `@nome@servidor` (conta de fora, Fediverso) leva ao perfil de fora aqui dentro, e só com gente de fora na tela; sem isso,
  // fica como texto (nunca um link para o perfil daqui com o mesmo nome, que pode ser outra pessoa).
  const deFora = trechos.some((t) => t.tipo === "mencao_de_fora") && fediversoNaTela();
  return (
    <>
      {trechos.map((t, i) =>
        t.tipo === "mencao" ? (
          <Link key={i} href={enderecos.perfil(lang, t.handle)} className={CLASSE_DA_MENCAO}>
            {t.valor}
          </Link>
        ) : t.tipo === "mencao_de_fora" && deFora ? (
          <Link key={i} href={enderecoDoPerfilRemoto(lang, t.conta)} className={CLASSE_DA_MENCAO}>
            {t.valor}
          </Link>
        ) : (
          <span key={i}>{t.valor}</span>
        ),
      )}
    </>
  );
}

/**
 * O texto de um post com as menções em link e, desde a onda 11 (frente 11A), `código` e $$fórmula$$ no meio da frase (o alcance
 * "mínimo" do texto formatado, lib/rede/texto/formatado.ts: asterisco e sublinhado de post antigo não mudam). Só elementos de
 * frase, porque o cartão põe este texto dentro de um <p>; o texto longo com blocos usa components/rede/texto/TextoDoPost.tsx.
 * Pequeno de propósito: o cartão de post usa em toda a Rede; o KaTeX só é baixado quando aparece uma fórmula.
 */
export function TextoComMencoes({ texto, lang }: { texto: string; lang: string }) {
  if (!texto.includes("`") && !texto.includes("$$")) return <SoMencoes texto={texto} lang={lang} />;
  return (
    <>
      {lerTrechos(texto, "minimo").map((x, i) =>
        x.t === "codigo" ? (
          <code key={i} className="txf-codigo-curto">
            {x.v}
          </code>
        ) : x.t === "formula" ? (
          <Formula key={i} expressao={x.v} bloco={false} />
        ) : x.t === "quebra" ? (
          "\n"
        ) : x.t === "texto" ? (
          <SoMencoes key={i} texto={x.v} lang={lang} />
        ) : null,
      )}
    </>
  );
}
