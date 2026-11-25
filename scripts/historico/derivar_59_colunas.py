"""Deriva o layout Orders de 59 colunas a partir da exportacao de 60 colunas.
Remove H (nome de entrega) e substitui I (endereco de entrega) por copia de C (cobranca),
reproduzindo o perfil original em que C e H eram a mesma coluna de cobranca."""
import copy, hashlib, json, re, sys
import xml.etree.ElementTree as ET
from zipfile import ZipFile, ZIP_DEFLATED
M = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
ET.register_namespace("", M)
ET.register_namespace("r", "http://schemas.openxmlformats.org/officeDocument/2006/relationships")
def idx(l):
    v = 0
    for c in l: v = v * 26 + ord(c) - 64
    return v
def col(i):
    s = ""
    while i: i, m = divmod(i - 1, 26); s = chr(65 + m) + s
    return s
src, dst = sys.argv[1], sys.argv[2]
with ZipFile(src) as z:
    names = z.namelist(); data = {n: z.read(n) for n in names}
sheet = "xl/worksheets/sheet1.xml"
tree = ET.fromstring(data[sheet])
rows = tree.find(f"{{{M}}}sheetData")
n = 0
for row in rows:
    r = row.attrib["r"]; cells = {re.sub(r"\d", "", c.attrib["r"]): c for c in row}
    for c in list(row): row.remove(c)
    out = []
    for label, c in sorted(cells.items(), key=lambda kv: idx(kv[0])):
        i = idx(label)
        if i in (8, 9): continue
        if i > 9: c.attrib["r"] = col(i - 1) + r
        out.append(c)
    if "C" in cells:
        h = copy.deepcopy(cells["C"]); h.attrib["r"] = "H" + r; out.append(h)
    for c in sorted(out, key=lambda c: idx(re.sub(r"\d", "", c.attrib["r"]))): row.append(c)
    n += 1
dim = tree.find(f"{{{M}}}dimension")
if dim is not None: dim.attrib["ref"] = re.sub(r"BH(\d+)$", r"BG\1", dim.attrib["ref"])
cols = tree.find(f"{{{M}}}cols")
if cols is not None: tree.remove(cols)
data[sheet] = ET.tostring(tree, encoding="utf-8", xml_declaration=True)
with ZipFile(dst, "w", ZIP_DEFLATED) as z:
    for name in names: z.writestr(name, data[name])
sha = lambda p: hashlib.sha256(open(p, "rb").read()).hexdigest()
print(json.dumps({"linhas": n, "origem_sha256": sha(src), "derivado_sha256": sha(dst), "dimensao": dim.attrib["ref"] if dim is not None else None}))
