# Naga Angin — Inti & Desain Game

Dokumen ini menjelaskan **inti permainannya**, **desain lengkapnya**, lalu merangkumnya jadi **prompt siap pakai**.

---

## 1. Inti Game (satu paragraf)

**Naga Angin** adalah game terbang satu jari yang tenang tapi menegangkan. Kamu mengendalikan seekor naga Tiongkok yang meluncur tanpa henti ke kanan di atas perbukitan yang bergulir menurun. Naga tidak bisa dipercepat atau diperlambat — **satu-satunya kendali adalah naik–turun mengikuti gerakan mouse**. Seluruh permainan dibangun dari satu ketegangan sederhana: **seberapa dekat kamu berani terbang ke tanah dan ke tebing.**

Genre acuannya *Alto's Odyssey*: bukan game refleks yang menuntut tombol, melainkan game **membaca medan** — lembut dan meditatif saat kamu mengalir, cepat dan panik saat kamu serakah.

### Loop intinya (10 detik pertama sudah kelihatan)

```
lewati cincin emas  →  Aliran ×N naik + kecepatan naik permanen
        ↑                        ↓
kumpulkan "bank" poin    waktu reaksi makin sempit
        ↓                        ↓
teruskan rantai = bank makin besar  ←→  berhenti aman = poin dicairkan
        ↓                        ↓
   serempet tebing dapat bonus   nabrak = SEMUA bank hilang
```

### Tiga pilar desainnya

1. **Tenang tapi menuntut.** Tidak ada lawan, tidak ada timer mati. Yang menuntut adalah medan yang makin cepat. Musiknya ambient, suaranya bel pentatonik — nada permainannya damai, padahal sarafmu tegang.
2. **Setiap rintangan adalah pilihan.** Cincin emas ditaruh tepat di atas tebing atau tepat di celah sempit. Mau ambil poinnya (risiko) atau lewat saja dengan aman? Kamu memutuskan puluhan kali per menit tanpa perlu menekan apa pun selain menggerakkan mouse.
3. **Menempel tanah itu menguntungkan, bukan hukuman.** Terbang rendah memberi kombo + dorongan kecepatan ("Selancar Angin"), menyerempet tebing memberi bonus ("Terelak Berani"). Hukumannya cuma satu: satu kesalahan kecil = mati.

---

## 2. Desain Lengkap

### 2.1 Kontrol & Rasa Gerak (bagian paling menentukan)

| Aspek | Desain |
|---|---|
| Input | **Hanya posisi Y kursor/sentuhan.** X diabaikan — naga selalu maju sendiri ke kanan. |
| Fisika | Pegas **kritikal-damping** dengan solusi **analitik per frame**: hasil sama di 30/60/120 fps dan saat frame drop. |
| Ketertinggalan | Ditambah **pengimbang maju (feedforward)**: kecepatan kursor diperkirakan, sasaran dibidik pada posisi + kecepatan/ω. Naga *menempel* ke kursor (lag ±24 px, bukan ±100 px) tanpa membuat pegas kaku & bergetar. |
| Batas | Langit-langit keras (y = 35). Tanah: naga **meluncur mengikuti kontur lereng** (kecepatan diproyeksikan ke arah permukaan), bukan dipantulkan. |
| Pitch naga | Sudut moncong dari kecepatan vertikal yang **dihaluskan** supaya kontak lereng tidak membuat moncong berkedip. |
| Kamera | Zoom 0,72 → 0,52 saat melaju kencang. Poros di 35% lebar & 19,6% tinggi layar. Naga duduk di ±22% lebar layar (mundur, supaya medan di depan banyak terlihat). |
| Getaran | Guncangan layar berupa **osilasi yang meredup halus** (bukan derau acak per frame). Efek "punch" memperbesar dunia, dikecilkan sesuai kecepatan. |

> Prinsip: **input harus terasa seperti tangan sendiri.** Kalau naga tertinggal jauh dari kursor, pemain merasa "kontrolnya rusak" walau sistemnya bekerja benar.

### 2.2 Dunia (medan & latar)

