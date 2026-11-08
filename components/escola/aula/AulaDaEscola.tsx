// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import dynamic from "next/dynamic";
import Link from "@/components/Link";
import { ExpliqueComSuasPalavrasSobDemanda as ExpliqueComSuasPalavras, LembraDaAnteriorSobDemanda as LembraDaAnterior } from "@/components/aula/AprenderAtivoSobDemanda";
import {
  BarraDeSelecaoSobDemanda as BarraDeSelecao,
  FatiasSobDemanda as Fatias,
  OuvirParagrafoSobDemanda as OuvirParagrafo,
  RetomarAquiSobDemanda as RetomarAqui,
  VersaoFacilSobDemanda as VersaoFacil,
} from "@/components/aula/AulaVivaSobDemanda";
import { MargemDaAula } from "@/components/aula/MargemDaAula";
import { OuvirAula } from "@/components/aula/OuvirAula";
import { BaixarArquivoUnico } from "@/components/BaixarArquivoUnico";
import { AcoesDaAula } from "@/components/celular/AcoesDaAula";
import { LevezaDaAulaSobDemanda as LevezaDaAula } from "@/components/escola/leveza/LevezaDaAulaSobDemanda";
import { espelhosDoSite } from "@/components/EspelhosDoSite";
import { ExerciciosComExplicacaoSobDemanda as ExerciciosComExplicacao } from "@/components/estudo/NaAula";
import { PraticaSobDemanda as Pratica } from "@/components/estudo/PraticaSobDemanda";
import { Markdown } from "@/components/Markdown";
import { RememberLesson } from "@/components/Progress";
import { Quiz } from "@/components/Quiz";
import { StudyTools } from "@/components/StudyTools";
import { originalLang } from "@/components/Untranslated";
import type { CadernoVisto, AulaDoCaderno } from "@/components/escola/formacao/vista";
import type { Dict } from "@/i18n/types";
import { defaultLocale, fill, localePath, type Locale } from "@/i18n/config";
import { textosDaAvaliacao } from "@/i18n/escola/avaliacao";
import { textosDaAula } from "@/i18n/escola/aula";
import type { TextosDaFormacao } from "@/i18n/escola/formacao";
import { textosDaLeveza } from "@/i18n/escola/leveza";
import { getGlossary, getTrack, versaoFacilDe, type Lesson, type Track } from "@/lib/content";
import { exerciciosDaAula } from "@/lib/exercicios-conteudo";
import { fatiar } from "@/lib/fatias";
import { caminhosDeLevar, librasDaAula, tamanhoDoTexto } from "@/lib/escola/leveza";
import { preencher } from "@/lib/escola/textos";
import { linguaDe } from "@/lib/pratica";
import { ligado } from "@/lib/recursos";
import { site } from "@/lib/site";
import { textosDoEstudo } from "@/lib/textos-estudo";
import { lerLexico } from "@/lib/vozes/lexico";
import { DiarioDeFormacao } from "./DiarioDeFormacao";
import { NaSuaRealidade } from "./NaSuaRealidade";
import { argumentoDoOutroLado, perguntaDaRealidade, semARealidade } from "./realidade";
import { RiscarNoQuadro } from "./RiscarNoQuadro";
import { TreinoDeConversa } from "./TreinoDeConversa";

// O espaço da F3 (aula ao vivo gravada): o esboço devolve nada; a F3 troca o arquivo (PLANO-ESCOLA.md, "Slot da F3").
const GravacaoDaAula = dynamic(() => import("./GravacaoDaAula"));

export interface AulaParaAEscola {
  caderno: CadernoVisto;
  aula: AulaDoCaderno;
  track: Track;
  lesson: Lesson;
}

/**
 * A aula aberta dentro da Escola (prancha Aula). NÃO é outra aula: é a MESMA de /trilhas (lida com getTrack, com o mesmo
 * lessonId de lib/ids.ts), montada com os MESMOS componentes da página da aula de /trilhas (tabela 1.4 do plano): ouvir
 * a aula, ouvir parágrafo, post-it da margem com glossário, fichamento (StudyTools), barra de seleção, fatias, retomar
 * aqui, versão fácil, quiz, exercícios com explicação, prática, explique com suas palavras, concluir (RiscarNoQuadro, no
 * mesmo progresso), leveza, baixar num arquivo só e as ações do celular. Por isso concluir aqui risca em /trilhas e
 * vice-versa. A Escola acrescenta "Na sua realidade" no alto, o diário de formação (só no aparelho), o treino de
 * conversa e o espaço da aula gravada (F3). Ficam de fora o Compartilhar (modo discreto) e os dados estruturados (página
 * fechada, sem indexação).
 */
