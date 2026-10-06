import { TrackCard } from "@/components/Cards";
import { PageHeading } from "@/components/PageHeading";
import { areas } from "@/lib/areas";
import { getTracks } from "@/lib/content";

export const metadata = {
  title: "Trilhas",
  description: "Sequências de aulas gratuitas, escritas e revisadas pela comunidade.",
};

export default function Trilhas() {
  const tracks = getTracks();
  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <PageHeading eyebrow="Aprendizado guiado" title="Trilhas">
        Aulas curtas, em sequência, com um teste no final de cada uma. Seu progresso fica salvo neste navegador.
      </PageHeading>
      {areas.map((area) => {
        const inArea = tracks.filter((t) => t.area === area.slug);
        if (inArea.length === 0) return null;
        return (
          <section key={area.slug}>
            <h2 className="mt-12 border-b border-rule pb-3 text-3xl font-semibold">{area.name}</h2>
            <div className="mt-6 grid gap-5 md:grid-cols-2">
              {inArea.map((track) => (
                <TrackCard key={track.slug} track={track} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
