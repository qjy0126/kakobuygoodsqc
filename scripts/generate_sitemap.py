import json
from pathlib import Path
from urllib.parse import quote
from xml.etree.ElementTree import Element, SubElement, register_namespace, tostring


ROOT = Path(__file__).resolve().parents[1]
BASE_URL = "https://kakobuygoodsqc.com"
XML_NS = "http://www.sitemaps.org/schemas/sitemap/0.9"
register_namespace("", XML_NS)


def main():
    catalog_source = (ROOT / "js" / "catalog.js").read_text(encoding="utf-8")
    payload = catalog_source.split("GQ.catalog=", 1)[1].rsplit(";", 1)[0]
    catalog = json.loads(payload)

    urls = [
        f"{BASE_URL}/",
        f"{BASE_URL}/shop.html",
        f"{BASE_URL}/privacy.html",
        f"{BASE_URL}/disclaimer.html",
    ]
    urls.extend(
        f"{BASE_URL}/shop.html?cat={quote(category['slug'], safe='')}"
        for category in catalog.get("categories", [])
    )
    seen_ids = set()
    for product in catalog.get("products", []):
        product_id = str(product.get("id", ""))
        if not product_id or product_id in seen_ids:
            continue
        seen_ids.add(product_id)
        urls.append(f"{BASE_URL}/item.html?id={quote(product_id, safe='')}")

    urlset = Element(f"{{{XML_NS}}}urlset")
    for url in urls:
        entry = SubElement(urlset, f"{{{XML_NS}}}url")
        SubElement(entry, f"{{{XML_NS}}}loc").text = url

    xml = tostring(urlset, encoding="utf-8", xml_declaration=True)
    (ROOT / "sitemap.xml").write_bytes(xml + b"\n")

    (ROOT / "robots.txt").write_text(
        "User-agent: *\n"
        "Allow: /\n"
        f"Sitemap: {BASE_URL}/sitemap.xml\n",
        encoding="utf-8",
    )

    print(f"Generated sitemap.xml with {len(urls)} URLs ({len(seen_ids)} product pages).")


if __name__ == "__main__":
    main()