export function AulaDaEscola({ lang, t, tf, dados }: { lang: Locale; t: Dict; tf: TextosDaFormacao; dados: AulaParaAEscola }) {
  const { caderno, aula, track, lesson } = dados;
  const id = aula.id;
  const sa = textosDaAula(lang);
  const avaliacao = textosDaAvaliacao(lang);
  const estudo = textosDoEstudo(lang).s;
  const ta = tf.aula;
  const n = String(caderno.numero).padStart(2, "0");
  const hrefDoCaderno = caderno.href;

  // A posição na lista do caderno e as vizinhas (na ordem das aulas prontas, a mesma do quadro).
  const i = caderno.prontas.findIndex((a) => a.id === id);
  const anterior = i > 0 ? caderno.prontas[i - 1] : null;
  const proxima = i >= 0 && i < caderno.prontas.length - 1 ? caderno.prontas[i + 1] : null;
  const ladoRotulo = aula.lado === "A" ? ta.ladoA : ta.ladoB;
  const total = caderno.contagem.tipo === "trilha" ? caderno.contagem.previstas : caderno.prontas.length;
  const posicao = caderno.forma === "trilha" ? caderno.plano.findIndex((a) => a.id === id) + 1 : i + 1;

  // O texto: sem o bloco "Na sua realidade" (sobe para a caixa do alto).
  const pergunta = perguntaDaRealidade(lesson.body);
  const corpo = pergunta ? semARealidade(lesson.body) : lesson.body;
  const terms = lesson.translated ? getGlossary(lang).filter((g) => g.translated).map(({ slug, term, summary }) => ({ slug, term, summary })) : [];
  const letraGrande = track.area === "alfabetizacao" && track.stage !== "superior";
  const facil = versaoFacilDe(lesson.file, lang);
  const fatias = fatiar(corpo).map(({ minutos, titulo, ancora }) => ({ minutos, titulo, ancora }));
  const exercicios = ligado("exercicios") ? exerciciosDaAula(track.slug, lesson.slug) : [];
  const glossarioDaAula = lesson.terms.map((termo) => ({ term: termo.term, summary: termo.summary, slug: getGlossary(lang).find((g) => g.term.toLowerCase() === termo.term.toLowerCase())?.slug }));
  const termo = lesson.terms[0] ? { slug: glossarioDaAula[0].slug ?? "", term: lesson.terms[0].term, summary: lesson.terms[0].summary } : undefined;
  const caminhoNaTrilha = `/trilhas/${track.slug}/${lesson.slug}`;
  const textoCompleto = (
    <div id="texto-da-aula" className="mt-8">
      <Markdown lang={lang} terms={terms} tryCode={t.lesson.tryCode} sala={track.area} audio={letraGrande}>
        {corpo}
      </Markdown>
    </div>
  );

  // O "lembra?" do começo: a aula anterior do caderno, se tem questões.
  const anteriorNoSite = anterior ? getTrack(anterior.id.split("/")[0], lang)?.lessons.find((l) => l.slug === anterior.id.split("/")[1]) : undefined;
  const anteriores = anterior && anteriorNoSite && anteriorNoSite.quiz.length > 0 ? [{ aula: anterior.id, titulo: anterior.titulo, questoes: anteriorNoSite.quiz }] : [];

  // O treino: o papel do caderno e, como posição de quem pensa diferente, o "outro lado" da aula (ou o resumo dela).
  const papel = ta.treino.papeis[caderno.numero - 1];
  const habilidade = lesson.title.charAt(0).toLocaleLowerCase(lang) + lesson.title.slice(1);
  const trecho = (argumentoDoOutroLado(lesson.body) ?? lesson.summary).slice(0, 1200);
  const lista = caderno.prontas.map((a) => ({ id: a.id, path: a.href ?? hrefDoCaderno, title: a.titulo, ready: true }));
  const vizinha = (a: AulaDoCaderno | null) => (a && a.href ? { id: a.id, path: a.href, title: a.titulo } : undefined);

  return (
    <div className="efa-aula pagina-da-aula" data-escola-escura="" data-tela-da-escola="aula">
      <RememberLesson path={aula.href ?? hrefDoCaderno} title={lesson.title} track={caderno.nome} area={track.area} />
      <AcoesDaAula id={id} anterior={vizinha(anterior)} proxima={vizinha(proxima)} aulas={lista} escola={{ umaMao: sa.umaMao, letra: sa.letra, trilha: hrefDoCaderno }} />

      <header className="efa-cabeca">
        <Link href={localePath(lang, hrefDoCaderno)} className="efa-voltar">
          ← {preencher(ta.voltar, { n, nome: caderno.nome })}
        </Link>
        <Link href={localePath(lang, "/escola/duvida")} className="ef-botao-ouro efa-duvida">
          {ta.duvida}
        </Link>
      </header>

      <div className="efa-grade">
        <article className="folha-da-aula efa-folha" data-posicao={`${posicao}/${total}`} data-trilha={caderno.nome}>
          <span className="efa-olho">{preencher(ta.olho, { codigo: aula.codigo ?? "", lado: ladoRotulo, i: posicao, total })}</span>
          <div {...originalLang(lesson.translated)}>
            <h1 className="ef-t efa-titulo">{lesson.title}</h1>
            <p className="efa-resumo">{lesson.summary}</p>
          </div>
          {pergunta && (
            <div {...originalLang(lesson.translated)}>
              <NaSuaRealidade pergunta={pergunta} rotulo={ta.realidade} />
            </div>
          )}

          <OuvirAula minutos={fill(t.tracks.minutes, { n: lesson.minutes })} lexico={lerLexico()} avisoTelaApagada={sa.voz.telaApagada} />
          <LevezaDaAula
            lang={lang}
            libras={librasDaAula(id)}
            vlibrasLigado={ligado("vlibras")}
            hrefEmPortugues={localePath(defaultLocale, caminhoNaTrilha)}
            textoBytes={tamanhoDoTexto(lesson.title, lesson.summary, lesson.body)}
            caminhos={caminhosDeLevar(lang, track.slug, lesson.slug)}
            paginasDaTrilha={[localePath(lang, hrefDoCaderno), ...caderno.prontas.filter((a) => a.href).map((a) => localePath(lang, a.href!))]}
            trilhas={t.tracks}
            espelhos={espelhosDoSite()}
            s={textosDaLeveza(lang)}
          />
          <RetomarAqui aula={id} partes={fatias.length > 1} s={sa.retomar} />
          <Fatias aula={id} fatias={fatias} s={sa.fatias} />
          {anteriores.length > 0 && <LembraDaAnterior aula={id} candidatas={anteriores} s={avaliacao.lembra} />}
          <GravacaoDaAula lang={lang} caderno={caderno.slug} aula={id} cadernoAula={`${caderno.slug}/${(aula.href ?? "").split("/").pop() ?? ""}`} />

          <div {...originalLang(lesson.translated)}>
            {facil ? (
              <VersaoFacil
                completo={textoCompleto}
                facil={
                  <Markdown lang={lang} terms={terms} tryCode={t.lesson.tryCode} sala={track.area} audio={letraGrande}>
                    {facil.body}
                  </Markdown>
                }
                s={sa.facil}
              />
            ) : (
              textoCompleto
            )}
            {letraGrande && <OuvirParagrafo raiz="#texto-da-aula" s={sa.ouvir} />}
            <BarraDeSelecao termos={glossarioDaAula} titulo={lesson.title} endereco={site.url} s={sa.selecao} cartao={sa.cartao} />
            {lesson.quiz.length > 0 && <Quiz key={id} questions={lesson.quiz} registro={id} guardarNoAparelho={ligado("meu-estudo")} audio={letraGrande} />}
            {exercicios.length > 0 && <ExerciciosComExplicacao exercicios={exercicios} aula={id} s={estudo.exercicios} corrigir={`/contribuir?corrigir=${encodeURIComponent(caminhoNaTrilha)}`} praticar="/meu-estudo/praticar" />}
            {lesson.practice.length > 0 && <Pratica key={`pratica-${id}`} id={id} exercicios={lesson.practice} lingua={linguaDe(track.area)} s={t.practice} semPlacar={ligado("pratica-sem-placar")} lead={ligado("pratica-sem-placar") ? estudo.praticaSemPlacar.lead : undefined} />}
          </div>

          <ExpliqueComSuasPalavras aula={id} s={avaliacao.explique} />
          <RiscarNoQuadro lang={lang} aula={id} perguntas={lesson.quiz.length} proxima={proxima?.href ? { codigo: proxima.codigo ?? "", titulo: proxima.titulo, href: proxima.href } : null} caderno={hrefDoCaderno} t={ta} />
          <BaixarArquivoUnico titulo={lesson.title} url={`${site.url}${localePath(lang, caminhoNaTrilha)}`} lang={lang} seletor="article.folha-da-aula" s={t.compartilhar} />
          <StudyTools id={id} path={caminhoNaTrilha} s={t.study} titulo={lesson.title} sala={track.area} />
        </article>

        <aside aria-label={ta.lado} className="efa-lado">
          <DiarioDeFormacao aula={id} t={ta.diario} />
          <TreinoDeConversa lang={lang} aula={id} habilidade={habilidade} papel={papel} trecho={trecho} t={ta.treino} />
          {lesson.sources.length > 0 && (
            <section aria-labelledby="efa-fontes" className="efa-cartao efa-fontes">
              <h2 id="efa-fontes" className="ef-t">
                {ta.fontes}
              </h2>
              <ul {...originalLang(lesson.translated)}>
                {lesson.sources.map((f, k) => (
                  <li key={k}>
                    {f.author ? `${f.author}, ` : ""}
                    {f.url ? (
                      <a href={f.url} rel="noopener noreferrer" target="_blank">
                        <em>{f.title}</em>
                      </a>
                    ) : (
                      <em>{f.title}</em>
                    )}
                    {f.year ? ` (${f.year})` : ""}
                  </li>
                ))}
              </ul>
            </section>
          )}
          <section aria-label={ta.anotacoes} className="efa-margem">
            <MargemDaAula aula={id} termo={termo} />
          </section>
        </aside>
      </div>
    </div>
  );
}
