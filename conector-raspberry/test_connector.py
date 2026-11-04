import sqlite3
import tempfile
import threading
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

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

    def test_drain_jobs_without_sleep_between_them(self):
        stop = Mock()
        stop.is_set.side_effect = [False, False, True]
        jobs = [{"id": "teste1234567893"}, {"id": "teste1234567894"}]
        with patch.object(connector, "recover_unacknowledged"), patch.object(connector, "usb_printers", return_value=[]), patch.object(connector, "send_job") as send, patch.object(connector, "request_json", side_effect=[{"trabalho": job} for job in jobs]) as api:
            connector.print_loop(self.db, "fake", stop)
        self.assertEqual(send.call_count, 2)
        stop.wait.assert_not_called()
        self.assertEqual(api.call_args.args[0], "/trabalhos?espera=20")
        self.assertEqual(api.call_args.kwargs["timeout"], 30)

    def test_telemetry_cannot_block_print_loop(self):
        blocked = threading.Event()
        release = threading.Event()
        stop = threading.Event()

        def slow_network():
            blocked.set()
            release.wait(2)
            return {}

        def api(path, *args, **kwargs):
            return {"trabalho": {"id": "teste1234567895"}} if path.startswith("/trabalhos") else {}

        with patch.object(connector, "local_network", side_effect=slow_network), patch.object(connector, "device_info", return_value={}), patch.object(connector, "usb_printers", return_value=[]), patch.object(connector, "recover_unacknowledged"), patch.object(connector, "process_wifi_change"), patch.object(connector, "request_json", side_effect=api), patch.object(connector, "send_job", side_effect=lambda *args: stop.set()) as send:
            background = threading.Thread(target=connector.maintain_device, args=("fake", stop))
            background.start()
            try:
                self.assertTrue(blocked.wait(1))
                connector.print_loop(self.db, "fake", stop)
                send.assert_called_once()
                self.assertFalse(release.is_set())
            finally:
                release.set()
                background.join(3)
            self.assertFalse(background.is_alive())

    def test_network_failures_use_bounded_backoff(self):
        stop = Mock()
        stop.is_set.side_effect = [False] * 8 + [True]
        with patch.object(connector, "recover_unacknowledged"), patch.object(connector, "request_json", side_effect=OSError("ficticio")), patch("sys.stderr"):
            connector.print_loop(self.db, "fake", stop)
        self.assertEqual([call.args[0] for call in stop.wait.call_args_list], [1, 2, 4, 8, 16, 30, 30, 30])

    def test_legacy_server_keeps_short_bounded_polling(self):
        stop = Mock()
        stop.is_set.side_effect = [False, True]
        with patch.object(connector, "recover_unacknowledged"), patch.object(connector, "request_json", return_value={"trabalho": None}):
            connector.print_loop(self.db, "fake", stop)
        stop.wait.assert_called_once_with(0.5)


if __name__ == "__main__":
    unittest.main()
