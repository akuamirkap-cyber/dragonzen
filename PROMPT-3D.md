# Naga Angin 3D — Arah Seni & Prompt

Referensi rasa: **Paper Sky** (Brute Force Studio) — *low-poly, warna yang berani tapi harmonis, lanskap sederhana, atmosfer menenangkan*.
Tujuan: game ini jadi **3D tapi tetap sederhana dan tetap indah**. Dokumen ini menjelaskan **apa yang membuatnya indah**, lalu merangkumnya jadi prompt.

---

## 0. Pelajaran terpenting lebih dulu

Paper Sky tidak indah karena detailnya banyak. Justru sebaliknya — indah karena **disiplin**:

> **Kedalaman dibangun dari LAPISAN + KABUT, bukan dari detail. Kecantikan dibangun dari PALET + SILUET, bukan dari tekstur.**

Ini kabar baik: artinya versi 3D-nya bisa **lebih sederhana** dari versi 2D sekarang (model low-poly, tanpa tekstur, tanpa bayangan realtime) dan tetap terlihat mahal. Yang mahal itu keputusan warna dan komposisinya, bukan jumlah poligonnya.

Kalau salah satu aturan di bawah dilanggar, hasilnya langsung terlihat seperti "3D murah" — jadi bagian 2 adalah bagian terpenting dari dokumen ini.

---

## 1. Yang dipertahankan vs yang berubah

### Dipertahankan (ini identitas game kamu — jangan diubah)

| Hal | Alasan |
|---|---|
| **Kontrol satu sumbu** (mouse naik–turun saja) | Ini yang membuat game kamu *zen*, bukan *flight sim*. Paper Sky butuh pitch/roll/yaw; game kamu **tidak boleh** ikut-ikutan — kalau ikut, jiwanya hilang. |
| **Medan yang mengalir MENURUN** (skew fase, lereng panjang) | Sudah jadi ciri khas, dan di 3D justru lebih terasa megah. |
| **Loop Aliran**: kombo → bank → dicairkan ×kombo → hilang kalau menabrak | Inti ketegangannya. |
| **Selancar Angin & Terelak Berani** | Alasan pemain terus berinteraksi. |
| **Siklus 4 waktu (fajar/siang/senja/malam)** | Sumber variasi termurah dan paling berdampak. |
| **Audio prosedural pentatonik** (bel naik tiap cincin) | Melodi rantai kombo. |
| **HUD minimal + penanda sasaran** | Penanda sasaran malah lebih penting di 3D (membaca kedalaman lebih sulit). |

### Berubah jadi 3D

| Hal | 2D sekarang | 3D nanti |
|---|---|---|
| Naga | Jejak 46 segmen digambar sebagai pita | **Rantai 3D**: kepala low-poly + badan tabung beruas yang mengikuti jejak posisi yang sama |
| Medan | Kurva `groundY(x)` | **Heightfield** dari rumus yang sama, dipakai sebagai mesh flat-shaded berpetak |
| Latar | 3 lapis siluet parallax | **3–4 lapisan mesh siluet sebenarnya**, tiap lapis punya palet lebih pudar |
| Cincin | Elips | **Torus** low-poly |
| Batu | Poligon | Kerucut/prisma low-poly |
| Cahaya | Gradien | **1 matahari + 1 rim light**, tanpa bayangan realtime |
| Kedalaman | Kabut berlapis | **Kabut volumetrik palsu (fog) antar-lapis** — ini kunci utamanya |

---

## 2. Aturan estetika "sederhana tapi indah" (bagian terpenting)

### 2.1 Palet: ketat, dan selalu satu keluarga

