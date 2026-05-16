# Usage Guide / Panduan Penggunaan

Real-world examples of what to ask your AI agent (Claude Desktop, Kiro, Cursor)
once `@mangerik/wordpress-mcp` is connected. Mix freely between Indonesian and
English — the LLM understands both.

> **Tip:** the agent doesn't need to know which tool to call. Just describe
> the outcome; it will pick the right tool(s) automatically.

---

## 📝 Content authoring

### Draft a single post
> Buatkan draft post tentang **"Tips memilih hosting WordPress untuk pemula"**
> dengan tone informal, panjang ~800 kata, masuk kategori "Blog" dan tag
> "hosting", "wordpress", "tutorial". Status draft saja, jangan publish.

> Draft a 600-word post titled "Why your team should adopt MCP", tone =
> opinionated, status = draft, assign to category id 4.

### Bulk drafts from a topic list
> Saya kasih 5 judul, buatkan draftnya semua sekaligus pakai batch:
> 1. Cara menulis meta description yang efektif
> 2. Perbedaan focus keyword dan meta keyword
> 3. SEO on-page vs off-page
> 4. Audit konten lama
> 5. Strategi internal linking
>
> Masing-masing ~500 kata, status draft, kategori "SEO".

### Republish an old draft
> Cari semua post dengan status `draft` yang dibuat sebelum 2024-01-01,
> tampilkan judulnya, lalu tunggu konfirmasi saya sebelum publish.

### Translate a page
> Page dengan id 142 isinya bahasa Inggris. Translate ke bahasa Indonesia,
> lalu **buat page baru** (jangan replace), status draft, parent-nya page
> 140. Pertahankan struktur HTML dan shortcode-nya.

---

## 🔍 Audit & cleanup

### Find broken / orphan content
> Cek ada berapa post yang status-nya `pending` selama lebih dari 30 hari.
> Tampilkan id, title, dan author-nya dalam tabel.

### Featured image audit
> Cari semua post yang **belum punya featured image**, batasi 50 post
> terbaru. Output: id, judul, slug.

### Comment moderation
> Tampilkan 20 komentar terbaru yang status-nya `hold`. Tandai yang isinya
> spam (kata kunci: "buy now", "click here", URL berlebihan), lalu update
> status mereka jadi `spam`.

---

## 🛒 WooCommerce

### Inventory check
> List semua produk WooCommerce dengan stok < 5. Format: SKU, nama, stok
> sekarang. Urut dari yang paling sedikit.

### Bulk price update
> Naikkan harga semua produk di kategori "Aksesoris" sebesar 10%. Pakai
> batch endpoint biar cepat.

### Daily sales summary
> Beri saya laporan penjualan minggu ini: total order, total revenue,
> top 5 produk terlaris. Pakai bahasa Indonesia.

### Refund a single order
> Order #1532 perlu di-refund full karena pelanggan komplain. Cek dulu
> isinya, lalu lakukan refund dengan reason "customer requested".

---

## 📈 SEO

### Yoast SEO meta for an article
> Saya pakai Yoast. Untuk post id 89:
> 1. Generate SEO title (max 60 char), meta description (≤155 char),
>    focus keyword "MCP WordPress integration"
> 2. Set noindex = false, nofollow = false
> 3. Apply via `seo_set_meta`

### Rank Math redirection
> Saya pindah dari `/old-blog/wordpress-mcp` ke `/blog/wordpress-mcp`.
> Buatkan rule redirection 301 lewat Rank Math.

### SERP preview check
> Pakai Yoast `/yoast/v1/get_head` untuk URL https://mysite.com/blog/post-x
> dan tampilkan title, description, dan og:image yang bakal dilihat Google.

---

## 🧱 Block themes & design

### Inspect templates
> List semua template aktif di tema `twentytwentyfour`. Ada berapa template
> part di header dan footer?

### Edit a template part
> Buka template part `twentytwentyfour//footer` dan ganti copyright text
> dari "© 2024" jadi "© 2026 — All rights reserved by ACME". Sisa konten
> tetap apa adanya.

