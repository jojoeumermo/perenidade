// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { guardarAparencia, TEMAS_DA_ALUMIA, type TemaDaAlumia } from "@/lib/rede/aparencia-da-rede";
import { setPrefs, TEXT_SCALES, usePrefs } from "@/lib/prefs";
import { useHydrated } from "@/lib/storage";
import type { PropsDaTelaDoPacote } from "../registro";
import { EsqueletoDaLinha } from "../Esqueletos";
import { AjusteDaPausa } from "../publicar/alumia2/LembreteDePausa";
import { Icone, type NomeDoIcone } from "../publicar/alumia2/icones";
import { Avatar16 } from "../ui/Avatar16";
import { Carimbo } from "../ui/Carimbo";
import { Pilula } from "../ui/Pilula";
import { useAparencia, useTextosDoAcabamento } from "./base";

// O painel de acessibilidade do site escuta este evento (pelo nome, sem importar o módulo dele).
const abrirAcessibilidade = () => window.dispatchEvent(new Event("lucia:alternar-acessibilidade"));

const ICONE_DO_TEMA: Record<TemaDaAlumia, NomeDoIcone> = { sistema: "aparelho", claro: "sol", escuro: "lua" };

/** Um interruptor de verdade (role="switch"): a linha inteira é o alvo de toque. */
function Interruptor({ titulo, dica, ligado, aoMudar }: { titulo: string; dica: string; ligado: boolean; aoMudar: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={ligado} className="ac-linha ac-interruptor" onClick={() => aoMudar(!ligado)}>
      <span className="min-w-0 flex-1">
        <span className="ac-linha-titulo">{titulo}</span>
        <span className="ac-linha-dica">{dica}</span>
      </span>
      <span className="ac-chave" aria-hidden>
        <span className="ac-chave-pino" />
      </span>
    </button>
  );
}

/**
 * Aparência e leitura (/alumia/aparencia): o tema (o do aparelho, claro ou escuro), o tamanho da letra, o contraste alto e o
 * "menos movimento" (os três do site: lib/prefs.ts), e o bem-estar (ocultar números e o lembrete de pausa). Nada aqui vai ao
 * servidor: fica no aparelho e some com o Sair rápido. A amostra muda na hora, para a pessoa ver antes de sair da tela.
 */
