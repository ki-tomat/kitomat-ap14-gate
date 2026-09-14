from __future__ import annotations

import unittest

from pii_heuristic import findings_for_text
from validate_metadata import load_simple_yaml_mapping


class MetadataFallbackTests(unittest.TestCase):
    def test_json_quoted_generator_scalars_are_lossless(self) -> None:
        data = load_simple_yaml_mapping(
            '\n'.join(
                [
                    'title: "Plan #1: \\"Prüfung\\" – äöü 🍅"',
                    'description: "Zeile 1\\nZeile 2"',
                    'empty: ""',
                    'enabled: true',
                    'count: 17',
                    'items:',
                    '  - "Wert #1: sicher"',
                    '  - "Zitat: \\"ja\\""',
                    'nothing: []',
                ]
            )
        )

        self.assertEqual(data["title"], 'Plan #1: "Prüfung" – äöü 🍅')
        self.assertEqual(data["description"], "Zeile 1\nZeile 2")
        self.assertEqual(data["empty"], "")
        self.assertIs(data["enabled"], True)
        self.assertEqual(data["count"], 17)
        self.assertEqual(data["items"], ['Wert #1: sicher', 'Zitat: "ja"'])
        self.assertEqual(data["nothing"], [])

    def test_unquoted_comments_do_not_damage_quoted_hashes(self) -> None:
        data = load_simple_yaml_mapping('quoted: "A # B" # comment\nplain: value # comment')
        self.assertEqual(data, {"quoted": "A # B", "plain": "value"})

    def test_unsupported_indentation_is_rejected(self) -> None:
        with self.assertRaisesRegex(ValueError, "unsupported indentation"):
            load_simple_yaml_mapping("key: value\n  nested: no")


class PiiHeuristicTests(unittest.TestCase):
    def test_iso_date_is_not_reported_as_phone(self) -> None:
        self.assertEqual(findings_for_text("Stand: 2026-09-14"), [])

    def test_phone_and_email_remain_visible(self) -> None:
        findings = findings_for_text("mail@example.org\n+49 30 12345678")
        self.assertIn(("email", 1), findings)
        self.assertIn(("phone_like", 2), findings)


if __name__ == "__main__":
    unittest.main()
