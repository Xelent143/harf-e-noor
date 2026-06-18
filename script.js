const navToggle = document.querySelector(".nav-toggle");
const mainNav = document.querySelector(".main-nav");

if (navToggle && mainNav) {
  navToggle.setAttribute("aria-expanded", "false");
  navToggle.addEventListener("click", () => {
    mainNav.classList.toggle("open");
    const isOpen = mainNav.classList.contains("open");
    navToggle.textContent = isOpen ? "Close" : "Menu";
    navToggle.setAttribute("aria-expanded", String(isOpen));
  });
}

const filterButtons = document.querySelectorAll("[data-filter]");
const shopGrid = document.querySelector(".shop-products");
const whatsappOrderUrl = "https://wa.me/923156101395";
let lightbox;
let lightboxImage;
let lightboxTitle;
let lightboxCaption;
let lightboxCount;
let lightboxIndex = 0;
let lightboxItems = [];
const escapeHtml = (value = "") =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

async function checkAdminSession() {
  try {
    const response = await fetch("/api/admin/session", { credentials: "same-origin" });
    return response.ok;
  } catch {
    return false;
  }
}

async function injectAdminBar() {
  if (!(await checkAdminSession())) return;
  if (document.querySelector(".admin-session-bar")) return;

  const bar = document.createElement("div");
  bar.className = "admin-session-bar";
  bar.innerHTML = `
    <strong>Admin mode</strong>
    <a href="/manage-catalog">Manage Catalog</a>
    <button type="button">Logout</button>
  `;
  bar.querySelector("button").addEventListener("click", async () => {
    await fetch("/api/admin/logout", { method: "POST", credentials: "same-origin" }).catch(() => {});
    window.location.href = "/admin";
  });
  document.body.prepend(bar);
}

function priceLabel(product) {
  const price = String(product.price || "").trim();
  if (!price || price.toLowerCase() === "inquire") return "Ask for price";
  return price;
}

function productInquiryUrl(product) {
  const message = `Assalam o Alaikum, I want details for ${product.title || "this artwork"}.`;
  return `${whatsappOrderUrl}?text=${encodeURIComponent(message)}`;
}

function applyProductFilter(filter) {
  document.querySelectorAll(".shop-products .product-card").forEach((product) => {
    const tags = product.dataset.tags || "";
    const visible = filter === "all" || tags.includes(filter);
    product.style.display = visible ? "" : "none";
  });
}

filterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const filter = button.dataset.filter;
    filterButtons.forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    applyProductFilter(filter);
  });
});

function registerArtworkPreview(element, item) {
  const trigger = element.closest("figure") || element;
  trigger.classList.add("artwork-preview-trigger");
  trigger.classList.add("lightbox-trigger");
  trigger.setAttribute("role", "button");
  trigger.setAttribute("tabindex", "0");
  trigger.setAttribute("aria-label", `${item.title} artwork preview`);
  trigger.dataset.artworkSrc = item.src;
  trigger.dataset.artworkTitle = item.title;
  trigger.dataset.artworkCaption = item.caption || "";
}

function buildLightboxItems(scopeSelector = ".artwork-preview-trigger[data-artwork-src]") {
  lightboxItems = Array.from(document.querySelectorAll(scopeSelector))
    .map((trigger) => ({
      trigger,
      src: trigger.dataset.artworkSrc,
      title: trigger.dataset.artworkTitle || "Artwork preview",
      caption: trigger.dataset.artworkCaption || ""
    }))
    .filter((item) => item.src);
}

function ensureLegacyLightbox() {
  if (lightbox) return;

  lightbox = document.createElement("section");
  lightbox.className = "art-lightbox";
  lightbox.setAttribute("aria-modal", "true");
  lightbox.setAttribute("role", "dialog");
  lightbox.setAttribute("aria-label", "Artwork gallery preview");
  lightbox.innerHTML = `
    <div class="art-lightbox__bar">
      <div>
        <p class="art-lightbox__count"></p>
        <h2 class="art-lightbox__title"></h2>
      </div>
      <button class="art-lightbox__close" type="button">Close</button>
    </div>
    <div class="art-lightbox__stage">
      <button class="art-lightbox__arrow art-lightbox__prev" type="button" aria-label="Previous artwork">‹</button>
      <figure class="art-lightbox__frame">
        <img class="art-lightbox__image" src="" alt="">
      </figure>
      <button class="art-lightbox__arrow art-lightbox__next" type="button" aria-label="Next artwork">›</button>
    </div>
    <p class="art-lightbox__caption"></p>
    <div class="art-lightbox__tools">
      <a href="${whatsappOrderUrl}" target="_blank" rel="noopener">Ask on WhatsApp</a>
    </div>
  `;
  document.body.appendChild(lightbox);

  lightboxImage = lightbox.querySelector(".art-lightbox__image");
  lightboxTitle = lightbox.querySelector(".art-lightbox__title");
  lightboxCaption = lightbox.querySelector(".art-lightbox__caption");
  lightboxCount = lightbox.querySelector(".art-lightbox__count");

  lightbox.querySelector(".art-lightbox__close").addEventListener("click", closeLightbox);
  lightbox.querySelector(".art-lightbox__prev").addEventListener("click", () => showLightboxItem(lightboxIndex - 1));
  lightbox.querySelector(".art-lightbox__next").addEventListener("click", () => showLightboxItem(lightboxIndex + 1));
  lightbox.addEventListener("click", (event) => {
    if (event.target === lightbox) closeLightbox();
  });
}

