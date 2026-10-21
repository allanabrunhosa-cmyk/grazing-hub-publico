"""Testes sintéticos da reconciliação. Não usa dados pessoais nem bancos."""
import copy
from decimal import Decimal
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location("reconciliar", Path(__file__).with_name("reconciliar.py"))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def row(order="teste-1", items=None, subtotal="100", freight="10", total="110", **values):
    data = [None] * 59
    data[8] = order
    data[50:53] = [subtotal, freight, total]
    for block, item in items or [(1, ["Produto sintético", "1", "100", "0"])]:
        start = 10 + (block - 1) * 4
        data[start:start + 4] = item
    for label, value in values.items():
        data[module.colindex(label) - 1] = value
    return {"linha": 2, "valores": data, "celulas": {
        module.col(i + 1): {"endereco": module.col(i + 1) + "2", "tipo": "s", "valor": value,
                            "valor_xml": value, "formula": None, "estilo": None}
        for i, value in enumerate(data) if value is not None}}


class ReconciliaTests(unittest.TestCase):
    def test_endereco_estruturado_por_bloco_de_cobranca_com_prova_por_campo(self):
        texto = "Pessoa sintética\nAlameda Exemplo, 120-A\nAP 42\nBairro sem rótulo\nCidade Exemplo\nSão Paulo\n01000-000"
        a = module.addressvalue(texto, "H", "Pessoa sintética")
        self.assertEqual(a["logradouro"], "Alameda Exemplo")
        self.assertEqual(a["numero"], "120-A")
        self.assertEqual(a["complemento"], "AP 42")
        self.assertIsNone(a["bairro"])
        self.assertEqual(a["municipio"], "Cidade Exemplo")
        self.assertEqual(a["uf"], "SP")
        self.assertEqual(a["cep"], "01000000")
        for campo in ["logradouro", "numero", "complemento", "municipio", "uf", "cep"]:
            self.assertEqual(a["provas_campos"][campo]["origem"], "H")
            self.assertTrue(a["provas_campos"][campo]["confirmado"])
        self.assertFalse(a["entrega_confirmada"])
        self.assertEqual(a["original"], texto)

    def test_bloco_postal_exige_nome_comprador_e_estado_extenso_reconhecido(self):
        texto = "Pessoa sintética\nRua Exemplo, 10\nBairro sem rótulo\nCidade Exemplo\nSão Paulo\n01000-000"
        for comprador in [None, "Outra pessoa"]:
            a = module.addressvalue(texto, "C", comprador)
            self.assertIsNone(a["municipio"])
            self.assertIsNone(a["logradouro"])
            self.assertEqual(a["pais_evidencias"], [])
        a = module.addressvalue(texto.replace("São Paulo", "Estado não identificado"), "C", "Pessoa sintética")
        self.assertIsNone(a["uf"])
        self.assertEqual(a["pais_evidencias"], [])

    def test_estado_extenso_postal_permite_ddi_com_prova_e_sem_nono_digito(self):
        texto = "Pessoa sintética\nRua Exemplo, 10\nCasa\nBairro sem rótulo\nCidade Exemplo - SP\nSão Paulo\n01000-000"
        record = module.normalize_row(row(B="Pessoa sintética", C=texto, G="11999990000"))
        self.assertEqual(record["enderecos"][0]["municipio"], "Cidade Exemplo")
        telefone = record["comprador"]["telefones"][0]
        self.assertEqual(telefone["digitos_preservados"], "11999990000")
        self.assertEqual(telefone["e164"], "+5511999990000")
        self.assertEqual(telefone["evidencia_pais"]["origem"], "C")
        self.assertFalse(record["enderecos"][0]["entrega_confirmada"])

    def test_numero_isolado_nao_vira_complemento_e_bairro_so_por_rotulo(self):
        texto = "Pessoa sintética\nRua Exemplo, 10\n42\nBairro: Bairro Exemplo\nCidade Exemplo\nSão Paulo\n01000-000"
        a = module.addressvalue(texto, "C", "Pessoa sintética")
        self.assertIsNone(a["complemento"])
        self.assertEqual(a["bairro"], "Bairro Exemplo")
        self.assertEqual(a["provas_campos"]["bairro"]["regra"], "rotulo_bairro_explicito")

    def test_cep_terminal_nao_e_substituido_por_oito_digitos_de_complemento(self):
        texto = "Pessoa sintética\nRua Exemplo, 10\nAP 12345678\nBairro sem rótulo\nCidade Exemplo\nSão Paulo\n01000-000"
        a = module.addressvalue(texto, "C", "Pessoa sintética")
        self.assertEqual(a["cep"], "01000000")
        self.assertFalse(a["localidade_conflitante"])
        self.assertEqual(a["uf"], "SP")
        self.assertTrue(all(e["cep"] == "01000000" for e in a["pais_evidencias"]))

    def test_apartamento_ap_nao_vira_amapa_nem_pais(self):
        a = module.addressvalue("Pessoa sintética\nRua Exemplo, 10\nAP 42\nBairro Exemplo\nCidade Exemplo\nEstado Exemplo\n01000-000", "C")
        self.assertIsNone(a["uf"])
        self.assertEqual(a["pais_evidencias"], [])
        self.assertTrue(any(c["valor"] == "AP" and c["complemento_aparente"] and not c["confirmada"] for c in a["uf_candidatas"]))
        self.assertIsNone(module.phonevalue("11999990000", "G")["e164"])

    def test_uf_municipal_e_cep_postal_com_prova_posicional(self):
        a = module.addressvalue("Rua Exemplo, 10\nAP 42\nBairro Exemplo\nCidade Exemplo - SP\nEstado Exemplo\n01000-000", "H")
        self.assertEqual(a["uf"], "SP")
        self.assertEqual(a["cep"], "01000000")
        self.assertEqual(a["pais_evidencias"][0]["origem"], "H")
        self.assertEqual(a["pais_evidencias"][0]["regra"], "uf_e_cep_em_posicao_inequivoca")
        self.assertFalse(next(c for c in a["uf_candidatas"] if c["valor"] == "AP")["confirmada"])

    def test_uf_sozinha_exige_posicao_municipal_e_cep(self):
        self.assertIsNone(module.addressvalue("Rua Exemplo SP, 10", "C")["uf"])
        self.assertIsNone(module.addressvalue("Cidade Exemplo - SP", "C")["uf"])
        self.assertEqual(module.addressvalue("Cidade Exemplo\nAP\n68900-000", "C")["uf"], "AP")
        self.assertEqual(module.addressvalue("UF: AP\nCEP: 68900-000", "C")["uf"], "AP")

    def test_conflitos_uf_cep_ou_pais_nao_sustentam_pais(self):
        for text in ["UF: SP\nUF: AP\n01000-000", "Cidade Exemplo - SP\n01000-000\n02000-000", "Cidade Exemplo - SP\n01000-000\nPaís: Portugal"]:
            a = module.addressvalue(text, "C")
            self.assertTrue(a["localidade_conflitante"])
            self.assertIsNone(a["uf"])
            self.assertEqual(a["pais_evidencias"], [])

    def test_brasil_em_logradouro_ou_bairro_nao_comprova_pais(self):
        for text in ["Avenida Brasil, 10\nCidade Exemplo\nEstado Exemplo\n01000-000", "Rua Exemplo, 10\nBrasil\nCidade Exemplo\n01000-000"]:
            a = module.addressvalue(text, "C")
            self.assertEqual(a["pais_evidencias"], [])
            self.assertTrue(a["termo_brasil_sem_papel_confirmado"])
        self.assertEqual(module.addressvalue("País: Brasil", "C")["pais_evidencias"][0]["regra"], "pais_br_rotulado_explicitamente")
        self.assertEqual(module.addressvalue("Rua Exemplo, 10\n01000-000\nBrazil", "C")["pais_evidencias"][0]["regra"], "pais_br_terminal_apos_cep")

    def test_prefixo_55_exportado_validado_sem_acrescentar_pais(self):
        p = module.phonevalue("55 (11) 99999-0000", "G")
        self.assertEqual(p["digitos_preservados"], "5511999990000")
        self.assertEqual(p["e164"], "+5511999990000")
        self.assertEqual(p["evidencia_pais"]["regra"], "prefixo_55_ja_exportado_validado")
        self.assertFalse(p["codigo_pais_acrescentado"])
        for value in ["55 00 99999-0000", "55 11 88888-0000", "5511900000000000", "55 11 telefone 99999-0000"]:
            self.assertIsNone(module.phonevalue(value, "G")["e164"])

    def test_numero_nacional_so_com_evidencia_sem_inventar_nono_digito(self):
        proof = module.addressvalue("Cidade Exemplo - SP\nEstado Exemplo\n01000-000", "H")["pais_evidencias"][0]
        p = module.phonevalue("(11) 99999-0000", "G", proof)
        self.assertEqual(p["digitos_preservados"], "11999990000")
        self.assertEqual(p["e164"], "+5511999990000")
        self.assertIsNone(p["pais_explicito"])
        self.assertEqual(p["pais_verificado"], "BR")
        self.assertTrue(p["codigo_pais_acrescentado"])
        self.assertIsNone(module.phonevalue("(11) 8999-0000", "G", proof)["e164"])
        self.assertEqual(module.phonevalue("(11) 3333-0000", "G", proof)["e164"], "+551133330000")

    def test_revisao_normalizacao_preserva_raw_hash_e_identidade_digitos(self):
        original = row(G="11999990000", C="Rua Exemplo, 10\nAP 42\nCidade Exemplo\nEstado Exemplo\n01000-000", H="Cidade Exemplo - SP\nEstado Exemplo\n01000-000")
        record = module.normalize_row(original)
        self.assertEqual(record["raw"], original)
        self.assertEqual(record["hash_linha"], module.hashlib.sha256(json.dumps(original["valores"], ensure_ascii=False, separators=(",", ":")).encode()).hexdigest())
        self.assertEqual(record["comprador"]["telefones"][0]["digitos_preservados"], "11999990000")
        self.assertEqual(record["comprador"]["telefones"][0]["evidencia_pais"]["origem"], "H")

    def test_desconto_total_linha_ja_embutido(self):
        record = module.normalize_row(row(items=[(1, ["Item A", "2", "902.33", "13.34"]),
                                                       (2, ["Item B", "1", "392.34", "6.66"])],
                                          subtotal="2217", freight="22", total="2219"))
        self.assertEqual(Decimal(record["totais"]["liquido_itens"]), Decimal("2197"))
        self.assertEqual(Decimal(record["totais"]["desconto_itens"]), Decimal("20"))
        self.assertEqual(Decimal(record["totais"]["diferenca_total"]), Decimal("0"))

    def test_repetidos_e_bloco_dez_apos_vazios(self):
        record = module.normalize_row(row(items=[(1, ["Mesmo nome", "1", "20", "0"]),
                                                       (10, ["Mesmo nome", "2", "40", "0"])],
                                          subtotal="100"))
        self.assertEqual([i["bloco"] for i in record["itens"]], [1, 10])
        self.assertEqual(len(record["itens"]), 2)

    def test_bloco_incompleto_preserva_originais(self):
        record = module.normalize_row(row(items=[(1, ["Produto", None, "100", "0"])]))
        self.assertTrue(record["itens"][0]["incompleto"])
        self.assertIsNone(record["itens"][0]["quantidade"])
        self.assertTrue(any(e["codigo"] == "bloco_item_incompleto" for e in record["excecoes"]))

    def test_dez_blocos_diferenca_sem_criar_produto(self):
        record = module.normalize_row(row(items=[(i, ["Produto", "1", "10", "0"]) for i in range(1, 11)],
                                          subtotal="120", freight="0", total="120"))
        self.assertEqual(Decimal(record["totais"]["valor_historico_nao_detalhado"]), Decimal("20"))
        self.assertEqual(len(record["itens"]), 10)
        self.assertTrue(all(i["consumo_apurado"] is None for i in record["itens"]))

    def test_frete_negativo_e_total_zero(self):
        record = module.normalize_row(row(freight="-100", total="0"))
        self.assertEqual(record["totais"]["frete_ajuste_original"], "-100")
        self.assertEqual(record["totais"]["frete_classificacao"], "ajuste_legado_a_classificar")
        self.assertTrue(record["totais"]["zero_final_preservado"])
        self.assertEqual(record["itens"][0]["quantidade"], "1")

    def test_diferenca_final_nao_vira_frete(self):
        record = module.normalize_row(row(subtotal="100", freight="0", total="154"))
        self.assertEqual(record["totais"]["diferenca_total_apos_nao_detalhado"], "54")
        self.assertEqual(record["totais"]["frete_ajuste_original"], "0")

    def test_datas_locais_sem_converter_fuso(self):
        record = module.normalize_row(row(E="46021.5", F="46028.5"))
        self.assertEqual(record["data_criacao"]["local_exato"], "2025-12-30T12:00:00")
        self.assertEqual(record["pagamento_informado"]["local_exato"], "2026-01-06T12:00:00")
        self.assertFalse(record["data_criacao"]["conversao_fuso_aplicada"])

    def test_status_reverso_e_proposta_negada_antiga(self):
        note = "Status do pedido alterado de Impresso para Retirado.\nStatus do pedido alterado de Pago para Impresso.\nStatus do pedido alterado de Proposta negada para Pago."
        status = module.statusinfo(note)
        self.assertEqual(status["final_legado"], "Retirado")
        self.assertIsNone(status["data_entrega"])
        self.assertIsNone(status["modalidade_entrega"])

    def test_status_inconsistente_nao_inventado(self):
        note = "Status do pedido alterado de Impresso para Retirado.\nStatus do pedido alterado de Novo Pedido para Pago."
        self.assertIsNone(module.statusinfo(note)["final_legado"])

    def test_notas_html_sao_dados_e_nao_criam_itens(self):
        record = module.normalize_row(row(BC='<script>malicioso()</script>Itens de linha adicionados: item removido.'))
        self.assertEqual(len(record["itens"]), 1)
        self.assertNotIn("malicioso", record["status"]["texto_seguro"])
        self.assertIn("<script>", record["notas_originais"])

    def test_comprador_destinatario_contatos_separados(self):
        record = module.normalize_row(row(B="Pessoa de teste A", BD="Pessoa de teste B", BE="a@example.invalid",
                                          BG="b@example.invalid", G="11999990000", BF="11999990001"))
        self.assertEqual(record["destinatario"]["emails"], [])
        self.assertEqual(record["destinatario"]["telefones"], [])
        self.assertIsNone(record["comprador"]["telefones"][0]["e164"])
        self.assertEqual(len(record["comprador"]["emails"]), 2)
        self.assertIsNotNone(module.phonevalue("+55 11 99999-0000", "G")["e164"])

    def test_identidade_nao_funde_nome_ou_telefone_compartilhado(self):
        records = [module.normalize_row(row(order="teste-a", B="Pessoa A", G="11999990000")),
                   module.normalize_row(row(order="teste-b", B="Pessoa B", G="11999990000")),
                   module.normalize_row(row(order="teste-c", B="Pessoa A"))]
        result = module.assign_identity(records)
        self.assertEqual(len(result["grupos_candidatos"]), 3)
        self.assertEqual(result["telefones_com_nomes_distintos"], 1)

    def test_idempotencia_e_nova_versao_em_memoria(self):
        original = row()
        first = module.normalize_row(original)
        revised = copy.deepcopy(original)
        revised["valores"][52] = "111"
        second = module.normalize_row(revised)
        self.assertEqual(first["chave_deduplicacao"], second["chave_deduplicacao"])
        self.assertNotEqual(first["hash_linha"], second["hash_linha"])
        cache = {}
        for record in [first, first, second]:
            cache[record["chave_deduplicacao"]] = record["hash_linha"]
        self.assertEqual(len(cache), 1)

    def test_google_compara_todas_as_posicoes_sem_sobrescrever(self):
        raw = row(C="Endereco de teste", H="Endereco diferente")
        project = Path(__file__).resolve().parents[2]
        fixture_root = project / ".tmp/historico-fixtures"
        fixture_root.mkdir(parents=True, exist_ok=True)
        with tempfile.TemporaryDirectory(dir=fixture_root) as directory:
            Path(directory).resolve().relative_to(project)
            path = Path(directory) / "google-chunk-0.json"
            path.write_text(json.dumps({"range": "Orders!A1:BG1", "values": [raw["valores"]]}), encoding="utf-8")
            result = module.compare_google({"linhas": [raw]}, directory)
            self.assertEqual(result["diferencas_conteudo"], [])
            self.assertEqual(result["celulas_conferidas"], 59)
            self.assertEqual(raw["valores"][2], "Endereco de teste")
            self.assertEqual(raw["valores"][7], "Endereco diferente")

    def test_eventos_setembro_nao_retrodatados(self):
        record = module.normalize_row(row(E="46264.5", F="46266.5"))
        self.assertEqual(record["data_criacao"]["mes"], "2026-08")
        self.assertEqual(record["pagamento_informado"]["mes"], "2026-09")
        self.assertFalse(record["efeitos_operacionais_autorizados"])
        self.assertTrue(any(e["codigo"] == "pagamento_informado_setembro_de_pedido_anterior" for e in record["excecoes"]))


if __name__ == "__main__":
    unittest.main()
