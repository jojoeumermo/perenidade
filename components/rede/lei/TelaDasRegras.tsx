// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import type { PropsDaTelaDoPacote } from "../registro";
import { CabecaDaLei, CarregandoALei, NavDaLei, Rico } from "./base";
import { DenunciarIlegal, PedirRevisao } from "./Formularios";
import { por, type TextosDaLei } from "./textos";
import { useTextosDaLei } from "./usarTextos";
import { JANELA_DO_RECURSO_DIAS, PRAZO_DA_RETENCAO_HORAS, PRAZO_DO_RECURSO_DIAS, PRAZOS_DAS_DENUNCIAS, type CategoriaDaDenuncia } from "./versao";

/** "24 H", "3 DIAS", "7 DIAS": o prazo de uma faixa de categorias, a partir das horas. */
function tempo(t: TextosDaLei, horas: number): string {
  return horas % 24 === 0 && horas >= 48 ? por(t.comum.dias, { n: horas / 24 }) : por(t.comum.horas, { n: horas });
}

/**
 * As regras da Alumia (/alumia/regras): as regras da casa, a escada do que a mediação pode fazer, os prazos de resposta, o
 * caminho do recurso, a proteção de menores e os dois formulários (pedir revisão da minha conta, que funciona mesmo para quem
 * está suspensa, e denunciar conteúdo ilegal). Abre sem conta (só os formulários pedem a conta).
 */
export default function TelaDasRegras({ lang, s, situacao }: PropsDaTelaDoPacote) {
  const t = useTextosDaLei(lang);
  if (!t) return <CarregandoALei rotulo={s.estados.carregando} />;
  const r = t.regras;
  return (
    <article className="le-pagina">
      <CabecaDaLei lang={lang} t={t} titulo={r.titulo} chamada={r.chamada} />
      <NavDaLei lang={lang} t={t} aberta="regras" />

      <section className="le-bloco" aria-label={r.titulo}>
        <ol className="le-regras">
          {r.lista.map((regra) => (
            <li key={regra.titulo} className="le-regra">
              <h3 className="al-cond">{regra.titulo}</h3>
              <p>{regra.texto}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="le-bloco" aria-labelledby="le-escada-t">
        <h2 id="le-escada-t" className="le-bloco-titulo al-cond">{r.escadaTitulo}</h2>
        <ol className="le-escada">
          {r.escada.map((degrau, i) => (
            <li key={degrau} style={{ ["--d" as string]: i + 1 }}>
              <span className="le-escada-n" aria-hidden>{i + 1}</span>
              {degrau}
            </li>
          ))}
        </ol>
        <p className="le-escada-nota">{r.escadaNota}</p>
      </section>

      <section className="le-bloco" aria-labelledby="le-prazos-t">
        <h2 id="le-prazos-t" className="le-bloco-titulo al-cond">{r.prazosTitulo}</h2>
        <ul className="le-prazos">
          {r.prazos.map((faixa) => (
            <li key={faixa.rotulo} className="le-prazo">
              <span className="le-prazo-tempo al-cond">{tempo(t, PRAZOS_DAS_DENUNCIAS[faixa.categorias[0] as CategoriaDaDenuncia])}</span>
              <p>{faixa.rotulo}</p>
            </li>
          ))}
          <li className="le-prazo le-prazo-recurso">
            <span className="le-prazo-tempo al-cond">{tempo(t, PRAZO_DO_RECURSO_DIAS * 24)}</span>
            <p>{r.prazoRecurso}</p>
          </li>
        </ul>
      </section>

      <section className="le-bloco" id="recurso" aria-labelledby="le-recurso-t">
        <h2 id="le-recurso-t" className="le-bloco-titulo al-cond">{r.recursoTitulo}</h2>
        <ol className="le-passos">
          {r.recurso.map((passo) => (
            <li key={passo.titulo} className="le-passo">
              <h3 className="al-cond">{passo.titulo}</h3>
              <p><Rico lang={lang} texto={por(passo.texto, { janela: JANELA_DO_RECURSO_DIAS, prazo: PRAZO_DO_RECURSO_DIAS })} /></p>
            </li>
          ))}
        </ol>
      </section>

      <section className="le-bloco" id="menores" aria-labelledby="le-menores-t">
        <h2 id="le-menores-t" className="le-bloco-titulo al-cond">{r.menoresTitulo}</h2>
        {r.menores.map((p, i) => (
          <p key={i} className="le-texto"><Rico lang={lang} texto={por(p, { horas: PRAZO_DA_RETENCAO_HORAS })} /></p>
        ))}
      </section>

      <div className="le-duas">
        <PedirRevisao lang={lang} t={t} logado={situacao.logado} />
        <DenunciarIlegal lang={lang} t={t} logado={situacao.logado && !situacao.suspenso} />
      </div>
    </article>
  );
}
