import type { Metadata } from "next";
import { EB_Garamond, Inter, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

const serif = EB_Garamond({ variable: "--font-serif-display", subsets: ["latin"] });
const ui = Inter({ variable: "--font-ui", subsets: ["latin"] });
const mono = IBM_Plex_Mono({ variable: "--font-archive", subsets: ["latin"], weight: ["400", "500"] });

export const metadata: Metadata = {
  title: "Perenidade — a biblioteca comunitária",
  description:
    "Conhecimento livre, gratuito e preservado. Aulas, trilhas e um índice de obras de domínio público, mantidos pela comunidade.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${serif.variable} ${ui.variable} ${mono.variable} h-full antialiased`}>
      <body className="paper min-h-full flex flex-col">
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
