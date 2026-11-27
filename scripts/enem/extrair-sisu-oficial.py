#!/usr/bin/env python3
# Extrai as linhas da AMPLA concorrência dos relatórios oficiais do Sisu (xlsx do MEC, em
# data/relatorios/ do clone sisu-data) para CSVs simples consumidos pelo gerar-sisu.mjs.
# Uso: python3 extrair-sisu-oficial.py <dir do sisu-data>
import openpyxl, csv, sys, os, unicodedata

DIR = sys.argv[1]
ARQS = {
    2020: "Portal Sisu_Sisu 2020-1_Inscrições e notas de corte.xlsx",
    2022: "Portal Sisu_Inscrições e notas de corte_Sisu 2022-1.xlsx",
    2023: "Portal Sisu_Sisu 2023-1_Inscrições e notas de corte.xlsx",
    2024: "Portal Sisu_Sisu 2024_Inscrições e notas de corte.xlsx",
    2025: "Portal Sisu_Sisu 2025_Inscrições e notas de corte.xlsx",
}
SAIDA = os.path.join(DIR, "data", "relatorios", "extraidos")
os.makedirs(SAIDA, exist_ok=True)

for ano, nome in ARQS.items():
    caminho = os.path.join(DIR, "data", "relatorios", nome)
    wb = openpyxl.load_workbook(caminho, read_only=True)
    aba = [s for s in wb.sheetnames if "inscri" in s.lower()][0]
    ws = wb[aba]
    it = ws.iter_rows(values_only=True)
    hdr = [str(h) for h in next(it)]
    ix = {h: i for i, h in enumerate(hdr)}
    # 2024/2025: TIPO_CONCORRENCIA="AC"; 2022/2023: TP_MOD_CONCORRENCIA; 2020: TP_MODALIDADE
    # (os dois últimos com o nome por extenso, "Ampla concorrência")
    col_mod = next(c for c in ("TIPO_CONCORRENCIA", "TP_MOD_CONCORRENCIA", "TP_MODALIDADE") if c in ix)
    def eh_ampla(v):
        v = str(v).strip().upper()
        return v in ("AC", "A") or v.startswith("AMPLA")  # 2024/25: "AC"; 2023: "A"; 2020/2022: por extenso
    n = 0
    with open(os.path.join(SAIDA, f"{ano}.csv"), "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f, delimiter=";")
        w.writerow(["co_ies_curso", "sigla", "ies", "campus", "cidade", "uf", "curso", "grau", "turno", "vagas_ac", "nota"])
        for r in it:
            if not eh_ampla(r[ix[col_mod]]): continue
            nota = r[ix["NU_NOTACORTE"]]
            if nota in (None, "", "-"): continue
            w.writerow([r[ix["CO_IES_CURSO"]], r[ix["SG_IES"]], r[ix["NO_IES"]], r[ix["NO_CAMPUS"]], r[ix["NO_MUNICIPIO_CAMPUS"]], r[ix["SG_UF_CAMPUS"]], r[ix["NO_CURSO"]], r[ix["DS_GRAU"]], r[ix["DS_TURNO"]], r[ix["QT_VAGAS_OFERTADAS" if "QT_VAGAS_OFERTADAS" in ix else "QT_VAGAS_CONCORRENCIA"]], nota])
            n += 1
    wb.close()
    print(f"{ano}: {n} linhas da ampla extraídas ({aba})")
