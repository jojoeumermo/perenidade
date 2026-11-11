// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// O perfil na Alumia nova (flags "rede-v2" + "alumia-2"): se o @ é de uma organização (e "alumia-org" está ligada), o perfil de
// organização (components/rede/org/PerfilDaOrg.tsx); senão, o perfil livre de pessoa (livre/PaginaDoPerfil.tsx): a cor, o clima,
// o modelo, a capa, a faixa e o rosto que a pessoa escolheu, e as abas na ordem dela. Sem contagem de seguidores e sem lista de
// quem segue (regra da casa); nada do nome civil; os campos nunca pedem dado pessoal (telefone, endereço, CPF).
import { useEffect, useState } from "react";
import { APARENCIA_PADRAO } from "@/lib/rede/aparencia";
import { redeOrg } from "@/lib/rede/cliente-org";
import { redePerfil } from "@/lib/rede/cliente-perfil";
import { orgLigada } from "@/lib/rede/org/flag";
import { carregarTextosDaOrg, type TextosDaOrg } from "@/lib/rede/textos-org";
import type { TextosDaRede } from "@/lib/rede/textos";
import type { Post, Situacao } from "@/lib/rede/tipos";
import type { PerfilDaRede } from "@/lib/rede/tipos-perfil";
import type { ExtrasDoPerfil, OrgPublica } from "@/lib/rede/tipos-org";
import { textoDoErro } from "../erros";
import { EsqueletoDaLinha } from "../Esqueletos";
import { Linha } from "../Linha";
import type { AcoesDaOrg } from "../org/Blocos";
import type { AcoesDeGestor } from "../org/CuidarDaOrg";
import { PerfilDaOrg } from "../org/PerfilDaOrg";
import { FileiraDoPerfil, fileiraDeDestaquesLigada } from "./FileiraDoPerfil";
import { useTextosDoPerfil } from "./useTextos";
import { aparenciaDe, extrasDe, perfilDaPrevia, previa, type AparenciaLida } from "./livre/dados";
import { PaginaDoPerfil, PerfilNaoAchado, PostsDaPrevia } from "./livre/PaginaDoPerfil";
import { useTextosDoPerfilLivre } from "./livre/textos";
import "../org/org.css";

interface Props {
  handle: string;
  lang: string;
  s: TextosDaRede;
  situacao: Situacao;
  aoResponder: (p: Post) => void;
}

/** A aba pedida no endereço (?aba=plenarias), lida uma vez ao abrir. */
function abaDoEndereco(): string | null {
  try {
    return new URLSearchParams(window.location.search).get("aba");
  } catch {
    return null;
  }
}

/** As ações de quem gerencia a organização: o banco (lib/rede/cliente-org.ts), que confere de novo se a pessoa gerencia. */
function cuidarPeloBanco(handle: string): AcoesDeGestor {
  return {
    registrarVotacao: (v) => redeOrg.registrarVotacao(handle, v),
    criarNucleo: (p) => redeOrg.criarNucleo(handle, p),
    pedidos: () => redeOrg.pedidosDosNucleos(handle),
    decidirNucleo: (nucleo, quem, aceitar) => redeOrg.decidirNucleo(nucleo, quem, aceitar),
    abrirConsulta: (p) => redeOrg.abrirConsulta(handle, p),
    abrirPlenaria: (p) => redeOrg.abrirPlenaria(handle, p),
    mudarPlenaria: (id, situacao, sala) => redeOrg.mudarPlenaria(id, situacao, sala ?? null),
    responder: (pergunta) => redeOrg.responderPergunta(pergunta),
    retirar: (pergunta, motivo) => redeOrg.retirarPergunta(pergunta, motivo),
    adicionarGestor: (quem) => redeOrg.adicionarGestor(handle, quem),
    removerGestor: (quem) => redeOrg.removerGestor(handle, quem),
    sair: () => redeOrg.sairDaGestao(handle),
  };
}

