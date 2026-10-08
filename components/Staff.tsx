// Instituto Lúcia — © Jonathan Santos. Todos os direitos reservados.

// Desenha uma pauta musical a partir de um texto simples, para as aulas de música.
// Exemplo dentro de uma aula:
//
//   ```pauta
//   clave: sol
//   compasso: 4/4
//   notas: C4/4 D4/4 E4/4 F4/4 | G4/2 G4/2 | A4/1
//   nomes: sim
//   ```
//
// Cada nota é LetraOitava/Duração: C4 é o dó central; # e b logo depois da letra são sustenido e bemol.
// Durações: 1 semibreve, 2 mínima, 4 semínima, 8 colcheia. "r/4" é uma pausa. "|" é a barra de compasso.

const LETTERS = "CDEFGAB";
const NAMES: Record<string, string> = { C: "dó", D: "ré", E: "mi", F: "fá", G: "sol", A: "lá", B: "si" };
const GAP = 12; // distância entre duas linhas da pauta
const TOP = 46; // altura da linha de cima

interface Note {
  kind: "note" | "rest" | "bar";
  letter?: string;
  accidental?: string;
  octave?: number;
  duration?: number;
}

function parse(spec: string) {
  const fields: Record<string, string> = {};
  for (const line of spec.split("\n")) {
    const at = line.indexOf(":");
    if (at > 0) fields[line.slice(0, at).trim().toLowerCase()] = line.slice(at + 1).trim();
  }
  const notes: Note[] = (fields.notas ?? "")
    .split(/\s+/)
    .filter(Boolean)
    .flatMap((token): Note[] => {
      if (token === "|") return [{ kind: "bar" }];
      const rest = /^r\/(1|2|4|8)$/i.exec(token);
      if (rest) return [{ kind: "rest", duration: Number(rest[1]) }];
      const note = /^([A-Ga-g])([#b]?)(\d)\/(1|2|4|8)$/.exec(token);
      if (!note) return [];
      return [{ kind: "note", letter: note[1].toUpperCase(), accidental: note[2], octave: Number(note[3]), duration: Number(note[4]) }];
    });
  return { clef: fields.clave === "fa" || fields.clave === "fá" ? "fa" : "sol", time: fields.compasso ?? "", names: /^(sim|s|yes)$/i.test(fields.nomes ?? ""), notes };
}

/** Clave de sol desenhada à mão (sem depender de fonte musical instalada no aparelho). */
function TrebleClef({ x }: { x: number }) {
  const g = TOP + 3 * GAP; // linha do sol
  return (
    <path
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      d={`M ${x + 9} ${g + 6} c -5 0 -8 -5 -5 -10 c 4 -6 14 -4 15 5 c 1 9 -8 15 -17 12 c -11 -4 -12 -18 -4 -27 c 6 -7 17 -15 16 -27 c -1 -7 -7 -6 -10 3 c -2 8 1 22 5 44 c 2 12 1 22 -7 23 c -6 1 -9 -5 -5 -8`}
    />
  );
}

function BassClef({ x }: { x: number }) {
  const f = TOP + GAP; // linha do fá
  return (
    <g fill="currentColor">
      <circle cx={x + 4} cy={f} r="3.6" />
      <path fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" d={`M ${x + 4} ${f} c 2 -9 18 -9 19 4 c 1 13 -11 22 -21 27`} />
      <circle cx={x + 29} cy={f - GAP / 2} r="2.2" />
      <circle cx={x + 29} cy={f + GAP / 2} r="2.2" />
    </g>
  );
}

/** `secret` esconde o nome das notas da descrição lida em voz alta (para exercícios de leitura). */
export function Staff({ spec, secret = false }: { spec: string; secret?: boolean }) {
  const { clef, time, names, notes } = parse(spec);
  // Posição diatônica contada a partir da linha de baixo: mi3... na clave de sol é o E4; na de fá, o G2.
  const bottom = clef === "sol" ? 4 * 7 + 2 : 2 * 7 + 4;
  const bottomY = TOP + 4 * GAP;
  const start = time ? 92 : 64;
  const step = 44;
  const width = start + notes.length * step + 16;
  const height = TOP + 4 * GAP + (names ? 62 : 44);
  const [beats, unit] = time.split("/");

  const marks = notes.map((note, i) => {
    const x = start + step / 2 + i * step;
    if (note.kind === "bar") return <line key={i} x1={x - step / 2} x2={x - step / 2} y1={TOP} y2={bottomY} stroke="currentColor" strokeWidth="1.4" />;
    if (note.kind === "rest") {
      const y = TOP + 2 * GAP;
      // Pausas de semibreve e mínima são um bloquinho preso à linha; as curtas, um traço inclinado.
      if (note.duration === 1) return <rect key={i} x={x - 8} y={TOP + GAP} width="16" height={GAP / 2} fill="currentColor" />;
      if (note.duration === 2) return <rect key={i} x={x - 8} y={y - GAP / 2} width="16" height={GAP / 2} fill="currentColor" />;
      return (
        <path key={i} fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"
          d={note.duration === 4 ? `M ${x - 3} ${y - 14} l 7 9 l -7 7 l 6 9 c -8 -4 -11 2 -5 8` : `M ${x - 4} ${y - 6} c 3 3 7 2 9 -1 l -6 20`} />
      );
    }
    const position = note.octave! * 7 + LETTERS.indexOf(note.letter!) - bottom;
    const y = bottomY - (position * GAP) / 2;
    const up = position < 4;
    const hollow = note.duration === 1 || note.duration === 2;
    const ledgers: number[] = [];
    for (let p = -2; p >= position; p -= 2) ledgers.push(p);
    for (let p = 10; p <= position; p += 2) ledgers.push(p);
    const stemX = up ? x + 6.6 : x - 6.6;
    const stemEnd = up ? y - 34 : y + 34;
    return (
      <g key={i}>
        {ledgers.map((p) => (
          <line key={p} x1={x - 12} x2={x + 12} y1={bottomY - (p * GAP) / 2} y2={bottomY - (p * GAP) / 2} stroke="currentColor" strokeWidth="1.2" />
        ))}
        {note.accidental && (
          <text x={x - 20} y={y + 5} fontSize="17" fill="currentColor">{note.accidental === "#" ? "♯" : "♭"}</text>
        )}
        <ellipse cx={x} cy={y} rx="7.2" ry="5.2" transform={`rotate(-20 ${x} ${y})`} fill={hollow ? "none" : "currentColor"} stroke="currentColor" strokeWidth="1.8" />
        {note.duration !== 1 && <line x1={stemX} x2={stemX} y1={y} y2={stemEnd} stroke="currentColor" strokeWidth="1.6" />}
        {note.duration === 8 && (
          <path fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"
            d={up ? `M ${stemX} ${stemEnd} c 2 8 10 9 8 20` : `M ${stemX} ${stemEnd} c 2 -8 10 -9 8 -20`} />
        )}
        {names && (
          <text x={x} y={height - 8} textAnchor="middle" fontSize="13" fill="currentColor" className="font-sans">
            {NAMES[note.letter!]}
            {note.accidental === "#" ? "♯" : note.accidental === "b" ? "♭" : ""}
          </text>
        )}
      </g>
    );
  });

  const described = notes
    .map((note) => (note.kind === "bar" ? "|" : note.kind === "rest" ? "pausa" : `${NAMES[note.letter!]}${note.accidental === "#" ? " sustenido" : note.accidental === "b" ? " bemol" : ""}`))
    .join(" ");

  return (
    <div className="overflow-x-auto border border-rule bg-parchment-deep p-3">
      <svg role="img" aria-label={`Pauta na clave de ${clef === "sol" ? "sol" : "fá"}${secret ? "" : `: ${described}`}`} viewBox={`0 0 ${width} ${height}`} width={width} height={height} className="max-w-none text-ink">
        {[0, 1, 2, 3, 4].map((line) => (
          <line key={line} x1="6" x2={width - 6} y1={TOP + line * GAP} y2={TOP + line * GAP} stroke="currentColor" strokeWidth="1" />
        ))}
        {clef === "sol" ? <TrebleClef x={14} /> : <BassClef x={14} />}
        {time && (
          <g fontSize="24" fontWeight="700" fill="currentColor" textAnchor="middle" className="font-serif">
            <text x="70" y={TOP + 2 * GAP - 2}>{beats}</text>
            <text x="70" y={TOP + 4 * GAP - 2}>{unit}</text>
          </g>
        )}
        {marks}
        <line x1={width - 6} x2={width - 6} y1={TOP} y2={bottomY} stroke="currentColor" strokeWidth="2.4" />
      </svg>
    </div>
  );
}

/** Teclado de piano com algumas teclas marcadas: ```teclado\nC4 E4 G4\n``` */
export function KeyboardDiagram({ spec }: { spec: string }) {
  const marked = new Set(
    spec
      .split(/\s+/)
      .map((token) => /^([A-Ga-g])([#b]?)(\d)$/.exec(token))
      .filter((match) => match !== null)
      .map((match) => `${match[1].toUpperCase()}${match[2]}${match[3]}`),
  );
  const whites = ["C", "D", "E", "F", "G", "A", "B"];
  const blacks: Record<string, string> = { C: "C#", D: "D#", F: "F#", G: "G#", A: "A#" };
  const flats: Record<string, string> = { "C#": "Db", "D#": "Eb", "F#": "Gb", "G#": "Ab", "A#": "Bb" };
  const keys = [3, 4].flatMap((octave) => whites.map((letter) => ({ letter, octave })));
  const w = 30;
  const isOn = (name: string, octave: number) => marked.has(`${name}${octave}`) || marked.has(`${flats[name] ?? name}${octave}`);
  return (
    <div className="overflow-x-auto border border-rule bg-parchment-deep p-3">
      <svg role="img" aria-label={`Teclado com as notas ${[...marked].join(", ")}`} viewBox={`0 0 ${keys.length * w + 2} 118`} width={keys.length * w + 2} height="118" className="max-w-none text-ink">
        {keys.map(({ letter, octave }, i) => (
          <g key={`${letter}${octave}`}>
            <rect x={1 + i * w} y="1" width={w} height="96" fill={isOn(letter, octave) ? "var(--gold)" : "var(--parchment)"} stroke="currentColor" />
            <text x={1 + i * w + w / 2} y="113" textAnchor="middle" fontSize="11" fill="currentColor" className="font-sans">
              {NAMES[letter]}
              {letter === "C" ? octave : ""}
            </text>
          </g>
        ))}
        {keys.map(({ letter, octave }, i) =>
          blacks[letter] ? (
            <rect key={`${letter}#${octave}`} x={1 + i * w + w * 0.68} y="1" width={w * 0.64} height="60" fill={isOn(blacks[letter], octave) ? "var(--oxblood)" : "var(--ink)"} stroke="currentColor" />
          ) : null,
        )}
      </svg>
    </div>
  );
}
