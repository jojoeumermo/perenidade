// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { ExternalLink, RotateCcw, Save } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import territoriosDoSite from "@/content/territorios.json";
import { can, type Me, rpc } from "@/lib/backend";
import { Aviso, useAcao, useLista } from "./comum";
import { Area, Botao, Campo, Cartao, Esqueleto, Faixa, Selecao } from "./ui";

/**
 * A página do território, editada pelo parceiro do instituto (supabase/migracoes/20261126-p5-equipe.sql). Cada parceiro edita só
 * a página do território dele; a coordenação edita qualquer uma. O que ficar vazio volta ao texto do site
 * (content/territorios.json). As mudanças vão ao ar na hora, pelo mesmo caminho das novidades do território.
 */

interface DoSite {
  slug: string;
  nome: string;
  linha: string;
  sobre: string;
  quem: string;
  instagram: string;
  temas: string[];
}
interface Editada {
  linha: string;
  sobre: string;
  quem: string;
  instagram: string;
  temas: string[];
  atualizado_em: string;
}
interface Formulario {
  linha: string;
  sobre: string;
  quem: string;
  instagram: string;
  temas: string;
}

const TERRITORIOS = territoriosDoSite.territorios as unknown as DoSite[];

export function PaginaDoTerritorio({ me }: { me: Me }) {
  const coordena = can(me, "coordenacao");
  const meus = useLista<string[]>("territorio_meus");
  const permitidos = useMemo(() => (coordena ? TERRITORIOS.map((t) => t.slug) : (meus.dados ?? [])), [coordena, meus.dados]);
  const [escolhido, setEscolhido] = useState("");
  const slug = permitidos.includes(escolhido) ? escolhido : (permitidos[0] ?? "");
  const doSite = TERRITORIOS.find((t) => t.slug === slug);

  if (meus.dados === null && !meus.erro && !coordena) return <Esqueleto linhas={4} />;
  if (permitidos.length === 0) {
    return (
      <Cartao titulo="Minha página no território">
        <Faixa tom="info">Você ainda não está ligado a um território. Quem liga um coletivo parceiro ao território dele é a coordenação, em Voluntários e convites (função “Parceiro do instituto”).</Faixa>
      </Cartao>
    );
  }
  return (
    <div className="space-y-4">
      {permitidos.length > 1 && (
        <div className="max-w-sm">
          <Selecao rotulo="Território" value={slug} onChange={(e) => setEscolhido(e.target.value)}>
            {permitidos.map((s) => (
              <option key={s} value={s}>
                {TERRITORIOS.find((t) => t.slug === s)?.nome ?? s}
              </option>
            ))}
          </Selecao>
        </div>
      )}
      {doSite && <Editor key={slug} doSite={doSite} />}
    </div>
  );
}

function Editor({ doSite }: { doSite: DoSite }) {
  // territorio_pagina devolve null quando o parceiro ainda não mudou nada: por isso a leitura guarda também se já respondeu.
  const [lido, setLido] = useState<{ pronto: boolean; dados: Editada | null; erro: string; vez: number }>({ pronto: false, dados: null, erro: "", vez: 0 });
  const [volta, setVolta] = useState(0);
  useEffect(() => {
    let vivo = true;
    rpc<Editada | null>("territorio_pagina", { p_territorio: doSite.slug })
      .then((dados) => vivo && setLido((l) => ({ pronto: true, dados, erro: "", vez: l.vez + 1 })))
      .catch(() => vivo && setLido((l) => ({ ...l, pronto: true, erro: "Não deu para ler a página agora. Tente de novo." })));
    return () => {
      vivo = false;
    };
  }, [doSite.slug, volta]);
  return (
    <Cartao
      titulo={`Página de ${doSite.nome}`}
      sobre="O que você escrever aqui substitui o texto do site na página do território. Campo vazio = o texto de sempre. As novidades do território continuam sendo postadas na própria página."
    >
      {lido.erro && <Faixa tom="erro">{lido.erro}</Faixa>}
      {!lido.pronto ? <Esqueleto linhas={4} /> : <FormularioDaPagina key={lido.vez} doSite={doSite} editada={lido.dados} depois={() => setVolta((v) => v + 1)} />}
    </Cartao>
  );
}

function FormularioDaPagina({ doSite, editada, depois }: { doSite: DoSite; editada: Editada | null; depois: () => void }) {
  const acao = useAcao(depois);
  const [form, setForm] = useState<Formulario>(() => ({ linha: editada?.linha ?? "", sobre: editada?.sobre ?? "", quem: editada?.quem ?? "", instagram: editada?.instagram ?? "", temas: (editada?.temas ?? []).join(", ") }));
  const muda = (campo: keyof Formulario) => (ev: { target: { value: string } }) => setForm((f) => ({ ...f, [campo]: ev.target.value }));
  const temas = form.temas
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
  const instagramOk = !form.instagram.trim() || /^@?[A-Za-z0-9._]{1,30}$/.test(form.instagram.trim());
  const pronto = instagramOk && temas.length <= 12 && temas.every((t) => t.length >= 2 && t.length <= 40);
  const salvar = (p: Formulario | null) =>
    acao.agir(
      "territorio_pagina_salvar",
      { p_territorio: doSite.slug, p: p ? { linha: p.linha.trim(), sobre: p.sobre.trim(), quem: p.quem.trim(), instagram: p.instagram.trim(), temas } : { linha: "", sobre: "", quem: "", instagram: "", temas: [] } },
      p ? "Guardado. A página do território já mostra o texto novo (pode levar alguns minutos para aparecer para todo mundo)." : "A página voltou ao texto do site.",
    );

  return (
    <form
      className="mt-2 grid gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (pronto) void salvar(form);
      }}
    >
      <Campo rotulo="Linha (a frase curta debaixo do nome)" value={form.linha} maxLength={200} placeholder={doSite.linha} onChange={muda("linha")} />
      <Area rotulo="Sobre o território" value={form.sobre} maxLength={1500} rows={4} placeholder={doSite.sobre} onChange={muda("sobre")} />
      <Area rotulo="Quem faz" value={form.quem} maxLength={1500} rows={3} placeholder={doSite.quem} onChange={muda("quem")} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo rotulo="Instagram do coletivo" value={form.instagram} maxLength={31} placeholder={`@${doSite.instagram}`} onChange={muda("instagram")} aria-invalid={!instagramOk} />
        <Campo rotulo="Temas (separados por vírgula, até 12)" value={form.temas} placeholder={doSite.temas.join(", ")} onChange={muda("temas")} aria-invalid={temas.length > 12} />
      </div>
      {!instagramOk && <p className="text-sm text-oxblood">Só o nome do perfil, sem o endereço: letras, números, ponto e sublinhado.</p>}
      <Aviso texto={acao.aviso} />
      <p className="flex flex-wrap items-center gap-2">
        <Botao type="submit" variante="principal" simbolo={Save} disabled={!pronto} carregando={acao.ocupado}>
          Guardar a página
        </Botao>
        {editada && (
          <Botao variante="discreto" simbolo={RotateCcw} disabled={acao.ocupado} onClick={() => void salvar(null)}>
            Voltar ao texto do site
          </Botao>
        )}
        <a href={`/pt/territorios/${doSite.slug}`} target="_blank" rel="noopener noreferrer" className="pn-elo inline-flex items-center gap-1 text-sm">
          Ver a página <ExternalLink aria-hidden className="h-3.5 w-3.5" />
        </a>
      </p>
    </form>
  );
}
