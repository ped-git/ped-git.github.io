#!/usr/bin/env python3
from __future__ import annotations

import argparse
import gzip
import json
import re
import shutil
from pathlib import Path


SURAH_NAMES = {
    1: "الفاتحة",
    2: "البقرة",
    3: "آل عمران",
    4: "النساء",
    5: "المائدة",
    6: "الأنعام",
    7: "الأعراف",
    8: "الأنفال",
    9: "التوبة",
    10: "يونس",
    11: "هود",
    12: "يوسف",
    13: "الرعد",
    14: "إبراهيم",
    15: "الحجر",
    16: "النحل",
    17: "الإسراء",
    18: "الكهف",
    19: "مريم",
    20: "طه",
    21: "الأنبياء",
    22: "الحج",
    23: "المؤمنون",
    24: "النور",
    25: "الفرقان",
    26: "الشعراء",
    27: "النمل",
    28: "القصص",
    29: "العنكبوت",
    30: "الروم",
    31: "لقمان",
    32: "السجدة",
    33: "الأحزاب",
    34: "سبأ",
    35: "فاطر",
    36: "يس",
    37: "الصافات",
    38: "ص",
    39: "الزمر",
    40: "غافر",
    41: "فصلت",
    42: "الشورى",
    43: "الزخرف",
    44: "الدخان",
    45: "الجاثية",
    46: "الأحقاف",
    47: "محمد",
    48: "الفتح",
    49: "الحجرات",
    50: "ق",
    51: "الذاريات",
    52: "الطور",
    53: "النجم",
    54: "القمر",
    55: "الرحمن",
    56: "الواقعة",
    57: "الحديد",
    58: "المجادلة",
    59: "الحشر",
    60: "الممتحنة",
    61: "الصف",
    62: "الجمعة",
    63: "المنافقون",
    64: "التغابن",
    65: "الطلاق",
    66: "التحريم",
    67: "الملك",
    68: "القلم",
    69: "الحاقة",
    70: "المعارج",
    71: "نوح",
    72: "الجن",
    73: "المزمل",
    74: "المدثر",
    75: "القيامة",
    76: "الإنسان",
    77: "المرسلات",
    78: "النبأ",
    79: "النازعات",
    80: "عبس",
    81: "التكوير",
    82: "الانفطار",
    83: "المطففين",
    84: "الانشقاق",
    85: "البروج",
    86: "الطارق",
    87: "الأعلى",
    88: "الغاشية",
    89: "الفجر",
    90: "البلد",
    91: "الشمس",
    92: "الليل",
    93: "الضحى",
    94: "الشرح",
    95: "التين",
    96: "العلق",
    97: "القدر",
    98: "البينة",
    99: "الزلزلة",
    100: "العاديات",
    101: "القارعة",
    102: "التكاثر",
    103: "العصر",
    104: "الهمزة",
    105: "الفيل",
    106: "قريش",
    107: "الماعون",
    108: "الكوثر",
    109: "الكافرون",
    110: "النصر",
    111: "المسد",
    112: "الإخلاص",
    113: "الفلق",
    114: "الناس",
}

ARABIC_DIGITS = str.maketrans("0123456789", "٠١٢٣٤٥٦٧٨٩")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Normalize and structure Safi book content for better rendering."
    )
    parser.add_argument(
        "--source",
        default="data/safi",
        help="Source Safi folder containing map.json and contents/*.json.gz.",
    )
    parser.add_argument(
        "--output",
        help="Optional output folder. If omitted, the source folder is rewritten in place.",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Replace the output folder if it already exists.",
    )
    return parser.parse_args()


def read_gzip_json(path: Path):
    with gzip.open(path, "rt", encoding="utf-8") as fh:
        return json.load(fh)


def write_gzip_json(path: Path, payload) -> None:
    with gzip.open(path, "wt", encoding="utf-8") as fh:
        json.dump(payload, fh, ensure_ascii=False, separators=(",", ":"))


def to_arabic_number(value: int) -> str:
    return str(value).translate(ARABIC_DIGITS)


def format_ayahs(ayahs: list[int]) -> str:
    if not ayahs:
        return ""
    if len(ayahs) == 1:
        return f"الآية {to_arabic_number(ayahs[0])}"
    return f"الآيات {to_arabic_number(ayahs[0])} - {to_arabic_number(ayahs[-1])}"


