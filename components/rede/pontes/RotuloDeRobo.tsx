// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// O rótulo de conta automática. No cartão (encaixe anexosDoCartao): "ROBÔ · Conta automática de <organização>" embaixo do texto
// de todo post de robô, para todo mundo, sem desligar. Os cartões de uma página pedem juntos (os autores que chegam em 40 ms vão
// numa chamada só) e a resposta fica na memória da aba. No perfil (RotuloDoPerfil): o mesmo rótulo e para que o robô serve; quem
// junta põe no alto do perfil (components/rede/perfil), porque o encaixe não tem lugar ali.
import "./pontes.css";
import { useEffect, useState } from "react";
import type { ContextoDoEncaixe } from "../encaixes";
import type { Post } from "@/lib/rede/tipos";
import { pontes, type RoboDoPerfil } from "./cliente";
import type { TextosDasPontes } from "./textos";
import { useTextosDasPontes } from "./usarTextos";

type Dono = { handle: string; nome: string } | null;
const guardados = new Map<string, Dono>();
let fila: { id: string; avisar: (d: Dono) => void }[] = [];
let relogio: ReturnType<typeof setTimeout> | null = null;

/** As esperas entre as tentativas quando a pergunta falha (a rede caiu, o banco demorou): o rótulo não some por um tropeço. */
const ESPERAS = [2000, 6000, 15000];

function pedir(autor: string, tentativa = 0): Promise<Dono> {
  if (guardados.has(autor)) return Promise.resolve(guardados.get(autor) ?? null);
  return new Promise((avisar) => {
    fila.push({ id: autor, avisar });
    if (relogio) return;
    relogio = setTimeout(async () => {
      const lote = fila;
      fila = [];
      relogio = null;
      const ids = [...new Set(lote.map((x) => x.id))].slice(0, 100);
      let resposta: { autor: string; org: { handle: string; nome: string } }[] = [];
      try {
        resposta = await pontes.rotulos(ids);
      } catch {
        // Sem resposta: não guarda "não é robô". Pergunta de novo daqui a pouco (e o próximo cartão também pergunta).
        const espera = ESPERAS[tentativa];
        if (espera === undefined) {
          for (const x of lote) x.avisar(null);
          return;
        }
        setTimeout(() => {
          for (const x of lote) void pedir(x.id, tentativa + 1).then(x.avisar);
        }, espera);
        return;
      }
      for (const id of ids) guardados.set(id, resposta.find((r) => r.autor === id)?.org ?? null);
      for (const x of lote) x.avisar(guardados.get(x.id) ?? null);
    }, 40);
  });
}

function Rotulo({ lang, t, org, parado = false }: { lang: string; t: TextosDasPontes; org: { handle: string; nome: string }; parado?: boolean }) {
  // A frase tem o marcador {org} no lugar do nome, em qualquer posição (no chinês, ele vem antes): o nome entra como link.
  const [antes, depois = ""] = (parado ? t.rotulo.parado : t.rotulo.de).split("{org}");
  return (
    <p className="po-rotulo" role="note">
      <span className="po-selo al-cond" data-tom="robo">{t.rotulo.robo}</span>
      <span>
        {antes}
        <a className="po-link" href={`/${lang}/alumia/u/${org.handle}`} onClick={(e) => e.stopPropagation()}>{org.nome}</a>
        {depois}
      </span>
    </p>
  );
}

/**
 * O anexo do cartão: nada quando o autor não é robô. O post já traz a organização dona em autor.robo (integração, nulo quando não
 * é robô): aí não pergunta nada. Só o post sem a chave (banco de antes da integração) pergunta por alumia_pontes_rotulos.
 */
export function RotuloNoCartao({ lang, post }: ContextoDoEncaixe & { post: Post }) {
  const t = useTextosDasPontes(lang);
  const veio = post.autor != null && "robo" in post.autor;
  const doPost: Dono = veio ? (post.autor.robo ?? null) : null;
  const autor = veio ? null : (post.autor?.id ?? null);
  const [dono, setDono] = useState<Dono>(() => (autor ? guardados.get(autor) ?? null : null));
  useEffect(() => {
    if (!autor) return;
    let vivo = true;
    void pedir(autor).then((d) => vivo && setDono(d));
    return () => {
      vivo = false;
    };
  }, [autor]);
  const org = veio ? doPost : dono;
  if (!t || !org) return null;
  return <Rotulo lang={lang} t={t} org={org} />;
}

/** No alto do perfil de um robô (para quem junta pôr no perfil): o rótulo e para que ele serve. */
export function RotuloDoPerfil({ lang, handle }: { lang: string; handle: string }) {
  const t = useTextosDasPontes(lang);
  const [robo, setRobo] = useState<RoboDoPerfil | null>(null);
  useEffect(() => {
    let vivo = true;
    pontes.roboDe(handle).then((r) => vivo && setRobo(r), () => vivo && setRobo(null));
    return () => {
      vivo = false;
    };
  }, [handle]);
  if (!t || !robo) return null;
  return (
    <div className="po-lado" role="note">
      <Rotulo lang={lang} t={t} org={robo.org} parado={robo.parado} />
      <p className="po-texto" style={{ margin: "0.5rem 0 0" }}>{t.rotulo.explica}</p>
      <p className="po-nota">{robo.descricao}</p>
    </div>
  );
}
