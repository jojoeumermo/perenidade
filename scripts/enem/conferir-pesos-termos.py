#!/usr/bin/env python3
# Confere os pesos do catálogo (public/sisu/ofertas.json) com os termos de adesão oficiais das IES
# (PDF com o template do MEC: "<codigo> - <curso>" + tabela PERCENTUAIS com peso por prova).
# Uso: python3 conferir-pesos-termos.py <dir com SIGLA.pdf + fontes.json> [caminho do ofertas.json]
import json, re, subprocess, sys, unicodedata
from pathlib import Path

DIR = Path(sys.argv[1])
OFERTAS = Path(sys.argv[2]) if len(sys.argv) > 2 else Path("public/sisu/ofertas.json")

def norm(s):
    s = unicodedata.normalize("NFD", s or "")
    s = "".join(c for c in s if not unicodedata.combining(c)).upper()
    return " ".join(s.split())

AREAS = [  # âncora -> posição no vetor [LC,CH,CN,MT,RED]
    ("LINGUAGENS", 0), ("CIENCIAS HUMANAS", 1), ("CIENCIAS DA NATUREZA", 2), ("MATEMATICA", 3), ("REDACAO", 4),
]

def extrair(pdf):
    """Pesos por CO_IES_CURSO de um termo no template MEC.
    Usa pdftotext -layout: no texto corrido as colunas Peso e Nota minima
    trocam de lugar por linha; no layout a 1a coluna numerica apos o nome
    da prova e sempre o PESO."""
    txt = subprocess.run(["pdftotext", "-layout", str(pdf), "-"], capture_output=True, text=True).stdout
    # nomes completos vem do texto corrido (o layout trunca nomes longos na largura da coluna)
    cru = subprocess.run(["pdftotext", str(pdf), "-"], capture_output=True, text=True).stdout
    nomes = {}
    for ln in cru.splitlines():
        mn = re.match(r"^\s*(\d{3,7})\s*-\s*(.{3,120})$", ln.strip())
        if mn and mn.group(1) not in nomes:
            nomes[mn.group(1)] = mn.group(2).strip()
    KW = [("REDACAO", 4), ("NATUREZA", 2), ("HUMANAS", 1), ("LINGUAGENS", 0), ("MATEMATICA", 3)]
    out = {}
    blocos = re.split(r"(?=^\s*\d{3,7} - [A-ZÀ-Ú])", txt, flags=re.M)
    # cidade do Local de Oferta mais recente antes de cada bloco
    locais = [(mm.start(), mm.group(1).strip(), mm.group(2)) for mm in re.finditer(r"Local de Oferta: \d+ - ([^()]+)\(([^(),]+),\s*[A-Z]{2}\)", txt)]
    pos = 0
    bounds = [mm.start() for mm in re.finditer(r"(?=^\s*\d{3,7} - [A-ZÀ-Ú])", txt, flags=re.M)]
    for i, b in enumerate(blocos):
        m = re.match(r"\s*(\d{3,7}) - (.+)", b)
        if not m or "PERCENTUAIS" not in b[:6000]:
            continue
        cod, nome = m.group(1), m.group(2).strip()
        inicio = bounds[i - 1] if 0 < i <= len(bounds) else 0
        cidade = None
        campus = None
        for li, camp, cid in locais:
            if li < inicio:
                cidade = cid.strip()
                campus = camp
            else:
                break
        mg = re.search(r"Grau:\s*([A-Za-zÀ-ú]+)", b)
        mt = re.search(r"Turno:\s*([A-Za-zÀ-ú]+)", b)
        pesos = [None] * 5
        pendente = None
        for linha in b.splitlines():
            if "Média mínima" in linha or "Prova do Enem" in linha:
                continue
            nums = re.findall(r"\d+,\d+", linha)
            achou = False
            for kw, pos in KW:
                if kw in norm(linha):
                    if nums:
                        pesos[pos] = float(nums[0].replace(",", "."))
                    else:
                        pendente = pos
                    achou = True
                    break
            if not achou and pendente is not None and nums:
                pesos[pendente] = float(nums[0].replace(",", "."))
                pendente = None
        if any(v is None for v in pesos) or cod in out:
            continue
        out[cod] = {"curso": nomes.get(cod, nome), "pesos": pesos,
                    "cidade": cidade,
                    "grau": norm(mg.group(1)) if mg else None,
                    "turno": norm(mt.group(1)) if mt else None,
                    "campus": norm(campus) if campus else None}
    return out

ofertas = json.load(open(OFERTAS, encoding="utf-8"))["ofertas"]
fontes = json.load(open(DIR / "fontes.json", encoding="utf-8"))
total = {"codigos": 0, "comparados": 0, "iguais": 0, "divergentes": 0, "sem_par": 0}
for sigla, url in fontes.items():
    pdf = DIR / f"{sigla}.pdf"
    if not pdf.exists():
        print(f"{sigla}: PDF ausente ({pdf})"); continue
    termo = extrair(pdf)
    nossas = [o for o in ofertas if o["sg"] == sigla]
    por_cod = {o.get("cod"): o for o in nossas if o.get("cod")}
    por_nome = {}
    for o in nossas:
        por_nome.setdefault(norm(o["curso"]), []).append(o)
    iguais = divergentes = sem_par = 0
    divs = []
    for cod, t in termo.items():
        alvo = por_cod.get(cod)
        if not alvo:
            cand = por_nome.get(norm(t["curso"]), [])
            if len(cand) > 1 and t.get("cidade"):
                # cidade e filtro DURO: sem oferta naquela cidade, nao casa com outro campus
                cand = [o for o in cand if norm(o.get("cidade", "")) == norm(t["cidade"])]
            if len(cand) > 1 and t.get("campus"):
                f = [o for o in cand if norm(o.get("campus", "")) == t["campus"]]
                if f:
                    cand = f
            if len(cand) > 1 and t.get("grau"):
                cand = [o for o in cand if norm(o.get("grau", "")).split()[0:1] == [t["grau"]]]
            elif len(cand) == 1 and t.get("grau") and norm(cand[0].get("grau", "")).split()[0:1] != [t["grau"]]:
                cand = []  # unico candidato mas grau diverge: oferta nao esta no catalogo
            if len(cand) > 1 and t.get("turno"):
                f = [o for o in cand if norm(o.get("turno", "")).split()[0:1] == [t["turno"]]]
                if f:
                    cand = f
            if len(cand) == 1:
                alvo = cand[0]
            elif len(cand) > 1 and t.get("turno"):
                p1 = [o for o in cand if norm(o["turno"]).split()[0] == t["turno"]]
                if len(p1) == 1:
                    alvo = p1[0]
        if not alvo or not alvo.get("p"):
            sem_par += 1; continue
        if alvo["p"] == t["pesos"]:
            iguais += 1
        else:
            divergentes += 1
            divs.append((cod, t["curso"][:40], t["pesos"], alvo["p"]))
    cobertura = sum(1 for o in nossas if o.get("p"))
    print(f"{sigla}: {len(termo)} códigos no termo | iguais {iguais} | divergentes {divergentes} | sem par no catálogo {sem_par} | fonte {url}")
    for d in divs[:10]:
        print(f"   DIVERGE {d[0]} {d[1]}: termo {d[2]} vs nosso {d[3]}")
    total["codigos"] += len(termo); total["comparados"] += iguais + divergentes
    total["iguais"] += iguais; total["divergentes"] += divergentes; total["sem_par"] += sem_par
print(f"TOTAL: {total['comparados']} comparados, {total['iguais']} iguais, {total['divergentes']} divergentes, {total['sem_par']} sem par")
