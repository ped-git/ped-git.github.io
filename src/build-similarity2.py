#!/usr/bin/env python3
import argparse
import heapq
import json
import math
import re
from collections import Counter, defaultdict
from pathlib import Path

IN_PATH = Path("data/quranic-corpus-morphology-0.4.txt")
DEFAULT_VEC = Path("data/cc.ar.300.vec")
OUT_DIR = Path("data/similarity2")
OUT_PATH = OUT_DIR / "r2rvec.json"
DEFAULT_LEXICON = OUT_DIR / "manual-lexicon.json"

LOC_RE = re.compile(r"^\((\d+):(\d+):(\d+):(\d+)\)$")
LEM_RE = re.compile(r"(?:^|\|)LEM:([^|]+)")
ROOT_RE = re.compile(r"(?:^|\|)ROOT:([^|]+)")
ARABIC_DIACRITICS_RE = re.compile(r"[\u064b-\u065f\u0670\u06d6-\u06ed]")

BUCKWALTER_TO_ARABIC = {
    "'": "ء", ">": "أ", "&": "ؤ", "<": "إ", "}": "ئ", "A": "ا", "{": "ا",
    "b": "ب", "p": "ة", "t": "ت", "v": "ث", "j": "ج", "H": "ح", "x": "خ",
    "d": "د", "*": "ذ", "r": "ر", "z": "ز", "s": "س", "$": "ش", "S": "ص",
    "D": "ض", "T": "ط", "Z": "ظ", "E": "ع", "g": "غ", "f": "ف", "q": "ق",
    "k": "ك", "l": "ل", "m": "م", "n": "ن", "h": "ه", "w": "و", "Y": "ى",
    "y": "ي", "F": "ً", "N": "ٌ", "K": "ٍ", "a": "َ", "u": "ُ", "i": "ِ",
    "~": "ّ", "o": "ْ", "^": "ٰ", "#": "ٔ", "`": "ٰ", "|": "", "]": "",
    "[": "", "@": "", ":": "", ";": "", ",": "", ".": "", "!": "", "-": "",
    "+": "", "%": "", '"': "", "_": "",
}


def parse_args():
    parser = argparse.ArgumentParser(
        description="Build a second-generation Quran root similarity graph with cleaned root vectors and Quran-only reranking."
    )
    parser.add_argument("--vec", type=Path, default=DEFAULT_VEC, help=f"fastText .vec file (default: {DEFAULT_VEC})")
    parser.add_argument("--input", type=Path, default=IN_PATH, help=f"Quran morphology corpus (default: {IN_PATH})")
    parser.add_argument("--out-dir", type=Path, default=OUT_DIR, help=f"Output directory (default: {OUT_DIR})")
    parser.add_argument("--top-k", type=int, default=250, help="Final related roots to keep per root")
    parser.add_argument("--candidate-pool", type=int, default=500, help="Embedding neighbors to rerank per root")
    parser.add_argument("--mutual-k", type=int, default=80, help="Mutual-neighbor cutoff used as a bonus signal")
    parser.add_argument("--csls-knn", type=int, default=10, help="Neighborhood size used in CSLS local scaling")
    parser.add_argument("--remove-pcs", type=int, default=4, help="Top principal directions to remove (ABTT-style)")
    parser.add_argument("--power-iters", type=int, default=30, help="Power-iteration steps per principal component")
    parser.add_argument("--min-final-score", type=float, default=0.005, help="Minimum final reranked score to keep")
    parser.add_argument("--w-csls", type=float, default=0.50, help="Weight for cleaned-space CSLS score")
    parser.add_argument("--w-cooc", type=float, default=0.25, help="Weight for Quran ayah-cooccurrence score")
    parser.add_argument("--w-mutual", type=float, default=0.15, help="Weight for mutual-neighbor bonus")
    parser.add_argument("--w-lexicon", type=float, default=0.10, help="Weight for optional manual lexicon edge")
    parser.add_argument("--lexicon", type=Path, default=DEFAULT_LEXICON, help=f"Optional manual lexicon JSON (default: {DEFAULT_LEXICON})")
    return parser.parse_args()


