import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import wifi_helper


class WifiHelperTests(unittest.TestCase):
    def test_keyfile_escapes_backslash_and_edge_spaces(self):
        self.assertEqual(wifi_helper.escape_keyfile("  abc\\def "), "\\s\\sabc\\\\def\\s")

    def test_rollback_restores_previous_profile_and_deletes_new(self):
        with tempfile.TemporaryDirectory(dir=Path(__file__).parent) as directory:
            state = Path(directory)
            connection = state / "new.nmconnection"
            connection.write_text("fictitious")
            request = state / "teste1234567890.json"
            request.write_text(json.dumps({
                "old": "11111111-1111-1111-1111-111111111111",
                "new": "22222222-2222-2222-2222-222222222222",
                "interface": "wlan0", "path": str(connection),
            }))
            with patch.object(wifi_helper, "STATE_DIR", state), patch.object(wifi_helper, "command", return_value="") as nm, patch.object(wifi_helper.subprocess, "run") as delete:
                wifi_helper.rollback("teste1234567890")
            self.assertIn("11111111-1111-1111-1111-111111111111", nm.call_args.args)
            self.assertIn("22222222-2222-2222-2222-222222222222", delete.call_args.args[0])
            self.assertFalse(request.exists())
            self.assertFalse(connection.exists())


if __name__ == "__main__":
    unittest.main()
