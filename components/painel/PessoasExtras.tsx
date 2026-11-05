// Instituto Lúcia. Licença: AGPL-3.0-or-later (veja LICENSE).
"use client";

import { BookOpen, BookOpenText, Check, Download, FileSignature, Users, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { groups } from "@/lib/areas";
import { type Role, rpc } from "@/lib/backend";
import { useI18n } from "../I18n";
import { Avatar } from "./Avatar";
import { Aviso, dataHora, GRUPOS_DEPARTAMENTO, papeis, textoDoErro, useAcao, useLista } from "./comum";
import { Botao, Busca, CabecalhoDeSecao, Cartao, type ColumnDef, Esqueleto, Estatistica, Estatisticas, Selecao, Selo, Tabela, Vazio } from "./ui";

interface FotoPendente {
  id: string;
  nome: string;
  foto: string;
  atual: string;
  enviada_em: string;
  funcoes: string[];
}

/** As fotos de perfil que esperam a coordenação: só depois de aprovadas aparecem nos cartões de quem ensina. */
export function FotosParaAprovar() {
  const lista = useLista<FotoPendente[]>("fotos_pendentes");
  const acao = useAcao(lista.recarregar);
  return (
    <section aria-labelledby="fotos-aprovar" className="space-y-3">
      <CabecalhoDeSecao
        id="fotos-aprovar"
        titulo="Fotos de perfil para aprovar"
        sobre="Cada pessoa da equipe pode pôr a própria foto. Ela aparece nos cartões de quem ensina, nas disciplinas e na página Quem somos, só depois de aprovada aqui. Aprove fotos de rosto, nítidas, sem outras pessoas e sem nada que identifique endereço ou escola."
      />
      <Aviso texto={lista.erro || acao.aviso} />
      {!lista.dados && !lista.erro && <Esqueleto forma="cartoes" linhas={3} />}
      {lista.dados?.length === 0 && <Vazio titulo="Nenhuma foto esperando." />}
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {lista.dados?.map((f) => (
          <li key={f.id}>
            <Cartao
              as="article"
              rodape={
                <span className="flex gap-2">
                  <Botao pequeno simbolo={Check} disabled={acao.ocupado} onClick={() => acao.agir("foto_decidir", { p_usuario: f.id, p_aprovar: true }, `Foto de ${f.nome} aprovada.`)}>
                    Aprovar
                  </Botao>
                  <Botao pequeno variante="discreto" perigo simbolo={X} disabled={acao.ocupado} onClick={() => acao.agir("foto_decidir", { p_usuario: f.id, p_aprovar: false }, "Recusada: a pessoa foi avisada.")}>
                    Recusar
                  </Botao>
                </span>
              }
            >
              <div className="flex items-center gap-4">
                <Avatar nome={f.nome} avatar={f.foto} className="h-24 w-24 rounded-lg border border-rule" />
                <div className="min-w-0">
                  <p className="font-semibold">{f.nome}</p>
                  <p className="pn-ajuda">{f.funcoes.join(", ")}</p>
                  <p className="pn-ajuda">enviada em {dataHora(f.enviada_em)}</p>
                  <p className="pn-ajuda mt-1 flex items-center gap-2">
                    hoje: <Avatar nome={f.nome} avatar={f.atual} className="h-7 w-7 rounded-full" />
                  </p>
                </div>
              </div>
            </Cartao>
          </li>
        ))}
      </ul>
    </section>
  );
}
interface Aceite {
  id: string | null;
  nome: string;
  termo: string;
  versao: string;
  sha256: string;
  dados: Record<string, unknown>;
  aceito_em: string;
  conta_apagada: boolean;
  /** Aceite de antes do registro integral: só a data e a versão, sem o texto guardado. */
  antigo?: boolean;
}
const NOME_DO_TERMO: Record<string, string> = { voluntario: "Termo de voluntário (entrada no painel)", adesao: "Termo de adesão (horas e certificados)", saude: "Termo do Mural de Saúde" };

/**
 * Os termos assinados, para sempre: nem a coordenação apaga. Dá para abrir o texto exato que a pessoa leu e baixar a
 * lista inteira numa planilha (CSV), o respaldo jurídico do voluntariado. A coordenação, a coordenação pedagógica e a
 * supervisão veem esta lista.
 */
export function TermosAceitos() {
  const lista = useLista<Aceite[]>("termos_aceites_listar");
  const [aberto, setAberto] = useState<{ id: string; texto: string } | null>(null);
  const [busca, setBusca] = useState("");
  const [tipo, setTipo] = useState("");
  const [erro, setErro] = useState("");
  /** O texto aberto aparece acima da tabela, longe da linha: o foco vai até ele, para o leitor de tela e o teclado o acharem. */
  const leitura = useRef<HTMLElement>(null);
  useEffect(() => {
    if (aberto) leitura.current?.focus();
  }, [aberto]);
  const todos = lista.dados ?? [];
  const vistos = todos.filter((a) => (!tipo || a.termo === tipo) && `${a.nome} ${a.termo}`.toLowerCase().includes(busca.toLowerCase()));
  const pessoas = new Set(todos.filter((a) => a.termo === "voluntario").map((a) => a.nome)).size;

  function baixarPlanilha() {
    const linhas = [["nome", "termo", "versao", "aceito_em", "sha256", "registro", "conta_apagada"], ...vistos.map((a) => [a.nome, NOME_DO_TERMO[a.termo] ?? a.termo, a.versao, a.aceito_em, a.sha256, a.antigo ? "anterior ao registro integral" : "texto guardado", a.conta_apagada ? "sim" : "não"])];
    const csv = linhas.map((l) => l.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(";")).join("\r\n");
    const url = URL.createObjectURL(new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `termos-assinados-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // A tabela não ganha busca própria: a busca e o filtro de termo daqui decidem também o que vai para a planilha.
  const colunas: ColumnDef<Aceite>[] = [
    {
      id: "nome",
      header: "Nome",
      accessorFn: (a) => a.nome,
      cell: ({ row: { original: a } }) => (
        <span className="grid gap-0.5">
          <span className="font-semibold">
            {a.nome}
            {a.conta_apagada ? " (conta apagada)" : ""}
          </span>
          {a.dados?.menor === true && (
            <span>
              <Selo tom="aviso">Menor de idade: responsável {String(a.dados.responsavel ?? "não informado")}</Selo>
            </span>
          )}
        </span>
      ),
    },
    { id: "termo", header: "Termo", accessorFn: (a) => NOME_DO_TERMO[a.termo] ?? a.termo, cell: ({ getValue }) => <span className="text-sm">{String(getValue())}</span> },
    { id: "versao", header: "Versão", accessorFn: (a) => a.versao, cell: ({ getValue }) => <span className="font-mono text-xs">versão {String(getValue())}</span> },
    { id: "aceito", header: "Aceito em", accessorFn: (a) => a.aceito_em, cell: ({ row }) => <span className="whitespace-nowrap tabular-nums">{dataHora(row.original.aceito_em)}</span> },
    {
      id: "registro",
      header: "SHA-256",
      accessorFn: (a) => a.sha256,
      enableSorting: false,
      cell: ({ row: { original: a } }) =>
        a.antigo ? <span className="pn-ajuda">Aceite anterior ao registro integral: ficou guardada a data, não o texto.</span> : <span className="block max-w-[16rem] break-all font-mono text-[0.65rem] text-ink-soft">{a.sha256}</span>,
    },
    {
      id: "ler",
      header: "",
      enableSorting: false,
      cell: ({ row: { original: a } }) =>
        a.id ? (
          <Botao
            variante="discreto"
            pequeno
            simbolo={BookOpenText}
            aria-expanded={aberto?.id === a.id}
            aria-controls={aberto?.id === a.id ? "termo-aberto" : undefined}
            onClick={async () => {
              try {
                const r = await rpc<{ texto: string }>("termos_aceites_listar", { p_texto_de: a.id });
                setAberto({ id: a.id as string, texto: r.texto });
              } catch (falha) {
                setErro(textoDoErro(falha));
              }
            }}
          >
            Ler o texto aceito
          </Botao>
        ) : null,
    },
  ];
  const lido = aberto ? todos.find((a) => a.id === aberto.id) : undefined;

  return (
    <section className="pn-tela">
      <p className="max-w-3xl text-ink-soft">Cada aceite fica guardado com o texto inteiro que a pessoa leu, a versão, a data e uma impressão digital (SHA-256) do texto. Ninguém altera nem apaga, nem a coordenação; se a conta for apagada, o aceite continua. É a prova do voluntariado, sem vínculo de emprego (Lei nº 9.608/1998), e da licença do que foi publicado.</p>
      <Aviso texto={lista.erro || erro} />
      <Estatisticas>
        <Estatistica rotulo="Aceites guardados" valor={todos.length} />
        <Estatistica rotulo="Voluntários com termo" valor={pessoas} />
        <Estatistica rotulo="Sem o texto (antigos)" valor={todos.filter((a) => a.antigo).length} tom={todos.some((a) => a.antigo) ? "aviso" : "neutro"} />
      </Estatisticas>
      <div className="pn-barra-ferramentas flex flex-wrap items-end gap-3">
        <div className="min-w-60 flex-1">
          <Busca rotulo="Buscar pelo nome" rotuloVisivel valor={busca} aoMudar={setBusca} />
        </div>
        <Selecao rotulo="Termo" value={tipo} onChange={(e) => setTipo(e.target.value)}>
          <option value="">Todos</option>
          {Object.entries(NOME_DO_TERMO).map(([id, nome]) => (
            <option key={id} value={id}>
              {nome}
            </option>
          ))}
        </Selecao>
        <Botao simbolo={Download} onClick={baixarPlanilha} disabled={!vistos.length}>
          Baixar a lista (CSV)
        </Botao>
      </div>
      {aberto && lido && (
        <Cartao
          ref={leitura}
          as="section"
          id="termo-aberto"
          tabIndex={-1}
          aria-label={`Texto aceito por ${lido.nome}`}
          variante="destaque"
          titulo={lido.nome}
          nivelDoTitulo={3}
          sobre={`${NOME_DO_TERMO[lido.termo] ?? lido.termo} · versão ${lido.versao} · ${dataHora(lido.aceito_em)}`}
          acoes={<Botao variante="discreto" pequeno icone simbolo={X} aria-label="Fechar" dica="Fechar" onClick={() => setAberto(null)} />}
        >
          <pre className="mt-2 max-h-[50vh] overflow-auto whitespace-pre-wrap font-sans text-sm">{aberto.texto}</pre>
        </Cartao>
      )}
      {!lista.dados && !lista.erro ? (
        <Esqueleto forma="tabela" linhas={6} rotulo="Carregando" />
      ) : (
        lista.dados && <Tabela dados={vistos} colunas={colunas} legenda="Termos assinados" porPagina={50} alturaMaxima="70vh" vazio={<Vazio simbolo={FileSignature} titulo="Nenhum termo encontrado." />} />
      )}
    </section>
  );
}
interface PessoaDaEquipe {
  id: string;
  nome: string;
  papeis: Role[];
}

/**
 * Os departamentos: as funções (curadoria, tradução, design…) e, na educação, as áreas que reúnem disciplinas
 * (Tecnologia reúne informática, programação, modelagem 3D, edição de vídeo e de foto). Cada um com os representantes
 * (podem ser vários) e quem trabalha nele.
 */
export function Departamentos({ pessoas }: { pessoas: PessoaDaEquipe[] }) {
  const { t } = useI18n();
  const nomeDaArea = (slug: string) => t.areas[slug as keyof typeof t.areas]?.[0] ?? slug;
  const reps = (dep: string) => pessoas.filter((p) => p.papeis.some((r) => r.papel === "representante" && r.disciplina === dep));
  const areas = groups.map((g) => ({
    id: `grupo-${g.id}`,
    nome: GRUPOS_DEPARTAMENTO[`grupo-${g.id}`] ?? g.id,
    disciplinas: g.areas as readonly string[],
  }));
  // O Departamento de Comunicação reúne duas funções: o jornal, a rádio e o podcast (jornalismo) e o marketing.
  const funcoes: { id: string; nome: string; papeis: string[] }[] = [
    ...(["curadoria", "mediacao", "revisao", "traducao"] as const).map((f) => ({ id: f, nome: papeis[f], papeis: [f] })),
    { id: "jornalismo", nome: "Departamento de Comunicação (jornal, rádio, podcast e marketing)", papeis: ["jornalismo", "marketing"] },
    ...(["mentoria", "desenvolvimento", "saude"] as const).map((f) => ({ id: f, nome: papeis[f], papeis: [f] })),
  ];
  return (
    <section aria-labelledby="departamentos-visao" className="space-y-4">
      <CabecalhoDeSecao
        id="departamentos-visao"
        titulo="Departamentos"
        sobre="Departamento não é a disciplina: é tudo o que a área engloba. Na educação, cada área reúne as disciplinas dela; nas outras funções, o departamento é a própria função. Um departamento pode ter vários representantes (nomeie em Confiar função › Representante do departamento)."
      />
      <p className="pn-rotulo-mono">Educação, por área</p>
      <ul className="grid gap-3 md:grid-cols-2">
        {areas.map((a) => {
          const educadores = pessoas.filter((p) => p.papeis.some((r) => (r.papel === "educacao" || r.papel === "educacao_secundaria") && r.disciplina && a.disciplinas.includes(r.disciplina)));
          return (
            <li key={a.id}>
              <Cartao as="article" className="h-full" titulo={a.nome} nivelDoTitulo={3} sobre={a.disciplinas.map(nomeDaArea).join(" · ")} acoes={<Selo tom={educadores.length ? "neutro" : "aviso"}>Educadores: {educadores.length}</Selo>}>
                <p className="mt-2 flex items-start gap-1.5 text-sm">
                  <BookOpen aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-ink-soft" />
                  <span>
                    <strong>Representantes:</strong> {reps(a.id).map((p) => p.nome).join(", ") || "ninguém ainda"}
                  </span>
                </p>
              </Cartao>
            </li>
          );
        })}
      </ul>
      <p className="pn-rotulo-mono">Outras funções</p>
      <ul className="grid gap-3 md:grid-cols-3">
        {funcoes.map((f) => {
          const quantas = pessoas.filter((p) => p.papeis.some((r) => f.papeis.includes(r.papel))).length;
          return (
            <li key={f.id}>
              <Cartao as="article" className="h-full" titulo={f.nome} nivelDoTitulo={3}>
                <p className="mt-2 text-sm">
                  <strong>Representantes:</strong>{" "}
                  {f.papeis
                    .flatMap((id) => reps(id))
                    .map((p) => p.nome)
                    .filter((n, i, l) => l.indexOf(n) === i)
                    .join(", ") || "ninguém ainda"}
                </p>
                <p className="mt-1 flex items-center gap-1.5 text-sm">
                  <Users aria-hidden className="h-4 w-4 text-ink-soft" />
                  <strong>Pessoas:</strong> <span className="tabular-nums">{quantas}</span>
                </p>
              </Cartao>
            </li>
          );
        })}
      </ul>
    </section>
  );
}