def buckwalter_to_arabic(text):
    return "".join(
        BUCKWALTER_TO_ARABIC.get(char, char)
        for char in text
        if BUCKWALTER_TO_ARABIC.get(char, char) != ""
    )


def normalize_fasttext_arabic(text):
    normalized = ARABIC_DIACRITICS_RE.sub("", text).replace("ـ", "")
    return normalized.translate(str.maketrans({
        "أ": "ا", "إ": "ا", "آ": "ا", "ٱ": "ا", "ى": "ي",
    }))


def lemma_candidates(lemma):
    stripped = ARABIC_DIACRITICS_RE.sub("", lemma).replace("ـ", "")
    normalized = normalize_fasttext_arabic(lemma)
    variants = []
    for candidate in (lemma, stripped, normalized):
        if candidate and candidate not in variants:
            variants.append(candidate)
    if stripped:
        for candidate in (
            stripped.replace("أ", "ا").replace("إ", "ا").replace("آ", "ا").replace("ٱ", "ا"),
            stripped.replace("ى", "ي"),
            stripped.replace("ة", "ه"),
        ):
            if candidate and candidate not in variants:
                variants.append(candidate)
    return variants


def parse_morphology(input_path):
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
            match = LOC_RE.match(parts[0].strip())
            if not match:
                continue
            key = (int(match.group(1)), int(match.group(2)), int(match.group(3)))
            segment = int(match.group(4))
            word_segments.setdefault(key, []).append((segment, parts[3].strip()))

    lemma_counts = Counter()
    root_counts = Counter()
    lemma_to_root = {}
    root_to_lemmas = defaultdict(Counter)
    root_ayahs = defaultdict(set)

    for (sura, ayah, _word), segments in word_segments.items():
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
            root_ayahs[root].add((sura, ayah))
        if lemma and root:
            existing = lemma_to_root.get(lemma)
            if existing and existing != root:
                raise ValueError(f"Lemma {lemma!r} mapped to multiple roots: {existing!r}, {root!r}")
            lemma_to_root[lemma] = root
            root_to_lemmas[root][lemma] += 1

    return lemma_counts, root_counts, lemma_to_root, root_to_lemmas, root_ayahs


def build_candidate_map(lemmas):
    candidate_to_lemmas = defaultdict(set)
    candidate_rank = {}
    for lemma in lemmas:
        for rank, candidate in enumerate(lemma_candidates(lemma)):
            candidate_to_lemmas[candidate].add(lemma)
            candidate_rank[(lemma, candidate)] = rank
    return candidate_to_lemmas, candidate_rank


def load_lemma_vectors(vec_path, lemma_counts):
    candidate_to_lemmas, candidate_rank = build_candidate_map(lemma_counts)
    vectors = {}
    matched_tokens = {}
    dimension = None
    header_consumed = False

    with vec_path.open("r", encoding="utf-8", errors="replace") as handle:
        for line in handle:
            line = line.rstrip("\n")
            if not line:
                continue
            if not header_consumed:
                header_consumed = True
                header = line.split()
                if len(header) == 2 and all(part.isdigit() for part in header):
                    continue
            parts = line.split()
            if len(parts) < 3:
                continue
            token = parts[0]
            if token not in candidate_to_lemmas:
                continue
            values = parts[1:]
            if dimension is None:
                dimension = len(values)
            try:
                vector = [float(value) for value in values]
            except ValueError:
                continue
            for lemma in candidate_to_lemmas[token]:
                existing_rank = candidate_rank.get((lemma, matched_tokens.get(lemma)), float("inf"))
                new_rank = candidate_rank[(lemma, token)]
                if lemma not in vectors or new_rank < existing_rank:
                    vectors[lemma] = vector
                    matched_tokens[lemma] = token
    return vectors, matched_tokens, dimension


def dot(a, b):
    total = 0.0
    for x, y in zip(a, b):
        total += x * y
    return total


def l2_norm(vec):
    return math.sqrt(dot(vec, vec))


