import sqlite3
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import grazing_connector as connector


class ConnectorTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(dir=Path(__file__).parent)
        self.addCleanup(self.temp.cleanup)
        self.path = Path(self.temp.name)
        self.db = sqlite3.connect(":memory:")
        self.db.execute("CREATE TABLE envios (id TEXT PRIMARY KEY, estado TEXT NOT NULL, finalizado INTEGER NOT NULL DEFAULT 0)")
        self.db.commit()

    def test_usb_success_means_sent_only(self):
        device = self.path / "lp0"
        device.touch()
        job = {"id": "teste1234567890", "impressoraId": "usb:1234", "zpl": "^XA^FDTESTE^FS^XZ"}
        with patch.object(connector, "request_json", return_value={"concluido": True}) as api:
            connector.send_job(self.db, "fake", job, [{"id": "usb:1234", "path": device}])
        self.assertEqual(device.read_bytes(), job["zpl"].encode())
        self.assertEqual(self.db.execute("SELECT estado, finalizado FROM envios").fetchone(), ("ENVIADO_USB", 1))
        self.assertEqual(api.call_args.args[3]["estado"], "ENVIADO_USB")

    def test_no_printer_fails_before_usb(self):
        job = {"id": "teste1234567891", "impressoraId": "usb:1234", "zpl": "^XA^XZ"}
        with patch.object(connector, "request_json", return_value={"concluido": True}):
            connector.send_job(self.db, "fake", job, [])
        self.assertEqual(self.db.execute("SELECT estado FROM envios").fetchone()[0], "FALHA")

    def test_restart_after_possible_usb_write_is_uncertain(self):
        self.db.execute("INSERT INTO envios (id, estado) VALUES ('teste1234567892', 'PODE_TER_ENVIADO')")
        self.db.commit()
        with patch.object(connector, "request_json", return_value={"concluido": True}) as api:
            connector.recover_unacknowledged(self.db, "fake")
        self.assertEqual(self.db.execute("SELECT estado, finalizado FROM envios").fetchone(), ("INCERTO", 1))
        self.assertEqual(api.call_args.args[3]["estado"], "INCERTO")


if __name__ == "__main__":
    unittest.main()
