// Instituto Lúcia. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useEffect, useState } from "react";
import { hasBackend, rpc } from "@/lib/backend";
import { site } from "@/lib/site";

/**
 * "Achei um erro": a pessoa conta o que deu errado e onde. Os dados do navegador (qual navegador e o tamanho da tela)
 * só vão se ela marcar; o endereço de rede não é guardado. Sem conta e sem e-mail obrigatório.
 */
export function RelatarErro() {
  const [pagina, setPagina] = useState("");
  // A página de onde a pessoa veio, se for do próprio site (preenchida depois de abrir, para o HTML bater com o do servidor).
  useEffect(() => {
    const veio = document.referrer.startsWith(window.location.origin) ? document.referrer.slice(window.location.origin.length) : "";
    if (veio) void Promise.resolve().then(() => setPagina((atual) => atual || veio));
  }, []);
  const [descricao, setDescricao] = useState("");
  const [passos, setPassos] = useState("");
  const [contato, setContato] = useState("");
  const [tecnico, setTecnico] = useState(false);
  const [isca, setIsca] = useState("");
  const [estado, setEstado] = useState<"" | "ocupado" | "pronto" | "erro">("");
  const campo = "mt-1 block w-full border-2 border-ink bg-parchment-deep px-3 py-2";

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setEstado("ocupado");
    try {
      await rpc("erro_relatar", {
        p: { pagina: pagina.trim(), descricao: descricao.trim(), passos: passos.trim(), contato: contato.trim(), site: isca, navegador: tecnico ? navigator.userAgent.slice(0, 300) : "", tela: tecnico ? `${window.innerWidth}x${window.innerHeight}` : "" },
      });
      setEstado("pronto");
    } catch {
      setEstado("erro");
    }
  }

  if (estado === "pronto") return <p role="status" className="mt-8 border-2 border-ok bg-parchment-deep p-6 font-sans text-lg">Recebido, obrigado! Quem cuida do código vai olhar. Se deixou um contato, pode ser que a gente escreva para entender melhor.</p>;
  if (!hasBackend) return <p className="mt-8 font-sans">Escreva para <a className="underline" href={`mailto:${site.newsletter}?subject=${encodeURIComponent("Erro no site")}`}>{site.newsletter}</a> contando o que aconteceu.</p>;
  return (
    <form onSubmit={(e) => void enviar(e)} className="mt-8 max-w-2xl space-y-4 font-sans">
      <label className="block"><span className="font-semibold">Em que página?</span> <span className="text-ink-soft">(o endereço, ou o nome da página)</span><input value={pagina} onChange={(e) => setPagina(e.target.value)} maxLength={300} placeholder="/pt/acervo" className={campo} /></label>
      <label className="block"><span className="font-semibold">O que deu errado?</span><textarea required minLength={10} value={descricao} onChange={(e) => setDescricao(e.target.value)} maxLength={4000} rows={5} placeholder="O que você esperava e o que aconteceu." className={campo} /></label>
      <label className="block"><span className="font-semibold">Como chegar no erro</span> <span className="text-ink-soft">(opcional)</span><textarea value={passos} onChange={(e) => setPassos(e.target.value)} maxLength={2000} rows={3} placeholder="1. Abri o acervo no celular 2. Toquei num livro 3. …" className={campo} /></label>
      <label className="block"><span className="font-semibold">Contato para a gente perguntar mais</span> <span className="text-ink-soft">(opcional: e-mail ou outro)</span><input value={contato} onChange={(e) => setContato(e.target.value)} maxLength={200} className={campo} /></label>
      <label className="flex items-start gap-2"><input type="checkbox" checked={tecnico} onChange={(e) => setTecnico(e.target.checked)} className="mt-1" />Mandar junto qual navegador e qual tamanho de tela eu uso (ajuda a achar o erro).</label>
      <label className="sr-only" aria-hidden>Não preencha<input tabIndex={-1} autoComplete="off" value={isca} onChange={(e) => setIsca(e.target.value)} /></label>
      {estado === "erro" && <p role="alert" className="text-oxblood">Não deu para enviar agora. Tente de novo em instantes ou escreva para {site.newsletter}.</p>}
      <button type="submit" disabled={estado === "ocupado" || descricao.trim().length < 10} className="cursor-pointer bg-ink px-6 py-3 font-bold text-parchment hover:bg-oxblood disabled:opacity-50">Enviar</button>
      <p className="text-xs text-ink-soft">Não guardamos o seu endereço de rede. Não escreva dados pessoais de ninguém no relato.</p>
    </form>
  );
}