- **Bingkai 16:9 lanskap** (logis 1280×720).
- **Medan**: 6 oktaf gelombang sinus mulus, semua memakai **skew fase** sehingga sisi turun memanjang & landai sementara tanjakan ringkas → terasa seperti **menuruni lereng gunung** (±58% jarak menurun, 1 lereng turun ≈ 2,1 layar). Kemiringan rata-rata ±5°, puncak ±17–31°: miring terasa, tidak pernah jadi tebing.
- **Latar parallax 3 lapis**: jauh (0,06), tengah (0,16), dekat (0,38). Siluetnya memakai fungsi *ridge* mulus yang juga miring menurun — bukan puncak-puncak jarum.
- **Catatan**: medan yang landai tidak boleh berarti datar. Permukaan harus berubah ±100 px per lebar layar, kalau tidak pemain tidak punya apa pun untuk "dibaca".

### 2.3 Siklus Waktu (4 palet, berganti tiap 42 detik)

**Fajar** (merah muda–krem) → **Siang** (biru–hijau pucat) → **Senja** (ungu–jingga) → **Malam** (biru gelap + bintang). Pergantian warnanya lerp halus, tidak pernah "jepret".

Perbedaan waktu bukan cuma warna:
- Matahari / bulan bergerak; bintang hanya muncul malam.
- **Malam**: kunang-kunang, lentera kertas naik dari lembah, bintang jatuh.
- **Siang**: kelopak sakura berguguran, debu emas.
- Semua hiasan langit dijaga di atas garis puncak bukit tertinggi, supaya tidak "hujan salju" di depan gunung.

Hiasan latar: balon udara bergaris, burung bangau putih (kawanan jauh & dekat), awan, **puing kuil kuno di punggung bukit** (pagoda 3 tingkat, torii lapuk, stupa), **pulau terapung** dengan torii/pinus/pagoda.

### 2.4 Rintangan (dirancang sebagai "ajakan", bukan sekadar obstacle)

Spawning berbasis pola, jarak antar-pola diskalakan dengan kecepatan (waktu reaksi dijaga konstan):

| Pola | Isi | Tujuan desain |
|---|---|---|
| **Gerbang batu** | Menara batu dari tanah + stalaktit dari langit, celah ±330→230 px, cincin di tengah celah | Uji presisi |
| **Busur cincin** | 5 cincin melengkung, menukik atau menanjak | Mengajak pemain menukik / memanjat |
| **Pulau terapung** | Batu menggantung + 3 cincin di atas/bawahnya | Pilihan jalur atas vs bawah |
| **Hutan menara batu** | Dua menara tinggi dari tanah + cincin di puncaknya | Terbang dekat puncak |
| **Stalaktit menggantung** | Dua batu dari langit, celah rendah di bawahnya | Menyusur tanah |

Batu yang tumbuh dari tanah dipatok ke **titik terendah pada tapaknya** supaya lereng yang miring tidak membuatnya melayang atau menganga.

### 2.5 Ekonomi Poin — inti "push your luck"-nya

Tiga sumber poin, semuanya menyatu ke satu mekanik bernama **ALIRAN**:

- **Cincin emas** → Aliran +1, bank +25 (+40 kalau lewat dalam 35% jari-jari dari titik tengah = *"Sempurna!"*), energi dorongan +100/+160. **Tiap cincin menaikkan kecepatan jelajah permanen +160 px/s.**
- **Selancar Angin** (terbang < 70 px di atas tanah) → sampai +15 poin/detik, makin dekat makin besar, dan **tiap 0,55 detik menambah kombo** + bank.
- **Terelak Berani** (menyerempet batu, < 12,5 px) → kombo + bank +30 + dorongan; naga didorong menjauh.

**Jendela Aliran 3,2 detik.** Kombo mati kalau tidak ada aksi apa pun selama itu.

**Pencairan (cash-out):** saat jendela Aliran berakhir, seluruh bank dicairkan **dikalikan kombo** — `poin = bank × kombo`.

> **Inilah keputusan intinya:** teruskan rantai untuk mengunci pengali besar, atau berhenti dan cairkan dengan aman? Dan yang paling penting — **kalau menabrak, seluruh bank yang belum dicairkan HILANG.** Serakah itu menguntungkan sampai satu detik sebelum kamu menyesal.

