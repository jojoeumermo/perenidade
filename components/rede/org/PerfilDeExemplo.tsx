// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "@/components/Link";
import { atosDeExemplo, orgDeExemplo, postsDeExemplo } from "@/lib/rede/org/exemplos";
import { carregarTextosDaOrg, type TextosDaOrg } from "@/lib/rede/textos-org";
import type { OrgPublica } from "@/lib/rede/tipos-org";
import { Faixa } from "../ui/Faixa";
import type { AcoesDaOrg } from "./Blocos";
import { ListaDeAtos, PerfilDaOrg, PostsDeExemplo } from "./PerfilDaOrg";
import { enderecosDaOrg } from "./ParaOrganizacoes";

/** Um instante de espera, para o exemplo responder como a rede (e o botão mostrar que está ocupado). */
const pausa = () => new Promise((r) => setTimeout(r, 250));

/**
 * As ações do exemplo: mudam só a tela, nada sai do aparelho e nada é guardado (nem no navegador). Assim dá para experimentar
 * seguir, pedir núcleo, votar e perguntar sem criar nada de verdade.
 */
function acoesDeExemplo(org: OrgPublica): AcoesDaOrg {
  let naFila = org.plenarias[0]?.naFila ?? 0;
  return {
    seguir: async (sim) => (await pausa(), { sigo: sim }),
    sino: async (sim) => (await pausa(), { sino: sim }),
    entrarNoNucleo: async () => (await pausa(), { sou: false, pedi: true }),
    votar: async () => pausa(),
    perguntar: async () => (await pausa(), { naFila: (naFila += 1) }),
  };
}

/**
 * O perfil de exemplo (/alumia/organizacoes/exemplo), com o aviso "Dados ilustrativos" sempre no alto: a organização, as pessoas e
 * os números são inventados (lib/rede/org/exemplos.ts). No exemplo a pessoa "é de um núcleo" para poder experimentar o voto.
 */
export function PerfilDeExemplo({ lang, aba }: { lang: string; aba: string | null }) {
  const [t, setT] = useState<TextosDaOrg | null>(null);
  useEffect(() => {
    let vivo = true;
    carregarTextosDaOrg(lang).then((x) => vivo && setT(x)).catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [lang]);
  const org = useMemo(() => {
    const o = orgDeExemplo();
    return { ...o, consultas: o.consultas.map((c) => (c.situacao === "aberta" ? { ...c, possoVotar: true } : c)) };
  }, []);
  const acoes = useMemo(() => acoesDeExemplo(org), [org]);
  if (!t) return <div aria-busy className="al-perfil" style={{ minHeight: "60vh" }} />;
  return (
    <>
      <Faixa />
      <PerfilDaOrg
        org={org}
        t={t}
        lang={lang}
        acoes={acoes}
        membro
        abaInicial={aba}
        posts={<PostsDeExemplo posts={postsDeExemplo()} org={org} t={t} lang={lang} />}
        atos={<ListaDeAtos atos={atosDeExemplo()} t={t} lang={lang} />}
        aviso={
          <div className="al-perfil-aviso" role="note">
            <div>
              <strong>{t.exemplo.aviso}</strong>
              {t.exemplo.texto} <Link href={enderecosDaOrg.pagina(lang)}>{t.exemplo.voltar}</Link>
            </div>
          </div>
        }
      />
    </>
  );
}