export default function TelaDaAparencia({ lang, s }: PropsDaTelaDoPacote) {
  const t = useTextosDoAcabamento(lang);
  const aparencia = useAparencia();
  const prefs = usePrefs();
  const montado = useHydrated();
  if (!t || !montado) return <EsqueletoDaLinha rotulo={s.estados.carregando} quantos={3} />;
  const a = t.aparencia;
  // A escala do site tem quatro degraus (100, 115, 130, 150); um valor de fora (preferência antiga) conta como o mais perto.
  const escala = TEXT_SCALES.reduce((perto, n) => (Math.abs(n - prefs.scale) < Math.abs(perto - prefs.scale) ? n : perto), TEXT_SCALES[0] as number);
  return (
    <section className="ac-tela" aria-labelledby="ac-aparencia-titulo">
      <header className="ac-cabeca">
        <h1 id="ac-aparencia-titulo" className="al-cond ac-titulo">{a.titulo}</h1>
        <p className="ac-lead">{a.lead}</p>
      </header>

      <div className="ac-grade">
        <div className="ac-ajustes">
          <section className="ac-bloco" aria-labelledby="ac-tema">
            <h2 id="ac-tema" className="al-cond ac-secao">{a.tema.titulo}</h2>
            <div role="radiogroup" aria-labelledby="ac-tema" className="ac-temas">
              {TEMAS_DA_ALUMIA.map((tema) => (
                <button key={tema} type="button" role="radio" aria-checked={aparencia.tema === tema} className="ac-tema" data-tema={tema} onClick={() => guardarAparencia({ tema })}>
                  {/* A miniatura: fundo, um cartão, a faixa tecida e o vermelho da casa, nas cores do tema que ela escolhe. */}
                  <span className="ac-mini" aria-hidden>
                    <span className="ac-mini-faixa" />
                    <span className="ac-mini-cartao">
                      <span className="ac-mini-linha" />
                      <span className="ac-mini-linha ac-mini-curta" />
                      <span className="ac-mini-botao" />
                    </span>
                  </span>
                  <span className="ac-tema-nome">
                    <Icone nome={aparencia.tema === tema ? "visto" : ICONE_DO_TEMA[tema]} className="h-4 w-4" grosso={aparencia.tema === tema} />
                    {a.tema[tema]}
                  </span>
                </button>
              ))}
            </div>
            <p className="ac-dica">{a.tema.dica}</p>
          </section>

          <section className="ac-bloco" aria-labelledby="ac-leitura">
            <h2 id="ac-leitura" className="al-cond ac-secao">{a.leitura}</h2>
            <div className="ac-linha ac-linha-coluna">
              <span>
                <span id="ac-letra" className="ac-linha-titulo">{a.letra.titulo}</span>
                <span className="ac-linha-dica">{a.letra.dica}</span>
              </span>
              <div role="radiogroup" aria-labelledby="ac-letra" className="ac-letras">
                {TEXT_SCALES.map((n, i) => (
                  <button key={n} type="button" role="radio" aria-checked={escala === n} className="ac-letra" onClick={() => setPrefs({ scale: n })}>
                    {/* O "A" no tamanho que a escolha produz (a letra de agora já vem escalada: divide pela escala atual). */}
                    <span aria-hidden className="ac-letra-amostra" style={{ fontSize: `${(1.25 * n) / escala}rem` }}>
                      A
                    </span>
                    <span className="ac-letra-nome">{a.letra.opcoes[i]}</span>
                  </button>
                ))}
              </div>
            </div>
            <Interruptor titulo={a.contraste.titulo} dica={a.contraste.dica} ligado={prefs.contrast} aoMudar={(v) => setPrefs({ contrast: v })} />
            <Interruptor titulo={a.movimento.titulo} dica={a.movimento.dica} ligado={prefs.motion} aoMudar={(v) => setPrefs({ motion: v })} />
            <button type="button" className="ac-linha ac-linha-link" onClick={abrirAcessibilidade}>
              <span className="min-w-0 flex-1">
                <span className="ac-linha-titulo">{a.maisAjustes}</span>
                <span className="ac-linha-dica">{a.maisAjustesDica}</span>
              </span>
              <Icone nome="chevron" className="h-5 w-5 shrink-0" />
            </button>
          </section>

          <section className="ac-bloco" aria-labelledby="ac-bem-estar">
            <h2 id="ac-bem-estar" className="al-cond ac-secao">{a.bemEstar}</h2>
            <Interruptor titulo={a.numeros.titulo} dica={a.numeros.dica} ligado={aparencia.semNumeros} aoMudar={(v) => guardarAparencia({ semNumeros: v })} />
            <div className="ac-linha ac-linha-pausa">
              <AjusteDaPausa />
            </div>
          </section>
        </div>

        {/* A amostra: um post e um carimbo de exemplo, para ver o tema, a letra e os números antes de sair daqui. */}
        <aside className="ac-amostra" aria-labelledby="ac-amostra">
          <h2 id="ac-amostra" className="al-cond ac-secao">{a.amostra.titulo}</h2>
          <div className="ac-amostra-cartao" aria-hidden>
            <div className="flex items-start gap-3">
              <Avatar16 handle="rosavermelha" tamanho={40} className="shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="font-extrabold leading-tight">{a.amostra.nome}</p>
                <p className="mt-1">
                  <Pilula texto={a.amostra.comunidade} cor={2} />
                </p>
                <p className="mt-2 leading-relaxed">{a.amostra.texto}</p>
                <p className="ac-amostra-acoes">
                  <span data-al-numero="">{a.amostra.respostas}</span>
                  <span>{a.amostra.acender}</span>
                  <span>{a.amostra.salvar}</span>
                </p>
              </div>
            </div>
            <div className="ac-amostra-pe">
              <span data-al-numero="">{a.amostra.seguidores}</span>
              <Carimbo situacao="confirmado" texto={a.amostra.carimbo} tamanho="p" />
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}
