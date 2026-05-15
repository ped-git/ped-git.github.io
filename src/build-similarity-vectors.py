#!/usr/bin/env python3
import argparse
import json
import math
import re
from collections import Counter, defaultdict
from pathlib import Path

IN_PATH = Path("data/quranic-corpus-morphology-0.4.txt")
OUT_DIR = Path("data/similarity")
W2W_PATH = OUT_DIR / "w2wvec.json"
R2R_PATH = OUT_DIR / "r2rvec.json"

LOC_RE = re.compile(r"^\((\d+):(\d+):(\d+):(\d+)\)$")
LEM_RE = re.compile(r"(?:^|\|)LEM:([^|]+)")
ROOT_RE = re.compile(r"(?:^|\|)ROOT:([^|]+)")
ARABIC_DIACRITICS_RE = re.compile(r"[\u064b-\u065f\u0670\u06d6-\u06ed]")

BUCKWALTER_TO_ARABIC = {
    "'": "ء",
    ">": "أ",
    "&": "ؤ",
    "<": "إ",
    "}": "ئ",
    "A": "ا",
    "{": "ا",
    "b": "ب",
    "p": "ة",
    "t": "ت",
    "v": "ث",
    "j": "ج",
    "H": "ح",
    "x": "خ",
    "d": "د",
    "*": "ذ",
    "r": "ر",
    "z": "ز",
    "s": "س",
    "$": "ش",
    "S": "ص",
    "D": "ض",
    "T": "ط",
    "Z": "ظ",
    "E": "ع",
    "g": "غ",
    "f": "ف",
    "q": "ق",
    "k": "ك",
    "l": "ل",
    "m": "م",
    "n": "ن",
    "h": "ه",
    "w": "و",
    "Y": "ى",
    "y": "ي",
    "F": "ً",
    "N": "ٌ",
    "K": "ٍ",
    "a": "َ",
    "u": "ُ",
    "i": "ِ",
    "~": "ّ",
    "o": "ْ",
    "^": "ٰ",
    "#": "ٔ",
    "`": "ٰ",
    "|": "",
    "]": "",
    "[": "",
    "@": "",
    ":": "",
    ";": "",
    ",": "",
    ".": "",
    "!": "",
    "-": "",
    "+": "",
    "%": "",
    '"': "",
    "_": "",
}


def parse_args():
    parser = argparse.ArgumentParser(
        description="Build lemma and root similarity JSON files from Quran lemmas and a fastText .vec file."
    )
    parser.add_argument(
        "--vec",
        required=True,
        type=Path,
        help="Path to the fastText .vec file, for example cc.ar.300.vec",
    )
    parser.add_argument(
        "--input",
        default=IN_PATH,
        type=Path,
        help=f"Quran morphology corpus path. Default: {IN_PATH}",
    )
    parser.add_argument(
        "--out-dir",
        default=OUT_DIR,
        type=Path,
        help=f"Output directory. Default: {OUT_DIR}",
    )
    parser.add_argument(
        "--top-k",
        default=20,
        type=int,
        help="How many related lemmas or roots to keep for each entry. Default: 20",
    )
    parser.add_argument(
        "--min-similarity",
        default=0.35,
        type=float,
        help="Minimum cosine similarity to keep. Default: 0.35",
    )
    return parser.parse_args()


def buckwalter_to_arabic(text: str) -> str:
    return "".join(
        BUCKWALTER_TO_ARABIC.get(char, char)
        for char in text
        if BUCKWALTER_TO_ARABIC.get(char, char) != ""
    )


def normalize_fasttext_arabic(text: str) -> str:
    normalized = ARABIC_DIACRITICS_RE.sub("", text)
    normalized = normalized.replace("ـ", "")
    normalized = normalized.translate(str.maketrans({
        "أ": "ا",
        "إ": "ا",
        "آ": "ا",
        "ٱ": "ا",
        "ى": "ي",
    }))
    return normalized


