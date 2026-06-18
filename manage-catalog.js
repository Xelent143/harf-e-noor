const productForm = document.querySelector("[data-product-form]");
const productList = document.querySelector("[data-product-list]");
const productMessage = document.querySelector("[data-product-message]");
const editorTitle = document.querySelector("[data-editor-title]");
const deleteButton = document.querySelector("[data-delete-product]");
const searchInput = document.querySelector("[data-search]");
const previewCard = document.querySelector("[data-preview-card]");
const previewImage = document.querySelector("[data-preview-image]");
const previewCaption = document.querySelector("[data-preview-caption]");
const passwordPanel = document.querySelector("[data-password-panel]");
const passwordForm = document.querySelector("[data-password-form]");
const passwordMessage = document.querySelector("[data-password-message]");

let products = [];
let selectedSlug = "";

async function api(path, options = {}) {
  const response = await fetch(path, {
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Request failed.");
  return data;
}

function priceLabel(product) {
  return product.price ? product.price : "Ask for price";
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function renderProducts() {
  const query = searchInput.value.trim().toLowerCase();
  const visibleProducts = products.filter((product) => {
    const text = `${product.title || ""} ${product.desc || ""} ${product.tags || ""}`.toLowerCase();
    return !query || text.includes(query);
  });

  productList.innerHTML = visibleProducts.map((product) => `
    <article class="product-item ${product.slug === selectedSlug ? "is-selected" : ""}" data-slug="${escapeHtml(product.slug)}" tabindex="0">
      <img src="${escapeHtml(product.image || "assets/product-collection-optimized.webp")}" alt="">
      <div>
        <h3>${escapeHtml(product.title)}</h3>
        <p>${escapeHtml(priceLabel(product))}</p>
      </div>
      <span class="status-pill ${escapeHtml(product.status || "active")}">${escapeHtml(product.status || "active")}</span>
    </article>
  `).join("");
}

function resetForm() {
  selectedSlug = "";
  productForm.reset();
  productForm.elements.originalSlug.value = "";
  editorTitle.textContent = "Add product";
  deleteButton.hidden = true;
  productMessage.textContent = "";
  updatePreview();
  renderProducts();
}

function selectProduct(slug) {
  const product = products.find((item) => item.slug === slug);
  if (!product) return;

  selectedSlug = slug;
  productForm.elements.originalSlug.value = product.slug || "";
  productForm.elements.title.value = product.title || "";
  productForm.elements.slug.value = product.slug || "";
  productForm.elements.desc.value = product.desc || "";
  productForm.elements.badge.value = product.badge || "";
  productForm.elements.status.value = product.status || "active";
  productForm.elements.price.value = product.price || "";
  productForm.elements.tags.value = product.tags || "";
  productForm.elements.image.value = product.image || "";
  productForm.elements.upload.value = "";
  editorTitle.textContent = "Edit product";
  deleteButton.hidden = false;
  productMessage.textContent = "";
  updatePreview();
  renderProducts();
}

async function loadProducts() {
  products = await api("/api/products?admin=1");
  renderProducts();
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Could not read image file."));
    reader.readAsDataURL(file);
  });
}

function formPayload() {
  return {
    title: productForm.elements.title.value,
    slug: productForm.elements.slug.value,
    desc: productForm.elements.desc.value,
    badge: productForm.elements.badge.value,
    status: productForm.elements.status.value,
    price: productForm.elements.price.value,
    tags: productForm.elements.tags.value,
    image: productForm.elements.image.value
  };
}

async function buildPayloadWithUpload() {
  const payload = formPayload();
  const file = productForm.elements.upload.files[0];
  if (file) {
    payload.upload = {
      name: file.name,
      data: await fileToDataUrl(file)
    };
  }
  return payload;
}

function updatePreview() {
  const file = productForm.elements.upload.files[0];
  const imagePath = productForm.elements.image.value.trim();
  const title = productForm.elements.title.value.trim() || "Product preview";
  const desc = productForm.elements.desc.value.trim();

  if (file) {
    previewImage.src = URL.createObjectURL(file);
  } else if (imagePath) {
    previewImage.src = imagePath;
  } else {
    previewCard.hidden = true;
    return;
  }

  previewImage.alt = title;
  previewCaption.textContent = desc || title;
  previewCard.hidden = false;
}

productForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  productMessage.textContent = "Saving...";
  try {
    const payload = await buildPayloadWithUpload();
    const originalSlug = productForm.elements.originalSlug.value;
    const saved = originalSlug
      ? await api(`/api/products/${encodeURIComponent(originalSlug)}`, { method: "PUT", body: JSON.stringify(payload) })
      : await api("/api/products", { method: "POST", body: JSON.stringify(payload) });

    await loadProducts();
    selectProduct(saved.slug);
    productMessage.textContent = "Product saved.";
  } catch (error) {
    productMessage.textContent = error.message;
  }
});

productList.addEventListener("click", (event) => {
  const item = event.target.closest("[data-slug]");
  if (item) selectProduct(item.dataset.slug);
});

productList.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") return;
  const item = event.target.closest("[data-slug]");
  if (!item) return;
  event.preventDefault();
  selectProduct(item.dataset.slug);
});

deleteButton.addEventListener("click", async () => {
  const slug = productForm.elements.originalSlug.value;
  if (!slug) return;
  const product = products.find((item) => item.slug === slug);
  const confirmed = window.confirm(`Delete "${product?.title || slug}" from the shop?`);
  if (!confirmed) return;

  productMessage.textContent = "Deleting...";
  try {
    await api(`/api/products/${encodeURIComponent(slug)}`, { method: "DELETE" });
    await loadProducts();
    resetForm();
    productMessage.textContent = "Product deleted.";
  } catch (error) {
    productMessage.textContent = error.message;
  }
});

document.querySelector("[data-new-product]")?.addEventListener("click", resetForm);
document.querySelector("[data-reset-form]").addEventListener("click", resetForm);
document.querySelector("[data-password-toggle]").addEventListener("click", () => {
  passwordPanel.hidden = !passwordPanel.hidden;
  passwordMessage.textContent = "";
  if (!passwordPanel.hidden) passwordForm.elements.currentPassword.focus();
});
document.querySelector("[data-password-close]").addEventListener("click", () => {
  passwordPanel.hidden = true;
  passwordForm.reset();
  passwordMessage.textContent = "";
});
document.querySelector("[data-logout]")?.addEventListener("click", async () => {
  await api("/api/admin/logout", { method: "POST" }).catch(() => {});
  window.location.href = "/admin";
});

passwordForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  passwordMessage.textContent = "Updating password...";
  try {
    await api("/api/admin/password", {
      method: "POST",
      body: JSON.stringify({
        currentPassword: passwordForm.elements.currentPassword.value,
        newPassword: passwordForm.elements.newPassword.value,
        confirmPassword: passwordForm.elements.confirmPassword.value
      })
    });
    passwordForm.reset();
    passwordMessage.textContent = "Password updated.";
  } catch (error) {
    passwordMessage.textContent = error.message;
  }
});

searchInput.addEventListener("input", renderProducts);
["title", "desc", "image"].forEach((name) => {
  productForm.elements[name].addEventListener("input", updatePreview);
});
productForm.elements.upload.addEventListener("change", updatePreview);

api("/api/admin/session")
  .then(async () => {
    await loadProducts();
    resetForm();
  })
  .catch(() => {
    window.location.href = "/admin";
  });