def normalize(vec):
    norm = l2_norm(vec)
    if norm == 0:
        return [0.0 for _ in vec]
    return [value / norm for value in vec]


def average_root_vectors(root_to_lemmas, lemma_vectors):
    root_vectors = {}
    root_meta = {}
    for root, lemma_counter in root_to_lemmas.items():
        matched = [(lemma, count) for lemma, count in lemma_counter.items() if lemma in lemma_vectors]
        if not matched:
            continue
        dimension = len(lemma_vectors[matched[0][0]])
        accum = [0.0] * dimension
        total_weight = 0.0
        for lemma, count in matched:
            vec = lemma_vectors[lemma]
            weight = float(count)
            total_weight += weight
            for idx, value in enumerate(vec):
                accum[idx] += weight * value
        root_vectors[root] = [value / total_weight for value in accum]
        root_meta[root] = {
            "matched_lemmas": len(matched),
            "representative_lemmas": [lemma for lemma, _ in sorted(matched, key=lambda item: (-item[1], item[0]))[:8]],
        }
    return root_vectors, root_meta


def mean_center(vectors):
    if not vectors:
        return [], []
    dimension = len(vectors[0])
    mean = [0.0] * dimension
    for vec in vectors:
        for idx, value in enumerate(vec):
            mean[idx] += value
    mean = [value / len(vectors) for value in mean]
    centered = [[value - mean[idx] for idx, value in enumerate(vec)] for vec in vectors]
    return centered, mean


def power_iteration_principal_component(vectors, iterations):
    if not vectors:
        return []
    dimension = len(vectors[0])
    component = [1.0 / math.sqrt(dimension)] * dimension
    for _ in range(iterations):
        next_vec = [0.0] * dimension
        for vec in vectors:
            score = dot(vec, component)
            if score == 0:
                continue
            for idx, value in enumerate(vec):
                next_vec[idx] += score * value
        norm = l2_norm(next_vec)
        if norm == 0:
            break
        component = [value / norm for value in next_vec]
    return component


def remove_top_components(vectors, n_components, iterations):
    cleaned = [vec[:] for vec in vectors]
    components = []
    for _ in range(max(0, n_components)):
        component = power_iteration_principal_component(cleaned, iterations)
        if not component or l2_norm(component) == 0:
            break
        components.append(component)
        for vec in cleaned:
            score = dot(vec, component)
            if score == 0:
                continue
            for idx in range(len(vec)):
                vec[idx] -= score * component[idx]
    return cleaned, components


def compute_neighbor_lists(root_names, vectors, pool_k):
    neighbors = {}
    for index, root in enumerate(root_names):
        heap = []
        source = vectors[index]
        for other_index, other_root in enumerate(root_names):
            if other_index == index:
                continue
            score = dot(source, vectors[other_index])
            if len(heap) < pool_k:
                heapq.heappush(heap, (score, other_root))
            elif score > heap[0][0]:
                heapq.heapreplace(heap, (score, other_root))
        neighbors[root] = sorted(heap, key=lambda item: (-item[0], item[1]))
    return neighbors


def compute_csls_local_average(neighbors, knn):
    local_avg = {}
    for root, items in neighbors.items():
        top = items[:knn]
        if not top:
            local_avg[root] = 0.0
            continue
        local_avg[root] = sum(score for score, _ in top) / len(top)
    return local_avg


def jaccard_similarity(a, b):
    if not a or not b:
        return 0.0
    inter = len(a & b)
    if inter == 0:
        return 0.0
    union = len(a | b)
    return inter / union if union else 0.0


def load_manual_lexicon(path):
    if not path.exists():
        return {}
    payload = json.loads(path.read_text(encoding="utf-8"))
    if isinstance(payload, dict):
        return {root: set(values) for root, values in payload.items() if isinstance(values, list)}
    return {}