Poin akhir = `jarak (m) + poin cincin + poin aliran`.

**Kecepatan**: dasar 320 px/s → +160 tiap cincin → +75 tiap langkah kombo (maks +600) → batas 2000 px/s (label permainan: 6,0×). Progresinya sengaja *runaway*: cincin membuatmu cepat, kecepatan membuatmu melewati lebih banyak cincin.

### 2.6 Naga (karakter)

Naga Tiongkok merah vermilion dengan sisik emas. Tubuhnya **tidak dianimasikan dengan kerangka**, melainkan dibangun ulang setiap frame dari **jejak 500 titik riwayat posisi kepala**: 46 segmen berjarak 6,2 px, lalu diberi gelombang sinus yang amplitudonya mengecil saat kecepatan tinggi (supaya tidak bergetar di 6×). Detail: tanduk rusa, kumis panjang, empat kaki kecil, sirip punggung, ekor berumbai emas, kilau lembut di sepanjang tubuh (memudar ke arah ekor).

### 2.7 Umpan Balik & Suara

- **Audio prosedural murni WebAudio — tanpa satu pun berkas suara.** Pad ambient (73,4 / 146,8 / 220 / 329,6 / 370 Hz) dengan filter yang terbuka seiring kecepatan, derau angin yang menguat dengan kecepatan, dan **bel pentatonik** yang naik satu nada tiap cincin — jadi rantai kombo panjang berubah jadi melodi.
- Partikel: semburan emas saat cincin, debu saat menyentuh tanah, kelopak/debu emas/kunang-kunang/lentera sesuai waktu hari, garis angin di kecepatan tinggi.
- Teks melayang: `+N (Aliran ×N)`, `Sempurna! ✦`, `Selancar Angin ✦ ×N`, `Terelak Berani! ✦ ×N`, `Aliran +N ✦`.
- HUD: jarak (kiri atas), skor total + jumlah cincin (kanan atas), `ALIRAN ×N` + bilah waktu tenggang + nilai bank, meter kecepatan bawah (`KECEPATAN 1.1× / 6.0×`), dan **penanda sasaran** (cincin kecil + benang angin putus-putus dari moncong naga ke kursor).

### 2.8 Batasan Teknis (yang membuatnya terasa "mahal")

- Canvas 2D, satu `<canvas>`, tanpa pustaka game.
- **Anggaran piksel kanvas 2,6 juta** — resolusi menyesuaikan ukuran jendela, bukan dipatok ke devicePixelRatio (kalau tidak, 1280×720 @2× = 3,7 juta piksel × 60 fps = macet).
- Gambar berkelompok: tepi lereng, rumput, pinus, bintang digambar sebagai **beberapa jalur saja**, bukan ratusan panggilan per frame.
- Pointer **tidak** memanggil `getBoundingClientRect()` per event (pembacaan layout = reflow = gerakan tersendat). Ukuran bingkai diukur sekali & saat jendela berubah.
- Tidak ada `backdrop-filter` di atas kanvas yang beranimasi.
- Semua efek gerak (pegas, kamera, guncangan) **konsisten terhadap waktu frame**, bukan per-frame.

### 2.9 Layar Menu & Akhir

- **Menu**: judul "Naga Angin", penanda `龍 · ZEN · FLIGHT`, panel bantuan 4 baris (cincin → selancar → terelak → kecepatan), tombol *Mulai Terbang*, rekor tersimpan di localStorage.
- **Akhir**: "Sang Naga Beristirahat", skor besar, REKOR BARU, dan grid statistik **Jarak / Cincin / Aliran / Puncak**, lalu *Terbang Lagi*.
- Layar game over sengaja menampilkan `detail` — pemain tahu kenapa ia gagal, dan ingin mencoba lagi.

---

## 3. Prompt Siap Pakai

> Salin blok di bawah ini kalau kamu mau minta AI (atau developer) membangun game ini dari nol.

