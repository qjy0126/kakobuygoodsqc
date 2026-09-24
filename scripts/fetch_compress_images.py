#!/usr/bin/env python3
"""Download remote images for GoodsQC-imported products, compress to WebP, update catalog."""
from __future__ import annotations

import concurrent.futures
import io
import json
import re
import time
import urllib.request
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
CATALOG = ROOT / "js" / "catalog.js"
PRODUCTS_DIR = ROOT.parent / "kakobuyqcsheets" / "img" / "products"
SOURCES = {"goodsqc-chrome-hearts", "goodsqc-top-picks"}
MAX_SIDE = 900
WEBP_QUALITY = 72
WORKERS = 10


def load_catalog() -> dict:
    text = CATALOG.read_text(encoding="utf-8")
    m = re.search(r"GQ\.catalog\s*=\s*(.*);\s*$", text, re.S)
    if not m:
        raise SystemExit("Cannot parse catalog.js")
    return json.loads(m.group(1))


def write_catalog(payload: dict) -> None:
    body = (
        "window.GQ=window.GQ||{};\n"
        "GQ.catalog="
        + json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
        + ";\n"
    )
    CATALOG.write_text(body, encoding="utf-8")


def fetch_bytes(url: str, retries: int = 3) -> bytes:
    last = None
    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        "Referer": "https://www.goodsqc.com/",
    }
    for i in range(retries):
        try:
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=40) as r:
                return r.read()
        except Exception as e:
            last = e
            time.sleep(0.5 * (i + 1))
    raise last  # type: ignore[misc]


def compress_to_webp(raw: bytes, dest: Path) -> int:
    im = Image.open(io.BytesIO(raw))
    im = im.convert("RGB")
    w, h = im.size
    scale = min(1.0, MAX_SIDE / max(w, h))
    if scale < 1.0:
        im = im.resize((max(1, int(w * scale)), max(1, int(h * scale))), Image.Resampling.LANCZOS)
    dest.parent.mkdir(parents=True, exist_ok=True)
    im.save(dest, "WEBP", quality=WEBP_QUALITY, method=6)
    return dest.stat().st_size


def process_one(item: dict) -> tuple[str, str, str | None]:
    """Returns (id, status, error)."""
    oid = str(item["id"])
    dest = PRODUCTS_DIR / f"{oid}.webp"
    if dest.exists() and dest.stat().st_size > 500:
        return oid, "exists", None

    urls = []
    for u in [item.get("image"), *(item.get("gallery") or [])]:
        u = str(u or "").strip()
        if u.startswith("http") and u not in urls:
            urls.append(u)
    if not urls:
        return oid, "no-url", "missing remote url"

    last_err = None
    for url in urls:
        try:
            raw = fetch_bytes(url)
            if len(raw) < 200:
                continue
            compress_to_webp(raw, dest)
            # optional extra angles as -2 -3 if gallery has more
            extras = [u for u in urls[1:4]]
            for i, eu in enumerate(extras, start=2):
                try:
                    eraw = fetch_bytes(eu)
                    compress_to_webp(eraw, PRODUCTS_DIR / f"{oid}-{i}.webp")
                except Exception:
                    pass
            return oid, "ok", None
        except Exception as e:
            last_err = str(e)
    return oid, "fail", last_err


def main() -> None:
    PRODUCTS_DIR.mkdir(parents=True, exist_ok=True)
    payload = load_catalog()
    targets = [p for p in payload["products"] if p.get("source") in SOURCES]
    print(f"targets={len(targets)} dir={PRODUCTS_DIR}")

    ok = exists = fail = 0
    errors: list[tuple[str, str]] = []

    with concurrent.futures.ThreadPoolExecutor(max_workers=WORKERS) as ex:
        futs = [ex.submit(process_one, p) for p in targets]
        done = 0
        for fut in concurrent.futures.as_completed(futs):
            oid, status, err = fut.result()
            done += 1
            if status == "ok":
                ok += 1
            elif status == "exists":
                exists += 1
            else:
                fail += 1
                if err:
                    errors.append((oid, err))
            if done % 50 == 0 or done == len(targets):
                print(f"progress {done}/{len(targets)} ok={ok} exists={exists} fail={fail}")

    # point catalog at local paths
    updated = 0
    for p in payload["products"]:
        if p.get("source") not in SOURCES:
            continue
        oid = str(p["id"])
        main = PRODUCTS_DIR / f"{oid}.webp"
        if not main.exists():
            continue
        gallery = [f"img/products/{oid}.webp"]
        for n in (2, 3, 4):
            alt = PRODUCTS_DIR / f"{oid}-{n}.webp"
            if alt.exists():
                gallery.append(f"img/products/{oid}-{n}.webp")
        p["image"] = gallery[0]
        p["gallery"] = gallery
        updated += 1

    write_catalog(payload)
    print(f"catalog local images updated={updated}")
    print(f"done ok={ok} exists={exists} fail={fail}")
    if errors[:10]:
        print("sample errors:")
        for oid, err in errors[:10]:
            print(f"  {oid}: {err[:120]}")


if __name__ == "__main__":
    main()
