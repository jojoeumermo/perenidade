// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// 105. Na página "Como a Rede cuida" (/alumia/cuidado, D7: a página continua; a sala de cuidado entra nela): o CVV (188) e os serviços
// públicos sempre, e as salas de cuidado entre pares que a pessoa pode ver (só o nome; nenhum número, nenhuma pessoa). Só com
// "alumia-p4-conta" ligado e a pessoa logada.
import Link from "next/link";
import { useEffect, useState } from "react";
import { rotaNovaLigada } from "@/lib/rede/rotas-novas";
import { conta, type SalaDeCuidado } from "@/lib/rede/conta/cliente";
import { enderecos } from "@/lib/rede/tipos";
import { preencher } from "@/lib/rede/preencher";
import { useTextosDaConta } from "./textos";

export function SalasDeCuidado({ lang, logado }: { lang: string; logado: boolean }) {
  const ligado = rotaNovaLigada("conta");
  const t = useTextosDaConta(lang);
  const [salas, setSalas] = useState<SalaDeCuidado[] | null>(null);
  useEffect(() => {
    if (!ligado || !logado) return;
    let vivo = true;
    conta.salas().then((r) => vivo && setSalas(r.salas), () => vivo && setSalas([]));
    return () => {
      vivo = false;
    };
  }, [ligado, logado]);
  if (!ligado || !logado || !t) return null;
  return (
    <section className="al2-bloco p-4" aria-labelledby="salas-de-cuidado" data-salas-de-cuidado>
      <h2 id="salas-de-cuidado" className="text-lg font-extrabold">{t.cuidado.paginaTitulo}</h2>
      <p className="mt-1 text-[var(--al-texto-2)]">{t.cuidado.paginaSobre}</p>
      {salas && salas.length === 0 && <p className="mt-2 text-sm">{t.cuidado.nenhumaSala}</p>}
      {salas && salas.length > 0 && (
        <ul className="mt-2 grid gap-1">
          {salas.map((s) => (
            <li key={s.slug}>
              <Link className="inline-flex min-h-11 items-center underline" href={enderecos.comunidade(lang, s.slug)}>{preencher(t.cuidado.ir, { nome: s.nome })}</Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
