"""Atualiza somente os KMs de pagamento dos registros existentes no JSON.

Requer Python com openpyxl. Sem --aplicar, apenas gera o relatório.
"""
import argparse
import copy
import hashlib
import json
import math
import re
import unicodedata
from collections import defaultdict
from datetime import datetime
from pathlib import Path

import openpyxl


def normalizar(valor):
    texto = unicodedata.normalize("NFKD", str(valor or ""))
    return " ".join("".join(c for c in texto if not unicodedata.combining(c)).upper().split())


def empresa(valor):
    texto = normalizar(valor)
    return "PLUSVAL" if texto == "PLUVAL" else texto


def chave(produtor, aviario, emissor):
    return normalizar(produtor), normalizar(aviario), empresa(emissor)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    pasta = Path(__file__).resolve().parent
    parser.add_argument("--planilha", type=Path, default=pasta / "CALCULO CTe.xlsx")
    parser.add_argument("--json", type=Path, default=pasta / "produtores-km.json")
    parser.add_argument("--aplicar", action="store_true")
    args = parser.parse_args()
    original = args.json.read_bytes()
    texto = original.decode("utf-8-sig")
    dados = json.loads(texto)
    antes = copy.deepcopy(dados)
    workbook = openpyxl.load_workbook(args.planilha, data_only=True, read_only=True)
    sheet = workbook["CALCULO CTE"]
    linhas = sheet.iter_rows(values_only=True)
    cabecalho = next(linhas)
    if cabecalho[:3] != ("CLIFFOR", "ENIR", "SO") or normalizar(cabecalho[5]) != "KM DISTANCIA":
        raise ValueError("Layout inesperado na aba CALCULO CTE; nenhuma alteração aplicada.")
    indice = defaultdict(list)
    for numero, row in enumerate(linhas, 2):
        if row[1]:
            indice[chave(row[1], row[2], row[4])].append((numero, row))
    workbook.close()
    relatorio = {"fonte": args.planilha.name, "aba": "CALCULO CTE", "coluna": "F - KM distancia",
                 "total": len(dados["produtores"]), "alterados": [], "semCorrespondencia": [],
                 "pendencias": [], "semAlteracao": 0}
    for posicao, produtor in enumerate(dados["produtores"]):
        identidade = {k: produtor.get(k) for k in ("cliffor", "produtor", "aviario", "empresa")}
        candidatos = indice.get(chave(produtor["produtor"], produtor.get("aviario"), produtor.get("empresa")), [])
        if not candidatos:
            relatorio["semCorrespondencia"].append(identidade)
            continue
        if len(candidatos) > 1:
            por_codigo = [item for item in candidatos if normalizar(item[1][0]) == normalizar(produtor.get("cliffor"))]
            if por_codigo:
                candidatos = por_codigo
        valores = {str(row[5]) for _, row in candidatos}
        if len(valores) != 1:
            relatorio["pendencias"].append({**identidade, "motivo": "KMs conflitantes", "linhas": [n for n, _ in candidatos]})
            continue
        valor = candidatos[0][1][5]
        if isinstance(valor, bool) or not isinstance(valor, (int, float)) or not math.isfinite(valor) or valor <= 0:
            relatorio["pendencias"].append({**identidade, "motivo": "KM distancia inválido", "valor": valor, "linha": candidatos[0][0]})
            continue
        valor = math.ceil(valor)
        campos = [campo for campo in ("distancia", "kmPagamento", "distanciaPagamento") if campo in produtor]
        mudancas = {campo: {"antes": produtor[campo], "depois": valor} for campo in campos if produtor[campo] != valor}
        for campo in mudancas:
            produtor[campo] = valor
        if mudancas:
            relatorio["alterados"].append({**identidade, "indiceJson": posicao, "linhaPlanilha": candidatos[0][0], "campos": mudancas})
        else:
            relatorio["semAlteracao"] += 1
    # Patches por objeto preservam a formatação e todos os outros campos existentes.
    objetos = list(re.finditer(r'\{[^{}]*"produtor"\s*:[^{}]*\}', texto))
    if len(objetos) != len(dados["produtores"]):
        raise ValueError("Estrutura JSON inesperada; nenhuma alteração aplicada.")
    for mudanca in reversed(relatorio["alterados"]):
        trecho = objetos[mudanca["indiceJson"]]
        novo = trecho.group()
        for campo, valores in mudanca["campos"].items():
            novo, quantidade = re.subn(r'("' + campo + r'"\s*:\s*)-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?',
                                      lambda m: m.group(1) + json.dumps(valores["depois"]), novo)
            if quantidade != 1:
                raise ValueError(f"Campo inesperado: {campo}; nenhuma alteração aplicada.")
        texto = texto[:trecho.start()] + novo + texto[trecho.end():]
    texto = re.sub(r'("total"\s*:\s*)\d+', lambda m: m.group(1) + str(relatorio["total"]), texto, count=1)
    esperado = copy.deepcopy(dados)
    esperado["total"] = relatorio["total"]
    assert json.loads(texto) == esperado
    assert len(antes["produtores"]) == len(dados["produtores"])
    for velho, novo in zip(antes["produtores"], dados["produtores"]):
        assert {k: v for k, v in velho.items() if k not in ("distancia", "kmPagamento", "distanciaPagamento")} == {
            k: v for k, v in novo.items() if k not in ("distancia", "kmPagamento", "distanciaPagamento")}
    if args.aplicar:
        if args.json.read_bytes() != original:
            raise RuntimeError("JSON alterado durante a comparação; execute novamente.")
        backup = args.json.with_name(args.json.name + "." + datetime.now().strftime("%Y%m%d-%H%M%S-%f") + ".bak")
        backup.write_bytes(original)
        assert hashlib.sha256(backup.read_bytes()).digest() == hashlib.sha256(original).digest()
        args.json.write_bytes(texto.encode("utf-8-sig" if original.startswith(b'\xef\xbb\xbf') else "utf-8"))
        assert json.loads(args.json.read_text(encoding="utf-8-sig")) == esperado
        relatorio["backup"] = backup.name
    relatorio["aplicado"] = args.aplicar
    destino = args.json.with_name("relatorio-sincronizacao-km.json")
    destino.write_text(json.dumps(relatorio, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"aplicado": args.aplicar, "total": relatorio["total"], "alterados": len(relatorio["alterados"]),
                      "semCorrespondencia": len(relatorio["semCorrespondencia"]), "pendencias": relatorio["pendencias"],
                      "semAlteracao": relatorio["semAlteracao"], "relatorio": str(destino)}, ensure_ascii=True))


if __name__ == "__main__":
    main()
