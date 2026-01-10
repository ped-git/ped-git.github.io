#!/usr/bin/env python3
import json
import math
import re
from collections import Counter, defaultdict
from pathlib import Path

# ------------ Config ------------
IN_PATH = Path("data/quranic-corpus-morphology-0.4.txt")
OUT_PATH = Path("data/roots-freq.json")

TOP_N = 10

# Distinctiveness filter (tune as you like)
MIN_COUNT_IN_SURA = 3          # avoid 1-off noise
MIN_RATIO = 3.0                # at least 3x more frequent in this sura than elsewhere
ALPHA = 0.5                    # smoothing (Jeffreys-ish). Use 1.0 for Laplace.

# ------------ Parsing helpers ------------
LOC_RE = re.compile(r"^\((\d+):(\d+):(\d+):(\d+)\)$")
ROOT_RE = re.compile(r"(?:^|\|)ROOT:([^|]+)")

def parse_line(line: str):
    """
    Expected columns (tab-separated):
      LOCATION  FORM  TAG  FEATURES
    """
    line = line.strip()
    if not line or line.startswith("#"):
        return None

    # Skip header or malformed lines
    if line.startswith("LOCATION"):
        return None

    parts = line.split("\t")
    if len(parts) < 4:
        return None

    loc = parts[0].strip()
    feats = parts[3].strip()

    mloc = LOC_RE.match(loc)
    if not mloc:
        return None

    sura = int(mloc.group(1))

    mroot = ROOT_RE.search(feats)
    if not mroot:
        return None

    root = mroot.group(1).strip()
    if not root:
        return None

    return sura, root

# ------------ Main computation ------------
def main():
    if not IN_PATH.exists():
        raise FileNotFoundError(f"Input file not found: {IN_PATH}")

    # Count roots per sura and globally
    per_sura = defaultdict(Counter)   # sura -> Counter(root->count)
    global_counts = Counter()

    with IN_PATH.open("r", encoding="utf-8", errors="replace") as f:
        for line in f:
            parsed = parse_line(line)
            if not parsed:
                continue
            sura, root = parsed
            per_sura[sura][root] += 1
            global_counts[root] += 1

    if not per_sura:
        raise RuntimeError("No data parsed. Check file format / delimiter (tabs expected).")

    # Precompute totals
    total_global = sum(global_counts.values())

    # Build output structure
    out = {
        "meta": {
            "input": str(IN_PATH),
            "top_n": TOP_N,
            "distinctive": {
                "min_count_in_sura": MIN_COUNT_IN_SURA,
                "min_ratio": MIN_RATIO,
                "alpha_smoothing": ALPHA,
                "definition": (
                    "ratio = ((c_sura + alpha) / (N_sura + alpha*V)) / "
                    "((c_else + alpha) / (N_else + alpha*V)), where V is root vocabulary size."
                ),
            },
            "root_vocab_size": len(global_counts),
            "total_root_tokens": total_global,
        },
        "suras": {}
    }

    V = len(global_counts)

    # For each sura, compute top roots + distinctive roots
    for sura in sorted(per_sura.keys()):
        c_s = per_sura[sura]
        N_s = sum(c_s.values())

        # counts outside this sura
        # (avoid recomputing full Counter subtraction for speed)
        N_else = total_global - N_s

        # Top N roots (by count)
        top = []
        for root, cnt in c_s.most_common(TOP_N):
            top.append({
                "root": root,
                "count": cnt,
                "rel_in_sura": cnt / N_s if N_s else 0.0,
            })

        # Distinctive roots (high relative frequency vs all other suras)
        distinctive = []
        for root, cnt in c_s.items():
            if cnt < MIN_COUNT_IN_SURA:
                continue

            c_else = global_counts[root] - cnt

            # Smoothed relative frequencies
            p_s = (cnt + ALPHA) / (N_s + ALPHA * V)
            p_e = (c_else + ALPHA) / (N_else + ALPHA * V) if N_else > 0 else 0.0

            # If p_e is 0 due to N_else==0 (only one sura in file), skip
            if p_e <= 0:
                continue

            ratio = p_s / p_e
            if ratio < MIN_RATIO:
                continue

            distinctive.append({
                "root": root,
                "count": cnt,
                "rel_in_sura": cnt / N_s if N_s else 0.0,
                "rel_elsewhere": c_else / N_else if N_else else 0.0,
                "ratio": ratio,
                "log_ratio": math.log(ratio),
            })

        # Sort distinctive roots: strongest first (log_ratio, then count)
        distinctive.sort(key=lambda x: (x["log_ratio"], x["count"]), reverse=True)

        kl_roots = []

        for root, cnt in c_s.items():
            # counts elsewhere
            cnt_else = global_counts[root] - cnt

            # smoothed probabilities
            p = (cnt + ALPHA) / (N_s + ALPHA * V)
            q = (cnt_else + ALPHA) / (N_else + ALPHA * V)

            # KL contribution: p * log(p / q)
            kl = p * math.log(p / q)

            if kl < 0.002: continue
            kl_roots.append({
                "root": root,
                "count": cnt,
                "p_sura": p,
                "p_else": q,
                "kl": kl
            })

        # sort: most informative roots first
        kl_roots.sort(key=lambda x: x["kl"], reverse=True)

        # keep top 10 if desired
        kl_roots = kl_roots[:100]

        n2_N = []
        for root, cnt in c_s.items():
            cnt_all = global_counts[root]
            cnt_else = global_counts[root] - cnt
            p = (cnt + ALPHA) / (N_s + ALPHA * V)
            q = (cnt_all + ALPHA) / (total_global + ALPHA * V)
            m = cnt * p / q
            if m < 10.0: continue
            n2_N.append({
                "root": root,
                "count": cnt,
                "global": global_counts[root],
                "p": p,
                "q": q,
                "m": m
            })
        n2_N.sort(key=lambda x: x["m"], reverse=True)
        n2_N = n2_N[:100]



        out["suras"][str(sura)] = {
            "total_root_tokens": N_s,
            "top_roots": top,
            "distinctive_roots": distinctive,  # keep top 10 distinctive by default
            "high_kl_roots": kl_roots,
            "n2_N_roots": n2_N
        }

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with OUT_PATH.open("w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)

    print(f"Wrote: {OUT_PATH} (suras: {len(per_sura)}, roots: {V}, tokens: {total_global})")

if __name__ == "__main__":
    main()