### Pattern audit
> Tampilkan semua block patterns yang terdaftar di site ini, dikelompokkan
> per kategori.

---

## 👥 User management

### Create an editor account
> Buatkan user baru dengan role "editor": username `siti`, email
> `siti@example.com`, password generate yang kuat, lalu kasih saya
> password-nya.

### Reassign content sebelum hapus user
> User id 12 mau dihapus. Reassign semua post mereka ke user id 1, baru
> hapus.

---

## 🧰 Generic / custom post types

### Discovery first
> Cek site ini punya CPT apa saja, dan taxonomy apa saja. Tampilkan
> sebagai dua tabel.

### Work with a CPT
> Site ini punya CPT `portfolio` (saya cek dari `wp_get_post_types`).
> List 20 portfolio terbaru pakai `wp_list_items` dengan
> route `wp/v2/portfolio`.

### Custom field via meta
> Update post id 55, set custom field (sudah register `show_in_rest`):
> `_views_count` = 1500
> `_featured_position` = 2

---

## 📦 Batch operations

### Multiple writes in one round-trip
> Pakai `wp_batch` untuk:
> 1. Update post 100 (status → publish)
> 2. Update post 101 (status → publish)
> 3. Buat 1 comment baru di post 100 dengan content "Selamat membaca!"
>
> Mode validasi: `require-all-validate`. Kalau salah satu gagal, batal semua.

### Discover the limit first
> Berapa max requests yang server WP saya support per batch? Cek pakai
> `wp_batch_options`.

---

## 🌐 Multisite (jika plugin terpasang)

### Onboard new subsite
> Tambahkan subsite baru: domain `clientx.example.com`, path `/`,
> title "Client X", network 1.

### Audit all sites
> List semua sites di network ini. Tampilkan blog id, domain, path, dan
> tanggal registrasi.

---

## 🔐 JWT mode (kalau auth = jwt)

> Cek apakah token JWT saya masih valid. Pakai `wp_jwt_validate`.

---

## 💡 Tips agar agent kerja efisien

1. **Mulai dengan `wp_site_info`** kalau site-nya belum kamu kenal — agent
   akan tahu plugin apa saja yang aktif lewat field `namespaces`.
2. **Pakai `_fields`** untuk list panjang, mis. `_fields=id,title,slug`,
   biar context window LLM tidak cepat penuh.
3. **Untuk update post**, minta agent panggil dengan `context=edit` dulu
   biar dapat raw content (bukan HTML yang sudah difilter).
4. **Operasi destruktif (delete, force=true)** sebaiknya selalu minta
   konfirmasi: "tampilkan dulu apa yang mau dihapus, baru hapus setelah
   saya bilang ya".
5. **Untuk pekerjaan massal (>10 item)**, minta agent pakai `wp_batch`
   atau loop dengan paginasi.
6. **Kalau muncul error `rest_forbidden`** untuk meta, biasanya field-nya
   belum register dengan `show_in_rest` di functions.php. Bilang ke
   developer site untuk register pakai `register_post_meta()`.

---

## ❓ Common errors / Error yang sering muncul

| Pesan | Penyebab | Solusi |
|------|----------|--------|
| `rest_cannot_create` (401) | Application Password salah | Buat ulang di WP Admin → Profile, **jangan hilangkan spasi** |
| `rest_no_route` (404) | Endpoint plugin tidak ada | Plugin belum terpasang / tidak expose REST |
| `rest_forbidden` (403) | User tidak punya capability | Login pakai user dengan role yang tepat |
| `jwt_token_fetch_failed` | `JWT_AUTH_SECRET_KEY` belum diset | Edit `wp-config.php`, tambahkan constant |
| `rest_post_invalid_meta_key` | `meta` belum register | Pakai `register_post_meta()` dengan `show_in_rest=true` |
| `woocommerce_rest_authentication_error` | WC consumer key salah | Generate ulang di WC Settings → Advanced → REST API |
| Tool not found | MCP server belum reconnect | Reconnect MCP server di Kiro / Claude Desktop |
| `Unable to upload file` | File terlalu besar | Cek `upload_max_filesize` di server, atau pakai chunked upload |
