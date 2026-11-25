"""Clean the web-development duration CSVs into a separate output folder."""
from __future__ import annotations

import csv
import math
import re
import shutil
from datetime import datetime
from pathlib import Path


SOURCE = Path("web_development_completion_2024_plus")
OUTPUT = Path("web_development_completion_2024_plus_cleaned")
COLUMNS = [
    "title", "Description", "task_type", "Priority", "priority_value",
    "assignee_average_completion_days", "actual_start_date",
    "actual_completion_duration_days", "issue_key", "assignee_id",
    "average_source", "prior_completed_tasks_used", "Created", "Resolved", "Resolution",
]
PRIORITY_VALUES = {"Highest": 5, "High": 4, "Normal": 3, "Low": 2, "Lowest": 1}
PRIORITY_ALIASES = {
    "Blocker": "Highest", "P1": "Highest",
    "Critical": "High",
    "Major": "Normal", "P3": "Normal", "Medium": "Normal",
    "Minor": "Low", "Trivial": "Lowest",
}
GREETING = re.compile(r"^(hello|hi|dear)\b", re.I)
SIGN_OFF = re.compile(r"^(thanks?(?:\s*(?:&|and)\s*regards)?|regards|best regards|kind regards|thank you)[\s,!.]*$", re.I)


def text(value: object) -> str:
    return str(value or "").replace("\r\n", "\n").replace("\r", "\n").strip()


def description(value: object) -> str:
    lines = []
    for line in text(value).replace("\u00a0", " ").split("\n"):
        line = re.sub(r"\s+", " ", line).strip()
        if not line or GREETING.match(line):
            continue
        if SIGN_OFF.match(line):
            break
        lines.append(line)
    return " ".join(lines)


def timestamp(value: object, path: Path, row: int, column: str) -> str:
    raw = text(value)
    try:
        return datetime.fromisoformat(raw.replace("Z", "+00:00")).isoformat(timespec="microseconds").replace("+00:00", "Z")
    except ValueError as exc:
        raise ValueError(f"{path.name}, row {row}: invalid {column}: {raw!r}") from exc


def number(value: object, path: Path, row: int, column: str) -> str:
    try:
        parsed = float(text(value))
    except ValueError as exc:
        raise ValueError(f"{path.name}, row {row}: invalid {column}") from exc
    if not math.isfinite(parsed) or parsed < 0:
        raise ValueError(f"{path.name}, row {row}: {column} must be non-negative")
    return f"{parsed:.8f}"


def clean_file(path: Path) -> int:
    destination = OUTPUT / path.name
    seen: set[str] = set()
    count = 0
    with path.open(encoding="utf-8-sig", newline="") as source, destination.open("w", encoding="utf-8", newline="") as target:
        reader = csv.DictReader(source)
        if reader.fieldnames not in (COLUMNS, [column for column in COLUMNS if column != "priority_value"]):
            raise ValueError(f"{path.name}: unexpected source schema")
        writer = csv.DictWriter(target, fieldnames=COLUMNS, quoting=csv.QUOTE_MINIMAL)
        writer.writeheader()
        for row_number, raw in enumerate(reader, start=2):
            cleaned = {key: text(raw.get(key)) for key in COLUMNS}
            if any(not cleaned[key] for key in ("title", "task_type", "Priority", "issue_key", "Created", "Resolved")):
                raise ValueError(f"{path.name}, row {row_number}: a required field is blank")
            if cleaned["issue_key"] in seen:
                continue
            seen.add(cleaned["issue_key"])
            priority = cleaned["Priority"]
            priority = PRIORITY_ALIASES.get(priority, priority)
            if priority not in PRIORITY_VALUES:
                raise ValueError(f"{path.name}, row {row_number}: unknown priority {priority!r}")
            value = str(PRIORITY_VALUES[priority])
            if "priority_value" in raw and cleaned["priority_value"] != value:
                raise ValueError(f"{path.name}, row {row_number}: priority_value must be {value}")
            cleaned["Priority"] = priority
            cleaned["priority_value"] = value
            cleaned["Description"] = description(raw["Description"])
            cleaned["task_type"] = {"Bug": "Bug Fix", "New Feature": "Feature Development"}.get(cleaned["task_type"], cleaned["task_type"])
            for field in ("assignee_average_completion_days", "actual_completion_duration_days"):
                cleaned[field] = number(raw[field], path, row_number, field)
            try:
                prior = int(cleaned["prior_completed_tasks_used"])
            except ValueError as exc:
                raise ValueError(f"{path.name}, row {row_number}: invalid prior_completed_tasks_used") from exc
            if prior < 0:
                raise ValueError(f"{path.name}, row {row_number}: prior_completed_tasks_used must be non-negative")
            cleaned["prior_completed_tasks_used"] = str(prior)
            for field in ("actual_start_date", "Created", "Resolved"):
                cleaned[field] = timestamp(raw[field], path, row_number, field)
            if datetime.fromisoformat(cleaned["Resolved"].replace("Z", "+00:00")) < datetime.fromisoformat(cleaned["Created"].replace("Z", "+00:00")):
                raise ValueError(f"{path.name}, row {row_number}: Resolved precedes Created")
            writer.writerow(cleaned)
            count += 1
    return count


if __name__ == "__main__":
    if OUTPUT.exists():
        shutil.rmtree(OUTPUT)
    OUTPUT.mkdir()
    total = sum(clean_file(path) for path in sorted(SOURCE.glob("*.csv")))
    print(f"Cleaned {total} rows into {OUTPUT}")
