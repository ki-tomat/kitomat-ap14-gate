#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import re
import sys
from pathlib import Path

try:
    import yaml
except ImportError:
    yaml = None

ROOT = Path(os.environ.get("KITOMAT_REPOSITORY_ROOT", Path(__file__).resolve().parents[2])).resolve()

COMMON_REQUIRED = {
    "id",
    "artifact_type",
    "title",
    "category",
    "status",
    "language",
    "version",
    "maintainer",
    "license",
    "license_status",
    "data_risk",
    "human_review_required",
    "ai_act_proximity",
    "legal_disclaimer",
    "sources_status",
}

TYPE_REQUIRED = {
    "prompt_package": {
        "target_users",
        "use_case",
        "required_inputs",
        "output_format",
        "personal_data_possible",
        "evaluation_criteria",
    },
    "dataset_package": {
        "linked_artifacts",
        "data_origin",
        "contains_personal_data",
        "contains_sensitive_data",
        "sources_date",
        "usage_scope",
        "release_asset_required",
    },
    "model": {
        "model_type",
        "target_users",
        "use_case",
        "required_inputs",
        "output_format",
        "application_scope",
        "framework_references",
        "required_review_level",
    },
}

ALLOWED = {
    "artifact_type": {"prompt_package", "dataset_package", "model"},
    "status": {
        "draft",
        "bronze_candidate",
        "bronze",
        "silver_candidate",
        "silver",
        "gold_candidate",
        "gold",
    },
    "data_risk": {"green", "yellow", "red"},
    "ai_act_proximity": {
        "none",
        "transparency",
        "high_risk_adjacent",
        "prohibited_check",
        "unclear",
    },
    "sources_status": {"not_required", "missing", "provided", "checked", "unverified"},
    "license_status": {"declared", "unclear", "not_applicable"},
}

COURSE_BLOCKED_STATUS = {"silver", "gold_candidate", "gold"}
KEY_PATTERN = re.compile(r"^[A-Za-z_][A-Za-z0-9_-]*$")


def _strip_unquoted_comment(value: str) -> str:
    in_single = False
    in_double = False
    escaped = False
    for index, char in enumerate(value):
        if escaped:
            escaped = False
            continue
        if char == "\\" and in_double:
            escaped = True
            continue
        if char == '"' and not in_single:
            in_double = not in_double
            continue
        if char == "'" and not in_double:
            in_single = not in_single
            continue
        if char == "#" and not in_single and not in_double:
            if index == 0 or value[index - 1].isspace():
                return value[:index].rstrip()
    return value.rstrip()


def _parse_scalar(raw_value: str) -> object:
    value = _strip_unquoted_comment(raw_value.strip())
    if value == "":
        return ""
    try:
        return json.loads(value)
    except json.JSONDecodeError:
        lowered = value.lower()
        if lowered == "true":
            return True
        if lowered == "false":
            return False
        if lowered in {"null", "~"}:
            return None
        if len(value) >= 2 and value[0] == value[-1] == "'":
            return value[1:-1].replace("''", "'")
        return value


def load_simple_yaml_mapping(text: str) -> dict:
    """Parse the generator's deliberately small, flat YAML subset.

    Generator strings are JSON-quoted YAML scalars. Parsing those scalars with
    json.loads keeps hashes, colons, quotes, Unicode and escaped newlines intact.
    """
    data: dict[str, object] = {}
    current_key: str | None = None
    for line_number, raw_line in enumerate(text.splitlines(), start=1):
        if not raw_line.strip() or raw_line.lstrip().startswith("#"):
            continue
        if raw_line.startswith((" ", "\t")):
            item = raw_line.strip()
            if not item.startswith("- ") or current_key is None:
                raise ValueError(f"unsupported indentation at line {line_number}")
            current_value = data.get(current_key)
            if not isinstance(current_value, list):
                raise ValueError(f"list item without list key at line {line_number}")
            current_value.append(_parse_scalar(item[2:]))
            continue
        if ":" not in raw_line:
            raise ValueError(f"missing key separator at line {line_number}")
        key, raw_value = raw_line.split(":", 1)
        current_key = key.strip()
        if not KEY_PATTERN.fullmatch(current_key):
            raise ValueError(f"invalid key at line {line_number}")
        value = raw_value.strip()
        data[current_key] = [] if value == "" else _parse_scalar(value)
    return data


def load_yaml(path: Path) -> dict:
    text = path.read_text(encoding="utf-8")
    data = load_simple_yaml_mapping(text) if yaml is None else yaml.safe_load(text)
    if not isinstance(data, dict):
        raise ValueError("metadata.yml must contain a YAML mapping")
    return data


def iter_metadata_files() -> list[Path]:
    roots = [ROOT / "prompts", ROOT / "datasets", ROOT / "models"]
    files: list[Path] = []
    for root in roots:
        if root.exists():
            files.extend(path for path in root.glob("*/metadata.yml") if not path.parent.name.startswith("_"))
    return sorted(files)


def validate_file(path: Path) -> list[str]:
    errors: list[str] = []
    try:
        data = load_yaml(path)
    except Exception as exc:
        return [f"{path.relative_to(ROOT)}: cannot parse YAML: {exc}"]

    missing = sorted(COMMON_REQUIRED - set(data))
    if missing:
        errors.append(f"{path.relative_to(ROOT)}: missing common fields: {', '.join(missing)}")

    artifact_type = data.get("artifact_type")
    if artifact_type not in TYPE_REQUIRED:
        errors.append(f"{path.relative_to(ROOT)}: invalid artifact_type: {artifact_type!r}")
        return errors

    missing_type = sorted(TYPE_REQUIRED[artifact_type] - set(data))
    if missing_type:
        errors.append(f"{path.relative_to(ROOT)}: missing {artifact_type} fields: {', '.join(missing_type)}")

    for field, allowed in ALLOWED.items():
        value = data.get(field)
        if value is not None and value not in allowed:
            errors.append(f"{path.relative_to(ROOT)}: invalid {field}: {value!r}")

    status = data.get("status")
    if status in COURSE_BLOCKED_STATUS:
        errors.append(f"{path.relative_to(ROOT)}: status {status!r} is not allowed for the MVP course")

    if status == "bronze" and data.get("human_review_required") is not True:
        errors.append(f"{path.relative_to(ROOT)}: bronze requires human_review_required: true")

    if data.get("sources_status") in {"missing", "unclear"} and status == "bronze":
        errors.append(f"{path.relative_to(ROOT)}: bronze cannot have missing or unclear sources")

    return errors


def main() -> int:
    files = iter_metadata_files()
    if not files:
        print("No metadata files found.")
        return 0
    errors: list[str] = []
    for path in files:
        errors.extend(validate_file(path))
    if errors:
        print("Metadata validation failed:")
        for error in errors:
            print(f"- {error}")
        return 1
    print(f"Metadata validation passed for {len(files)} files.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
