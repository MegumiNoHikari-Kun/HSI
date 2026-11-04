# Copas Musrif

Web sederhana untuk menyimpan, mencari, dan menyalin template chat WhatsApp.
Tidak perlu database. Semua template tersimpan di `data/templates.json` pada repo GitHub ini.

## Cara deploy

### 1. Upload ke GitHub
Buat repo baru (boleh private), lalu upload semua file di folder ini.
Pastikan file `.vercelignore` ikut ter-upload.

### 2. Buat token GitHub
Buka GitHub > Settings > Developer settings > Personal access tokens > Fine-grained tokens > Generate new token.

- Repository access: pilih **Only select repositories**, lalu pilih repo ini
- Permissions: **Contents** = **Read and write**

Salin token yang muncul. Token hanya ditampilkan sekali.
Catat tanggal kedaluwarsanya. Setelah kedaluwarsa, buat token baru dan ganti nilainya di Vercel.

### 3. Import ke Vercel
Buka vercel.com > Add New > Project, lalu pilih repo ini.
Framework Preset: **Other**. Build Command dan Output Directory dikosongkan.

Isi **Environment Variables** berikut:

| Nama | Isi | Contoh |
| --- | --- | --- |
| `GITHUB_TOKEN` | Token dari langkah 2 | `github_pat_...` |
| `GITHUB_REPO` | Pemilik dan nama repo | `namaanda/copas-musrif` |
| `GITHUB_BRANCH` | Nama branch (opsional, bawaan `main`) | `main` |
| `ADMIN_PASSWORD` | Kata sandi untuk tambah, ubah, dan hapus | buat sendiri |

Klik **Deploy**.

Jika environment variable ditambahkan atau diubah setelah deploy, lakukan Redeploy agar nilainya terpakai.

## Cara pakai

- Cari template lewat kotak pencarian. Tekan `/` di keyboard untuk langsung ke kotak pencarian.
- Tekan **Salin**, lalu tempel di WhatsApp.
- Format WhatsApp didukung: `*tebal*`, `_miring_`, `~coret~`.
- Teks dalam kurung siku seperti `[tautan]` disorot sebagai pengingat untuk diganti sebelum dikirim.
- Kata sandi diminta sekali saat menyimpan, lalu diingat di browser tersebut.

## Yang perlu diketahui

- Melihat, mencari, dan menyalin template tidak butuh kata sandi. Siapa pun yang punya alamat web bisa membaca isi template, jadi jangan simpan data pribadi di dalamnya.
- Setiap simpan menjadi satu commit di GitHub, sehingga riwayat perubahan bisa dilihat dan dikembalikan.
- `vercel.json` membuat Vercel tidak build ulang jika yang berubah hanya `data/templates.json`.

## Struktur

```
index.html            Tampilan web
api/templates.js      API tambah, baca, ubah, hapus ke GitHub
data/templates.json   Data template
vercel.json           Lewati build saat hanya data yang berubah
.vercelignore         Data tidak ikut diunggah sebagai file publik
```
