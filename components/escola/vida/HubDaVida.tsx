// Instituto Lúcia — © Jonathan Santos. Licença: AGPL-3.0-or-later (veja LICENSE).
import Link from "@/components/Link";
import { type Locale, localePath } from "@/i18n/config";
import type { TextosDaVida } from "@/i18n/escola/vida";
import { ResumoDaVida } from "./ResumoDaVida";

const CARTOES = [
  { chave: "vozes", caminho: "/escola/vozes" },
  { chave: "lutas", caminho: "/escola/lutas" },
  { chave: "tarefas", caminho: "/vida/tarefas" },
  { chave: "missoes", caminho: "/vida/missoes" },
  { chave: "caso", caminho: "/vida/caso-do-bairro" },
  { chave: "documentos", caminho: "/vida/documentos" },
  // O círculo de cultura digital é do E4-15: aqui só entra o link, sem duplicar.
  { chave: "circulo", caminho: "/escola/turmas/circulo" },
] as const;

/** O hub "Vida real": reúne as peças e aponta para o círculo de cultura digital. Links puros, funciona sem JavaScript. */
export function HubDaVida({ s, lang, totalDeTarefas, totalDeMissoes }: { s: TextosDaVida["hub"]; lang: Locale; totalDeTarefas: number; totalDeMissoes: number }) {
  return (
    <div data-hub-da-vida="">
      <ResumoDaVida tarefas={totalDeTarefas} missoes={totalDeMissoes} s={{ tarefas: s.resumoTarefas, missoes: s.resumoMissoes }} />
      <ul className="vida-grade">
        {CARTOES.map(({ chave, caminho }) => (
          <li key={chave}>
            <Link href={localePath(lang, caminho)} className="vida-cartao vida-cartao-link" data-vida-cartao={chave}>
              <h2>{s.cartoes[chave].titulo}</h2>
              <p>{s.cartoes[chave].texto}</p>
              <p className="font-semibold">{s.abrir} →</p>
            </Link>
          </li>
        ))}
      </ul>
      <p className="vida-nota">{s.nota}</p>
    </div>
  );
}