- **Maksimal 5 warna per babak.** Bukan 5 *hue* acak — satu keluarga warna dengan nilai berbeda.
- **Tidak ada hitam pekat (#000) dan tidak ada putih murni (#fff).** Bayangan tergelap tetap berwarna (mis. biru malam), sorotan tetap hangat. Ini yang membuat gambar terasa "dilukis", bukan "render".
- Setiap babak waktu punya palet sendiri yang lengkap (langit atas, langit bawah, kabut, 3 nilai bukit, tanah, aksen). Transisi antar babak **lerp halus**, tidak pernah "jepret".
- Aksen (cincin emas, partikel) adalah **satu-satunya** warna yang boleh menyala/menyimpang dari palet.

### 2.2 Siluet dulu, detail belakangan

- Uji setiap objek: **kalau jadi hitam total, masih terbaca bentuknya?** Kalau tidak, perbaikinya bukan menambah detail — tapi memperbaiki bentuknya.
- Anggaran poligon: batu ≤ 40 segitiga, cincin ≤ 64, pohon ≤ 20, kepala naga ≤ 200. Kalau butuh lebih, berarti ada detail yang belum perlu.
- Sudut khas low-poly: **permukaan rata (facets) terlihat jelas**, bukan permukaan halus. Ini yang memberi rasa "kertas terlipat".

### 2.3 Kedalaman: lapisan + kabut (bukan detail)

- 3–4 lapisan bukit berurutan dari depan ke belakang. Tiap lapis mundur: **warnanya makin pudar, makin membiru/ke arah warna kabut, dan kontrasnya turun.**
- Jarak pandang dibatasi kabut (~2.000–3.000 unit). Objek di luar itu tidak digambar sama sekali — jadi perfoma aman *dan* hasilnya otomatis "berkabut seperti lukisan".
- **Tidak ada objek kecil yang jauh.** Detail kecil di kejauhan = titik-titik kotor. Biarkan jauh = bentuk besar.

### 2.4 Cahaya: satu sumber, kontras dari nilai

- 1 directional light (matahari) + 1 hemisphere light (langit vs tanah). Selesai.
- **Tanpa bayangan realtime.** Ganti dengan satu "blob shadow" lembut yang diproyeksikan ke medan di bawah naga (lingkaran gelap tipis, opacity 0,15). Ini juga membantu pemain membaca ketinggian.
- *Backface culling* + flat shading. Rim light tipis di sisi yang menghadap matahari untuk memisahkan siluet dari latar.

### 2.5 Tanpa tekstur sama sekali

- Warna datang dari **vertex color / gradien**, bukan berkas gambar. Hasilnya: berkas kecil, gaya konsisten, dan tidak mungkin terlihat "foto yang ditempel".
- Boleh satu pengecualian: **butiran kertas halus** di seluruh layar (noise sangat tipis, opacity 3–5%) sebagai lapisan akhir. Ini yang memberi rasa kertas, dan sangat murah.

### 2.6 Ruang kosong itu bagian dari desain

- **60–70% frame adalah langit kosong.** Jangan mengisinya. Kekosongan itulah yang membuat pemandangan terasa luas dan tenang.
- Titik fokus: naga + cincin terdekat + matahari. Maksimal tiga hal yang "ramai" sekaligus.

### 2.7 Gerak: lambat, berat, dan punya massa

- Kamera punya kelembaman (pegas kritikal-damping, sama seperti sekarang). Naga bergerak seperti sutra.
- **Tidak ada gerak mendadak** — kecuali saat mati. Bahkan cincin "punch" hanya tumbuh beberapa persen.
- Kertas di dunia ikut bergerak: kumis naga melengkung tertiup angin, rumput bergoyang, balon naik pelan. *Hidup karena bergerak*, bukan karena detail.

### 2.8 Komposisi: kunci dari versi 2D, jangan dilepas

Komposisi yang sekarang sudah teruji — pertahankan di 3D:

- Naga di **±22% lebar layar** (bukan tengah) supaya medan di depan banyak terlihat.
- Garis horizon di **±75% tinggi layar** (sepertiga bawah).
- Kamera sedikit di atas dan di belakang naga, melihat ke titik **di depannya** (bukan ke naganya) — inilah yang membuat pemain bisa membaca medan.

---

## 3. Spesifikasi teknis 3D

### Kamera
- *Third-person chase*, di belakang & sedikit di atas naga. Sudut pandang ~55°.
- Kamera mengejar **titik di depan naga** (look-ahead ±250 unit), bukan naga itu sendiri.
- Pegas kritikal-damping dengan solusi analitik (sama seperti 2D) — konsisten di 60/120 fps.
- Kamera ikut miring (roll) sedikit saat naga mendaki/menukik, tapi **maksimal ±6°** supaya tidak memusingkan.
- Zoom melonggar saat kencang (FOV 55 → 68).

### Naga
- **Kepala** mesh low-poly: moncong, tanduk rusa, mata, kumis tipis (dua pita *ribbon* yang melengkung mengikuti angin).
- **Badan**: rantai ±40 ruas yang mengikuti jejak posisi kepala (teknik jejak yang sama seperti versi 2D!). Tiap ruas = satu tabung pendek atau satu pita yang dipilin.
- **Sirip punggung** sebagai barisan bilah tipis (paper-cut), bergetar halus.
- Kecepatan gelombang badan mengecil saat cepat (pelajaran dari 2D: jangan bergetar saat 6×).
- Warna: merah vermilion + emas, tetap jadi satu-satunya objek paling jenuh di frame.

### Medan
- Heightfield dari **rumus yang sudah ada** (`terrain.ts`), ditambah variasi arah lateral supaya terasa 3D (mis. gelombang silang dengan amplitudo lebih kecil).
- Mesh berpetak sedang (mis. 8×8 unit per petak) dengan **flat shading**.
- Warna per petak diambil dari **pita ketinggian** (4–5 pita), jadi terbaca seperti lapisan kertas bertingkat — bukan gradien halus.
- Di bawah permukaan diberi "tepi" berwarna lebih gelap (seperti potongan karton berlapis).
- Perlahan: **gelombang menurun** tetap jadi arah utama dunia.

### Latar (lapisan)
- 3–4 mesh siluet bukit (bentuk sederhana: pita gelombang yang diekstrusi sedikit), masing-masing dengan palet lebih pudar.
- Lapisan bergerak lebih lambat dari kamera (parallax asli, karena jaraknya beda) — otomatis didapat dari perspektif.
- Puing kuil (pagoda, torii, stupa) sebagai mesh low-poly **hanya di lapisan depan** — kalau di lapisan jauh, jadi titik kotor.

### Langit & cuaca
- **Kubah langit** (bola setengah) dengan vertex color gradien — biaya hampir nol.
- Matahari: cakram datar + halo sprite. Bulan untuk malam.
- Awan: **billboard datar bergaya potongan kertas** (bukan volume). 8–12 awan besar jauh lebih kuat daripada 100 awan kecil.
- Bintang: titik pada kubah langit, hanya muncul malam.
- Kabut: `scene.fog` dengan warna = warna kabut babak itu. Ini yang menyatukan semuanya.

### Umpan balik
- Cincin: torus emas, saat dilewati → cincin mengecil lalu meledak jadi ~20 percikan (titik, bukan mesh).
- **Satu kilau emas** yang cukup; jangan menumpuk efek.
- Skor/waktu babak: hanya satu kilau + teks melayang (sama seperti sekarang).
- Umpan balik warna: layar sedikit menghangat saat Aliran aktif. Murah, sangat terasa.

### Performa
- Semua objek berulang (batu, pohon, bilah rumput) memakai **InstancedMesh**.
- Geometri per-lapisan digabung (**merge**) supaya jumlah draw call < 100.
- Tanpa bayangan realtime, tanpa post-processing berat. Kalau perlu bloom, hanya untuk matahari + cincin.
- Batas piksel render: sama seperti sekarang, **anggaran ~2,6 juta piksel** (skala menyesuaikan ukuran jendela).
- Target: 60 fps di laptop biasa.

---

## 4. Catatan untuk repo ini

- Butuh **three.js** (±600 KB minified, ±150 KB gzip). Repo ini memakai `vite-plugin-singlefile`, jadi seluruh JS di-*inline* ke satu HTML — berkas akhir akan membesar dari ±270 KB ke ±900 KB. Masih wajar, tapi perlu diketahui.
- **Rumus medan tidak perlu ditulis ulang**: `src/game/terrain.ts` (`groundY`, `groundSlope`, `ridge`, `TERRAIN_BASE`) langsung dipakai sebagai tinggi heightfield dan bentuk siluet lapisan. Ini menghemat waktu paling banyak.
- **Pelajaran tuning dari versi 2D wajib dibawa**: pegas analitik, pengimbang maju, proyeksi ke arah permukaan, guncangan halus, dan anggaran piksel. Semua itu sudah "dibayar mahal" lewat pengukuran.
- Saran aman: kerjakan 3D di **entry terpisah** (mis. `src/three/`), jangan hapus versi 2D dulu — 2D-nya sudah terbukti jalan dan bisa jadi cadangan.
- Urutan pengerjaan yang saya sarankan: **(1) kamera + medan + naga bisa terbang**, lalu **(2) palet & kabut** (di sini baru mulai terlihat indah), lalu **(3) cincin & batu**, baru **(4) hiasan** (balon, burung, puing kuil). Kalau hiasan dikerjakan duluan, hasilnya akan terlihat ramai tapi tidak indah.

---

## 5. Prompt Siap Pakai

> Salin blok di bawah ini untuk membangun **Naga Angin versi 3D**.

```
Ubah game "Naga Angin" dari 2D (Canvas) menjadi 3D, TANPA mengubah jiwanya:
game terbang satu jari yang tenang tapi menegangkan. Referensi rasa visualnya
adalah game "Paper Sky": low-poly, warna yang berani tapi harmonis, lanskap
sederhana, atmosfer menenangkan, terasa seperti diorama kertas.

PRINSIP UTAMA (ini yang menentukan indah atau tidak, jangan dilanggar):
1. Kedalaman dibangun dari LAPISAN + KABUT, bukan dari detail.
2. Kecantikan dibangun dari PALET + SILUET, bukan dari tekstur.
3. Tanpa tekstur sama sekali. Warna dari vertex color / gradien, bukan berkas gambar.
4. 60-70% frame harus tetap langit kosong. Kekosongan itu bagian dari desain.

TEKNOLOGI
- three.js (boleh dengan react-three-fiber karena proyeknya React + Vite).
- Flat shading (permukaan rata terlihat jelas), backface culling.
- Semua grafik prosedural, tidak ada berkas model/tekstur eksternal.
- Objek berulang memakai InstancedMesh; geometri per-lapisan digabung sehingga
  jumlah draw call < 100. Target 60 fps di laptop biasa.

KAMERA (pertahankan komposisi versi 2D yang sudah teruji)
- Kamera third-person di belakang & sedikit di atas naga, FOV ~55 derajat.
- Kamera mengejar titik di DEPAN naga (look-ahead), bukan naga itu sendiri -
  supaya pemain bisa membaca medan yang akan datang.
- Naga duduk di sekitar 22% lebar layar (bukan tengah). Garis horizon sekitar
  75% tinggi layar (sepertiga bawah).
- Pegas kritikal-damping dengan solusi ANALITIK per frame (jangan Euler), supaya
  hasilnya sama pada 60/120 fps dan saat waktu frame goyah.
- Kamera ikut miring saat naga mendaki/menukik, maksimal 6 derajat.
- FOV melonggar dari 55 ke 68 saat melaju kencang.

KONTROL (identitas game ini - jangan diubah)
- Naga selalu maju sendiri. Pemain HANYA mengatur naik-turun dengan posisi Y mouse.
- Jangan menambahkan pitch/roll/yaw manual: itu akan mengubah game ini dari
  pengalaman zen menjadi flight simulator.
- Pakai kembali resep yang sudah teruji: pegas + pengimbang maju (feedforward)
  supaya naga menempel pada target kursor, dan saat menyentuh lereng kecepatan
  vertikal DIPROYEKSIKAN ke arah permukaan (jangan dipangkas jadi nol).

NAGA
- Kepala low-poly (maksimal ~200 segitiga): moncong, tanduk, mata, dan kumis
  berupa dua pita tipis yang melengkung tertiup angin.
- Badan berupa rantai sekitar 40 ruas yang MENGIKUTI JEJAK posisi kepala (teknik
  jejak yang sama seperti versi 2D), sehingga gerakannya seperti sutra.
- Sirip punggung sebagai barisan bilah tipis bergaya potongan kertas, bergetar halus.
- Gelombang badan mengecil saat kecepatan tinggi supaya tidak bergetar.
- Warna merah vermilion + emas: satu-satunya objek paling jenuh di seluruh frame.

MEDAN
- Heightfield bersudut rata (flat shaded) dari rumus gelombang yang sudah ada di
  src/game/terrain.ts (fungsi groundY/groundSlope/ridge): perbukitan yang mengalir
  MENURUN dengan lereng panjang & landai, tanjakan lebih ringkas, tidak pernah
  menjadi tebing dan tidak pernah terasa datar.
- Warna diambil dari 4-5 PITA KETINGGIAN (bukan gradien halus) supaya terbaca
  seperti kertas berlapis. Beri tepi lebih gelap di bawah permukaan seperti
  potongan karton bertingkat.
- Tambahkan variasi lateral kecil supaya terasa tiga dimensi.

LATAR & KEDALAMAN
- 3-4 lapisan mesh siluet bukit. Tiap lapisan yang lebih jauh: warna makin pudar,
  makin ke arah warna kabut, kontras makin turun.
- scene.fog dengan warna sesuai babak waktu (jarak pandang ~2000-3000 unit).
  Objek di luar jarak itu tidak digambar.
- Puing kuil (pagoda, torii, stupa) hanya di lapisan terdekat, jangan di lapisan jauh.

LANGIT & WAKTU
- Kubah langit dengan vertex color gradien. Matahari berupa cakram datar + halo,
  bulan untuk malam, bintang hanya muncul malam.
- Awan berupa billboard datar bergaya potongan kertas: 8-12 awan besar jauh lebih
  kuat daripada 100 awan kecil.
- Siklus 4 babak (fajar, siang, senja, malam) berdurasi 42 detik, transisi warna
  di-lerp halus. Tiap babak memakai PALET TERSENDIRI yang lengkap (langit atas,
  langit bawah, kabut, 3 nilai bukit, tanah, aksen).
- Batasan palet: maksimal 5 warna per babak, tidak ada hitam pekat (#000) dan
  tidak ada putih murni (#fff) - bayangan tergelap tetap berwarna.

CAHAYA
- Satu directional light (matahari) + satu hemisphere light. Selesai.
- TANPA bayangan realtime. Ganti dengan satu blob shadow lembut di bawah naga
  untuk membantu pemain membaca ketinggian.
- Rim light tipis di sisi yang menghadap matahari supaya siluet tidak menyatu
  dengan latar.

RINTANGAN (pertahankan variasi yang sudah ada)
- Gerbang batu (menara dari tanah + stalaktit dari langit), busur cincin yang
  mengajak menukik/memanjat, pulau terapung, hutan menara batu, stalaktit
  menggantung. Semua dari bentuk low-poly sederhana dengan sudut rata.
- Cincin emas berupa torus low-poly, ditaruh di jalur berisiko supaya setiap
  rintangan jadi keputusan: ambil poinnya atau lewat dengan aman.

EKONOMI POIN (jangan diubah)
- Cincin: menambah kombo Aliran, menambah bank poin, dan menaikkan kecepatan
  jelajah permanen. Bonus "Sempurna" kalau lewat persis di tengah.
- Terbang rendah dekat permukaan memberi "Selancar Angin" (poin per detik +
  kombo tiap 0,55 detik). Menyerempet tebing memberi "Terelak Berani".
- Jendela Aliran 3,2 detik; saat berakhir seluruh bank dicairkan DIKALIKAN kombo.
  Kalau menabrak, seluruh bank yang belum dicairkan HILANG.

GERAK & SUASANA (bagian yang membuat terasa hidup)
- Kertas di dunia ikut bergerak: kumis naga melengkung, rumput bergoyang,
  balon naik pelan, burung bangau melintas.
- Gerak harus lambat dan punya massa. Tidak ada aksen mendadak kecuali saat mati.
- Guncangan layar berupa osilasi yang meredup halus, BUKAN offset acak per frame.
- Efek "punch" saat melewati cincin hanya beberapa persen dan dikecilkan saat
  kecepatan tinggi (di kecepatan tinggi cincin terlewati 5-9 kali per detik).

UMPAN BALIK & SUARA
- Partikel hemat: satu kilau emas per kejadian, bukan ledakan besar.
- Layar sedikit menghangat saat Aliran aktif - umpan balik warna sangat murah tapi
  sangat terasa.
- Audio tetap prosedural WebAudio: pad ambient dengan filter yang terbuka seiring
  kecepatan, derau angin, dan bel pentatonik yang naik satu nada tiap cincin
  sehingga rantai kombo panjang berubah menjadi melodi.
- HUD minimal: jarak, skor, "ALIRAN xN" dengan bilah waktu tenggang dan nilai bank,
  meter kecepatan, serta penanda sasaran (di 3D ini lebih penting lagi karena
  membaca kedalaman lebih sulit).

TEKNIS
- Anggaran piksel render sekitar 2,6 juta: skala render menyesuaikan ukuran
  jendela (jangan dipatok ke devicePixelRatio, kalau tidak akan macet).
- Jangan membaca layout (getBoundingClientRect) di dalam event pointer.
- Semua efek gerak harus konsisten terhadap waktu frame, bukan per-frame.
- Kerjakan bertahap dan periksa di tiap tahap: (1) kamera + medan + naga bisa
  terbang, (2) palet + kabut, (3) cincin + batu, (4) hiasan. Jangan mengerjakan
  hiasan lebih dulu, hasilnya akan terlihat ramai tapi tidak indah.

URUTAN VISUAL YANG BENAR
Kalau baru sebagian selesai, yang harus sudah benar lebih dulu adalah: palet warna,
bentuk siluet medan, dan kabut. Ketiga hal itu yang membuatnya indah.
```

---

## 6. Ringkas: 10 aturan emas versi 3D

1. Maksimal 5 warna per babak; tidak ada hitam pekat & putih murni.
2. Kalau jadi siluet hitam, bentuknya masih harus terbaca.
3. Kedalaman = lapisan + kabut, bukan detail.
4. Tanpa tekstur; warna dari vertex/gradien.
5. Satu matahari + satu rim light, tanpa bayangan realtime.
6. 60–70% frame tetap langit kosong.
7. Semua bergerak lambat dan punya massa.
8. Kontrol tetap satu sumbu — jangan jadi flight sim.
9. Rumah pegang jejak tuning 2D: pegas analitik, pengimbang maju, proyeksi lereng, anggaran piksel.
10. Kerjakan palet & kabut lebih dulu; hiasan terakhir.