def lemma_candidates(lemma: str):
    stripped = ARABIC_DIACRITICS_RE.sub("", lemma).replace("ـ", "")
    normalized = normalize_fasttext_arabic(lemma)

    variants = []
    for candidate in (lemma, stripped, normalized):
        if candidate and candidate not in variants:
            variants.append(candidate)

    if stripped:
        variants.extend(
            candidate
            for candidate in {
                stripped.replace("أ", "ا").replace("إ", "ا").replace("آ", "ا").replace("ٱ", "ا"),
                stripped.replace("ى", "ي"),
                stripped.replace("ة", "ه"),
            }
            if candidate and candidate not in variants
        )

    return variants


def parse_morphology(input_path: Path):
    if not input_path.exists():
        raise FileNotFoundError(f"Input file not found: {input_path}")

    word_segments = {}
    with input_path.open("r", encoding="utf-8", errors="replace") as handle:
        for line in handle:
            line = line.strip()
            if not line or line.startswith("#") or line.startswith("LOCATION"):
                continue

            parts = line.split("\t")
            if len(parts) < 4:
                continue

            loc = parts[0].strip()
            feats = parts[3].strip()
            match = LOC_RE.match(loc)
            if not match:
                continue

            key = (
                int(match.group(1)),
                int(match.group(2)),
                int(match.group(3)),
            )
            segment = int(match.group(4))
            word_segments.setdefault(key, []).append((segment, feats))

    lemma_counts = Counter()
    root_counts = Counter()
    lemma_to_root = {}

    for segments in word_segments.values():
        segments.sort(key=lambda item: item[0])
        lemma = None
        root = None
        for _, feats in segments:
            if lemma is None:
                lemma_match = LEM_RE.search(feats)
                if lemma_match:
                    lemma = buckwalter_to_arabic(lemma_match.group(1))
            if root is None:
                root_match = ROOT_RE.search(feats)
                if root_match:
                    root = buckwalter_to_arabic(root_match.group(1))

        if lemma:
            lemma_counts[lemma] += 1
        if root:
            root_counts[root] += 1
        if lemma and root:
            existing = lemma_to_root.get(lemma)
            if existing and existing != root:
                raise ValueError(f"Lemma {lemma!r} mapped to multiple roots: {existing!r}, {root!r}")
            lemma_to_root[lemma] = root

    return lemma_counts, root_counts, lemma_to_root


def build_candidate_map(lemmas):
    candidate_to_lemmas = defaultdict(set)
    candidate_rank = {}
    for lemma in lemmas:
        for rank, candidate in enumerate(lemma_candidates(lemma)):
            candidate_to_lemmas[candidate].add(lemma)
            candidate_rank[(lemma, candidate)] = rank
    return candidate_to_lemmas, candidate_rank


def load_target_vectors(vec_path: Path, candidate_to_lemmas, candidate_rank):
    if not vec_path.exists():
        raise FileNotFoundError(f"Vector file not found: {vec_path}")

    vectors = {}
    found_tokens = {}
    need_candidates = set(candidate_to_lemmas)
    dimension = None
    header_consumed = False

    with vec_path.open("r", encoding="utf-8", errors="replace") as handle:
        for line_number, line in enumerate(handle, start=1):
            line = line.rstrip("\n")
            if not line:
                continue

            if not header_consumed:
                header_consumed = True
                first_parts = line.split()
                if len(first_parts) == 2 and all(part.isdigit() for part in first_parts):
                    continue

            parts = line.split()
            if len(parts) < 3:
                continue

            token = parts[0]
            if token not in need_candidates:
                continue

            values = parts[1:]
            if dimension is None:
                dimension = len(values)

            try:
                vector = [float(value) for value in values]
            except ValueError:
                continue

            norm = math.sqrt(sum(component * component for component in vector))
            if norm == 0:
                continue
            normalized_vector = [component / norm for component in vector]

            for lemma in candidate_to_lemmas[token]:
                existing_rank = candidate_rank.get((lemma, found_tokens.get(lemma)), float("inf"))
                new_rank = candidate_rank[(lemma, token)]
                if lemma not in vectors or new_rank < existing_rank:
                    vectors[lemma] = normalized_vector
                    found_tokens[lemma] = token

    return vectors, found_tokens, dimension


def cosine_similarity(vec_a, vec_b):
    return sum(a * b for a, b in zip(vec_a, vec_b))