function ensureLightbox() {
  if (lightbox) return;

  lightbox = document.createElement("section");
  lightbox.className = "art-lightbox";
  lightbox.setAttribute("aria-modal", "true");
  lightbox.setAttribute("role", "dialog");
  lightbox.setAttribute("aria-label", "Artwork easel preview");
  lightbox.innerHTML = `
    <div class="art-lightbox__bar">
      <div>
        <p class="art-lightbox__count"></p>
        <h2 class="art-lightbox__title"></h2>
      </div>
      <button class="art-lightbox__close" type="button">Close</button>
    </div>
    <div class="art-lightbox__stage">
      <button class="art-lightbox__arrow art-lightbox__prev" type="button" aria-label="Previous artwork">&lsaquo;</button>
      <figure class="art-lightbox__easel">
        <span class="easel-spotlight" aria-hidden="true"></span>
        <span class="easel-back-leg" aria-hidden="true"></span>
        <span class="easel-leg easel-leg-left" aria-hidden="true"></span>
        <span class="easel-leg easel-leg-right" aria-hidden="true"></span>
        <span class="easel-spine" aria-hidden="true"></span>
        <span class="easel-top" aria-hidden="true"></span>
        <span class="easel-shelf" aria-hidden="true"></span>
        <img class="art-lightbox__image" src="" alt="">
        <span class="easel-floor-shadow" aria-hidden="true"></span>
      </figure>
      <button class="art-lightbox__arrow art-lightbox__next" type="button" aria-label="Next artwork">&rsaquo;</button>
    </div>
    <p class="art-lightbox__caption"></p>
    <div class="art-lightbox__tools">
      <a href="${whatsappOrderUrl}" target="_blank" rel="noopener">Ask on WhatsApp</a>
    </div>
  `;
  document.body.appendChild(lightbox);

  lightboxImage = lightbox.querySelector(".art-lightbox__image");
  lightboxTitle = lightbox.querySelector(".art-lightbox__title");
  lightboxCaption = lightbox.querySelector(".art-lightbox__caption");
  lightboxCount = lightbox.querySelector(".art-lightbox__count");

  lightbox.querySelector(".art-lightbox__close").addEventListener("click", closeLightbox);
  lightbox.querySelector(".art-lightbox__prev").addEventListener("click", () => showLightboxItem(lightboxIndex - 1));
  lightbox.querySelector(".art-lightbox__next").addEventListener("click", () => showLightboxItem(lightboxIndex + 1));
  lightbox.addEventListener("click", (event) => {
    if (event.target === lightbox) closeLightbox();
  });
}

function showLightboxItem(index) {
  if (!lightboxItems.length) return;
  lightboxIndex = (index + lightboxItems.length) % lightboxItems.length;
  const item = lightboxItems[lightboxIndex];
  lightboxImage.src = item.src;
  lightboxImage.alt = item.title;
  lightboxTitle.textContent = item.title;
  lightboxCaption.textContent = item.caption;
  lightboxCount.textContent = `${String(lightboxIndex + 1).padStart(2, "0")} / ${String(lightboxItems.length).padStart(2, "0")}`;
}

function openLightbox(trigger) {
  ensureLightbox();
  const scopeSelector = trigger.closest(".shop-products")
    ? ".shop-products .artwork-preview-trigger[data-artwork-src]"
    : ".artwork-preview-trigger[data-artwork-src]";
  buildLightboxItems(scopeSelector);
  const nextIndex = lightboxItems.findIndex((item) => item.trigger === trigger);
  showLightboxItem(nextIndex >= 0 ? nextIndex : 0);
  document.body.classList.add("lightbox-open");
  lightbox.classList.add("open");
  lightbox.querySelector(".art-lightbox__close").focus({ preventScroll: true });
}

function closeLightbox() {
  if (!lightbox) return;
  lightbox.classList.remove("open");
  document.body.classList.remove("lightbox-open");
  lightboxItems[lightboxIndex]?.trigger?.focus({ preventScroll: true });
}

document.addEventListener("pointerover", (event) => {
  const preview = event.target.closest(".listed-artwork-photo");
  if (!preview) return;
  preview.closest(".shop-products")?.classList.add("is-previewing");
  preview.classList.add("is-detail-preview");
});

document.addEventListener("pointerout", (event) => {
  const preview = event.target.closest(".listed-artwork-photo");
  if (!preview || preview.contains(event.relatedTarget)) return;
  preview.classList.remove("is-detail-preview");
  preview.closest(".shop-products")?.classList.remove("is-previewing");
});

