"""Reconciliação privada, offline e sem acesso a bancos do legado Orders."""
from __future__ import annotations

import argparse
import collections
import datetime as dt
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
import hashlib
import html
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import shutil
import stat
import unicodedata
import xml.etree.ElementTree as ET
from zipfile import ZipFile

SRC = OUT = PROMPT = GOOGLE_DIR = None
NS = {"s": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
SOURCE_ID = "grazing-legado-orders"
ZERO = Decimal("0")
CENT = Decimal("0.01")
UFS_BR = "AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO".split()
UF_RE = r"(?:" + "|".join(UFS_BR) + r")"
DDDS_BR = set("11 12 13 14 15 16 17 18 19 21 22 24 27 28 31 32 33 34 35 37 38 41 42 43 44 45 46 47 48 49 51 53 54 55 61 62 63 64 65 66 67 68 69 71 73 74 75 77 79 81 82 83 84 85 86 87 88 89 91 92 93 94 95 96 97 98 99".split())
CEP_RE = r"(?<!\d)(\d{5})-?(\d{3})(?!\d)"
CEP_FRAGMENTO_RE = re.compile(r"\s*(?:CEP\s*[:=-]?\s*)?(\d{5})[ -]?(\d{3})\s*", re.I)
ESTADOS_BR = dict(zip(("Acre|Alagoas|Amapá|Amazonas|Bahia|Ceará|Distrito Federal|Espírito Santo|Goiás|Maranhão|Mato Grosso|Mato Grosso do Sul|Minas Gerais|Pará|Paraíba|Paraná|Pernambuco|Piauí|Rio de Janeiro|Rio Grande do Norte|Rio Grande do Sul|Rondônia|Roraima|Santa Catarina|São Paulo|Sergipe|Tocantins").split("|"), "AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO".split()))
COMPLEMENTO_EXPLICITO_RE = re.compile(r"^(?:(?:ap(?:to)?\.?|apartamento|bloco|torre|andar|sala|cj\.?|conjunto|loja|cobertura)\s*(?:[-:.]\s*)?(?:\d|[A-Z]\b)|(?:casa|fundos|sobrado)(?:\s+(?:\d.*|fundos|frente))?\s*$)", re.I)


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def col(index):
    result = ""
    while index:
        index, mod = divmod(index - 1, 26)
        result = chr(65 + mod) + result
    return result


def colindex(label):
    value = 0
    for char in label:
        value = value * 26 + ord(char) - 64
    return value


def norm(value):
    return re.sub(r"\s+", " ", html.unescape(str(value or ""))).strip()


def keytext(value):
    return "".join(c for c in unicodedata.normalize("NFKD", norm(value).casefold()) if not unicodedata.combining(c))


def validate_headers(workbook):
    expected = {
        "A": "Nome do usuário", "B": "Nome completo (cobrança)", "C": "Full Adress (Billing)",
        "D": "Empresa (cobrança)", "E": "Data do Pedido", "F": "Paid Date",
        "G": "Celular / Whatsapp (cobrança)", "H": "Full Adress (Billing)",
        "I": "Número do pedido", "J": "Payment Method Title", "AY": "Valor total dos produtos",
        "AZ": "Frete", "BA": "Valor total do pedido", "BB": "Transaction ID", "BC": "Order Notes",
        "BD": "Nome completo (entrega)", "BE": "E-mail do usuário do cliente", "BF": "Celular", "BG": "Email",
    }
    for block in range(10):
        for offset, name in enumerate(["Item Name", "Quantidade", "Custo do item", "Valor do desconto do item"]):
            expected[col(11 + block * 4 + offset)] = f"{name} #{block + 1}"
    if len(workbook["linhas"][0]["celulas"]) != 59:
        return False
    headers = workbook["linhas"][0]["valores"]
    return all(keytext(headers[colindex(label) - 1]) == keytext(header) for label, header in expected.items())


def dec(value):
    if value is None or str(value).strip() == "":
        return None
    return Decimal(str(value))


def exact(value):
    return None if value is None else format(value, "f")


def money(value):
    return None if value is None else format(value.quantize(CENT, rounding=ROUND_HALF_UP), ".2f")


class PlainHTML(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.parts = []
        self.blocked = 0

    def handle_starttag(self, tag, attrs):
        if tag.casefold() in {"script", "style"}:
            self.blocked += 1
        elif tag.casefold() in {"br", "p", "div", "li"} and not self.blocked:
            self.parts.append("\n")

    def handle_endtag(self, tag):
        if tag.casefold() in {"script", "style"}:
            self.blocked = max(0, self.blocked - 1)
        elif tag.casefold() in {"p", "div", "li"} and not self.blocked:
            self.parts.append("\n")

    def handle_data(self, data):
        if not self.blocked:
            self.parts.append(data)


def plaintext(value):
    parser = PlainHTML()
    parser.feed(str(value or ""))
    return "\n".join(line.strip() for line in html.unescape("".join(parser.parts)).splitlines() if line.strip())


def datevalue(value, date1904=False):
    if value is None or value == "":
        return None
    serial = dec(value)
    epoch = dt.datetime(1904, 1, 1) if date1904 else dt.datetime(1899, 12, 30)
    # O serial é um relógio local. Não converter o fuso dos metadados da planilha.
    micros = int((serial * Decimal(86400_000000)).quantize(Decimal("1"), rounding=ROUND_HALF_UP))
    local = epoch + dt.timedelta(microseconds=micros)
    second = local.replace(microsecond=0) + dt.timedelta(seconds=1 if local.microsecond >= 500000 else 0)
    return {"serial_original": str(value), "local_exato": local.isoformat(), "local_segundo": second.isoformat(),
            "exibicao_minuto": local.strftime("%Y-%m-%d %H:%M"), "mes": local.strftime("%Y-%m"),
            "fuso_hipotese": "America/Sao_Paulo", "conversao_fuso_aplicada": False,
            "metodo": "serial_excel_local_sem_deslocamento; segundos arredondados apenas em local_segundo"}


def read_xlsx(path):
    with ZipFile(path) as archive:
        workbook = ET.fromstring(archive.read("xl/workbook.xml"))
        properties = workbook.find("s:workbookPr", NS)
        date1904 = properties is not None and properties.attrib.get("date1904") in {"1", "true"}
        strings = []
        if "xl/sharedStrings.xml" in archive.namelist():
            for item in ET.fromstring(archive.read("xl/sharedStrings.xml")):
                strings.append("".join(t.text or "" for t in item.iter(f"{{{NS['s']}}}t")))
        relationships = ET.fromstring(archive.read("xl/_rels/workbook.xml.rels"))
        targets = {item.attrib["Id"]: item.attrib["Target"] for item in relationships}
        sheet = next(x for x in workbook.find("s:sheets", NS) if x.attrib["name"] == "Orders")
        relationship = sheet.attrib["{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id"]
        target = targets[relationship]
        target = target.lstrip("/") if target.startswith("/") else "xl/" + target
        tree = ET.fromstring(archive.read(target))
        rows = []
        formula_count = 0
        for row in tree.findall("s:sheetData/s:row", NS):
            cells = {}
            values = [None] * 59
            for cell in row:
                address = cell.attrib["r"]
                label = re.sub(r"\d", "", address)
                v = cell.find("s:v", NS)
                raw = v.text if v is not None else None
                formula = cell.find("s:f", NS)
                dtype = cell.attrib.get("t", "n")
                value = strings[int(raw)] if dtype == "s" and raw is not None else raw
                if dtype == "inlineStr":
                    value = "".join(t.text or "" for t in cell.iter(f"{{{NS['s']}}}t"))
                cells[label] = {"endereco": address, "tipo": dtype, "estilo": cell.attrib.get("s"),
                                "valor_xml": raw, "valor": value, "formula": formula.text if formula is not None else None}
                if formula is not None:
                    formula_count += 1
                index = colindex(label)
                if index > 59:
                    raise ValueError("Coluna fora do intervalo contratado")
                values[index - 1] = value
            rows.append({"linha": int(row.attrib["r"]), "valores": values, "celulas": cells})
        return {"aba": "Orders", "sheetId_excel": sheet.attrib["sheetId"], "date1904": date1904,
                "dimensao": tree.find("s:dimension", NS).attrib["ref"], "formulas": formula_count, "linhas": rows}


TRANSITIONS = re.compile(r"Status do pedido alterado de ([^.\n]+?) para ([^.\n]+?)\.")


def statusinfo(note):
    text = plaintext(note)
    matches = [{"de": norm(m.group(1)), "para": norm(m.group(2)), "offset_inicio": m.start(), "offset_fim": m.end()}
               for m in TRANSITIONS.finditer(text)]
    forward = sum(a["para"] == b["de"] for a, b in zip(matches, matches[1:]))
    reverse = sum(a["de"] == b["para"] for a, b in zip(matches, matches[1:]))
    edges = max(0, len(matches) - 1)
    final = None
    method = "sem_transicao"
    if len(matches) == 1:
        final, method = matches[0]["para"], "transicao_unica"
    elif edges and reverse == edges and forward < edges:
        final, method = matches[0]["para"], "ordem_reversa_validada_por_cadeia_completa"
    elif edges and forward == edges and reverse < edges:
        final, method = matches[-1]["para"], "ordem_direta_validada_por_cadeia_completa"
    elif edges and forward == reverse == edges and len({m["para"] for m in matches}) == 1:
        final, method = matches[0]["para"], "estado_constante"
    elif edges:
        method = "cadeia_inconsistente_ou_ambigua_nao_derivar_final"
    return {"transicoes": matches, "arestas": edges, "continuidade_direta": forward,
            "continuidade_reversa": reverse, "final_legado": final, "regra": method,
            "evidencia_atendimento": "status_legado_retirado" if final == "Retirado" else "nao_comprovado",
            "modalidade_entrega": None, "data_entrega": None,
            "adicoes_itens_em_notas": len(re.findall(r"Itens? de linha adicionados?", text, re.I)),
            "exclusoes_itens_em_notas": len(re.findall(r"(?:exclu[ií]dos?|removidos?)", text, re.I)),
            "referencias_nf": re.findall(r"\bNF\s*[-:#.]?\s*(\d{2,10})\b", text, re.I),
            "nf_autenticada": False, "texto_seguro": text}


def emailvalue(value, source):
    normalized = norm(value).casefold()
    return {"origem": source, "original": value, "normalizado": normalized or None,
            "valido_sintaticamente": bool(re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", normalized))}


def nacional_br_valido(digits):
    if len(digits) not in {10, 11} or digits[:2] not in DDDS_BR:
        return False
    subscriber = digits[2:]
    return bool(re.fullmatch(r"9\d{8}", subscriber) if len(digits) == 11 else re.fullmatch(r"[2-5]\d{7}", subscriber))


def phonevalue(value, source, country_evidence=None):
    original = norm(value)
    digits = re.sub(r"\D", "", original)
    explicit = original.startswith("+") or original.startswith("00")
    if original.startswith("00"):
        digits = digits[2:]
    compatible = bool(re.fullmatch(r"[+\d().\s-]+", original)) and original.count("+") <= 1 and ("+" not in original or original.startswith("+"))
    exported_prefix_br = compatible and len(digits) in {12, 13} and digits.startswith("55") and nacional_br_valido(digits[2:])
    national_with_country = compatible and country_evidence is not None and country_evidence.get("pais") == "BR" and nacional_br_valido(digits)
    evidence = None
    e164 = None
    rule = "digitos_sem_acrescentar_pais"
    if exported_prefix_br:
        e164 = "+" + digits
        rule = "prefixo_55_exportado_validado_sem_acrescentar_digitos"
        evidence = {"pais": "BR", "regra": "prefixo_55_ja_exportado_validado", "origem": source,
                    "ddi_ja_presente": True, "ddd_assinante_validados": True}
    elif national_with_country:
        e164 = "+55" + digits
        rule = "ddi_55_com_evidencia_de_pais; numero_nacional_preservado_sem_inserir_nono_digito"
        evidence = dict(country_evidence)
        evidence["ddi_ja_presente"] = False
        evidence["ddd_assinante_validados"] = True
    elif compatible and explicit and re.fullmatch(r"[1-9]\d{7,14}", digits) and not digits.startswith("55"):
        e164 = "+" + digits
        rule = "formato_internacional_exportado; pais_nao_classificado"
    return {"origem": source, "original": value, "digitos_preservados": digits or None,
            "pais_explicito": "BR" if exported_prefix_br else None,
            "pais_verificado": "BR" if evidence else None, "evidencia_pais": evidence,
            "codigo_pais_acrescentado": bool(national_with_country and not exported_prefix_br),
            "e164": e164, "normalizacao": rule,
            "plausivel": 8 <= len(digits) <= 15}


def addressvalue(value, source, buyer_name=None):
    text = plaintext(value)
    cep_matches = list(re.finditer(CEP_RE, text))
    cep_values = {"".join(m.groups()) for m in cep_matches}
    fragments = []
    for match in re.finditer(r"[^\n;]+", text):
        part = match.group().strip()
        if not part:
            continue
        start = match.start() + len(match.group()) - len(match.group().lstrip())
        fragments.append({"texto": part, "inicio": start, "fim": start + len(part)})
    postal_fragments = {index: "".join(m.groups()) for index, f in enumerate(fragments)
                        if (m := CEP_FRAGMENTO_RE.fullmatch(f["texto"]))}
    structured = {campo: None for campo in ["logradouro", "numero", "complemento", "bairro", "municipio"]}
    field_proofs = {}
    buyer_first = bool(fragments and norm(buyer_name) and norm(fragments[0]["texto"]) == norm(buyer_name))
    state_names = {keytext(nome): uf for nome, uf in ESTADOS_BR.items()}
    postal_tail = None
    if buyer_first and len(fragments) >= 5 and len(fragments) - 1 in postal_fragments:
        city = fragments[-3]["texto"]
        uf = state_names.get(keytext(fragments[-2]["texto"]))
        if uf and city and not re.search(r"\d", city):
            postal_tail = {"cep": postal_fragments[len(fragments) - 1], "uf": uf,
                           "municipio_original": city, "indice_estado": len(fragments) - 2,
                           "indice_municipio": len(fragments) - 3, "indice_cep": len(fragments) - 1}

    def prove_field(campo, valor, index, rule, start=None, end=None, confirmed=True):
        fragment = fragments[index]
        field_proofs[campo] = {"origem": source, "fragmento_indice": index,
                              "inicio": fragment["inicio"] if start is None else start,
                              "fim": fragment["fim"] if end is None else end,
                              "regra": rule, "confirmado": confirmed}
        if campo in structured:
            structured[campo] = valor

    if buyer_first and len(fragments) > 1:
        street = re.fullmatch(r"(?P<logradouro>.+?),\s*(?P<numero>\d[\dA-Za-z/-]{0,29}|[Ss]/[Nn])\s*", fragments[1]["texto"])
        if street and len(street.group("logradouro").strip()) <= 200:
            for campo in ["logradouro", "numero"]:
                prove_field(campo, street.group(campo).strip(), 1, "linha_apos_nome_comprador_com_logradouro_numero_delimitados",
                            fragments[1]["inicio"] + street.start(campo), fragments[1]["inicio"] + street.end(campo))
    if postal_tail and len(fragments) in {6, 7} and COMPLEMENTO_EXPLICITO_RE.match(fragments[2]["texto"]):
        prove_field("complemento", fragments[2]["texto"], 2, "marcador_explicito_complemento_apos_logradouro_em_bloco_postal")
    for index, fragment in enumerate(fragments):
        bairro = re.fullmatch(r"\s*Bairro\s*:\s*(.+?)\s*", fragment["texto"], re.I)
        if bairro:
            prove_field("bairro", bairro.group(1), index, "rotulo_bairro_explicito",
                        fragment["inicio"] + bairro.start(1), fragment["inicio"] + bairro.end(1))
    candidates = [{"valor": m.group(), "inicio": m.start(), "fim": m.end(), "confirmada": False,
                   "regra": "sigla_sem_posicao_inequivoca",
                   "complemento_aparente": m.group() == "AP" and bool(re.match(r"\s*[.:-]?\s*\d", text[m.end():]))}
                  for m in re.finditer(r"\b" + UF_RE + r"\b", text)]
    evidence = []

    def confirm_uf(uf, start, end, rule, cep=None):
        candidate = next((c for c in candidates if c["inicio"] == start and c["fim"] == end), None)
        if candidate is None:
            candidate = {"valor": uf.upper(), "inicio": start, "fim": end, "confirmada": False,
                         "regra": "sigla_sem_posicao_inequivoca", "complemento_aparente": False}
            candidates.append(candidate)
        candidate.update({"valor": uf.upper(), "confirmada": True, "regra": rule})
        candidate["texto_original"] = text[start:end]
        if cep:
            evidence.append({"pais": "BR", "regra": "uf_e_cep_em_posicao_inequivoca", "origem": source,
                             "uf": uf.upper(), "cep": cep, "posicao_uf": [start, end],
                             "inferido_pelo_endereco_cobranca": True})

    def nearby_postal(index):
        # CEP próprio a até duas linhas da UF. AP seguido por número em um
        # complemento não é uma posição municipal e não confirma estado.
        if postal_tail and abs(index - postal_tail["indice_cep"]) <= 2:
            return postal_tail["cep"]
        for other in range(max(0, index - 2), min(len(fragments), index + 3)):
            if other not in postal_fragments:
                continue
            between = fragments[min(index, other) + 1:max(index, other)]
            if any(re.search(r"\d|\b(?:ap|apto|apartamento|complemento|bloco)\b", f["texto"], re.I) for f in between):
                continue
            if len(text[fragments[min(index, other)]["inicio"]:fragments[max(index, other)]["fim"]]) <= 160:
                return postal_fragments[other]
        return None

    bad_city = re.compile(r"\b(?:rua|avenida|estrada|rodovia|logradouro|ap|apto|apartamento|complemento|bloco|casa|quadra|lote|cep)\b", re.I)
    for index, fragment in enumerate(fragments):
        part = fragment["texto"]
        for match in re.finditer(r"\b(?:UF|Estado)\s*[:=-]\s*(?P<uf>" + UF_RE + r")\b", part, re.I):
            confirm_uf(match.group("uf"), fragment["inicio"] + match.start("uf"), fragment["inicio"] + match.end("uf"), "rotulo_uf_explicito", nearby_postal(index))
        municipal = re.fullmatch(r"\s*(?P<cidade>[^\d\n;]+?)\s*[-/]\s*(?P<uf>" + UF_RE + r")\s*", part, re.I)
        if municipal and len(municipal.group("cidade").strip()) >= 2 and not bad_city.search(municipal.group("cidade")):
            if cep := nearby_postal(index):
                confirm_uf(municipal.group("uf"), fragment["inicio"] + municipal.start("uf"), fragment["inicio"] + municipal.end("uf"), "sufixo_municipal_com_cep_postal", cep)
        single_uf = re.fullmatch(r"\s*(?P<uf>" + UF_RE + r")\s*", part, re.I)
        if single_uf and index > 0 and not re.search(r"\d", fragments[index - 1]["texto"]) and not bad_city.search(fragments[index - 1]["texto"]):
            if cep := nearby_postal(index):
                confirm_uf(single_uf.group("uf"), fragment["inicio"] + single_uf.start("uf"), fragment["inicio"] + single_uf.end("uf"), "uf_em_fragmento_municipal_com_cep_postal", cep)

    if postal_tail:
        index = postal_tail["indice_estado"]
        confirm_uf(postal_tail["uf"], fragments[index]["inicio"], fragments[index]["fim"],
                   "nome_estado_extenso_em_bloco_postal_apos_comprador", postal_tail["cep"])

    country_labels = list(re.finditer(r"\b(?:Pa[ií]s|Country)\s*[:=-]\s*([^\n;]+)", text, re.I))
    foreign_label = any(keytext(m.group(1)) not in {"brasil", "brazil", "br"} for m in country_labels)
    for match in country_labels:
        if keytext(match.group(1)) in {"brasil", "brazil", "br"}:
            evidence.append({"pais": "BR", "regra": "pais_br_rotulado_explicitamente", "origem": source,
                             "posicao": [match.start(1), match.end(1)], "inferido_pelo_endereco_cobranca": False})
    if len(fragments) > 1 and keytext(fragments[-1]["texto"]) in {"brasil", "brazil"} and len(fragments) - 2 in postal_fragments:
        evidence.append({"pais": "BR", "regra": "pais_br_terminal_apos_cep", "origem": source,
                         "inferido_pelo_endereco_cobranca": False})
    confirmed = {c["valor"] for c in candidates if c["confirmada"]}
    conflict = foreign_label or len(confirmed) > 1 or len(cep_values) > 1 and postal_tail is None
    if conflict:
        evidence = []
    selected_cep = postal_tail["cep"] if postal_tail else next(iter(cep_values)) if len(cep_values) == 1 else None
    selected_uf = next(iter(confirmed)) if len(confirmed) == 1 and not conflict else None
    if postal_tail and not conflict:
        city = postal_tail["municipio_original"]
        suffix = re.search(r"\s*[-/]\s*(" + UF_RE + r")\s*$", city, re.I)
        if suffix and suffix.group(1).upper() == selected_uf:
            city = city[:suffix.start()].strip()
        prove_field("municipio", city, postal_tail["indice_municipio"], "municipio_antes_de_estado_extenso_e_cep_em_bloco_comprador")
        prove_field("cep", selected_cep, postal_tail["indice_cep"], "cep_terminal_em_bloco_postal_com_estado_extenso")
    elif selected_cep:
        match = next(m for m in cep_matches if "".join(m.groups()) == selected_cep)
        field_proofs["cep"] = {"origem": source, "inicio": match.start(), "fim": match.end(),
                               "regra": "padrao_de_cep_sem_confirmacao_de_finalidade_postal", "confirmado": False}
    if selected_uf:
        candidate = next(c for c in candidates if c["confirmada"] and c["valor"] == selected_uf)
        field_proofs["uf"] = {"origem": source, "inicio": candidate["inicio"], "fim": candidate["fim"],
                              "regra": candidate["regra"], "confirmado": True}
    return {"origem": source, "original": value, "texto": text or None, "finalidade": "cobranca_cabecalho",
            "entrega_confirmada": False, "fragmentos": [f["texto"] for f in fragments],
            "cep": selected_cep, "uf": selected_uf,
            "uf_candidatas": candidates, "pais_evidencias": evidence, "localidade_conflitante": conflict,
            "termo_brasil_sem_papel_confirmado": bool(re.search(r"\b(?:brasil|brazil)\b", text, re.I)) and not any(not e["inferido_pelo_endereco_cobranca"] for e in evidence),
            **structured, "provas_campos": field_proofs,
            "regra": "campos_por_rotulo_ou_formato_cobranca_com_nome_comprador_e_bloco_postal_comprovavel; bairro_sem_template_nao_inferido; candidatos_nao_confirmam_UF"}


def normalize_row(raw, date1904=False):
    values = raw["valores"]
    get = lambda label: values[colindex(label) - 1]
    order = norm(get("I"))
    errors = []
    items = []
    for block in range(10):
        start = 11 + block * 4
        labels = [col(start + i) for i in range(4)]
        vals = [get(label) for label in labels]
        if all(v in {None, ""} for v in vals):
            continue
        name, quantity, price, discount = vals
        try:
            q, p, d = dec(quantity), dec(price), dec(discount)
        except InvalidOperation:
            q = p = d = None
            errors.append({"codigo": "numero_item_invalido", "bloco": block + 1})
        incomplete = not norm(name) or q is None or p is None
        if incomplete:
            errors.append({"codigo": "bloco_item_incompleto", "bloco": block + 1})
        net = q * p if q is not None and p is not None else None
        items.append({"bloco": block + 1, "colunas": labels, "linha": raw["linha"], "originais": vals,
                      "nome_original": name, "nome_normalizado": norm(name), "chave_nome": keytext(name),
                      "quantidade": exact(q), "preco_unitario_liquido": exact(p), "desconto_linha": exact(d),
                      "desconto_ausente": d is None, "liquido_linha": exact(net),
                      "bruto_linha_reconstruido": exact(net + (d or ZERO)) if net is not None else None,
                      "incompleto": incomplete, "produto_externo_nao_identificado": keytext(name) == "produto externo",
                      "consumo_apurado": None, "custo_historico_comprovado": None})
    subtotal, freight, total = dec(get("AY")), dec(get("AZ")), dec(get("BA"))
    net = sum((dec(item["liquido_linha"]) or ZERO for item in items), ZERO)
    discounts = sum((dec(item["desconto_linha"]) or ZERO for item in items), ZERO)
    gross = net + discounts
    product_delta = subtotal - gross if subtotal is not None else None
    expected = net + freight if freight is not None else None
    total_delta = total - expected if total is not None and expected is not None else None
    if product_delta != ZERO:
        errors.append({"codigo": "diferenca_subtotal_bruto", "valor": exact(product_delta)})
    if total_delta != ZERO:
        errors.append({"codigo": "diferenca_total_final", "valor": exact(total_delta)})
    if subtotal is None or freight is None or total is None:
        errors.append({"codigo": "total_ou_frete_ausente"})
    if freight is not None and freight < ZERO:
        errors.append({"codigo": "ajuste_legado_negativo_a_classificar", "valor": exact(freight)})
    if len(items) == 10 and (product_delta or total_delta):
        errors.append({"codigo": "dez_blocos_e_diferenca_possivel_truncamento_nao_comprovado"})
    status = statusinfo(get("BC"))
    if status["regra"] in {"sem_transicao", "cadeia_inconsistente_ou_ambigua_nao_derivar_final"}:
        errors.append({"codigo": "status_final_nao_apurado"})
    emails = [emailvalue(get("BE"), "BE"), emailvalue(get("BG"), "BG")]
    addresses = [addressvalue(get("C"), "C", get("B")), addressvalue(get("H"), "H", get("B"))]
    country_evidences = [e for a in addresses for e in a["pais_evidencias"]]
    country_evidence = country_evidences[0] if country_evidences and not any(a["localidade_conflitante"] for a in addresses) else None
    phones = [phonevalue(get("G"), "G", country_evidence), phonevalue(get("BF"), "BF", country_evidence)]
    valid_emails = {x["normalizado"] for x in emails if x["valido_sintaticamente"]}
    valid_phones = {x["digitos_preservados"] for x in phones if x["plausivel"]}
    if len(valid_emails) > 1:
        errors.append({"codigo": "emails_alternativos_divergentes"})
    if len(valid_phones) > 1:
        errors.append({"codigo": "telefones_alternativos_divergentes"})
    buyer_name = norm(get("B"))
    recipient = norm(get("BD"))
    if buyer_name and recipient and keytext(buyer_name) != keytext(recipient):
        errors.append({"codigo": "comprador_diferente_destinatario"})
    creation, paid = datevalue(get("E"), date1904), datevalue(get("F"), date1904)
    if creation and creation["mes"] == "2025-12":
        errors.append({"codigo": "criacao_2025_preservada"})
    if creation and paid and creation["mes"] < "2026-09" <= paid["mes"]:
        errors.append({"codigo": "pagamento_informado_setembro_de_pedido_anterior"})
    remaining = product_delta if product_delta is not None and product_delta > ZERO else ZERO
    remaining_total_after_partial = total_delta - remaining if total_delta is not None else None
    return {"linha": raw["linha"], "numero_original": order, "origem": SOURCE_ID,
            "chave_deduplicacao": SOURCE_ID + ":" + order,
            "hash_linha": hashlib.sha256(json.dumps(values, ensure_ascii=False, separators=(",", ":")).encode()).hexdigest(),
            "raw": raw, "data_criacao": creation, "pagamento_informado": paid, "liquidacao_comprovada": None,
            "metodo_pagamento_original": get("J"), "transaction_id_original": get("BB"),
            "itens": items, "quantidade_blocos": len(items),
            "totais": {"liquido_itens": exact(net), "desconto_itens": exact(discounts),
                       "bruto_reconstruido": exact(gross), "subtotal_produtos_original": exact(subtotal),
                       "frete_ajuste_original": exact(freight), "total_original": exact(total),
                       "total_calculado_itens_mais_frete": exact(expected), "diferenca_produtos": exact(product_delta),
                       "diferenca_total": exact(total_delta), "valor_historico_nao_detalhado": exact(remaining),
                       "diferenca_total_apos_nao_detalhado": exact(remaining_total_after_partial),
                       "frete_classificacao": "ajuste_legado_a_classificar" if freight is not None and freight < ZERO else "frete_cobrado_legado",
                       "custo_logistico": None, "zero_final_preservado": total == ZERO,
                       "arredondamento": "Decimal exato do XML; nao aplicado arredondamento aos calculos; exibicao monetaria a 2 casas HALF_UP"},
            "comprador": {"nome_cobranca": get("B"), "nome_usuario_original": get("A"),
                          "nome_usuario_e_nome_civil": False, "empresa": get("D"), "emails": emails, "telefones": phones,
                          "identificavel": bool(buyer_name or get("D") or valid_emails or valid_phones)},
            "destinatario": {"nome_entrega_original": get("BD"), "emails": [], "telefones": [],
                             "contato_comprador_atribuido": False},
            "enderecos": addresses,
            "notas_originais": get("BC"), "status": status, "excecoes": errors,
            "efeitos_operacionais_autorizados": False, "estado_importacao": "preparado_sem_gravacao_operacional"}


def compare_google(workbook, directory):
    values = []
    files = []
    paths = list(Path(directory).glob("google-chunk-*.json"))
    if not paths:
        raise ValueError("Nenhum google-chunk-*.json na pasta informada")
    paths.sort(key=lambda path: int(re.search(r"(\d+)\.json$", path.name).group(1)))
    expected_row = 1
    for path in paths:
        source = json.loads(path.read_text(encoding="utf-8"), parse_float=Decimal)
        first_row = int(re.search(r"[A-Z]+(\d+):", source["range"]).group(1))
        if first_row != expected_row:
            raise ValueError("Faixas Google ausentes, repetidas ou fora de ordem")
        values.extend(source["values"])
        expected_row += len(source["values"])
        files.append({"arquivo": str(path), "sha256": sha(path), "range": source["range"]})
    differences = []
    numeric_residuals = []
    for index in range(max(len(values), len(workbook["linhas"]))):
        google = values[index] if index < len(values) else []
        excel = workbook["linhas"][index]["valores"] if index < len(workbook["linhas"]) else []
        for column in range(59):
            g = google[column] if column < len(google) else None
            x = excel[column] if column < len(excel) else None
            if g in {None, ""} and x in {None, ""}:
                continue
            if isinstance(g, (int, float, Decimal)):
                try:
                    delta = Decimal(str(g)) - Decimal(str(x))
                    if delta == ZERO:
                        continue
                    if abs(delta) < Decimal("0.00000001"):
                        numeric_residuals.append({"celula": col(column + 1) + str(index + 1), "google": str(g), "excel": x,
                                                  "diferenca": exact(delta), "tipo": "precisao_serial_exportacao"})
                        continue
                except InvalidOperation:
                    pass
            elif str(g) == str(x):
                continue
            differences.append({"celula": col(column + 1) + str(index + 1), "google": str(g), "excel": x})
    return {"arquivos": files, "linhas_google": len(values), "linhas_excel": len(workbook["linhas"]),
            "diferencas_conteudo": differences, "diferencas_precisao_serial": numeric_residuals,
            "metadados_google": None,
            "comparacao_celula_a_celula": True, "celulas_conferidas": max(len(values), len(workbook["linhas"])) * 59,
            "referencia": "Excel anexo preservado sem alteracao; mesma identidade de fonte; Google somente comparado"}


def assign_identity(records):
    email_names = collections.defaultdict(set)
    phone_names = collections.defaultdict(set)
    for record in records:
        buyer = record["comprador"]
        name = keytext(buyer["nome_cobranca"])
        for item in buyer["emails"]:
            if item["valido_sintaticamente"]:
                email_names[item["normalizado"]].add(name)
        for item in buyer["telefones"]:
            if item["plausivel"]:
                phone_names[item["digitos_preservados"]].add(name)
    groups = {}
    for record in records:
        buyer = record["comprador"]
        name = keytext(buyer["nome_cobranca"])
        email = sorted({x["normalizado"] for x in buyer["emails"] if x["valido_sintaticamente"]})
        phones = sorted({x["digitos_preservados"] for x in buyer["telefones"] if x["plausivel"]})
        conflicts = []
        if any(len(email_names[e] - {""}) > 1 for e in email):
            conflicts.append("email_associado_a_nomes_diferentes")
        if any(len(phone_names[p] - {""}) > 1 for p in phones):
            conflicts.append("telefone_associado_a_nomes_diferentes")
        # Sem fusão por nome ou telefone isolado; alternativas divergentes bloqueiam fusão automática.
        if name and len(email) == 1 and not conflicts:
            candidate = ["nome_email_exatos", name, email[0]]
        elif name and len(phones) == 1 and not email and not conflicts:
            candidate = ["nome_telefone_sem_conflito", name, phones[0]]
        else:
            candidate = ["identidade_por_documento_legado", record["chave_deduplicacao"]]
        identity = SOURCE_ID + ":cliente:" + hashlib.sha256(json.dumps(candidate, ensure_ascii=False).encode()).hexdigest()[:24]
        buyer["identidade_candidata"] = identity
        buyer["regra_identidade"] = candidate[0]
        buyer["conflitos_identidade"] = conflicts
        buyer["vinculo_hub"] = None
        buyer["vinculo_atendimento"] = None
        buyer["tag_cliente_aplicada"] = False
        groups.setdefault(identity, {"identidade": identity, "regra": candidate[0], "linhas": [], "pedidos": [], "conflitos": conflicts})
        groups[identity]["linhas"].append(record["linha"])
        groups[identity]["pedidos"].append(record["numero_original"])
        for conflict in conflicts:
            record["excecoes"].append({"codigo": conflict})
    return {"grupos_candidatos": list(groups.values()),
            "emails_com_nomes_distintos": sum(len(names - {""}) > 1 for names in email_names.values()),
            "telefones_com_nomes_distintos": sum(len(names - {""}) > 1 for names in phone_names.values()),
            "regra": "grupos conservadores candidatos; nenhum cadastro nem fusao realizado; revisao contra HUB ainda pendente"}


def monthly(records, field):
    groups = collections.defaultdict(list)
    for record in records:
        date = record[field]
        groups[date["mes"] if date else "nao_informado"].append(record)
    result = []
    for month, rows in sorted(groups.items()):
        metrics = {key: sum((dec(r["totais"][key]) or ZERO for r in rows), ZERO) for key in
                   ["liquido_itens", "desconto_itens", "bruto_reconstruido", "subtotal_produtos_original",
                    "frete_ajuste_original", "total_original", "diferenca_produtos", "diferenca_total", "valor_historico_nao_detalhado"]}
        result.append({"mes": month, "pedidos": len(rows), "pedidos_unicos": len({r["numero_original"] for r in rows}),
                       "itens": sum(len(r["itens"]) for r in rows),
                       "unidades": exact(sum((dec(i["quantidade"]) or ZERO for r in rows for i in r["itens"]), ZERO)),
                       "pedidos_total_zero": sum(dec(r["totais"]["total_original"]) == ZERO for r in rows),
                       "fretes_negativos": sum((dec(r["totais"]["frete_ajuste_original"]) or ZERO) < ZERO for r in rows),
                       "valores": {key: exact(value) for key, value in metrics.items()}})
    return result


def write_json(name, data):
    path = OUT / name
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2, default=str) + "\n", encoding="utf-8")
    return {"arquivo": str(path), "sha256": sha(path), "bytes": path.stat().st_size}


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    source_hash = sha(SRC)
    immutable = OUT / ("fonte-imutavel-" + source_hash[:12] + ".xlsx")
    if immutable.exists():
        if sha(immutable) != source_hash:
            raise RuntimeError("Copia imutavel existente diverge da fonte")
    else:
        shutil.copyfile(SRC, immutable)
        immutable.chmod(stat.S_IREAD)
    prompt_copy = None
    if PROMPT:
        prompt_copy = OUT / ("prompt-imutavel-" + sha(PROMPT)[:12] + ".txt")
        if not prompt_copy.exists():
            shutil.copyfile(PROMPT, prompt_copy)
            prompt_copy.chmod(stat.S_IREAD)
    workbook = read_xlsx(immutable)
    if not validate_headers(workbook):
        raise ValueError("Cabecalhos ou posicoes divergem do contrato Orders de 59 colunas")
    records = [normalize_row(row, workbook["date1904"]) for row in workbook["linhas"][1:]]
    if len({r["numero_original"] for r in records}) != len(records) or any(not r["numero_original"] for r in records):
        raise RuntimeError("Identidade de pedido vazia ou duplicada")
    comparison = compare_google(workbook, GOOGLE_DIR) if GOOGLE_DIR else {
        "comparacao_celula_a_celula": False, "diferencas_conteudo": [],
        "diferencas_precisao_serial": [], "celulas_conferidas": 0,
        "motivo": "Google nao informado; nenhuma equivalencia entre fontes afirmada"}
    identities = assign_identity(records)
    exceptions = [{"numero_original": r["numero_original"], "linha": r["linha"], "excecoes": r["excecoes"]}
                  for r in records if r["excecoes"]]
    counter = collections.Counter(e["codigo"] for r in records for e in r["excecoes"])
    final_statuses = collections.Counter(r["status"]["final_legado"] or "NAO_APURADO" for r in records)
    methods = collections.Counter(r["status"]["regra"] for r in records)
    creation = monthly(records, "data_criacao")
    paid = monthly(records, "pagamento_informado")
    summary = {"fonte": str(SRC), "sha256": source_hash, "copia_imutavel": str(immutable),
               "prompt_sha256": sha(PROMPT) if PROMPT else None, "lote_proposto": SOURCE_ID + ":2026:" + source_hash[:12],
               "origem_identidade_estavel": SOURCE_ID, "lido_em_utc": dt.datetime.now(dt.timezone.utc).isoformat(),
               "leitura_somente": True, "gravacao_operacional": False, "registros": len(records),
               "normalizacao_versao": 3, "date1904": workbook["date1904"],
               "pedidos_unicos": len({r["numero_original"] for r in records}),
               "itens": sum(len(r["itens"]) for r in records),
               "unidades": exact(sum((dec(i["quantidade"]) or ZERO for r in records for i in r["itens"]), ZERO)),
               "por_criacao": creation, "por_pagamento_informado": paid,
               "status_finais": dict(final_statuses), "regras_status": dict(methods), "excecoes_contagens": dict(counter),
               "identidades_candidatas": len(identities["grupos_candidatos"]),
               "regras_identidade": dict(collections.Counter(g["regra"] for g in identities["grupos_candidatos"])),
               "emails_associados_nomes_diferentes": identities["emails_com_nomes_distintos"],
               "telefones_associados_nomes_diferentes": identities["telefones_com_nomes_distintos"],
               "emails_validos_pedidos": sum(any(e["valido_sintaticamente"] for e in r["comprador"]["emails"]) for r in records),
               "telefones_plausiveis_pedidos": sum(any(p["plausivel"] for p in r["comprador"]["telefones"]) for r in records),
               "enderecos_C_H_iguais": sum(norm(r["raw"]["valores"][2]) == norm(r["raw"]["valores"][7]) for r in records),
               "enderecos_C_preenchidos": sum(bool(norm(r["raw"]["valores"][2])) for r in records),
               "enderecos_H_preenchidos": sum(bool(norm(r["raw"]["valores"][7])) for r in records),
               "enderecos_entrega_confirmados": 0,
               "notas_adicoes_nao_convertidas_itens": sum(r["status"]["adicoes_itens_em_notas"] for r in records),
               "notas_exclusoes_nao_convertidas_itens": sum(r["status"]["exclusoes_itens_em_notas"] for r in records),
               "diferencas_fontes_conteudo": len(comparison["diferencas_conteudo"]),
               "diferencas_fontes_precisao_serial": len(comparison["diferencas_precisao_serial"]),
               "celulas_comparadas": comparison["celulas_conferidas"],
               "formulas_fonte": workbook["formulas"],
               "testes_nao_comprovam": ["backup e restauracao de bases", "gravacao em HUB ou Atendimento",
                   "idempotencia transacional no HUB", "protecao de saldos e vinculos reais de setembro",
                   "composicoes, custos ou consumo historico", "filas e automacoes externas", "publicacao"],
               "inferencias": [
                   {"regra": "fuso_local_sp", "justificativa": "horario serial sem fuso; orientacao explicita do prompt", "registros": len(records)},
                   {"regra": "preco_exportado_liquido", "justificativa": "regra do legado validada pela reconciliacao de todos os itens", "registros": len(records)},
                   {"regra": "desconto_linha_nao_reaplicado", "justificativa": "desconto total da linha exportada", "registros": len(records)},
                   {"regra": "nao_criar_itens_pelas_notas", "justificativa": "alteracoes e exclusoes antigas nao comprovam composicao final", "registros": len(records)},
                   {"regra": "enderecos_C_H_cobranca", "justificativa": "ambos cabecalhos de cobranca; entrega nao comprovada", "registros": len(records)}]}
    summary["normalizacao_uf"] = {
        "confirmadas_por_uf": dict(collections.Counter(a["uf"] for r in records for a in r["enderecos"] if a["uf"])),
        "nao_informada_enderecos": sum(a["uf"] is None for r in records for a in r["enderecos"]),
        "candidatas_ap_complemento": sum(c["valor"] == "AP" and c["complemento_aparente"] for r in records for a in r["enderecos"] for c in a["uf_candidatas"]),
        "localidade_conflitante_enderecos": sum(a["localidade_conflitante"] for r in records for a in r["enderecos"]),
        "candidatas_sem_posicao_inequivoca_nao_confirmam_uf": True}
    summary["pais_telefone"] = {
        "pedidos_com_evidencia_pais_endereco": sum(any(a["pais_evidencias"] for a in r["enderecos"]) for r in records),
        "pedidos_com_telefone_canonico": sum(any(t["e164"] for t in r["comprador"]["telefones"]) for r in records),
        "evidencias_por_celula": dict(collections.Counter(t["evidencia_pais"]["regra"] for r in records for t in r["comprador"]["telefones"] if t["evidencia_pais"])),
        "pedidos_termo_brasil_sem_papel_confirmado": sum(any(a["termo_brasil_sem_papel_confirmado"] for a in r["enderecos"]) for r in records),
        "pais_do_negocio_nao_usado_como_evidencia": True,
        "digitos_originais_preservados": True, "nono_digito_nunca_inserido_ou_removido": True}
    summary["enderecos_estruturacao"] = {
        "cobertura_enderecos_por_campo": {campo: sum(a.get(campo) is not None for r in records for a in r["enderecos"])
            for campo in ["logradouro", "numero", "complemento", "bairro", "municipio", "uf", "cep"]},
        "primeiro_fragmento_igual_comprador": sum(bool(a["fragmentos"] and norm(a["fragmentos"][0]) == norm(r["comprador"]["nome_cobranca"])) for r in records for a in r["enderecos"]),
        "bairro_sem_template_ou_rotulo_permanece_nao_apurado": True,
        "prova_por_campo": "enderecos[].provas_campos com origem, fragmento, offsets, regra e grau de confirmacao",
        "finalidade_entrega_nao_inferida": True}
    summary["inferencias"].extend([
        {"regra": "uf_municipal_ou_estado_extenso_com_cep_inequivoco", "justificativa": "UF em rotulo/sufixo municipal ou estado extenso no bloco comprador-municipio-estado-CEP; AP em complemento permanece candidato", "registros": summary["pais_telefone"]["pedidos_com_evidencia_pais_endereco"]},
        {"regra": "ddi_55_somente_com_evidencia", "justificativa": "prefixo 55 ja exportado validado ou pais sustentado por endereco; DDD e assinante validados, digitos originais e prova individual preservados", "registros": summary["pais_telefone"]["pedidos_com_telefone_canonico"]},
        {"regra": "logradouro_numero_delimitados_apos_comprador", "justificativa": "primeiro fragmento igual a B; linha seguinte tem separador e numero explicitos; texto original e offsets preservados", "registros": sum(any(a["logradouro"] is not None for a in r["enderecos"]) for r in records)},
        {"regra": "municipio_estado_cep_em_bloco_cobranca", "justificativa": "nome comprador confirmado, CEP terminal, estado brasileiro por extenso antes do CEP e municipio anterior sem digitos; bairro nao inferido", "registros": sum(any(a["municipio"] is not None for a in r["enderecos"]) for r in records)},
        {"regra": "complemento_com_marcador_explicito", "justificativa": "AP/apto/bloco/casa ou equivalente explicito em posicao de complemento e bloco postal comprovavel; numero isolado nao e convertido em apartamento", "registros": sum(any(a["complemento"] is not None for a in r["enderecos"]) for r in records)}])
    checks = {
        "linhas_contabilizadas": len(records) + 1 == len(workbook["linhas"]),
        "numeros_unicos": len({r["numero_original"] for r in records}) == len(records),
        "cabecalhos_posicionais": validate_headers(workbook),
        "fonte_sem_formulas": workbook["formulas"] == 0,
        "soma_mensal_criacao": sum(r["pedidos"] for r in creation) == len(records),
        "soma_mensal_pagamento": sum(r["pedidos"] for r in paid) == len(records),
    }
    if not all(checks.values()):
        raise RuntimeError("Falha nas validacoes estruturais da fonte")
    artifacts = []
    artifacts.append(write_json("registros-normalizados-completos.json", {"metadados": summary, "cabecalhos": workbook["linhas"][0], "registros": records}))
    artifacts.append(write_json("comparacao-fontes.json", comparison))
    artifacts.append(write_json("identidades-candidatas.json", identities))
    artifacts.append(write_json("excecoes.json", exceptions))
    artifacts.append(write_json("sumario-reconciliacao.json", summary))
    artifacts.append(write_json("validacoes-fonte.json", {
        "validacoes": checks, "gravacao_operacional": False,
        "limites": "validacoes offline; nao comprovam backup, saldos, integracoes ou idempotencia transacional"}))
    manifest = {"artefatos": artifacts, "fonte_imutavel": {"arquivo": str(immutable), "sha256": sha(immutable)},
                "prompt_imutavel": {"arquivo": str(prompt_copy), "sha256": sha(prompt_copy)} if prompt_copy else None}
    write_json("manifesto.json", manifest)
    # A saída padrão nunca contém contatos, endereços, observações ou dados brutos.
    print(json.dumps({"registros": len(records), "itens": summary["itens"],
        "sha256": source_hash, "manifesto": str(OUT / "manifesto.json"),
        "diferencas_conteudo_fontes": len(comparison["diferencas_conteudo"]),
        "validacoes": checks}, ensure_ascii=True))



if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--fonte", type=Path, required=True, help="Excel de origem; somente leitura")
    parser.add_argument("--saida", type=Path, required=True, help="Diretorio privado, ignorado pelo Git")
    parser.add_argument("--google-dir", type=Path, help="Pasta opcional com google-chunk-N.json de valores UNFORMATTED_VALUE")
    parser.add_argument("--prompt", type=Path, help="Prompt autorizado opcional para preservar hash e copia")
    parser.add_argument("--origem", default=SOURCE_ID, help="Identidade estavel, independente da versao do arquivo")
    args = parser.parse_args()
    SRC, OUT, PROMPT, GOOGLE_DIR, SOURCE_ID = args.fonte, args.saida, args.prompt, args.google_dir, args.origem
    if not SRC.is_file():
        parser.error("Fonte inexistente")
    if SRC.resolve().parent == OUT.resolve():
        parser.error("A saida deve ser separada do diretorio da fonte")
    main()
