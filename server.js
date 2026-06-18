const { createServer } = require("node:http");
const { createReadStream, promises: fs } = require("node:fs");
const crypto = require("node:crypto");
const path = require("node:path");

const root = __dirname;
const port = Number(process.env.PORT || 3000);
const productsFile = path.join(root, "assets", "products", "products.json");
const uploadDir = path.join(root, "assets", "products", "uploads");
const settingsDir = path.join(root, "data");
const settingsFile = path.join(settingsDir, "admin-settings.json");
const sessionCookie = "harf_admin_session";
const sessionTtlMs = 1000 * 60 * 60 * 12;
const sessions = new Map();

const adminUser = process.env.ADMIN_USER || "admin";
const adminPassword = process.env.ADMIN_PASSWORD || "ChangeMe123!";
const isProduction = process.env.NODE_ENV === "production";

if (!process.env.ADMIN_PASSWORD) {
  console.warn("ADMIN_PASSWORD is not set. Temporary admin password is ChangeMe123! - change it before handover.");
}

const types = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml; charset=utf-8",
  ".ico": "image/x-icon"
};

const pageRoutes = {
  "/": "/index.html",
  "/shop": "/shop.html",
  "/custom": "/custom.html",
  "/process": "/process.html",
  "/about": "/about.html",
  "/contact": "/contact.html",
  "/gallery": "/gallery.html",
  "/admin": "/admin.html",
  "/manage-catalog": "/manage-catalog.html"
};

const legacyRoutes = {
  "/index.html": "/",
  "/shop.html": "/shop",
  "/custom.html": "/custom",
  "/process.html": "/process",
  "/about.html": "/about",
  "/contact.html": "/contact",
  "/gallery.html": "/gallery"
};

function splitRequestUrl(url) {
  const parsed = new URL(url || "/", "http://localhost");
  return {
    pathname: decodeURIComponent(parsed.pathname),
    search: parsed.search
  };
}

function resolveRequest(urlPath) {
  const cleanPath = decodeURIComponent(urlPath);
  const normalized = pageRoutes[cleanPath] || cleanPath;
  const filePath = path.normalize(path.join(root, normalized));
  if (!filePath.startsWith(root)) return null;
  return filePath;
}

function sendJson(res, status, payload) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(payload));
}

function parseCookies(req) {
  return Object.fromEntries(
    String(req.headers.cookie || "")
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const index = part.indexOf("=");
        return index === -1 ? [part, ""] : [part.slice(0, index), decodeURIComponent(part.slice(index + 1))];
      })
  );
}

function cleanupSessions() {
  const now = Date.now();
  for (const [token, session] of sessions.entries()) {
    if (session.expiresAt <= now) sessions.delete(token);
  }
}

function getSession(req) {
  cleanupSessions();
  const token = parseCookies(req)[sessionCookie];
  if (!token) return null;
  const session = sessions.get(token);
  if (!session || session.expiresAt <= Date.now()) {
    sessions.delete(token);
    return null;
  }
  return { token, ...session };
}

function requireAdmin(req, res) {
  if (getSession(req)) return true;
  sendJson(res, 401, { error: "Please login again." });
  return false;
}

function readBody(req, limit = 8 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error("Request body is too large."));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

async function readJsonBody(req) {
  const body = await readBody(req);
  if (!body) return {};
  return JSON.parse(body);
}

async function readProducts(includeHidden = false) {
  const content = await fs.readFile(productsFile, "utf8");
  const products = JSON.parse(content);
  return includeHidden ? products : products.filter((product) => product.status !== "hidden");
}

async function writeProducts(products) {
  await fs.writeFile(productsFile, `${JSON.stringify(products, null, 2)}\n`, "utf8");
}

function slugify(value) {
  return String(value || "artwork")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "artwork";
}

function uniqueSlug(base, products, currentSlug) {
  const cleanBase = slugify(base);
  let slug = cleanBase;
  let count = 2;
  while (products.some((product) => product.slug === slug && product.slug !== currentSlug)) {
    slug = `${cleanBase}-${count}`;
    count += 1;
  }
  return slug;
}