def build_similarity_graph(
    root_names,
    root_counts,
    root_ayahs,
    cosine_neighbors,
    csls_local_average,
    manual_lexicon,
    args,
):
    mutual_maps = {
        root: {other: rank for rank, (_score, other) in enumerate(items[:args.mutual_k], start=1)}
        for root, items in cosine_neighbors.items()
    }
    roots_output = {}

    for root in root_names:
        candidates = []
        csls_scores = []
        for cosine_score, other in cosine_neighbors[root][:args.candidate_pool]:
            mutual_rank = mutual_maps.get(other, {}).get(root)
            lexicon_edge = 1.0 if other in manual_lexicon.get(root, set()) else 0.0
            csls = (2.0 * cosine_score) - csls_local_average.get(root, 0.0) - csls_local_average.get(other, 0.0)
            csls = max(0.0, csls)
            cooc = jaccard_similarity(root_ayahs.get(root, set()), root_ayahs.get(other, set()))
            mutual_bonus = 0.0
            if mutual_rank is not None and args.mutual_k > 0:
                mutual_bonus = (args.mutual_k - mutual_rank + 1) / args.mutual_k
            candidates.append({
                "root": other,
                "cosine": cosine_score,
                "csls": csls,
                "cooccurrence": cooc,
                "mutual_rank": mutual_rank,
                "mutual_bonus": mutual_bonus,
                "lexicon": lexicon_edge,
            })
            csls_scores.append(csls)

        max_csls = max(csls_scores) if csls_scores else 0.0
        related = []
        for item in candidates:
            normalized_csls = (item["csls"] / max_csls) if max_csls > 0 else 0.0
            final_score = (
                args.w_csls * normalized_csls
                + args.w_cooc * item["cooccurrence"]
                + args.w_mutual * item["mutual_bonus"]
                + args.w_lexicon * item["lexicon"]
            )
            if final_score < args.min_final_score:
                continue
            related.append({
                "root": item["root"],
                "score": round(final_score, 6),
            })

        related.sort(key=lambda item: (-item["score"], item["root"]))
        roots_output[root] = {
            "related": related[:args.top_k],
        }

    return roots_output


def write_json(path, payload):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False, separators=(",", ":"))


def main():
    args = parse_args()
    if not args.vec.exists():
        raise FileNotFoundError(f"Vector file not found: {args.vec}")

    lemma_counts, root_counts, lemma_to_root, root_to_lemmas, root_ayahs = parse_morphology(args.input)
    lemma_vectors, matched_tokens, dimension = load_lemma_vectors(args.vec, lemma_counts)
    root_vectors, root_meta = average_root_vectors(root_to_lemmas, lemma_vectors)

    root_names = sorted(root_vectors)
    dense_vectors = [root_vectors[root] for root in root_names]
    centered_vectors, mean = mean_center(dense_vectors)
    cleaned_vectors, components = remove_top_components(centered_vectors, args.remove_pcs, args.power_iters)
    normalized_vectors = [normalize(vec) for vec in cleaned_vectors]

    pool_k = max(args.candidate_pool, args.mutual_k, args.csls_knn)
    cosine_neighbors = compute_neighbor_lists(root_names, normalized_vectors, pool_k)
    csls_local_average = compute_csls_local_average(cosine_neighbors, args.csls_knn)
    manual_lexicon = load_manual_lexicon(args.lexicon)

    roots_output = build_similarity_graph(
        root_names=root_names,
        root_counts=root_counts,
        root_ayahs=root_ayahs,
        cosine_neighbors=cosine_neighbors,
        csls_local_average=csls_local_average,
        manual_lexicon=manual_lexicon,
        args=args,
    )

    output_path = args.out_dir / "r2rvec.json"
    write_json(output_path, {
        "meta": {
            "root_count": len(root_counts),
            "matched_lemmas": len(lemma_vectors),
            "matched_roots": len(root_names),
            "power_iters": args.power_iters,
            "min_final_score": args.min_final_score,
            "top_k": args.top_k,
            "threshold_hint": 0.10,
            "method": "compact_similarity2",
        },
        "roots": roots_output,
    })

    print(
        f"Wrote {output_path} with {len(root_names)} matched roots "
        f"from {len(lemma_vectors)}/{len(lemma_counts)} matched lemmas."
    )


if __name__ == "__main__":
    main()
