#!/usr/bin/env python3
"""Merge a GoodsQC CSV export into js/catalog.js with Kakobuy aff links ready."""
from __future__ import annotations

import csv
import json
import re
from pathlib import Path
from urllib.parse import quote

ROOT = Path(__file__).resolve().parents[1]
CATALOG = ROOT / "js" / "catalog.js"
AFF = "9v88f"
CNY_TO_USD = 7.2

# Keep home category icons on local white-bg cutouts (don't let CSV imports overwrite with CDN URLs).
CAT_IMAGE_OVERRIDES = {
    "tops": "img/products/7725725581.webp",
    "bottoms": "img/products/7730552342.webp",
    "shoes": "img/products/7728700946.webp",
    "accessories": "img/products/7730242208.webp",
    "jackets": "img/products/7797943764.webp",
    "bags": "img/products/7730179090.webp",
    "watches": "img/products/7728742916.webp",
    "electronics": "img/products/7730271602.webp",
}

CAT_HINTS = [
    (r"\b(iphone|ipad|airpods|earbuds?|earphones?|headphones?|headsets?|playstation|ps5|xbox|power\s*banks?|electronics)\b", "electronics"),
    (
        r"\b(shoes?|sneakers?|boots?|slides?|sandals?|slippers?|trainers?|runners?|dunks?|jordans?|yeezys?|"
        r"air\s*max|air\s*force|af[\s-]?1|aj[1-9]|b30|b22|shox|foam|samba|gazelle|"
        r"running\s*shoes?|casual\s*shoes?|putian|运动鞋|篮球鞋|板鞋|鞋子|拖鞋)\b",
        "shoes",
    ),
    (r"\b(hoodie|sweatshirt|tech fleece)\b", "hoodies"),
    (r"\b(jacket|puffer|coat|outerwear|varsity)\b", "jackets"),
    (r"\b(pants?|shorts?|jeans|bottoms?|sweatpants?)\b", "bottoms"),
    (r"\b(bags?|backpacks?|totes?)\b", "bags"),
    (r"\b(watches?)\b", "watches"),
    (r"\b(underwear|briefs?|boxers?)\b", "underwear"),
    (r"\b(tee|t-shirts?|tshirts?|shirts?|polos?|tops?)\b", "tops"),
    (r"\b(rings?|necklaces?|bracelets?|chains?|jewelry|jewellery|caps?|hats?|socks?|belts?|sunglasses?)\b", "accessories"),
]