```
Bangun sebuah game web bernama "Naga Angin": game terbang satu jari yang tenang
tapi menegangkan, bergaya Alto's Odyssey, dengan seekor naga Tiongkok sebagai pemain.

BENTUK & TAMPILAN
- Bingkai 16:9 lanskap (logis 1280x720), responsif penuh ke jendela.
- Render dengan Canvas 2D biasa (tanpa pustaka game), semua grafik digambar secara
  prosedural (tidak ada berkas gambar/audio).
- Gaya visual: lukisan datar yang bersih, siluet berlapis, palet hangat.
- Siklus waktu 4 fase (fajar, siang, senja, malam) berdurasi 42 detik, pergantian
  warna di-lerp halus. Malam memunculkan bintang, kunang-kunang, dan lentera kertas
  yang naik dari lembah; siang memunculkan kelopak sakura dan debu emas.
- Latar parallax 3 lapis pegunungan dengan siluet yang halus dan miring menurun
  (bukan puncak jarum), plus puing kuil kuno di punggung bukit, balon udara bergaris,
  kawanan burung bangau putih, awan, dan pulau terapung berisi torii dan pinus.

MEDAN
- Perbukitan yang mengalir MENURUN: gabungan gelombang sinus mulus dengan skew fase,
  sehingga sisi turun panjang & landai (sekitar 2x lebih panjang dari tanjakan) dan
  tanjakan kembali ringkas. Kemiringan rata-rata ~5 derajat, puncak ~30 derajat:
  miringnya terasa jelas, tapi tidak pernah jadi tebing, dan tidak pernah terasa datar.
- Permukaan harus berubah sekitar 100 px per lebar layar, dan setiap bagian harus
  kontinu (tanpa patahan) supaya terbaca sebagai lereng asli.

KONTROL (bagian terpenting - rasa geraknya harus sempurna)
- Naga selalu maju sendiri ke kanan; pemain HANYA mengatur naik-turun dengan gerakan
  mouse/sentuhan (posisi Y saja, X diabaikan).
- Gaya: pegas kritikal-damping dengan solusi ANALITIK per frame, supaya hasilnya sama pada
  30/60/120 fps dan saat waktu frame goyah (frame drop) - jangan pakai Euler.
- Tambahkan pengimbang maju (feedforward): perkirakan kecepatan kursor, lalu bidik
  sasaran pada posisi + kecepatan/omega. Tujuannya naga MENEMPEL pada kursor
  (ketertinggalan < 30 px), bukan tertinggal ~100 px, tanpa membuat pegas jadi kaku
  dan bergetar. Saat menempel tanah, pengimbang ini harus menyerah.
- Saat menyentuh lereng, kecepatan vertikal naga DIPROYEKSIKAN ke arah permukaan
  (seperti meluncur di lereng), jangan dipangkas jadi nol - kalau tidak, di kecepatan
  tinggi penjepitan itu bertarung dengan pegas setiap frame dan terasa tersendat.
- Sudut moncong naga memakai kecepatan vertikal yang dihaluskan.
- Kamera: zoom 0,72 yang melonggar ke 0,52 saat melaju kencang; poros kamera di 35%
  lebar dan ~20% tinggi layar; naga duduk di sekitar 22% lebar layar (cukup mundur
  supaya medan di depannya banyak terlihat).
- Guncangan layar harus berupa osilasi yang meredup halus, BUKAN offset acak per frame.

RINTANGAN
- Pola yang di-spawn berulang dengan jarak yang diskalakan sesuai kecepatan supaya
  waktu reaksi tetap adil: gerbang batu (menara dari tanah + stalaktit dari langit),
  busur cincin yang mengajak menukik/memanjat, pulau terapung, hutan menara batu, dan
  stalaktit menggantung.
- Cincin emas ditaruh tepat di jalur berisiko (di atas tebing, di celah sempit), jadi
  setiap rintangan jadi keputusan: ambil poinnya atau lewat dengan aman.

EKONOMI POIN (harus punya ketegangan "push your luck")
- Cincin emas: menambah kombo Aliran, menambah bank poin, dan menaikkan kecepatan
  jelajah permanen. Bonus "Sempurna" kalau lewat persis di tengah cincin.
- Terbang rendah dekat tanah memberi "Selancar Angin": poin per detik dan kombo
  tambahan setiap 0,55 detik - jadi pemain punya alasan untuk terus berinteraksi.
- Menyerempet tebing memberi "Terelak Berani": bonus kombo dan poin.
- Kombo hanya hidup dalam jendela 3,2 detik. Saat jendela berakhir, seluruh bank
  dicairkan DIKALIKAN kombo. TAPI kalau menabrak, seluruh bank yang belum dicairkan
  HILANG. Inilah inti keputusannya: teruskan rantai untuk pengali besar, atau cairkan
  dengan aman.
- Kecepatan: dasar 320 px/s, +160 tiap cincin, +75 tiap langkah kombo, batas 2000 px/s (label permainan: 6x).
  Progresi sengaja melaju sendiri: cincin membuat cepat, kecepatan membuat lebih
  banyak cincin.

SUARA (prosedural, WebAudio, tanpa berkas)
- Pad ambient lembut yang filternya terbuka seiring kecepatan, derau angin yang
  menguat dengan kecepatan, dan bel pentatonik yang naik satu nada tiap cincin -
  sehingga rantai kombo panjang berubah menjadi melodi.
- Efek pendek: desiran saat menukik cepat, dentum saat menyentuh tanah, dan bunyi
  benturan saat mati.

TAMPILAN & UMPAN BALIK
- Naga digambar dari jejak riwayat posisi kepala (bukan kerangka): puluhan segmen
  berjarak tetap, diberi gelombang sinus yang mengecil saat kecepatan tinggi.
  Detail: tanduk, kumis panjang, kaki kecil, sirip punggung, ekor berumbai emas,
  kilau lembut di sepanjang tubuh.
- Partikel: semburan emas saat melewati cincin, debu saat menyentuh tanah, kelopak
  bunga / debu emas / kunang-kunang / lentera sesuai fase waktu, garis angin di
  kecepatan tinggi.
- Teks melayang untuk setiap kejadian ("Sempurna!", "Selancar Angin x5", dll).
- HUD: jarak (kiri atas), skor + jumlah cincin (kanan atas), indikator "ALIRAN xN"
  dengan bilah waktu tenggang dan nilai bank, meter kecepatan di bawah, serta penanda
  sasaran berupa cincin kecil dan benang angin putus-putus dari moncong naga ke kursor.
- Layar menu dengan judul, panel bantuan singkat, dan tombol mulai; layar akhir dengan
  skor, rekor, dan rincian statistik (jarak, cincin, kombo terbaik, kecepatan puncak).

BATASAN TEKNIK
- Jaga anggaran piksel kanvas sekitar 2,6 juta (skala render menyesuaikan ukuran
  jendela) supaya tetap 60 fps di laptop biasa.
- Gambar elemen berulang secara berkelompok (beberapa jalur untuk banyak objek),
  jangan satu panggilan gambar per objek.
- Jangan membaca layout (getBoundingClientRect) di dalam event pointer - ukur sekali
  dan saat jendela berubah saja.
- Semua gerakan harus konsisten terhadap waktu frame, bukan per-frame.
```

