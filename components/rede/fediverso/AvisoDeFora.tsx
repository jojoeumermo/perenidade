// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { preencher } from "@/lib/rede/preencher";
import { contaDoHandle, contagemVisivel } from "@/lib/rede/fediverso/tela/tipos";
import { useTextosDoFediverso, type TextosDoFediverso } from "@/lib/rede/fediverso/tela/textos";
import { tempoCurto } from "@/lib/rede/tipos-conversa";
import { Avatar16 } from "../ui/Avatar16";
import { SeloDoServidor } from "./SeloDoServidor";

export const TIPOS_DE_AVISO_DE_FORA = ["fed_seguidor", "fed_resposta", "fed_mencao", "fed_curtida", "fed_impulso"] as const;
export type TipoDeAvisoDeFora = (typeof TIPOS_DE_AVISO_DE_FORA)[number];

/** Quem é de fora num grupo de avisos, como `rede_aviso_listar` devolve em `ator_remoto` (o `avatar` de lá nunca é usado na tela). */
export interface AtorDoAvisoDeFora {
  ator: string;
  handle: string | null;
  nome: string | null;
  servidor: string | null;
}

/** Um grupo de avisos com gente de fora (as chaves de ItemDeAviso que esta linha lê, mais as três da federação). */
export interface ItemDeAvisoDeFora {
  id: string;
  tipo: string | null;
  total: number;
  pessoas: number;
  lido: boolean;
  criado_em: string;
  post: string | null;
  titulo?: string | null;
  ator_remoto?: AtorDoAvisoDeFora | null;
  objeto_remoto?: string | null;
}

/** A seção dos textos (i18n/rede/fediverso, "avisos") de cada tipo de aviso de fora. */
const SECAO = { fed_seguidor: "seguidor", fed_resposta: "resposta", fed_mencao: "mencao", fed_curtida: "curtida", fed_impulso: "impulso" } as const;

/** O tipo de sempre que dá a cor do ícone (a mesma regra da preferência no banco: curtida = apoio, impulso = citação). */
const BASE: Record<TipoDeAvisoDeFora, string> = { fed_seguidor: "seguidor", fed_resposta: "resposta", fed_mencao: "mencao", fed_curtida: "apoio", fed_impulso: "citacao" };
const CAMINHO: Record<TipoDeAvisoDeFora, string> = {
  fed_resposta: "M4 5h16v10H9l-5 4z",
  fed_mencao: "M16 12a4 4 0 1 1-1.2-2.9M16 8v5a2 2 0 0 0 4 0v-1a8 8 0 1 0-3.1 6.3",
  fed_seguidor: "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21c0-4 3-6.5 7-6.5s7 2.5 7 6.5M19 8v6M16 11h6",
  fed_curtida: "M12 20s-7-4.4-7-9.5A4 4 0 0 1 12 8a4 4 0 0 1 7 2.5c0 5.1-7 9.5-7 9.5z",
  fed_impulso: "M17 3l3 3-3 3M4 11V9a3 3 0 0 1 3-3h13M7 21l-3-3 3-3M20 13v2a3 3 0 0 1-3 3H4",
};

const eTipo = (v: unknown): v is TipoDeAvisoDeFora => (TIPOS_DE_AVISO_DE_FORA as readonly unknown[]).includes(v);
// Nome e @ vêm de outro servidor: só texto, curto, sem quebra de linha nem caractere de controle.
const limpo = (v: unknown, teto = 60): string => (typeof v === "string" ? v.replace(/[\u0000-\u001f\u007f​-‏‪-‮⁦-⁩]/g, " ").replace(/\s+/g, " ").trim().slice(0, teto) : "");

/**
 * A frase de um aviso de fora. Curtida e impulso NUNCA dizem quem foi (nem nome, nem servidor: reação a post político é dado
 * sensível), e o número só aparece a partir de 3. Seguidor, resposta e menção dizem quem (o nome que a pessoa mesma publicou).
 */
export function fraseDoAvisoDeFora(item: Pick<ItemDeAvisoDeFora, "tipo" | "pessoas" | "ator_remoto">, t: TextosDoFediverso["avisos"]): string {
  if (!eTipo(item.tipo)) return "";
  const f = t[SECAO[item.tipo]];
  if (item.tipo === "fed_curtida" || item.tipo === "fed_impulso") {
    const n = contagemVisivel(item.pessoas);
    return n === null ? f.um : preencher(f.varios, { n });
  }
  const quem = item.ator_remoto;
  const nome = limpo(quem?.nome) || contaDoHandle(quem?.handle) || t.alguem;
  return preencher(item.pessoas > 1 ? f.varios : f.um, { nome });
}

/**
 * O miolo de uma linha de aviso com gente de fora, no visual da tela de Avisos (components/rede/avisos/Tela.tsx): o rosto em
 * mosaico pelo @ (nunca a foto de fora) com o ícone do tipo no canto, a frase, o selo do servidor e o tempo. Em curtida e impulso
 * não há rosto, nome nem servidor. Vai DENTRO do link ou botão que a tela de Avisos já desenha (aqui não há link nenhum).
 */
export default function AvisoDeFora({ item, lang, novo }: { item: ItemDeAvisoDeFora; lang: string; /** O rótulo "novo" da tela de Avisos. */ novo?: string }) {
  const tf = useTextosDoFediverso(lang);
  if (!eTipo(item.tipo) || !tf) return null;
  const anonimo = item.tipo === "fed_curtida" || item.tipo === "fed_impulso";
  const quem = anonimo ? null : (item.ator_remoto ?? null);
  const conta = contaDoHandle(quem?.handle);
  const servidor = quem ? limpo(quem.servidor, 253) || (conta ? conta.split("@")[2] : "") : "";
  const titulo = limpo(item.titulo, 120);
  return (
    <span className="al3-aviso-linha">
      <span className="al3-aviso-rosto" aria-hidden data-tipo={BASE[item.tipo]}>
        {quem ? <Avatar16 handle={conta ?? quem.ator} tamanho={40} /> : <span className="al3-aviso-rosto-vazio" />}
        <span className="al3-aviso-tipo">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d={CAMINHO[item.tipo]} />
          </svg>
        </span>
      </span>
      <span className="min-w-0">
        <span className="flex items-start gap-2">
          {!item.lido && novo && <span className="al3-aviso-novo">{novo}</span>}
          <span className={`min-w-0 [overflow-wrap:anywhere] ${item.lido ? "" : "font-bold"}`}>{fraseDoAvisoDeFora(item, tf.avisos)}</span>
        </span>
        {quem && (conta || servidor) && (
          <span className="mt-1 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 text-[0.8125rem] text-[var(--al-texto-3)]">
            {conta && <span className="min-w-0 truncate">{conta}</span>}
            {servidor && <SeloDoServidor servidor={servidor} rotulo={tf.cartao.doFediverso} curto={Boolean(conta)} />}
          </span>
        )}
        {titulo && <span className="mt-0.5 block text-sm text-[var(--al-texto-3)]">{titulo}</span>}
        <time dateTime={item.criado_em} className="mt-0.5 block text-xs text-[var(--al-texto-3)]">
          {tempoCurto(item.criado_em, lang)}
        </time>
      </span>
    </span>
  );
}