def slugify(text: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", str(text or "").lower())
    return re.sub(r"^-+|-+$", "", s)[:60]


def guess_category(title: str) -> str:
    t = (title or "").lower()
    for pat, slug in CAT_HINTS:
        if re.search(pat, t):
            return slug
    # Unknown titles used to default to accessories (dumped shoes/tops there).
    return "other"


def money_usd(cny) -> float | None:
    try:
        v = float(cny)
    except (TypeError, ValueError):
        return None
    if v <= 0:
        return None
    return round(v / CNY_TO_USD, 2)


def kakobuy_url(source_url: str) -> str:
    url = str(source_url or "")
    m = re.search(r"itemID=(\d+)", url, re.I)
    if m:
        return (
            "https://www.kakobuy.com/item/details?url="
            f"https%3A%2F%2Fweidian.com%2Fitem.html%3FitemID%3D{m.group(1)}&affcode={AFF}"
        )
    return f"https://www.kakobuy.com/item/details?url={quote(url, safe='')}&affcode={AFF}"


def load_catalog() -> dict:
    text = CATALOG.read_text(encoding="utf-8")
    m = re.search(r"GQ\.catalog\s*=\s*(\{.*\})\s*;\s*$", text, re.S)
    if not m:
        raise SystemExit("Cannot parse GQ.catalog from catalog.js")
    return json.loads(m.group(1))


def write_catalog(payload: dict) -> None:
    body = (
        "window.GQ=window.GQ||{};\n"
        "GQ.catalog="
        + json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
        + ";\n"
    )
    CATALOG.write_text(body, encoding="utf-8")


def refresh_meta(payload: dict) -> None:
    products = payload["products"]
    cat_defs = [
        ("shoes", "Shoes"),
        ("tops", "Tops"),
        ("hoodies", "Hoodies"),
        ("jackets", "Jackets"),
        ("bottoms", "Bottoms"),
        ("bags", "Bags"),
        ("accessories", "Accessories"),
        ("sets", "Sets"),
        ("jersey", "Jersey"),
        ("watches", "Watches"),
        ("underwear", "Underwear"),
        ("electronics", "Electronics"),
        ("other", "Other"),
    ]
    cat_images = {}
    for p in products:
        img = str(p.get("image") or "")
        # Prefer first local product image per category (skip hotlink CDN URLs).
        if not img.startswith("img/"):
            continue
        cat_images.setdefault(p["category"], img)
    # Fallback: any image if no local one yet
    for p in products:
        cat_images.setdefault(p["category"], p.get("image") or "")
    categories = []
    for slug, label in cat_defs:
        count = sum(1 for p in products if p["category"] == slug)
        if not count:
            continue
        image = CAT_IMAGE_OVERRIDES.get(slug) or cat_images.get(slug) or products[0]["image"]
        categories.append(
            {
                "slug": slug,
                "label": label,
                "count": count,
                "image": image,
            }
        )
    payload["categories"] = categories
    payload["productCount"] = len(products)
    payload["topPickIds"] = [
        p["id"] for p in products if len(p.get("gallery") or []) >= 2
    ][:24]


def import_csv(csv_path: Path, brand: str | None = "Chrome Hearts", source_tag: str | None = None) -> tuple[int, int]:
    payload = load_catalog()
    products = payload["products"]
    by_id = {str(p["id"]): i for i, p in enumerate(products)}
    tag = source_tag or f"goodsqc-{csv_path.stem}"

    added = 0
    updated = 0
    skipped = 0
    with csv_path.open(encoding="utf-8-sig") as f:
        for row in csv.DictReader(f):
            oid = str(row.get("origin_product_id") or "").strip()
            if not oid:
                continue
            title = (row.get("title_en") or row.get("title_cn") or "").strip()
            if not title:
                skipped += 1
                continue
            source = (row.get("origin_url") or "").strip()
            if not source:
                platform = (row.get("platform") or "weidian").lower()
                if platform == "weidian":
                    source = f"https://weidian.com/item.html?itemID={oid}"
                elif platform == "1688":
                    source = f"https://detail.1688.com/offer/{oid}.html"
                else:
                    source = f"https://weidian.com/item.html?itemID={oid}"

            image = (row.get("primary_image") or "").strip()
            if not image:
                skipped += 1
                continue
            gallery = [image]

            price = money_usd(row.get("price_cny"))
            try:
                qc_n = int(float(row.get("qc_num") or 0))
            except (TypeError, ValueError):
                qc_n = 0

            item_brand = (brand if brand is not None else "").strip()
            if not item_brand:
                item_brand = (row.get("shop_name") or "").strip() or title.split(" ")[0]

            item = {
                "id": oid,
                "platform": (row.get("platform") or "weidian").strip().lower() or "weidian",
                "title": title,
                "brand": item_brand,
                "category": guess_category(title),
                "price": price,
                "sourceUrl": source,
                "image": image,
                "gallery": gallery,
                "qc_batches": [],
                "score": float(qc_n),
                "opens": qc_n,
                "slug": f"{slugify(title)}-{oid}" if slugify(title) else oid,
                "kakobuyUrl": kakobuy_url(source),
                "source": tag,
            }

            if oid in by_id:
                # Keep original catalog item; never overwrite Excel / earlier imports.
                skipped += 1
                continue
            by_id[oid] = len(products)
            products.append(item)
            added += 1

    products.sort(key=lambda p: (-(p.get("opens") or 0), -(p.get("score") or 0), p.get("title") or ""))
    payload["products"] = products
    sources = payload.get("generatedFrom") or ""
    name = csv_path.name
    if name not in sources:
        payload["generatedFrom"] = f"{sources}+{name}" if sources else name
    refresh_meta(payload)
    write_catalog(payload)
    print(f"skipped_existing_or_invalid={skipped}")
    return added, 0


def enrich_csv_with_aff(csv_path: Path) -> Path:
    rows = list(csv.DictReader(csv_path.open(encoding="utf-8-sig")))
    if not rows:
        return csv_path.with_name(csv_path.stem + "_with_aff.csv")
    fields = list(rows[0].keys())
    if "kakobuy_url" not in fields:
        fields.append("kakobuy_url")
    out = csv_path.with_name(csv_path.stem + "_with_aff.csv")
    with out.open("w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        for row in rows:
            row["kakobuy_url"] = kakobuy_url(row.get("origin_url") or "")
            w.writerow(row)
    return out


def main() -> None:
    import argparse

    ap = argparse.ArgumentParser()
    ap.add_argument(
        "csv",
        nargs="?",
        default=str(ROOT / "data" / "goodsqc_chrome_hearts.csv"),
    )
    ap.add_argument("--brand", default=None, help="Fixed brand; omit to use shop_name / title")
    ap.add_argument("--source-tag", default=None)
    args = ap.parse_args()
    csv_path = Path(args.csv)
    if not csv_path.exists():
        raise SystemExit(f"Missing {csv_path}")

    aff_csv = enrich_csv_with_aff(csv_path)
    brand = args.brand
    # backwards-compat: chrome hearts file defaults brand if not passed
    if brand is None and "chrome_hearts" in csv_path.name:
        brand = "Chrome Hearts"
    added, updated = import_csv(csv_path, brand=brand, source_tag=args.source_tag)
    payload = load_catalog()
    print(
        f"Imported {csv_path.name}: +{added} new, {updated} updated → "
        f"{payload['productCount']} products in catalog.js"
    )
    print(f"Aff links CSV: {aff_csv.resolve().relative_to(ROOT.resolve())} (affcode={AFF})")


if __name__ == "__main__":
    main()