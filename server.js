const { createServer } = require("node:http");
const { createReadStream, promises: fs } = require("node:fs");
const path = require("node:path");

const root = __dirname;
const port = Number(process.env.PORT || 3000);

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
  "/gallery": "/gallery.html"
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

createServer(async (req, res) => {
  const { pathname, search } = splitRequestUrl(req.url || "/");
  if (legacyRoutes[pathname]) {
    res.writeHead(301, { Location: `${legacyRoutes[pathname]}${search}` });
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