def is_block_boundary(line: str) -> bool:
    stripped = line.strip()
    if not stripped:
        return True
    if stripped.startswith("#"):
        return True
    if stripped.startswith("```"):
        return True
    if stripped.startswith(">"):
        return True
    if stripped.startswith("|"):
        return True
    if stripped.startswith("- "):
        return True
    if stripped.startswith("* "):
        return True
    if stripped[:2].isdigit() and stripped[2:4] == ". ":
        return True
    if stripped in {"***", "---", "___"}:
        return True
    return False


def normalize_wrapped_lines(text: str) -> str:
    lines = text.splitlines()
    if not lines:
        return text

    out: list[str] = []
    i = 0
    while i < len(lines):
        line = lines[i]
        if not line.strip():
            out.append("")
            i += 1
            continue

        current = line.strip()
        if is_block_boundary(line):
            out.append(current if line == current else line.rstrip())
            i += 1
            continue

        while i + 1 < len(lines):
            next_line = lines[i + 1]
            if not next_line.strip() or is_block_boundary(next_line):
                break
            current = f"{current} {next_line.strip()}"
            i += 1

        out.append(current)
        i += 1

    normalized = "\n".join(out)
    if text.endswith("\n"):
        normalized += "\n"
    return normalized


def strip_generated_scaffold(text: str) -> str:
    lines = []
    for line in text.splitlines():
        stripped = line.strip()
        if re.match(r"^#{1,6}\s+(سورة|الآية|الآيات)\b", stripped):
            continue
        lines.append(line)

    text = "\n".join(lines).strip()
    text = re.sub(r"^(?:الآية\s+[٠-٩]+\s+|الآيات\s+[٠-٩]+\s*-\s*[٠-٩]+\s+)", "", text)
    return text.strip()


def dedupe_repeated_text(text: str) -> str:
    parts = [part.strip() for part in re.split(r"\n{2,}", text) if part.strip()]
    if not parts:
        return text

    deduped: list[str] = []
    for part in parts:
        if part not in deduped:
            deduped.append(part)
    return "\n\n".join(deduped)