function sanitizeProduct(input, products, currentSlug) {
  const title = String(input.title || "").trim();
  if (!title) throw new Error("Product title is required.");

  const status = ["active", "sold", "hidden"].includes(input.status) ? input.status : "active";
  const nextSlug = uniqueSlug(input.slug || title, products, currentSlug);
  return {
    slug: nextSlug,
    title,
    image: String(input.image || "").trim(),
    desc: String(input.desc || "").trim(),
    tags: String(input.tags || "").trim(),
    badge: String(input.badge || "").trim(),
    price: String(input.price || "").trim(),
    status
  };
}

async function saveUploadedImage(upload) {
  if (!upload || !upload.data || !upload.name) return "";

  const match = String(upload.data).match(/^data:(image\/(?:png|jpe?g|webp));base64,(.+)$/i);
  if (!match) throw new Error("Only PNG, JPG, JPEG, and WebP images are allowed.");

  const extByType = {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/webp": ".webp"
  };
  const ext = extByType[match[1].toLowerCase()];
  const safeName = slugify(path.basename(upload.name, path.extname(upload.name)));
  const fileName = `${Date.now()}-${safeName}${ext}`;
  const buffer = Buffer.from(match[2], "base64");
  if (buffer.length > 6 * 1024 * 1024) throw new Error("Image is too large. Please upload an image under 6MB.");

  await fs.mkdir(uploadDir, { recursive: true });
  await fs.writeFile(path.join(uploadDir, fileName), buffer);
  return `assets/products/uploads/${fileName}`;
}

function constantTimeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.pbkdf2Sync(String(password), salt, 120000, 64, "sha512").toString("hex");
  return { salt, hash };
}

async function readAdminSettings() {
  try {
    return JSON.parse(await fs.readFile(settingsFile, "utf8"));
  } catch {
    return {};
  }
}

async function writeAdminSettings(settings) {
  await fs.mkdir(settingsDir, { recursive: true });
  await fs.writeFile(settingsFile, `${JSON.stringify(settings, null, 2)}\n`, "utf8");
}

async function verifyAdminPassword(password) {
  const settings = await readAdminSettings();
  if (settings.passwordHash && settings.passwordSalt) {
    const next = hashPassword(password, settings.passwordSalt);
    return constantTimeEqual(next.hash, settings.passwordHash);
  }
  return constantTimeEqual(password || "", adminPassword);
}

async function updateAdminPassword(nextPassword) {
  const cleanPassword = String(nextPassword || "");
  if (cleanPassword.length < 8) throw new Error("New password must be at least 8 characters.");
  const next = hashPassword(cleanPassword);
  await writeAdminSettings({
    passwordSalt: next.salt,
    passwordHash: next.hash,
    updatedAt: new Date().toISOString()
  });
}

