// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// Prompt 4, item 132 (atrás de "alumia-p4-pontes"): "pouco útil" numa resposta, no "…" dela. Voto secreto: a tela só sabe o voto de
// quem está lendo (rede_p4_pouco_util_meus); nenhum número aparece para ninguém. A resposta só desce na conversa a partir de 3
// marcas de contas diferentes (o banco ordena) e nunca some: esconder continua sendo da moderação.
import { useEffect, useState } from "react";
import { pontes } from "@/lib/rede/p4/pontes/cliente";
import { textoDoErro } from "./textos";
import { useTextosDasPontes } from "./usarTextos";

export function PoucoUtil({ post, lang, classe = "al3-acao" }: { post: string; lang: string; classe?: string }) {
  const t = useTextosDasPontes(lang);
  const [eu, setEu] = useState<boolean | null>(null);
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);
  useEffect(() => {
    let vivo = true;
    pontes
      .poucoUtilMeus([post])
      .then((r) => vivo && setEu(Array.isArray(r) && r.includes(post)))
      .catch(() => vivo && setEu(false));
    return () => {
      vivo = false;
    };
  }, [post]);
  if (!t || eu === null) return null;
  async function mudar() {
    if (ocupado || !t) return;
    setOcupado(true);
    setErro("");
    try {
      setEu((await pontes.poucoUtil(post, !eu)).eu);
    } catch (e) {
      setErro(textoDoErro(t.erros, e));
    } finally {
      setOcupado(false);
    }
  }
  return (
    <>
      <button type="button" className={classe} aria-pressed={eu} title={t.poucoUtil.ajuda} disabled={ocupado} onClick={() => void mudar()} data-p4-pouco-util>
        {eu ? t.poucoUtil.marcado : t.poucoUtil.marcar}
      </button>
      {erro && <span role="alert" className="text-sm text-oxblood">{erro}</span>}
    </>
  );
}