document.addEventListener("click", (event) => {
  if (event.target.closest("a")) return;
  const trigger = event.target.closest(".artwork-preview-trigger");
  if (!trigger) return;
  event.preventDefault();
  openLightbox(trigger);
});

document.addEventListener("keydown", (event) => {
  const trigger = event.target.closest?.(".artwork-preview-trigger");
  if (trigger && (event.key === "Enter" || event.key === " ")) {
    event.preventDefault();
    openLightbox(trigger);
    return;
  }

  if (!lightbox?.classList.contains("open")) return;
  if (event.key === "Escape") closeLightbox();
  if (event.key === "ArrowLeft") showLightboxItem(lightboxIndex - 1);
  if (event.key === "ArrowRight") showLightboxItem(lightboxIndex + 1);
});

function productTags(product) {
  const text = `${product.title || ""} ${product.desc || ""}`.toLowerCase();
  const tags = new Set((product.tags || "").split(/\s+/).filter(Boolean));
  if (/name|personalized|fatima|aisha|ayeza|rehan|jaza|areeba|muhammad/.test(text)) tags.add("name");
  if (/dua|allah|qadr|sabr|shukr|tawakkul|kaaba|calligraphy|invocation|prayer/.test(text)) tags.add("spiritual");
  if (/gift|birthday|wedding|friendship|father|mother|keepsake|memory|enough|blessing/.test(text)) tags.add("gift");
  if (/mini|small/.test(text)) tags.add("mini");
  return Array.from(tags).join(" ");
}

function productMedium(product) {
  const text = `${product.title || ""} ${product.desc || ""}`.toLowerCase();
  if (/paper|cotton|deckled/.test(text)) return "Ink and paint on paper";
  if (/gold/.test(text)) return "Acrylic and gold detail on canvas";
  if (/black and gold|gold calligraphy/.test(text)) return "Gold-accent hand-painted canvas";
  return "Hand-painted acrylic on canvas";
}

function productFormat(product) {
  const text = `${product.title || ""} ${product.desc || ""}`.toLowerCase();
  if (/mini|small/.test(text)) return "Mini canvas";
  if (/pair|duo|set|panel/.test(text)) return "Canvas set";
  if (/horizontal|wide/.test(text)) return "Horizontal canvas";
  return "Original canvas";
}

function bindStaticGalleryImages() {
  document.querySelectorAll(`
    .hero-photo img,
    .hero-detail-card img,
    .gallery-mood-board img,
    .interior-story img,
    .material-story img,
    .shop-editorial-hero img,
    .shop-material-strip img
  `).forEach((image) => {
    registerArtworkPreview(image, {
      src: image.currentSrc || image.src,
      title: image.alt || "Artwork image",
      caption: image.alt || ""
    });
  });
}

function bindProductGallery(products) {
  document.querySelectorAll(".shop-products .listed-artwork-photo img").forEach((image, index) => {
    const product = products[index];
    registerArtworkPreview(image, {
      src: product?.image || image.src,
      title: product?.title || image.alt || "Artwork image",
      caption: product?.desc || image.alt || ""
    });
  });
}

async function loadProductCatalog() {
  if (!shopGrid) return;

  try {
    const response = await fetch("/api/products");
    if (!response.ok) return;
    const products = await response.json();

    shopGrid.innerHTML = products.map((product) => `
      <article class="product-card listed-artwork-card ${product.status === "sold" ? "is-sold" : ""}" data-tags="${escapeHtml(productTags(product))}">
        <figure class="art-mini listed-artwork-photo artwork-preview-trigger" aria-label="${escapeHtml(product.title)} artwork preview" data-artwork-src="${escapeHtml(product.image)}" data-artwork-title="${escapeHtml(product.title)}" data-artwork-caption="${escapeHtml(product.desc)}">
          <img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.title)} handmade calligraphy artwork" width="900" height="1125" loading="lazy">
          <span>Private viewing</span>
        </figure>
        ${product.badge || product.status === "sold" ? `<p class="badge">${escapeHtml(product.status === "sold" ? "Sold" : product.badge)}</p>` : ""}
        <h3>${escapeHtml(product.title)}</h3>
        ${product.desc ? `<p>${escapeHtml(product.desc)}</p>` : ""}
        <div class="product-meta">
          <span>${escapeHtml(priceLabel(product))}</span>
          <a class="artwork-inquiry-link" href="${escapeHtml(productInquiryUrl(product))}" target="_blank" rel="noopener">Ask</a>
        </div>
      </article>
    `).join("");

    const activeFilter = document.querySelector("[data-filter].active")?.dataset.filter || "all";
    applyProductFilter(activeFilter);
    bindProductGallery(products);
  } catch {
    applyProductFilter("all");
  }
}

bindStaticGalleryImages();
injectAdminBar();
loadProductCatalog();