async function handleApi(req, res, pathname) {
  try {
    if (pathname === "/api/admin/login" && req.method === "POST") {
      const body = await readJsonBody(req);
      const usernameOk = constantTimeEqual(body.username || "", adminUser);
      const passwordOk = await verifyAdminPassword(body.password || "");
      if (!usernameOk || !passwordOk) {
        sendJson(res, 401, { error: "Invalid username or password." });
        return true;
      }

      const token = crypto.randomBytes(32).toString("hex");
      sessions.set(token, { username: adminUser, expiresAt: Date.now() + sessionTtlMs });
      res.writeHead(200, {
        "Content-Type": "application/json; charset=utf-8",
        "Set-Cookie": `${sessionCookie}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(sessionTtlMs / 1000)}${isProduction ? "; Secure" : ""}`,
        "Cache-Control": "no-store"
      });
      res.end(JSON.stringify({ ok: true, username: adminUser }));
      return true;
    }

    if (pathname === "/api/admin/password" && req.method === "POST") {
      if (!requireAdmin(req, res)) return true;
      const body = await readJsonBody(req);
      const currentOk = await verifyAdminPassword(body.currentPassword || "");
      if (!currentOk) {
        sendJson(res, 401, { error: "Current password is not correct." });
        return true;
      }
      if (String(body.newPassword || "") !== String(body.confirmPassword || "")) {
        sendJson(res, 400, { error: "New password and confirmation do not match." });
        return true;
      }
      await updateAdminPassword(body.newPassword);
      sendJson(res, 200, { ok: true });
      return true;
    }

    if (pathname === "/api/admin/logout" && req.method === "POST") {
      const session = getSession(req);
      if (session) sessions.delete(session.token);
      res.writeHead(200, {
        "Content-Type": "application/json; charset=utf-8",
        "Set-Cookie": `${sessionCookie}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${isProduction ? "; Secure" : ""}`,
        "Cache-Control": "no-store"
      });
      res.end(JSON.stringify({ ok: true }));
      return true;
    }

    if (pathname === "/api/admin/session" && req.method === "GET") {
      const session = getSession(req);
      sendJson(res, session ? 200 : 401, session ? { ok: true, username: session.username } : { error: "Not logged in." });
      return true;
    }

    if (pathname === "/api/products" && req.method === "GET") {
      const includeHidden = new URL(req.url || "/", "http://localhost").searchParams.get("admin") === "1";
      if (includeHidden && !requireAdmin(req, res)) return true;
      const products = await readProducts(includeHidden);
      sendJson(res, 200, products);
      return true;
    }

    if (pathname === "/api/products" && req.method === "POST") {
      if (!requireAdmin(req, res)) return true;
      const body = await readJsonBody(req);
      const products = await readProducts(true);
      const image = await saveUploadedImage(body.upload);
      const product = sanitizeProduct({ ...body, image: image || body.image }, products);
      products.unshift(product);
      await writeProducts(products);
      sendJson(res, 201, product);
      return true;
    }

    const productMatch = pathname.match(/^\/api\/products\/([^/]+)$/);
    if (productMatch && req.method === "PUT") {
      if (!requireAdmin(req, res)) return true;
      const slug = decodeURIComponent(productMatch[1]);
      const body = await readJsonBody(req);
      const products = await readProducts(true);
      const index = products.findIndex((product) => product.slug === slug);
      if (index === -1) {
        sendJson(res, 404, { error: "Product was not found." });
        return true;
      }
      const image = await saveUploadedImage(body.upload);
      products[index] = sanitizeProduct({ ...products[index], ...body, image: image || body.image || products[index].image }, products, slug);
      await writeProducts(products);
      sendJson(res, 200, products[index]);
      return true;
    }

    if (productMatch && req.method === "DELETE") {
      if (!requireAdmin(req, res)) return true;
      const slug = decodeURIComponent(productMatch[1]);
      const products = await readProducts(true);
      const nextProducts = products.filter((product) => product.slug !== slug);
      if (nextProducts.length === products.length) {
        sendJson(res, 404, { error: "Product was not found." });
        return true;
      }
      await writeProducts(nextProducts);
      sendJson(res, 200, { ok: true });
      return true;
    }
  } catch (error) {
    sendJson(res, 400, { error: error.message || "Something went wrong." });
    return true;
  }

  return false;
}

createServer(async (req, res) => {
  const { pathname, search } = splitRequestUrl(req.url || "/");

  if (pathname.startsWith("/api/")) {
    const handled = await handleApi(req, res, pathname);
    if (!handled) sendJson(res, 404, { error: "API route not found." });
    return;
  }

  if (legacyRoutes[pathname]) {
    res.writeHead(301, { Location: `${legacyRoutes[pathname]}${search}` });
    res.end();
    return;
  }

  if (pathname === "/manage-catalog" && !getSession(req)) {
    res.writeHead(302, { Location: "/admin" });
    res.end();
    return;
  }

  const filePath = resolveRequest(pathname);
  if (!filePath) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  try {
    const stat = await fs.stat(filePath);
    const finalPath = stat.isDirectory() ? path.join(filePath, "index.html") : filePath;
    const ext = path.extname(finalPath).toLowerCase();
    const shouldRevalidate = ext === ".html" || ext === ".css" || ext === ".js";
    res.writeHead(200, {
      "Content-Type": types[ext] || "application/octet-stream",
      "Cache-Control": shouldRevalidate ? "no-cache" : "public, max-age=31536000, immutable"
    });
    createReadStream(finalPath).pipe(res);
  } catch {
    res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
    createReadStream(path.join(root, "index.html")).pipe(res);
  }
}).listen(port, "0.0.0.0", () => {
  console.log(`Harf-e-Noor running on ${port}`);
});
