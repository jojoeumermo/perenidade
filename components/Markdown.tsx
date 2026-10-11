// Instituto Lúcia — © Jonathan Santos. Todos os direitos reservados.
import Link from "next/link";
import ReactMarkdown, { defaultUrlTransform } from "react-markdown";
import rehypeSlug from "rehype-slug";
import remarkGfm from "remark-gfm";
import { localePath } from "@/i18n/config";
import { InlineCheck } from "./InlineCheck";
import { PendingImage, VideoEmbed } from "./LessonMedia";
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

/** Imagem enviada pela equipe e ainda não publicada: "envio:<pessoa>/<arquivo>". */
const pending = /^envio:([0-9a-f-]{36}\/[a-z0-9-]{8,60}\.(webp|jpg))$/;

/** Conta passo a passo: a expressão na primeira linha e uma passagem por linha, cada uma começando com "=". */
function Calculation({ spec }: { spec: string }) {
  const lines = spec.split("\n").map((line) => line.trim()).filter(Boolean);
  return (
    <div className="conta" role="math" aria-label={lines.join(" ")}>
      {lines.map((line, i) => (
        <div key={i} className={line.startsWith("=") ? "passo" : undefined}>
          {line}
        </div>
      ))}
    </div>
  );
}

// HTML cru não é interpretado. Imagens só as guardadas no próprio site (/arquivos, /imagens): nada de
// terceiros é carregado, e toda imagem publicada passou pela equipe. Vídeo só aparece quando a pessoa pede.
// Links internos ("/acervo/...") ganham o prefixo do idioma atual.
export function Markdown({ children, lang, terms, tryCode }: { children: string; lang: string; terms?: GlossaryLink[]; tryCode?: string }) {
  return (
    <div className="prose-lesson">
      <ReactMarkdown
        remarkPlugins={terms?.length ? [remarkGfm, linkGlossary(terms)] : [remarkGfm]}
        rehypePlugins={[rehypeSlug, numberBlocks]}
        urlTransform={(url) => (pending.test(url) ? url : defaultUrlTransform(url))}
        components={{
          // A legenda vem do título da imagem: ![descrição](/arquivos/x.webp "Autor, licença").
          img: ({ src, alt = "", title }) => {
            const address = typeof src === "string" ? src : "";
            const waiting = pending.exec(address);
            if (waiting) return <PendingImage path={waiting[1]} alt={alt} caption={title} />;
            if (!/^\/(arquivos|imagens)\/[A-Za-z0-9/._-]+$/.test(address)) return null;
            return (
              <span className="figura">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={address} alt={alt} loading="lazy" decoding="async" />
                {title && <span className="legenda">{title}</span>}
              </span>
            );
          },
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
            if (language === "video") return <VideoEmbed spec={source} />;
            if (language === "conta") return <Calculation spec={source} />;
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
