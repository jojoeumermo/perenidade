// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// Prompt 4, item 35: nos Salvos, com uma pasta PRIVADA aberta, "Tornar esta pasta pública". Pública, ela vira uma coleção do perfil
// da dona (a aba Coleções, do acervo) e acompanha a pasta. Só os posts abertos entram; os restritos ficam só na pasta, e quem lê a
// coleção ainda passa cada post pela visibilidade de sempre (interno.rede_ve). A pasta do núcleo nunca aparece aqui.
import { useEffect, useId, useState } from "react";
import Link from "@/components/Link";
import { clienteDoCartao } from "@/lib/rede/p4/cartao/cliente";
import { pastaPodeSerPublica } from "@/lib/rede/p4/cartao/regras";
import { enderecos } from "@/lib/rede/tipos";
import { useTextosDoCartaoP4 } from "./usar";
import "./cartao.css";

export function PastaPublica({ lang, pasta, nucleo, handle }: { lang: string; pasta: string; nucleo: unknown; handle: string | null | undefined }) {
  const t = useTextosDoCartaoP4(lang);
  const id = useId();
  // O estado é da pasta aberta: trocar de pasta volta a "carregando" sem apagar nada à mão.
  const [estado, setEstado] = useState<{ pasta: string; publica: boolean; ficouFora: boolean; erro: string | null } | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const pode = pastaPodeSerPublica({ nucleo });
  const daPasta = estado?.pasta === pasta ? estado : null;
  const publica = daPasta ? daPasta.publica : null;
  const ficouFora = daPasta?.ficouFora ?? false;
  const erro = daPasta?.erro ?? null;

  useEffect(() => {
    if (!pode) return;
    let vivo = true;
    clienteDoCartao.pastasPublicas().then(
      (r) => vivo && setEstado({ pasta, publica: r.ligado && r.itens.some((i) => i.pasta === pasta), ficouFora: false, erro: null }),
      () => vivo && setEstado({ pasta, publica: false, ficouFora: false, erro: null }),
    );
    return () => {
      vivo = false;
    };
  }, [pasta, pode]);

  if (!t || !pode || publica === null) return null;

  async function mudar(sim: boolean) {
    if (!t) return;
    setOcupado(true);
    try {
      const r = await clienteDoCartao.tornarPublica(pasta, sim);
      setEstado({ pasta, publica: r.publica, ficouFora: r.ficou_fora, erro: null });
    } catch (e) {
      const texto = String((e as Error)?.message ?? "").includes("sem_handle") ? t.pasta.semHandle : t.pasta.erro;
      setEstado({ pasta, publica: publica ?? false, ficouFora, erro: texto });
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="p4c-bloco" data-p4c="pasta-publica">
      <label className="p4c-marcar" htmlFor={`${id}-p`}>
        <input id={`${id}-p`} type="checkbox" checked={publica} disabled={ocupado} onChange={(e) => void mudar(e.target.checked)} aria-describedby={`${id}-a`} />
        {t.pasta.tornar}
      </label>
      <p className="p4c-nota" id={`${id}-a`}>{publica ? t.pasta.publica : t.pasta.ajuda}</p>
      {publica && ficouFora ? <p className="p4c-nota" role="status">{t.pasta.ficouFora}</p> : null}
      {publica && handle ? (
        <div className="p4c-acoes">
          <Link className="al-botao al-botao-contorno al-botao-m" href={`${enderecos.perfil(lang, handle)}`}>
            {t.pasta.verNoPerfil}
          </Link>
        </div>
      ) : null}
      {erro ? <p className="p4c-erro" role="alert">{erro}</p> : null}
    </div>
  );
}
