#!/usr/bin/env python3
from __future__ import annotations

import argparse
import gzip
import json
import shutil
import sqlite3
import tarfile
import tempfile
from pathlib import Path
from typing import Dict, List


DEFAULT_CHUNK_SIZE = 30


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Export a tafsir SQLite database into the static book folder format."
    )
    parser.add_argument(
        "--db",
        default="data/tafsir_almizan_ar.db",
        help="Path to the source SQLite database.",
    )
    parser.add_argument(
        "--output",
        default="data/almizan-ar",
        help="Destination folder for the exported book.",
    )
    parser.add_argument(
        "--chunk-size",
        type=int,
        default=DEFAULT_CHUNK_SIZE,
        help="Number of content entries per compressed JSON chunk.",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Delete the output folder first if it already exists.",
    )
    return parser.parse_args()


def write_gzip_json(path: Path, payload: object) -> None:
    with gzip.open(path, "wt", encoding="utf-8") as fh:
        json.dump(payload, fh, ensure_ascii=False, separators=(",", ":"))


def open_source_database(db_path: Path):
    if db_path.suffixes[-2:] == [".tar", ".xz"] or db_path.suffix == ".txz":
        temp_dir = tempfile.TemporaryDirectory(prefix="book-to-db-")
        with tarfile.open(db_path, "r:*") as archive:
            members = [member for member in archive.getmembers() if member.isfile()]
            if not members:
                temp_dir.cleanup()
                raise SystemExit(f"No database file found in archive: {db_path}")
            archive.extractall(path=temp_dir.name, filter="data")

        extracted_files = sorted(Path(temp_dir.name).rglob("*"))
        db_files = [path for path in extracted_files if path.is_file()]
        if not db_files:
            temp_dir.cleanup()
            raise SystemExit(f"No extracted database file found in archive: {db_path}")

        connection = sqlite3.connect(db_files[0])
        return connection, temp_dir

    return sqlite3.connect(db_path), None


def validate_schema(connection: sqlite3.Connection, source_label: str) -> None:
    rows = connection.execute(
        "SELECT name FROM sqlite_master WHERE type='table'"
    ).fetchall()
    tables = {name for (name,) in rows}
    required = {"content", "ayah_mapping", "muqadimah"}
    missing = sorted(required - tables)
    if missing:
        available = ", ".join(sorted(tables)) or "(none)"
        missing_text = ", ".join(missing)
        raise SystemExit(
            f"Unsupported database schema in {source_label}. "
            f"Missing required tables: {missing_text}. "
            f"Available tables: {available}"
        )


def build_map(connection: sqlite3.Connection) -> Dict[str, dict]:
    rows = connection.execute(
        """
        SELECT
            content_id,
            surah_number,
            ayah_number
        FROM ayah_mapping
        ORDER BY surah_number, ayah_number, content_id
        """
    ).fetchall()

    grouped: Dict[int, dict] = {}
    for content_id, surah_number, ayah_number in rows:
        entry = grouped.setdefault(
            content_id,
            {"s": surah_number, "a": []},
        )
        entry["a"].append(ayah_number)

    return {str(content_id): entry for content_id, entry in grouped.items()}


def export_chunks(
    connection: sqlite3.Connection,
    output_dir: Path,
    map_data: Dict[str, dict],
    chunk_size: int,
) -> None:
    rows = connection.execute(
        """
        SELECT content_id, content
        FROM content
        ORDER BY content_id
        """
    ).fetchall()

    contents_dir = output_dir / "contents"
    contents_dir.mkdir(parents=True, exist_ok=True)

    for chunk_index, offset in enumerate(range(0, len(rows), chunk_size), start=1):
        chunk_rows = rows[offset : offset + chunk_size]
        filename = f"chunk-{chunk_index:04d}.json.gz"
        chunk_payload = {str(content_id): content for content_id, content in chunk_rows}
        write_gzip_json(contents_dir / filename, chunk_payload)

        for content_id, _content in chunk_rows:
            map_data[str(content_id)]["f"] = filename


def export_muqadimah(connection: sqlite3.Connection, output_dir: Path) -> None:
    rows = connection.execute(
        """
        SELECT id, content
        FROM muqadimah
        ORDER BY id
        """
    ).fetchall()
    if not rows:
        return

    payload = {str(row_id): content for row_id, content in rows}
    write_gzip_json(output_dir / "muqadimah.json.gz", payload)


def main() -> None:
    args = parse_args()
    db_path = Path(args.db)
    output_dir = Path(args.output)

    if not db_path.exists():
        raise SystemExit(f"Database not found: {db_path}")
    if args.chunk_size < 1:
        raise SystemExit("--chunk-size must be at least 1")

    if output_dir.exists():
        if not args.force:
            raise SystemExit(
                f"Output directory already exists: {output_dir}. Use --force to replace it."
            )
        shutil.rmtree(output_dir)

    output_dir.mkdir(parents=True, exist_ok=True)

    connection, temp_dir = open_source_database(db_path)
    try:
        validate_schema(connection, str(db_path))
        map_data = build_map(connection)
        export_chunks(connection, output_dir, map_data, args.chunk_size)
        export_muqadimah(connection, output_dir)
    finally:
        connection.close()
        if temp_dir is not None:
            temp_dir.cleanup()

    map_path = output_dir / "map.json"
    map_path.write_text(
        json.dumps(map_data, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )

    print(f"Exported {len(map_data)} content entries to {output_dir}")


if __name__ == "__main__":
    main()
