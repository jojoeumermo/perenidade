import Link from "next/link";
import ReactMarkdown from "react-markdown";
import rehypeSlug from "rehype-slug";
import remarkGfm from "remark-gfm";
import { localePath } from "@/i18n/config";

// HTML cru não é interpretado e imagens ficam de fora: o acervo aceita só texto,
// o que evita tanto scripts quanto imagens de terceiros sem licença.
// Links internos ("/acervo/...") ganham o prefixo do idioma atual.
export function Markdown({ children, lang }: { children: string; lang: string }) {
  return (
    <div className="prose-lesson">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSlug]}
        disallowedElements={["img"]}
        components={{
          a: ({ href = "", children: label }) =>
            href.startsWith("/") ? (
              <Link href={localePath(lang, href)}>{label}</Link>
            ) : href.startsWith("#") ? (
              <a href={href}>{label}</a>
            ) : (
              <a href={href} target="_blank" rel="noopener noreferrer">
                {label}
              </a>
            ),
          table: ({ children: rows }) => (
            <div className="overflow-x-auto">
              <table>{rows}</table>
            </div>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
