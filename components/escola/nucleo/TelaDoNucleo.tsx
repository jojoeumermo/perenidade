// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "@/components/Link";
import { localePath, type Locale } from "@/i18n/config";
import type { TextosDaTelaDoNucleo } from "@/i18n/escola/nucleo";
import { emPrevia } from "@/lib/escola/acesso";
import type { PerguntaDaSemana } from "@/lib/escola/contratos";
import { chamarDoNucleo, type MotivoDoErro, type NucleoCompleto, type Resposta } from "@/lib/escola/nucleo";
import { preencher } from "@/lib/escola/textos";
import { useEuDaEscola } from "../casca/Casca";
import { diaEHora } from "../hoje/tempo";
import { type AbaDoNucleo, ABAS, AbasDoNucleo } from "./AbasDoNucleo";
import { BancaDePassagem } from "./BancaDePassagem";
import { Pauta } from "./Pauta";
import { Tarefas } from "./Tarefas";

/** A tela Hoje leva para #pergunta (aba Pauta); o "Roteiro da roda" (#roteiro) e a banca (#banca) moram na aba Círculo. */
function abaDoEndereco(): AbaDoNucleo | null {
  if (typeof location === "undefined") return null;
  const alvo = location.hash.slice(1);
  if (alvo === "roteiro" || alvo === "banca") return "circulo";
  if (alvo === "pergunta") return "pauta";
  return (ABAS as readonly string[]).includes(alvo) ? (alvo as AbaDoNucleo) : null;
}

/**
 * A tela do núcleo (prancha Cel-Núcleo; no computador, a mesma ordem dentro da casca com a coluna lateral): a faixa
 * coral com o nome do núcleo, o próximo encontro, "Abrir na Alumia" e "Roteiro da roda"; as abas Pauta · Tarefas ·
 * Círculo · Assembleia; ao lado (embaixo no celular), quem acompanha e a banca de passagem.
 *
 * Só monta dentro da casca (militante conferido no banco). Tudo que é do núcleo vem das funções da F4 depois da sessão
 * (lib/escola/nucleo.ts); o kit de quem facilita e a assembleia são texto público e chegam prontos do servidor.
 */