---

## 4. Angka Kunci (untuk menyetel cepat)

| Parameter | Nilai | Efek kalau diubah |
|---|---|---|
| `WARP` (terrain) | −0,75 | Makin negatif = makin banyak porsi menurun |
| Amplitudo oktaf terbesar | 170 px | Kedalaman bukit |
| `CAM_BACK` | 0,17 | Naga makin mundur = waktu baca medan lebih panjang |
| `VIEW_Z_RATIO` | 0,196 | Posisi garis horizon di layar |
| `ZOOM_BASE` / `ZOOM_FAST` | 0,72 / 0,52 | Seberapa lega pandangan |
| `OMEGA_BASE` | 30 | Kekakuan pegas: besar = menempel, kecil = lembut |
| `VY_MAX` | 2400 px/s | Batas mendaki saat kecepatan 6× |
| Jendela Aliran | 3,2 detik | Seberapa "pemaaf" rantai kombo |
| Kecepatan maksimum | 2000 px/s (label 6,0×) | Langit-langit kesulitan |

**Ambang rasa yang sudah terukur** (jangan dilanggar tanpa alasan): ketertinggalan naga < 30 px; simpangan lintasan antar frame rate < 5 px; lonjakan kecepatan saat menyusur tanah < ±700 px/s; waktu render < 13 ms per frame.
