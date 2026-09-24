(() => {
  const GQ = (window.GQ = window.GQ || {});
  const catalog = GQ.catalog || { products: [], categories: [], trending: [], topPickIds: [] };
  const AFF = "9v88f";
  const PAGE_SIZE = 48;
  const WISH_KEY = "kakoqc_wishlist";

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const escapeHtml = (s) =>
    String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  const money = (n) => (n == null || Number.isNaN(Number(n)) ? "—" : `$${Number(n).toFixed(2)}`);
  const byId = new Map((catalog.products || []).map((p) => [String(p.id), p]));

  function kakobuyUrl(sourceUrl) {
    const url = String(sourceUrl || "");
    const wd = url.match(/itemID=(\d+)/i);
    if (wd) {
      return `https://www.kakobuy.com/item/details?url=https%3A%2F%2Fweidian.com%2Fitem.html%3FitemID%3D${wd[1]}&affcode=${AFF}`;
    }
    return `https://www.kakobuy.com/item/details?url=${encodeURIComponent(url)}&affcode=${AFF}`;
  }

  function wishList() {
    try {
      return JSON.parse(localStorage.getItem(WISH_KEY) || "[]");
    } catch {
      return [];
    }
  }

  const REVIEW_KEY = "kakoqc_reviews";

  function reviewsByProduct(productId) {
    try {
      const all = JSON.parse(localStorage.getItem(REVIEW_KEY) || "{}");
      return Array.isArray(all[String(productId)]) ? all[String(productId)] : [];
    } catch {
      return [];
    }
  }

  function saveReview(productId, review) {
    let all = {};
    try {
      all = JSON.parse(localStorage.getItem(REVIEW_KEY) || "{}");
    } catch {
      all = {};
    }
    const key = String(productId);
    const list = Array.isArray(all[key]) ? all[key] : [];
    list.unshift(review);
    all[key] = list;
    localStorage.setItem(REVIEW_KEY, JSON.stringify(all));
    return list;
  }

  function setWish(ids) {
    localStorage.setItem(WISH_KEY, JSON.stringify([...new Set(ids.map(String))]));
    syncWishCount();
  }

  function toggleWish(id) {
    const ids = wishList();
    const key = String(id);
    const next = ids.includes(key) ? ids.filter((x) => x !== key) : ids.concat(key);
    setWish(next);
    return next.includes(key);
  }

  function syncWishCount() {
    $$("[data-wish-count]").forEach((el) => {
      el.textContent = String(wishList().length);
    });
  }

  function seedCount(p) {
    return (p.gallery || []).length;
  }

  function warehouseCount(p) {
    return (p.qc_batches || []).length;
  }

  function shopHref(params = {}) {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v == null || v === "" || v === false) return;
      q.set(k, String(v));
    });
    const s = q.toString();
    return s ? `shop.html?${s}` : "shop.html";
  }

  function itemHref(p) {
    return `item.html?id=${encodeURIComponent(p.id)}`;
  }

  function productCard(p, opts = {}) {
    const seeds = seedCount(p);
    const batches = warehouseCount(p);
    const badge =
      batches > 0
        ? `<span class="badge">QC ${batches}</span>`
        : seeds > 1
          ? `<span class="badge badge-seed">${seeds} photos</span>`
          : "";
    const railClass = opts.rail ? " is-rail" : "";
    return `<a class="product-card${railClass}" href="${itemHref(p)}">
      <div class="thumb">
        <img src="${escapeHtml(p.image)}" alt="${escapeHtml(p.title)}" loading="lazy" decoding="async" />
        <div class="badge-row">${badge}</div>
      </div>
      <div class="product-meta">
        <h3>${escapeHtml(p.title)}</h3>
        <div class="price">${money(p.price)}</div>
        <div class="sub">${escapeHtml(p.brand || p.platform)} · ${escapeHtml(p.category)}</div>
      </div>
    </a>`;
  }

  function bindRail(rail) {
    const track = rail.querySelector(".rail-track");
    const prev = rail.querySelector(".rail-prev");
    const next = rail.querySelector(".rail-next");
    if (!track || !prev || !next) return;

    const step = () => Math.max(track.clientWidth * 0.85, 240);

    const sync = () => {
      const max = track.scrollWidth - track.clientWidth - 4;
      prev.classList.toggle("is-hidden", track.scrollLeft <= 4);
      next.classList.toggle("is-hidden", track.scrollLeft >= max);
    };

    prev.addEventListener("click", () => track.scrollBy({ left: -step(), behavior: "smooth" }));
    next.addEventListener("click", () => track.scrollBy({ left: step(), behavior: "smooth" }));
    track.addEventListener("scroll", sync, { passive: true });
    window.addEventListener("resize", sync);
    sync();
  }

  function railSection({ title, subtitle = "", href, items, slug = "" }) {
    if (!items.length) return "";
    const id = slug ? `section-${slug}` : `rail-${Math.random().toString(36).slice(2, 8)}`;
    return `<section class="section" id="${id}">
      <div class="wrap">
        <div class="section-head">
          <div>
            <h2>${escapeHtml(title)}</h2>
            ${subtitle ? `<p>${escapeHtml(subtitle)}</p>` : ""}
          </div>
          <a class="view-all" href="${href}">VIEW ALL <span class="arrow">→</span></a>
        </div>
        <div class="rail" data-rail="${id}">
          <button class="rail-btn rail-prev" type="button" aria-label="Previous">‹</button>
          <div class="rail-track">${items.map((p) => productCard(p, { rail: true })).join("")}</div>
          <button class="rail-btn rail-next" type="button" aria-label="Next">›</button>
        </div>
      </div>
    </section>`;
  }

  function renderHeader(active = "") {
    const host = $("#site-header");
    if (!host) return;
    const menu = (catalog.categories || [])
      .map((c) => `<a href="${shopHref({ cat: c.slug })}">${escapeHtml(c.label)}</a>`)
      .join("");
    host.innerHTML = `<div class="wrap header-row">
      <a class="brand" href="index.html" aria-label="Kakobuy Spreadsheet">
        <img class="brand-mark" src="img/logo.png" alt="" width="28" height="36" />
        <span class="brand-text">
          <span class="brand-title"><span class="c-kako">Kakobuy</span> <span class="c-sheet">Spreadsheet</span></span>
          <span class="brand-url"><span class="c-ink">www.</span><span class="c-kako">kakobuy</span><span class="c-goods">goods</span><span class="c-qc">qc</span><span class="c-ink">.com</span></span>
        </span>
      </a>
      <div class="cat-menu">
        <button class="nav-link cat-menu-btn" type="button" aria-expanded="false">Category ▾</button>
        <div class="cat-menu-panel" hidden>
          <a href="shop.html">All finds</a>
          ${menu}
        </div>
      </div>
      <div class="header-actions">
        <a class="btn btn-ghost kakobuy-login" href="https://item.kakobuy.com/item/details?url=https%3A%2F%2Fweidian.com%2Fitem.html%3FitemID%3D7729008416&amp;affcode=9v88f" target="_blank" rel="noopener sponsored">Kakobuy Login</a>
        <button class="btn btn-install" id="pwa-install" type="button">Add to desktop</button>
      </div>
    </div>`;
    syncWishCount();
    bindPwaInstall();

    const btn = host.querySelector(".cat-menu-btn");
    const panel = host.querySelector(".cat-menu-panel");
    if (btn && panel) {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const open = panel.hasAttribute("hidden");
        if (open) panel.removeAttribute("hidden");
        else panel.setAttribute("hidden", "");
        btn.setAttribute("aria-expanded", open ? "true" : "false");
      });
      document.addEventListener("click", () => {
        panel.setAttribute("hidden", "");
        btn.setAttribute("aria-expanded", "false");
      });
      panel.addEventListener("click", (e) => e.stopPropagation());
    }
  }

  let deferredInstallPrompt = null;
  let installGuide;

  function bindPwaInstall() {
    const button = $("#pwa-install");
    if (!button || button.dataset.bound) return;
    button.dataset.bound = "1";
    const isInstalled = () => window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
    const refresh = () => { button.hidden = isInstalled(); };
    refresh();
    window.addEventListener("appinstalled", refresh);
    window.addEventListener("beforeinstallprompt", (event) => {
      event.preventDefault();
      deferredInstallPrompt = event;
      refresh();
    });
    button.addEventListener("click", async () => {
      if (deferredInstallPrompt) {
        deferredInstallPrompt.prompt();
        await deferredInstallPrompt.userChoice.catch(() => null);
        deferredInstallPrompt = null;
        refresh();
      } else {
        showInstallGuide();
      }
    });
  }

  function showInstallGuide() {
    if (!installGuide) {
      installGuide = document.createElement("dialog");
      installGuide.className = "install-guide";
      installGuide.innerHTML = `<div class="install-guide-head"><strong>Add KakobuyQC to your device</strong><button type="button" aria-label="Close">×</button></div><p class="install-guide-copy"></p>`;
      installGuide.querySelector("button").addEventListener("click", () => installGuide.close());
      installGuide.addEventListener("click", (event) => { if (event.target === installGuide) installGuide.close(); });
      document.body.appendChild(installGuide);
    }
    const copy = installGuide.querySelector(".install-guide-copy");
    const ua = navigator.userAgent;
    if (/iphone|ipad|ipod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)) {
      copy.textContent = "In Safari, tap Share, then choose Add to Home Screen.";
    } else if (/android/i.test(ua)) {
      copy.textContent = "Open your browser menu and choose Install app or Add to Home screen.";
    } else {
      copy.textContent = "In Chrome or Edge, use the install icon in the address bar. In Safari, choose File → Add to Dock.";
    }
    installGuide.showModal();
  }

  function renderFooter() {
    const host = $("#site-footer");
    if (!host) return;
    host.innerHTML = `<div class="wrap footer-grid">
      <div>
        <h3>KakobuyQC</h3>
        <p>QC photos, videos, and spreadsheet finder for CNFans, Oopbuy, ACBuy, Kakobuy, and more. Explore QC content from Taobao, Weidian, and 1688 — then buy on Kakobuy.</p>
      </div>
      <div>
        <h3>Browse</h3>
        <p><a href="shop.html">All finds</a></p>
        <p><a href="shop.html?sort=picks">Top picks</a></p>
      </div>
      <div>
        <h3>Note</h3>
        <p>Warehouse <code>qc_batches</code> stays empty until Kakobuy authorizes a QC feed. Seed gallery photos are reference angles only.</p>
      </div>
      <div>
        <h3>Legal</h3>
        <p><a href="privacy.html">Privacy policy</a></p>
        <p><a href="disclaimer.html">Disclaimer</a></p>
      </div>
    </div>`;
  }

  function homeCategories() {
    const preferred = ["tops", "bottoms", "shoes", "accessories", "jackets", "bags", "watches", "electronics"];
    const bySlug = new Map((catalog.categories || []).map((c) => [c.slug, c]));
    const picked = preferred.map((s) => bySlug.get(s)).filter(Boolean);
    if (picked.length >= 6) return picked.slice(0, 8);
    return (catalog.categories || []).slice(0, 8);
  }

  function filterProducts({ q = "", cat = "", wish = false, sort = "popular" } = {}) {
    let list = catalog.products.slice();
    const query = String(q || "").trim().toLowerCase();
    if (wish) {
      const ids = new Set(wishList());
      list = list.filter((p) => ids.has(String(p.id)));
    }
    if (cat) list = list.filter((p) => p.category === cat);
    if (query) {
      list = list.filter((p) => {
        const hay = `${p.title} ${p.brand} ${p.id} ${p.category}`.toLowerCase();
        return hay.includes(query);
      });
    }
    if (sort === "price-asc") list.sort((a, b) => (a.price || 0) - (b.price || 0));
    else if (sort === "price-desc") list.sort((a, b) => (b.price || 0) - (a.price || 0));
    else if (sort === "picks") {
      const rank = new Map((catalog.topPickIds || []).map((id, i) => [String(id), i]));
      list.sort((a, b) => (rank.get(String(a.id)) ?? 9999) - (rank.get(String(b.id)) ?? 9999));
    } else list.sort((a, b) => {
      const aHasBadge = warehouseCount(a) > 0 || seedCount(a) > 1;
      const bHasBadge = warehouseCount(b) > 0 || seedCount(b) > 1;
      return Number(bHasBadge) - Number(aHasBadge) ||
        (b.opens || 0) - (a.opens || 0) ||
        (b.score || 0) - (a.score || 0);
    });
    return list;
  }

  function renderHome() {
    renderHeader("home");
    renderFooter();

    const form = $("#hero-search");
    if (form) {
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        const q = $("#hero-q")?.value || "";
        location.href = shopHref({ q });
      });
    }

    const cats = $("#cat-row");
    if (cats) {
      cats.innerHTML = homeCategories()
        .map(
          (c) => `<a class="cat-icon" href="shop.html?cat=${encodeURIComponent(c.slug)}" data-cat="${escapeHtml(c.slug)}">
            <span class="orb"><img src="${escapeHtml(c.image)}" alt="" loading="lazy" /></span>
            <span>${escapeHtml(c.label)}</span>
          </a>`
        )
        .join("");

      // Click → go to category page (reliable relative URL)
      cats.addEventListener("click", (e) => {
        const a = e.target.closest("a.cat-icon");
        if (!a) return;
        e.preventDefault();
        const slug = a.getAttribute("data-cat");
        if (slug) location.assign(`shop.html?cat=${encodeURIComponent(slug)}`);
      });
    }

    const picks = $("#top-picks");
    if (picks) {
      const items = (catalog.topPickIds || []).map((id) => byId.get(String(id))).filter(Boolean).slice(0, 18);
      picks.innerHTML = items.map((p) => productCard(p, { rail: true })).join("");
    }

    const rails = $("#home-rails");
    if (rails) {
      const order = homeCategories();
      rails.innerHTML = order
        .map((c) => {
          const items = filterProducts({ cat: c.slug, sort: "popular" }).slice(0, 18);
          return railSection({
            title: c.label,
            slug: c.slug,
            href: shopHref({ cat: c.slug }),
            items,
          });
        })
        .join("");
    }

    $$(".rail").forEach(bindRail);
  }

  function renderShop() {
    renderHeader("shop");
    renderFooter();
    const params = new URLSearchParams(location.search);
    const state = {
      q: params.get("q") || "",
      cat: params.get("cat") || "",
      sort: params.get("sort") || "popular",
      wish: params.get("wish") === "1",
      page: Math.max(1, Number(params.get("page") || 1) || 1),
    };

    const qInput = $("#shop-q");
    const catSelect = $("#shop-cat");
    const sortSelect = $("#shop-sort");
    if (qInput) qInput.value = state.q;
    if (catSelect) {
      catSelect.innerHTML =
        `<option value="">All categories</option>` +
        (catalog.categories || [])
          .map(
            (c) =>
              `<option value="${escapeHtml(c.slug)}" ${c.slug === state.cat ? "selected" : ""}>${escapeHtml(c.label)}</option>`
          )
          .join("");
    }
    if (sortSelect) sortSelect.value = state.sort;

    const apply = () => {
      location.href = shopHref({
        q: qInput?.value || "",
        cat: catSelect?.value || "",
        sort: sortSelect?.value || "popular",
        wish: state.wish ? "1" : "",
        page: "1",
      });
    };
    $("#shop-go")?.addEventListener("click", apply);
    qInput?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") apply();
    });
    catSelect?.addEventListener("change", apply);
    sortSelect?.addEventListener("change", apply);

    const list = filterProducts(state);
    const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
    const page = Math.min(state.page, pages);
    const slice = list.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    document.title = state.cat
      ? `${catalog.categories.find((c) => c.slug === state.cat)?.label || "Browse"} — KakobuyQC`
      : state.wish
        ? "Wishlist — KakobuyQC"
        : "Browse — KakobuyQC";

    const title = $("#shop-title");
    if (title) {
      title.textContent = state.wish
        ? "Wishlist"
        : state.cat
          ? catalog.categories.find((c) => c.slug === state.cat)?.label || "Browse"
          : state.q
            ? `Search: ${state.q}`
            : "Browse finds";
    }
    const sub = $("#shop-sub");
    if (sub) sub.textContent = `${list.length} items · seed photos ready · warehouse qc_batches pending`;

    const chipsHost = $("#shop-chips");
    if (chipsHost) {
      chipsHost.innerHTML =
        `<a class="shop-chip ${!state.cat && !state.wish ? "is-on" : ""}" href="shop.html">All</a>` +
        (catalog.categories || [])
          .map(
            (c) =>
              `<a class="shop-chip ${state.cat === c.slug ? "is-on" : ""}" href="${shopHref({ cat: c.slug, sort: state.sort })}">${escapeHtml(c.label)}</a>`
          )
          .join("");
    }

    const grid = $("#shop-grid");
    if (grid) {
      grid.innerHTML = slice.length
        ? slice.map(productCard).join("")
        : `<div class="empty-state">No finds match. Try another search or category.</div>`;
    }

    const pager = $("#pager");
    if (pager && pages > 1) {
      const link = (p, label, disabled = false) =>
        disabled
          ? `<span class="btn btn-ghost" aria-disabled="true">${label}</span>`
          : `<a class="btn btn-ghost" href="${shopHref({ ...state, wish: state.wish ? "1" : "", page: p })}">${label}</a>`;
      pager.innerHTML =
        link(page - 1, "Prev", page <= 1) +
        `<span class="nav-link">Page ${page} / ${pages}</span>` +
        link(page + 1, "Next", page >= pages);
    }
  }

  function renderItem() {
    renderHeader("shop");
    renderFooter();
    const id = new URLSearchParams(location.search).get("id");
    const item = byId.get(String(id || ""));
    const root = $("#item-root");
    if (!root) return;
    if (!item) {
      root.innerHTML = `<div class="empty-state">Product not found. <a href="shop.html">Back to browse</a></div>`;
      return;
    }

    const gallery = item.gallery?.length ? item.gallery : [item.image];
    const batches = item.qc_batches || [];
    const batchPhotos = batches.flatMap((b, bi) => {
      const photos = b.photos?.length ? b.photos : b.cover ? [b.cover] : [];
      return photos.map((src, pi) => {
        const bits = [];
        if (b.weight_g != null) bits.push(`weight(g): ${b.weight_g}`);
        if (b.size_cm) bits.push(`size(cm): ${b.size_cm}`);
        return {
          src,
          label: bits.join(" · ") || `QC batch ${bi + 1}${photos.length > 1 ? ` · ${pi + 1}` : ""}`,
        };
      });
    });
    const qcPhotos = batchPhotos.length
      ? batchPhotos
      : gallery.map((src, i) => ({ src, label: i === 0 ? "main" : `angle ${i + 1}` }));
    const qcCount = qcPhotos.length;
    const wished = wishList().includes(String(item.id));
    const cny = item.price != null && !Number.isNaN(Number(item.price))
      ? `¥${(Number(item.price) * 7.2).toFixed(2)}`
      : "";
    const rating = item.score != null ? Number(item.score).toFixed(1) : "0.0";
    const opens = item.opens != null ? Number(item.opens).toLocaleString("en-US") : null;
    const platform = String(item.platform || "source").toLowerCase();

    const reviews = reviewsByProduct(item.id);
    const reviewCount = reviews.length;

    const related = (() => {
      const exclude = String(item.id);
      const sameCat = filterProducts({ cat: item.category, sort: "popular" }).filter((p) => String(p.id) !== exclude);
      const need = 18;
      if (sameCat.length >= need) return sameCat.slice(0, need);
      const seen = new Set(sameCat.map((p) => String(p.id)));
      const filler = filterProducts({ sort: "popular" }).filter((p) => {
        const id = String(p.id);
        if (id === exclude || seen.has(id)) return false;
        seen.add(id);
        return true;
      });
      return sameCat.concat(filler).slice(0, need);
    })();
    const catLabel =
      (catalog.categories || []).find((c) => c.slug === item.category)?.label || item.category || "finds";

    document.title = `${item.title} — KakobuyQC`;

    root.innerHTML = `
      <a class="item-back" href="shop.html">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>
        Back
      </a>
      <div class="item-layout">
        <div class="item-gallery">
          <div class="gallery-main"><img id="main-photo" src="${escapeHtml(gallery[0])}" alt="${escapeHtml(item.title)}" /></div>
          <div class="gallery-thumbs" id="thumbs">
            ${gallery
              .map(
                (src, i) => `<button type="button" data-i="${i}" class="${i === 0 ? "is-active" : ""}" aria-label="Photo ${i + 1}">
                  <img src="${escapeHtml(src)}" alt="" loading="lazy" />
                </button>`
              )
              .join("")}
          </div>
          <div class="item-media-tabs" role="tablist">
            <button class="media-tab is-active" type="button" role="tab" aria-selected="true" data-tab="qc">QC (${qcCount})</button>
            <button class="media-tab" type="button" role="tab" aria-selected="false" data-tab="reviews" id="reviews-tab">Reviews (${reviewCount})</button>
          </div>
        </div>
        <div class="item-panel">
          <h1>${escapeHtml(item.title)}</h1>
          <div class="item-meta-row">
            ${opens != null ? `<span class="meta-chip" title="Opens"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M13 2L4 14h7l-1 8 10-14h-7l0-6z"/></svg>${opens}</span>` : ""}
            <span class="meta-chip" title="Score"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 17.3l-6.2 3.7 1.6-7.1L2 9.2l7.2-.6L12 2l2.8 6.6 7.2.6-5.4 4.7 1.6 7.1z"/></svg>${rating}</span>
            <span class="meta-chip">${escapeHtml(item.brand || "—")} · ${escapeHtml(platform)}</span>
          </div>
          <div class="item-price-row">
            <span class="item-price">${money(item.price)}</span>
            ${cny ? `<span class="item-price-cny">${cny}</span>` : ""}
          </div>
          <a class="btn-buy-now" href="${kakobuyUrl(item.sourceUrl)}" target="_blank" rel="noopener">
            <span class="buy-mark" aria-hidden="true">K</span>
            <span>Buy Now</span>
          </a>
          <button class="btn btn-ghost item-wish" type="button" id="wish-btn">${wished ? "In wishlist" : "Add to wishlist"}</button>
        </div>
      </div>

      <section class="item-below is-active" id="panel-qc" data-panel="qc">
        ${
          qcPhotos.length
            ? `<div class="qc-photo-grid">${qcPhotos
                .map(
                  (p) => `<figure class="qc-photo">
                    <img src="${escapeHtml(p.src)}" alt="" loading="lazy" />
                    <figcaption>${escapeHtml(p.label)}</figcaption>
                  </figure>`
                )
                .join("")}</div>`
            : `<div class="qc-empty"><strong>No QC photos yet</strong>Warehouse QC will appear here when the feed is authorized.</div>`
        }
      </section>
      <section class="item-below" id="panel-reviews" data-panel="reviews" hidden>
        <div class="reviews-view" id="reviews-list-view">
          <div class="reviews-toolbar">
            <div class="reviews-filters">
              <button class="review-filter is-active" type="button" data-filter="all">ALL (${reviewCount})</button>
              <button class="review-filter" type="button" data-filter="likes">Maximum number of likes (0)</button>
              <button class="review-filter" type="button" data-filter="media">Photos / Videos (0)</button>
            </div>
            <button class="btn-write-review" type="button" id="write-review-btn">Write a Review</button>
          </div>
          <div id="reviews-body">
            ${
              reviewCount
                ? `<div class="review-list">${reviews
                    .map(
                      (r) => `<article class="review-card">
                        <div class="review-card-top">
                          <span class="review-stars" aria-label="${Number(r.rating).toFixed(1)} stars">${"★".repeat(Math.round(r.rating))}${"☆".repeat(5 - Math.round(r.rating))}</span>
                          <span class="review-score">${Number(r.rating).toFixed(1)}</span>
                          <time>${escapeHtml(r.date || "")}</time>
                        </div>
                        <p>${escapeHtml(r.text)}</p>
                      </article>`
                    )
                    .join("")}</div>`
                : `<div class="reviews-empty">
                    <svg class="reviews-empty-icon" viewBox="0 0 80 80" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true">
                      <circle cx="40" cy="42" r="18"/>
                      <ellipse cx="40" cy="42" rx="28" ry="8"/>
                      <circle cx="34" cy="38" r="2" fill="currentColor" stroke="none"/>
                      <circle cx="46" cy="46" r="1.5" fill="currentColor" stroke="none"/>
                      <path d="M40 18v8M40 18l4-3M40 18l-3-4"/>
                      <path d="M52 22l6-2 1 6"/>
                    </svg>
                    <strong>No data yet</strong>
                    <p>Be the first to review this product</p>
                  </div>`
            }
          </div>
        </div>
        <div class="reviews-view" id="reviews-form-view" hidden>
          <div class="review-form-head">
            <button class="review-form-back" type="button" id="review-form-back" aria-label="Back">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>
            </button>
            <h2>Write a Review</h2>
          </div>
          <form class="review-form" id="review-form">
            <label class="review-label">Rating</label>
            <div class="review-rating-row">
              <div class="star-picker" id="star-picker" role="radiogroup" aria-label="Rating">
                ${[1, 2, 3, 4, 5]
                  .map(
                    (n) => `<button type="button" class="star-btn" data-star="${n}" aria-label="${n} star${n > 1 ? "s" : ""}">
                      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 17.3l-6.2 3.7 1.6-7.1L2 9.2l7.2-.6L12 2l2.8 6.6 7.2.6-5.4 4.7 1.6 7.1z"/></svg>
                    </button>`
                  )
                  .join("")}
              </div>
              <span class="star-value" id="star-value">0.0</span>
            </div>
            <div class="review-compose">
              <textarea id="review-text" name="text" rows="6" placeholder="Please provide your genuine feedback" required></textarea>
            </div>
            <button class="btn-review-submit" type="submit">Submit</button>
          </form>
        </div>
      </section>

      ${
        related.length
          ? `<section class="item-related" aria-label="More products">
              <div class="section-head">
                <div>
                  <h2>More ${escapeHtml(catLabel)}</h2>
                  <p>Other finds you might like</p>
                </div>
                <a class="view-all" href="${shopHref({ cat: item.category })}">VIEW ALL <span class="arrow">→</span></a>
              </div>
              <div class="rail" data-rail="item-related">
                <button class="rail-btn rail-prev" type="button" aria-label="Previous">‹</button>
                <div class="rail-track">${related.map((p) => productCard(p, { rail: true })).join("")}</div>
                <button class="rail-btn rail-next" type="button" aria-label="Next">›</button>
              </div>
            </section>`
          : ""
      }
    `;

    const main = $("#main-photo");
    $$("#thumbs button").forEach((btn) => {
      btn.addEventListener("click", () => {
        const i = Number(btn.dataset.i);
        main.src = gallery[i];
        $$("#thumbs button").forEach((b) => b.classList.toggle("is-active", b === btn));
      });
    });

    $("#wish-btn")?.addEventListener("click", () => {
      const on = toggleWish(item.id);
      $("#wish-btn").textContent = on ? "In wishlist" : "Add to wishlist";
    });

    $$(".rail").forEach(bindRail);

    $$(".media-tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        $$(".media-tab").forEach((t) => {
          const on = t === tab;
          t.classList.toggle("is-active", on);
          t.setAttribute("aria-selected", on ? "true" : "false");
        });
        $$(".item-below").forEach((p) => {
          const on = p.dataset.panel === tab.dataset.tab;
          p.classList.toggle("is-active", on);
          p.hidden = !on;
        });
        if (tab.dataset.tab === "reviews") {
          $("#reviews-list-view").hidden = false;
          $("#reviews-form-view").hidden = true;
        }
      });
    });

    const listView = $("#reviews-list-view");
    const formView = $("#reviews-form-view");
    let pendingRating = 0;

    const showReviewForm = () => {
      listView.hidden = true;
      formView.hidden = false;
      pendingRating = 0;
      $("#star-value").textContent = "0.0";
      $$(".star-btn").forEach((b) => b.classList.remove("is-on"));
      $("#review-text").value = "";
    };

    const showReviewList = () => {
      formView.hidden = true;
      listView.hidden = false;
    };

    $("#write-review-btn")?.addEventListener("click", showReviewForm);
    $("#review-form-back")?.addEventListener("click", showReviewList);

    $$(".star-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        pendingRating = Number(btn.dataset.star);
        $("#star-value").textContent = pendingRating.toFixed(1);
        $$(".star-btn").forEach((b) => b.classList.toggle("is-on", Number(b.dataset.star) <= pendingRating));
      });
    });

    $("#review-form")?.addEventListener("submit", (e) => {
      e.preventDefault();
      const text = String($("#review-text").value || "").trim();
      if (!text) return;
      if (!pendingRating) {
        pendingRating = 5;
        $("#star-value").textContent = "5.0";
        $$(".star-btn").forEach((b) => b.classList.add("is-on"));
      }
      saveReview(item.id, {
        rating: pendingRating,
        text,
        date: new Date().toISOString().slice(0, 10),
        likes: 0,
      });
      renderItem();
      $("#reviews-tab")?.click();
    });

    $$(".review-filter").forEach((btn) => {
      btn.addEventListener("click", () => {
        $$(".review-filter").forEach((b) => b.classList.toggle("is-active", b === btn));
      });
    });
  }

  GQ.api = { byId, filterProducts, kakobuyUrl, toggleWish, wishList };

  document.addEventListener("DOMContentLoaded", () => {
    const page = document.body.dataset.page;
    if (page === "home") renderHome();
    else if (page === "shop") renderShop();
    else if (page === "item") renderItem();
    else {
      renderHeader();
      renderFooter();
    }
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
  });
})();
