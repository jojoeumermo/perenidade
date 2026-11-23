// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

// Item 101: o calendário de inscrições, por programa (ENEM, SISU, ProUni, FIES, Encceja), sobre a agenda de provas da onda 11: só
// datas com a fonte oficial e o dia da conferência, e o lembrete 7 dias e 1 dia antes para quem assina. A data entra pela agenda de
// provas (quem cuida); aqui não se inventa data nenhuma.
import Link from "@/components/Link";
import { agenda } from "@/components/rede/estudo/agenda/cliente";
import { ehInscricao, porPrograma } from "@/lib/rede/descoberta-estudo/inscricoes";
import { Botao } from "../ui/Botao";
import { EstadoDaAlumia } from "../ui/Estado";
import { Bloco, Mensagem, fraseDoErro, por, useAcao, useLeitura, type PropsDaParte } from "./comum";

const dia = (lang: string, d: string) => new Intl.DateTimeFormat(lang, { weekday: "short", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${d}T12:00:00Z`));

export default function Inscricoes({ t, lang }: PropsDaParte) {
  const k = t.inscricoes;
  const leitura = useLeitura("agenda", () => agenda.datas());
  const acao = useAcao(t, leitura.recarregar);
  if (leitura.erro) {
    return (
      <EstadoDaAlumia erro texto={fraseDoErro(t, leitura.erro)}>
        <Botao variante="contorno" onClick={leitura.recarregar}>{t.tentar}</Botao>
      </EstadoDaAlumia>
    );
  }
  if (!leitura.dado) return <p role="status" className="de-miudo">{t.carregando}</p>;
  const grupos = porPrograma(leitura.dado.itens, leitura.dado.hoje);
  return (
    <Bloco titulo={k.titulo} ajuda={k.ajuda}>
      <ul className="de-lista">
        {grupos.map(({ programa, datas }) => (
          <li key={programa.chave} className="de-item">
            <h3 className="de-form-titulo">{programa.nome}</h3>
            {datas.length === 0 ? (
              <p className="de-miudo">{k.semData}</p>
            ) : (
              <ul className="de-lista">
                {datas.map((d) => (
                  <li key={d.id} className={`de-data${ehInscricao(d.etapa) ? " de-data-inscricao" : ""}`}>
                    <strong>{dia(lang, d.dia)}{d.hora ? ` · ${d.hora}` : ""}</strong>
                    <span>{d.exame} · {d.etapa}</span>
                    <span className="de-miudo">
                      {por(k.conferida, { orgao: d.orgao, dia: d.conferido_em.split("-").reverse().join("/") })}{" "}
                      <a className="de-link" href={d.fonte} target="_blank" rel="noopener noreferrer nofollow">{k.fonte}</a>
                    </span>
                    <Botao variante={d.assinada ? "claro" : "contorno"} pressionado={d.assinada} disabled={acao.ocupado}
                      onClick={() => void acao.fazer(async () => (await agenda.assinar([d.id], !d.assinada), d.assinada ? k.semLembrete : k.comLembrete))}>
                      {d.assinada ? k.lembrando : k.lembrar}
                    </Botao>
                  </li>
                ))}
              </ul>
            )}
            <a className="de-link" href={programa.oficial} target="_blank" rel="noopener noreferrer nofollow">{por(k.paginaOficial, { programa: programa.nome })}</a>
          </li>
        ))}
      </ul>
      <Mensagem mensagem={acao.mensagem} />
      <p className="de-miudo">{k.regra}</p>
      {leitura.dado.pode_cuidar && <p className="de-miudo">{k.cuida} <Link href={`/${lang}/alumia/agenda`}>{k.agenda}</Link></p>}
    </Bloco>
  );
}
