// Instituto Lúcia — © Jonathan Santos. Todos os direitos reservados.
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import rehypeSlug from "rehype-slug";
import remarkGfm from "remark-gfm";
import { localePath } from "@/i18n/config";
import { InlineCheck } from "./InlineCheck";
import { KeyboardDiagram, Staff } from "./Staff";

export interface GlossaryLink {
  slug: string;
  term: string;
  summary: string;
}

interface Node {
  type: string;
  value?: string;
  tagName?: string;
  url?: string;
  title?: string;
  children?: Node[];
  properties?: Record<string, unknown>;
  data?: Record<string, unknown>;
}

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Liga a primeira aparição de cada termo do glossário ao seu verbete, com a definição curta
 * no balão que aparece ao passar o mouse. Não mexe em títulos, links nem código.
 */
function linkGlossary(terms: GlossaryLink[]) {
  const pending = new Map(terms.map((term) => [term.term.toLowerCase(), term]));
  const walk = (node: Node) => {
    if (!node.children || ["link", "heading", "code", "inlineCode", "table"].includes(node.type)) return;
    const next: Node[] = [];
    for (const child of node.children) {
      if (child.type !== "text" || !child.value || pending.size === 0) {
        walk(child);
        next.push(child);
        continue;
      }
      let rest = child.value;
      while (pending.size > 0) {
        const pattern = new RegExp(`(?<![\\p{L}\\p{N}-])(${[...pending.keys()].sort((a, b) => b.length - a.length).map(escape).join("|")})(?![\\p{L}\\p{N}-])`, "iu");
        const match = pattern.exec(rest);
        if (!match) break;
        const term = pending.get(match[1].toLowerCase())!;
        pending.delete(match[1].toLowerCase());
        if (match.index > 0) next.push({ type: "text", value: rest.slice(0, match.index) });
        next.push({ type: "link", url: `/glossario#${term.slug}`, title: term.summary, data: { hProperties: { className: "termo" } }, children: [{ type: "text", value: match[1] }] });
        rest = rest.slice(match.index + match[1].length);
      }
      if (rest) next.push({ type: "text", value: rest });
    }
    node.children = next;
  };
  return () => (tree: Node) => walk(tree);
}

/** Numera os blocos de primeiro nível, para as anotações da comunidade saberem onde se prender. */
const numberBlocks = () => (tree: Node) => {
  let index = 0;
  for (const node of tree.children ?? []) {
    if (node.type === "element" && ["p", "ul", "ol", "blockquote"].includes(node.tagName ?? "")) {
      node.properties = { ...node.properties, "data-p": index++ };
    }
  }
};

const textOf = (node: Node | undefined): string => (node?.value ?? "") + (node?.children ?? []).map(textOf).join("");

// HTML cru não é interpretado e imagens ficam de fora: o acervo aceita só texto,
// o que evita tanto scripts quanto imagens de terceiros sem licença.
// Links internos ("/acervo/...") ganham o prefixo do idioma atual.
export function Markdown({ children, lang, terms, tryCode }: { children: string; lang: string; terms?: GlossaryLink[]; tryCode?: string }) {
  return (
    <div className="prose-lesson">
      <ReactMarkdown
        remarkPlugins={terms?.length ? [remarkGfm, linkGlossary(terms)] : [remarkGfm]}
        rehypePlugins={[rehypeSlug, numberBlocks]}
        disallowedElements={["img"]}
        components={{
          a: ({ href = "", children: label, className, title }) =>
            href.startsWith("/") ? (
              <Link href={localePath(lang, href)} className={className} title={title}>{label}</Link>
            ) : href.startsWith("#") ? (
              <a href={href}>{label}</a>
            ) : (
              <a href={href} target="_blank" rel="noopener noreferrer nofollow">
                {label}
              </a>
            ),
          table: ({ children: rows }) => (
            <div className="overflow-x-auto">
              <table>{rows}</table>
            </div>
          ),
          // Blocos de código com "idiomas" próprios viram pauta musical, teclado ou pergunta rápida.
          pre: ({ children: content, node }) => {
            const code = (node as Node | undefined)?.children?.[0];
            const language = String((code?.properties?.className as string[] | undefined)?.[0] ?? "").replace("language-", "");
            const source = textOf(code).replace(/\n$/, "");
            if (language === "pauta") return <Staff spec={source} />;
            if (language === "teclado") return <KeyboardDiagram spec={source} />;
            if (language === "verificar") return <InlineCheck spec={source} />;
            const runnable = (language === "python" || language === "php") && tryCode;
            return (
              <div>
                <pre>{content}</pre>
                {runnable && (
                  <p className="no-print !mt-1 text-right font-sans text-sm">
                    <Link href={`${localePath(lang, `/ferramentas/${language}`)}?codigo=${encodeURIComponent(source)}`}>
                      {tryCode} →
                    </Link>
                  </p>
                )}
              </div>
            );
          },
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