export function TelaDoNucleo({ lang, t, kit, assembleia }: { lang: Locale; t: TextosDaTelaDoNucleo; kit: React.ReactNode; assembleia: React.ReactNode }) {
  const eu = useEuDaEscola();
  // A tela só monta no navegador (depois de a porta conferir a militância), então o endereço já pode ser lido aqui.
  const [aba, setAba] = useState<AbaDoNucleo>(() => abaDoEndereco() ?? "pauta");
  const [lido, setLido] = useState<Resposta<NucleoCompleto> | null>(null);
  const [pergunta, setPergunta] = useState<PerguntaDaSemana | null>(null);
  const [vez, setVez] = useState(0);
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState("");
  const [previa, setPrevia] = useState(false);
  const recarregar = useCallback(() => setVez((v) => v + 1), []);

  useEffect(() => {
    let vivo = true;
    Promise.all([chamarDoNucleo("escola_nucleo"), chamarDoNucleo("escola_pergunta_da_semana")]).then(([n, p]) => {
      if (!vivo) return;
      setLido(n);
      setPergunta(p.ok ? p.dados : null);
      setPrevia(emPrevia());
      // Na primeira leitura, o alvo do endereço (#pergunta, #roteiro, #banca) só existe agora: rola até ele.
      const alvo = vez === 0 ? location.hash.slice(1) : "";
      if (/^[a-z]+$/.test(alvo)) requestAnimationFrame(() => document.getElementById(alvo)?.scrollIntoView({ block: "start" }));
    });
    return () => {
      vivo = false;
    };
  }, [vez]);

  // Um link para #roteiro, #banca ou o nome de uma aba, com a tela já aberta, troca a aba.
  useEffect(() => {
    const mudou = () => {
      const aba = abaDoEndereco();
      if (aba) setAba(aba);
    };
    window.addEventListener("hashchange", mudou);
    return () => window.removeEventListener("hashchange", mudou);
  }, []);

  function abrirRoteiro() {
    setAba("circulo");
    requestAnimationFrame(() => document.getElementById("roteiro")?.focus());
  }

  async function pegar(id: string, sim: boolean) {
    setOcupado(true);
    setAviso("");
    const r = await chamarDoNucleo("escola_tarefa_pegar", { p_id: id, p_pegar: sim });
    setOcupado(false);
    if (!r.ok) setAviso(t.erros[r.motivo as MotivoDoErro]);
    recarregar();
  }

  const dados = lido?.ok ? lido.dados : null;
  const nucleo = dados?.nucleo ?? eu.nucleo;
  const proximo = dados?.proximo ?? null;

  let conteudoDaPauta: React.ReactNode;
  if (lido === null) conteudoDaPauta = <p className="en-vazio">{t.tela.carregando}</p>;
  else if (!lido.ok)
    conteudoDaPauta = (
      <div className="en-bloco">
        <p className="en-vazio">{lido.motivo === "ausente" ? t.tela.ausente : t.erros[lido.motivo] ?? t.tela.falha}</p>
        <button type="button" className="ef-botao-vazado" onClick={recarregar}>
          {t.tela.tentar}
        </button>
      </div>
    );
  else if (!dados?.nucleo) conteudoDaPauta = <p className="en-vazio">{t.tela.semNucleo}</p>;
  else conteudoDaPauta = <Pauta lang={lang} dados={dados} pergunta={pergunta} t={t} ocupado={ocupado} pegar={pegar} depois={recarregar} />;

  return (
    <div className="en-nucleo" data-escola-escura="" data-tela-da-escola="nucleo">
      <header className="en-cabeca">
        <span className="en-olho">{t.tela.olho}</span>
        <h1 className="ef-t en-titulo">{nucleo?.nome ?? t.tela.semNucleoTitulo}</h1>
        <p className="en-cabeca-texto">
          {nucleo ? (
            <>
              {proximo ? preencher(t.tela.proximo, { quando: diaEHora(lang, proximo.quando) }) : lido?.ok ? t.tela.semEncontro : null} {t.tela.alumia}
            </>
          ) : (
            t.tela.semNucleo
          )}
        </p>
        <div className="en-cabeca-acoes">
          {nucleo && (
            <Link href={localePath(lang, `/comunidade/nucleos/${nucleo.id}`)} className="en-botao-cheio">
              {t.tela.abrirAlumia}
            </Link>
          )}
          <button type="button" className="en-botao-borda" onClick={abrirRoteiro}>
            {t.tela.roteiro}
          </button>
        </div>
      </header>
      {previa && <p className="en-previa">{t.tela.previa}</p>}

      <div className="en-corpo">
        <div className="en-principal">
          <AbasDoNucleo
            rotulo={t.tela.abas.rotulo}
            nomes={{ pauta: t.tela.abas.pauta, tarefas: t.tela.abas.tarefas, circulo: t.tela.abas.circulo, assembleia: t.tela.abas.assembleia }}
            atual={aba}
            escolher={setAba}
            paineis={{
              pauta: conteudoDaPauta,
              tarefas: dados?.nucleo ? <Tarefas encontro={proximo} t={t} ocupado={ocupado} pegar={pegar} /> : <p className="en-vazio">{lido === null ? t.tela.carregando : lido.ok ? t.tela.semNucleo : t.tela.falha}</p>,
              circulo: kit,
              assembleia,
            }}
          />
          <p role="status" className="en-aviso">
            {aviso}
          </p>
        </div>
        <aside className="en-lado" aria-label={t.banca.titulo}>
          <BancaDePassagem lang={lang} eu={eu} t={t} />
        </aside>
      </div>
    </div>
  );
}
