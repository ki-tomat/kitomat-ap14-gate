#!/usr/bin/env python3
from __future__ import annotations

import os
import re
import sys
from pathlib import Path

ROOT = Path(os.environ.get("KITOMAT_REPOSITORY_ROOT", Path(__file__).resolve().parents[2])).resolve()

PATTERNS = {
    "email": re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b"),
    "phone_like": re.compile(r"\b(?:\+?\d[\d\s()./-]{7,}\d)\b"),
    "iban_like": re.compile(r"\b[A-Z]{2}\d{2}[A-Z0-9]{10,30}\b"),
    "german_tax_id_like": re.compile(r"\b\d{11}\b"),
}
ISO_DATE = re.compile(r"\d{4}-\d{2}-\d{2}")
SCAN_ROOTS = ["prompts", "datasets", "models"]
SCAN_SUFFIXES = {".md", ".txt", ".csv", ".yml", ".yaml", ".json"}


def iter_files() -> list[Path]:
    files: list[Path] = []
    for name in SCAN_ROOTS:
        root = ROOT / name
        if root.exists():
            files.extend(
                path
                for path in root.rglob("*")
                if path.is_file()
                and path.suffix.lower() in SCAN_SUFFIXES
                and not any(part.startswith("_") for part in path.relative_to(root).parts)
            )
    return sorted(files)


def findings_for_text(text: str) -> list[tuple[str, int]]:
    findings: list[tuple[str, int]] = []
    for label, pattern in PATTERNS.items():
        for match in pattern.finditer(text):
            if label == "phone_like" and ISO_DATE.fullmatch(match.group(0)):
                continue
            line = text.count("\n", 0, match.start()) + 1
            findings.append((label, line))
    return findings


def main() -> int:
    findings: list[str] = []
    for path in iter_files():
        text = path.read_text(encoding="utf-8", errors="ignore")
        for label, line in findings_for_text(text):
            findings.append(f"{path.relative_to(ROOT)}:{line}: possible {label}")
    if findings:
        print("PII heuristic warnings:")
        for finding in findings:
            print(f"- {finding}")
        print("These warnings do not automatically prove PII, but require human review.")
        return 0
    print("PII heuristic scan passed without warnings.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