/** As ações do perfil de organização de verdade: o banco (lib/rede/cliente-org.ts). */
function acoesDoBanco(handle: string): AcoesDaOrg {
  return {
    seguir: (sim) => redeOrg.seguir(handle, sim),
    sino: (sim) => redeOrg.sino(handle, sim),
    entrarNoNucleo: (id) => redeOrg.entrarNoNucleo(id),
    votar: (consulta, ranking) => redeOrg.votar(consulta, ranking),
    perguntar: (plenaria, texto, mostrar) => redeOrg.perguntar(plenaria, texto, mostrar),
  };
}

export default function PerfilDaAlumia2({ handle, lang, s, situacao, aoResponder }: Props) {
  const [t, setT] = useState<TextosDaOrg | null>(null);
  const [volta, setVolta] = useState(0);
  const [estado, setEstado] = useState<{ handle: string; org: OrgPublica | null; pessoa: PerfilDaRede | null; extras: ExtrasDoPerfil | null; lida?: AparenciaLida; erro: string } | null>(null);
  const tl = useTextosDoPerfilLivre(lang);
  const sp = useTextosDoPerfil(lang);

  useEffect(() => {
    let vivo = true;
    carregarTextosDaOrg(lang).then((x) => vivo && setT(x)).catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [lang]);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const org = orgLigada() ? await redeOrg.org(handle).catch(() => null) : null;
        if (org) return vivo && setEstado({ handle, org, pessoa: null, extras: null, erro: "" });
        const daPrevia = previa() ? perfilDaPrevia(handle) : null;
        // Na prévia, um @ que não está nos exemplos é "não encontrado" (não há serviço de contas para perguntar).
        if (previa() && !daPrevia) return vivo && setEstado({ handle, org: null, pessoa: null, extras: null, erro: "" });
        const [pessoa, extras, lida] = await Promise.all([
          daPrevia ?? redePerfil.perfil(handle),
          previa() ? extrasDe(handle) : redeOrg.extras(handle).catch(() => null),
          aparenciaDe(handle).catch(() => ({ aparencia: { ...APARENCIA_PADRAO }, orgs: [] })),
        ]);
        if (vivo) setEstado({ handle, org: null, pessoa, extras, lida, erro: "" });
      } catch (e) {
        if (vivo) setEstado({ handle, org: null, pessoa: null, extras: null, erro: textoDoErro(s, e) });
      }
    })();
    return () => {
      vivo = false;
    };
  }, [handle, s, volta]);

  if (!t || !tl || !estado || estado.handle !== handle) return <EsqueletoDaLinha rotulo={s.estados.carregando} quantos={3} />;
  if (estado.org) {
    return (
      <PerfilDaOrg
        org={estado.org}
        t={t}
        lang={lang}
        acoes={acoesDoBanco(estado.org.handle)}
        cuidar={cuidarPeloBanco(estado.org.handle)}
        aoMudar={() => setVolta((v) => v + 1)}
        vivo
        membro={situacao.membro}
        abaInicial={abaDoEndereco()}
        acimaDasAbas={fileiraDeDestaquesLigada() ? <FileiraDoPerfil handle={estado.org.handle} lang={lang} s={s} situacao={situacao} /> : null}
        posts={previa() ? <PostsDaPrevia handle={estado.org.handle} lang={lang} s={s} situacao={situacao} aoResponder={aoResponder} /> : <Linha aba={`u:${estado.org.handle}`} lang={lang} s={s} logado={situacao.logado} aoResponder={aoResponder} />}
      />
    );
  }
  if (!estado.pessoa) {
    if (estado.erro) {
      return (
        <div className="al-perfil al-painel" role="alert">
          <p className="al-painel-vazio">{estado.erro}</p>
        </div>
      );
    }
    return <PerfilNaoAchado handle={handle} lang={lang} t={tl} />;
  }
  return <PaginaDoPerfil dado={estado.pessoa} extras={estado.extras} lida={estado.lida ?? { aparencia: { ...APARENCIA_PADRAO }, orgs: [] }} t={tl} sp={sp} lang={lang} s={s} situacao={situacao} aoResponder={aoResponder} />;
}