def clean_markdown(text: str) -> str:
    text = text.replace("***", "**")
    text = re.sub(r"\*\*\s+", "**", text)
    text = re.sub(r"\s+\*\*", " **", text)
    text = re.sub(r"\*\*أقول\s*:\s*\*\*", "**أقول:**", text)
    text = re.sub(r"\*\*أقول\s*:\s*", "**أقول:** ", text)
    text = re.sub(r"\s+", " ", text)
    text = re.sub(r"\s+([،؛:.])", r"\1", text)
    text = re.sub(r"(?<=[^\s(])\*\*", r" **", text)
    text = re.sub(r"\*\*(?=[^\s)،؛:.])", r"** ", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def split_intro_and_ayahs(text: str) -> tuple[str, list[tuple[int, str, str]]]:
    matches = list(
        re.finditer(
            r"\((?P<num>[٠-٩]+)\)\s*\*+\s*(?P<verse>.*?)\*+\s*(?P<commentary>.*?)(?=(?:\s*\([٠-٩]+\)\s*\*+)|$)",
            text,
        )
    )
    if not matches:
        return text.strip(), []

    intro = text[: matches[0].start()].strip()
    items: list[tuple[int, str, str]] = []
    for match in matches:
        number = int(match.group("num").translate(str.maketrans("٠١٢٣٤٥٦٧٨٩", "0123456789")))
        verse = clean_markdown(match.group("verse"))
        commentary = clean_markdown(match.group("commentary"))
        items.append((number, verse, commentary))
    return intro, items


def format_intro(intro: str, surah_number: int, first_of_surah: bool) -> str:
    intro = intro.strip()
    surah_name = SURAH_NAMES.get(surah_number, f"سورة {surah_number}")

    parts: list[str] = []
    if first_of_surah:
        parts.append(f"# سورة {surah_name}")

    if intro:
        intro = re.sub(r"^#+\s*", "", intro)
        intro = re.sub(rf"^سُ?ورة\s+{re.escape(surah_name)}\s*", "", intro)
        intro = clean_markdown(intro)
        if intro and intro != f"سورة {surah_name}" and intro != f"سُورة {surah_name}":
            parts.append(intro)

    return "\n\n".join(parts).strip()


def format_entry(text: str, surah_number: int, ayahs: list[int], first_of_surah: bool) -> str:
    text = strip_generated_scaffold(text)
    text = dedupe_repeated_text(text)
    normalized = normalize_wrapped_lines(text)
    intro, ayah_items = split_intro_and_ayahs(normalized)

    sections: list[str] = []
    intro_block = format_intro(intro, surah_number, first_of_surah)
    if intro_block:
        sections.append(intro_block)

    if ayah_items:
        if len(ayah_items) > 1:
            sections.append(f"## {format_ayahs(ayahs)}")

        for ayah_number, verse, commentary in ayah_items:
            sections.append(f"### الآية {to_arabic_number(ayah_number)}")
            sections.append(f"**{verse}**")
            if commentary:
                commentary = re.sub(
                    r"\s+(في الكافي|في تفسير الإمام|في المعاني|في العيون|وفي الكافي|وفي تفسير الإمام|وفي المعاني|وفي العيون|وفي رواية أخرى|وفي رواية|وعن الصادق عليه السلام|وعنه عليه السلام|العيّاشيّ عن|القمّيّ عن|القميّ عن|قيل:)\s",
                    r"\n\n\1 ",
                    commentary,
                )
                commentary = re.sub(r"\s+\*\*أقول:\*\*\s*", r"\n\n**أقول:** ", commentary)
                commentary = re.sub(r"\n{3,}", "\n\n", commentary)
                sections.append(commentary.strip())
    else:
        title = f"## {format_ayahs(ayahs)}" if ayahs else None
        if title:
            sections.append(title)
        body = clean_markdown(normalized)
        if body:
            sections.append(body)

    return "\n\n".join(part for part in sections if part).strip() + "\n"


def normalize_payload(payload, map_data: dict[str, dict], first_ids_by_surah: dict[int, str]):
    if not isinstance(payload, dict):
        return payload

    normalized = {}
    for key, value in payload.items():
        if not isinstance(value, str) or key not in map_data:
            normalized[key] = value
            continue

        entry = map_data[key]
        surah_number = entry.get("s")
        ayahs = entry.get("a", [])
        first_of_surah = first_ids_by_surah.get(surah_number) == key
        normalized[key] = format_entry(value, surah_number, ayahs, first_of_surah)
    return normalized


def prepare_output(source: Path, output: Path | None, force: bool) -> Path:
    if output is None:
        return source

    if output.exists():
        if not force:
            raise SystemExit(
                f"Output directory already exists: {output}. Use --force to replace it."
            )
        shutil.rmtree(output)

    shutil.copytree(source, output)
    return output


def build_first_ids_by_surah(map_data: dict[str, dict]) -> dict[int, str]:
    first_ids: dict[int, str] = {}
    for key in sorted(map_data, key=lambda item: int(item)):
        surah_number = map_data[key].get("s")
        first_ids.setdefault(surah_number, key)
    return first_ids


def main() -> None:
    args = parse_args()
    source = Path(args.source)
    if not source.exists():
        raise SystemExit(f"Source folder not found: {source}")

    target = prepare_output(source, Path(args.output) if args.output else None, args.force)
    map_data = json.loads((target / "map.json").read_text(encoding="utf-8"))
    first_ids_by_surah = build_first_ids_by_surah(map_data)

    contents_dir = target / "contents"
    for path in sorted(contents_dir.glob("*.json.gz")):
        payload = read_gzip_json(path)
        write_gzip_json(path, normalize_payload(payload, map_data, first_ids_by_surah))

    muqadimah_path = target / "muqadimah.json.gz"
    if muqadimah_path.exists():
        payload = read_gzip_json(muqadimah_path)
        if isinstance(payload, dict):
            payload = {
                key: normalize_wrapped_lines(value) if isinstance(value, str) else value
                for key, value in payload.items()
            }
        write_gzip_json(muqadimah_path, payload)

    print(f"Normalized Safi content in {target}")


if __name__ == "__main__":
    main()
