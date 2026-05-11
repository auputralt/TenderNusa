# TenderNusa

**Data pengadaan pemerintah Indonesia, terstruktur dan mudah ditelusuri.**

TenderNusa adalah platform *procurement intelligence* modern yang mengagregasi dan menormalisasi data tender publik dari berbagai portal LPSE (Layanan Pengadaan Secara Elektronik) di Indonesia.

## Fitur Utama
- **Real-time Ingestion**: Pipeline *scraping* canggih dari API DataTables LPSE.
- **Modern UI/UX**: *Dark/Light mode*, *Skeleton loading*, *Fluid typography*, dan responsivitas tinggi.
- **Aksesibilitas (a11y)**: Mendukung navigasi *keyboard* (contoh: tekan `/` untuk fokus ke *search bar*) dan dukungan *screen reader*.

## Persyaratan Sistem

- **Node.js** >= 18.0.0 (Wajib karena menggunakan fitur native `fetch` dan ES Modules).
- **npm** >= 9.0.0

## Instalasi

1. *Clone* repositori ini dan masuk ke direktorinya:
   ```bash
   git clone <repo-url> tendernusa
   cd tendernusa
   ```

2. Inisialisasi dan instal dependensi (`express` & `cheerio`):
   ```bash
   npm init -y
   npm install express cheerio
   ```

3. **Penting:** Tambahkan `"type": "module"` di dalam file `package.json` Anda untuk mengaktifkan ES Modules:
   ```json
   {
     "name": "tendernusa",
     "version": "1.0.0",
     "type": "module",
     "dependencies": {
       "cheerio": "^1.0.0",
       "express": "^4.18.2"
     }
   }
   ```

## Konfigurasi

Secara *default*, sistem menarik data dari `https://lpse.go.id`. Jika Anda ingin mengubah target portal LPSE (misal: LPSE Kementerian Perdagangan), Anda bisa menggunakan *Environment Variable*:

```bash
LPSE_BASE_URL=https://lpse.kemendag.go.id node server.js
```

Atau edit batas keterlambatan *request* (untuk menghindari blokir *rate-limiting* dari server LPSE) di dalam `ingestion/fetch-lpse.js`.

## Menjalankan Server

Jalankan perintah berikut:

```bash
node server.js
```

Aplikasi akan aktif di `http://localhost:3000`. Saat pertama kali berjalan, server akan melakukan proses *ingestion* secara otomatis di latar belakang.

## Arsitektur

Aplikasi dibangun tanpa menggunakan framework *frontend* berat (seperti React/Vue) untuk menjaga ukuran tetap minimalis, namun tetap reaktif menggunakan Vanilla JS modern.

```text
tendernusa/
├── package.json
├── server.js                 # Express server & API Endpoints
├── index.html                # Struktur HTML SPA (Single Page Application)
├── styles.css                # CSS Variables & desain responsif
├── app.js                    # Client-side state management & rendering
└── ingestion/
    ├── fetch-lpse.js         # Fetcher DataTables LPSE & HTML fallbacks
    └── normalize-lpse.js     # Data parsing (Rupiah, Date) & Normalization
```
