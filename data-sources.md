# Sumber Data & Aspek Legal

## Sumber Data Utama

TenderNusa mengambil data publik dari sistem **LPSE (Layanan Pengadaan Secara Elektronik)** Indonesia, terutama menggunakan protokol DataTables bawaan portal.
- **Portal Utama**: `https://lpse.go.id`
- **Endpoint Data**: `POST /eproc4/dt/tender`
- **Endpoint Direktori**: `POST /eproc4/dt/portal`

## Dasar Hukum (Legal Basis)

Seluruh data yang ditampilkan adalah data publik yang memang diwajibkan untuk transparan sesuai undang-undang di Indonesia:
1. **Perpres No. 16 Tahun 2018** tentang Pengadaan Barang/Jasa Pemerintah.
2. **Peraturan LKPP No. 9 Tahun 2018** tentang Pedoman Pelaksanaan Pengadaan Barang/Jasa.
3. **UU No. 14 Tahun 2008** tentang Keterbukaan Informasi Publik.

## Peta Skema Normalisasi Data

Karena setiap portal LPSE kadang mengembalikan data format JSON Array (bukan Objek), TenderNusa menggunakan pemetaan urutan kolom yang dinormalisasi menjadi skema standar.

| Raw Field (LPSE)       | Tipe Data  | Unified Schema Field   |
|------------------------|------------|------------------------|
| `Kode Tender`          | String     | `tender_id`            |
| `Nama Tender`          | String     | `tender_name`          |
| `Instansi`             | String     | `agency_name`          |
| `KLPD`                 | String     | `klpd_name`            |
| `Metode Pengadaan`     | String     | `procurement_method`   |
| `Tahun`                | Integer    | `fiscal_year`          |
| `Satuan Kerja`         | String     | `work_unit`            |
| `Nama Paket`           | String     | `category`             |
| `Nilai HPS`            | Currency   | `hps_value`            |
| `Status`               | String     | `tender_status`        |
| `Nama Pemenang`        | String     | `winner_name`          |
| `Nilai Kontrak`        | Currency   | `contract_value`       |

*Catatan Kualitas Data:* Format tanggal dan mata uang (Rupiah) dikonversi secara otomatis oleh sistem `normalize-lpse.js` agar seragam menjadi format *Integer* dan format tanggal ISO `YYYY-MM-DD`.
