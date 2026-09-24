# KakobuyQC

独立新站（目录 `goodsqc/`），品牌 **KakobuyQC**。按 QC 索引站的信息架构做了搜索、分类、Top picks、详情多图和空的 `qc_batches`，数据用你自己的 Excel + 本地种子图，不是搬 GoodsQC。

## 本地预览

```bash
cd "/Users/cusky/Desktop/kakobuy网站/goodsqc"
python3 -m http.server 5180
```

打开 http://localhost:5180

## 重建商品数据

```bash
python3 scripts/build_catalog.py
```

读取 `../kakobuyqcsheets/2026-09-10.xlsx`，扫描 `img/products/{id}.webp` / `-2` / `-3` / `-4`，写出 `js/catalog.js`。

每个商品结构要点：

```json
{
  "id": "7729008416",
  "gallery": ["img/products/….webp", "…-2.webp", "…-3.webp"],
  "qc_batches": []
}
```

`qc_batches` 预留给 Kakobuy 仓检授权后的数据，建议每项：

```json
{
  "photos": ["https://…/1.jpg", "https://…/2.jpg"],
  "weight_g": 420,
  "size_cm": "36*31*7",
  "created_at": "2026-09-01T00:00:00Z"
}
```

## 图片

`img/products`、`logo`、`favicon` 软链到 `../../kakobuyqcsheets/img`。上线前可改成拷贝或独立 CDN。

## 页面

| 文件 | 作用 |
|------|------|
| `index.html` | 首页：品牌 + 搜索 + 分类 + Top picks |
| `shop.html` | 列表：搜索 / 分类 / 排序 / wishlist |
| `item.html` | 详情：种子图 gallery + QC 页签（空 batches） |

## Google 站点地图

`python3 scripts/generate_sitemap.py` 根据 `js/catalog.js` 生成 `sitemap.xml` 和 `robots.txt`。线上站点地图地址：`https://kakobuygoodsqc.com/sitemap.xml`。
