# Harf-e-Noor Admin Handover

## Admin URL

Open:

```text
/admin
```

Local testing URL:

```text
http://localhost:3000/admin
```

After login, the admin is sent to the normal website. A top admin bar appears with:

```text
Manage Catalog
```

Product management URL:

```text
/manage-catalog
```

If port `3000` is busy, run with another port:

```powershell
$env:PORT="3100"; $env:ADMIN_PASSWORD="your-strong-password"; npm start
```

## Login

Default username:

```text
admin
```

Set the password before client handover:

```powershell
$env:ADMIN_PASSWORD="your-strong-password"
```

For deployment, add this environment variable in the hosting dashboard:

```text
ADMIN_PASSWORD=your-strong-password
```

Optional custom username:

```text
ADMIN_USER=admin
```

## What Admin Can Manage

- Add products
- Edit product title, slug, description, badge, tags, image, price, and status
- Upload product images
- Delete products
- Leave price blank so the shop shows `Ask for price`
- Mark products as `Active`, `Sold`, or `Hidden`
- Change the admin password from the admin panel

## Product Status

- `Active`: visible on the shop page
- `Sold`: visible on the shop page with sold styling
- `Hidden`: only visible inside admin panel

## Data Files

Products are saved in:

```text
assets/products/products.json
```

Uploaded images are saved in:

```text
assets/products/uploads/
```

If the admin changes the password from the panel, the hashed password settings are saved in:

```text
data/admin-settings.json
```

## Important Before Final Handover

Change the default admin password. The fallback password is only for local testing and should not be used for the client website.