def build_w2w(lemma_counts, lemma_to_root, vectors, found_tokens, top_k, min_similarity):
    scored = {}
    sorted_lemmas = sorted(vectors)

    for index, lemma in enumerate(sorted_lemmas):
        source_vector = vectors[lemma]
        related = []
        for other in sorted_lemmas[index + 1:]:
            score = cosine_similarity(source_vector, vectors[other])
            if score < min_similarity:
                continue
            related.append((other, score))
            scored.setdefault(other, []).append((lemma, score))

        for other, score in related:
            scored.setdefault(lemma, []).append((other, score))

    w2w = {}
    for lemma in sorted(lemma_counts):
        relations = sorted(scored.get(lemma, []), key=lambda item: (-item[1], item[0]))[:top_k]
        w2w[lemma] = {
            "root": lemma_to_root.get(lemma),
            "count": lemma_counts[lemma],
            "fasttext_token": found_tokens.get(lemma),
            "related": [
                {
                    "lemma": other,
                    "root": lemma_to_root.get(other),
                    "similarity": round(score, 6),
                    "count": lemma_counts[other],
                    "fasttext_token": found_tokens.get(other),
                }
                for other, score in relations
            ],
        }
    return w2w


def build_r2r(w2w, root_counts, top_k):
    pair_scores = defaultdict(list)

    for lemma, payload in w2w.items():
        source_root = payload.get("root")
        if not source_root:
            continue
        for related in payload.get("related", []):
            target_root = related.get("root")
            if not target_root or target_root == source_root:
                continue
            pair_scores[(source_root, target_root)].append(related["similarity"])

    r2r = {}
    for root in sorted(root_counts):
        related_roots = []
        for (source_root, target_root), scores in pair_scores.items():
            if source_root != root:
                continue
            average = sum(scores) / len(scores)
            related_roots.append({
                "root": target_root,
                "similarity": round(average, 6),
                "support": len(scores),
                "max_similarity": round(max(scores), 6),
                "count": root_counts[target_root],
            })

        related_roots.sort(key=lambda item: (-item["similarity"], -item["support"], item["root"]))
        r2r[root] = {
            "count": root_counts[root],
            "related": related_roots[:top_k],
        }
    return r2r


def write_json(path: Path, payload):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=2)


def main():
    args = parse_args()

    lemma_counts, root_counts, lemma_to_root = parse_morphology(args.input)
    candidate_to_lemmas, candidate_rank = build_candidate_map(lemma_counts)
    vectors, found_tokens, dimension = load_target_vectors(args.vec, candidate_to_lemmas, candidate_rank)

    w2w = build_w2w(
        lemma_counts=lemma_counts,
        lemma_to_root=lemma_to_root,
        vectors=vectors,
        found_tokens=found_tokens,
        top_k=args.top_k,
        min_similarity=args.min_similarity,
    )
    r2r = build_r2r(w2w=w2w, root_counts=root_counts, top_k=args.top_k)

    out_dir = args.out_dir
    w2w_path = out_dir / "w2wvec.json"
    r2r_path = out_dir / "r2rvec.json"

    write_json(w2w_path, {
        "meta": {
            "input": str(args.input),
            "vector_file": str(args.vec),
            "top_k": args.top_k,
            "min_similarity": args.min_similarity,
            "lemma_count": len(lemma_counts),
            "root_count": len(root_counts),
            "vector_dimension": dimension,
            "matched_lemmas": len(vectors),
            "unmatched_lemmas": len(lemma_counts) - len(vectors),
            "notes": [
                "Lemma keys are the original Quran corpus lemmas in Arabic script.",
                "fasttext_token stores the normalized token that matched the vector vocabulary.",
            ],
        },
        "lemmas": w2w,
    })
    write_json(r2r_path, {
        "meta": {
            "source": str(w2w_path),
            "top_k": args.top_k,
            "root_count": len(root_counts),
            "matched_roots": sum(1 for root, payload in r2r.items() if payload["related"]),
        },
        "roots": r2r,
    })

    print(
        f"Wrote {w2w_path} and {r2r_path}. "
        f"Matched {len(vectors)}/{len(lemma_counts)} lemmas against {args.vec}."
    )


if __name__ == "__main__":
    main()
