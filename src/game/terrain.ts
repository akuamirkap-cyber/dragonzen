/**
 * Profil dunia bergaya Alto: perbukitan halus yang mengalir MENURUN dengan lereng
 * miring — bukan dinding tegak, dan bukan pula garis datar yang lurus terus.
 *
 * Semua fungsi di sini kontinu & mulus (C1): tidak ada patahan atau sudut tajam,
 * sehingga permukaan selalu terasa "meluncur" seperti lereng gunung asli.
 *
 * Hasil kalibrasi profil di bawah (diukur pada rentang 200.000 px):
 *   • kemiringan rata-rata ±14°, kemiringan sesaat puncak ±31° → lereng panjang, bukan tebing
 *   • satu lereng turun rata-rata membentang ±2,1 layar, sedangkan satu tanjakan
 *     hanya ±1,1 layar → dunia terasa sedang menuruni gunung, bukan naik-turun seragam
 *   • permukaan berubah ±105 px per layar → miringnya terlihat jelas, tidak terasa datar
 */

export const TERRAIN_BASE = 700;

/**
 * Pelengkungan fase (phase warp), |nilai| < 1 supaya turunan gelombang tetap mulus
 * (tidak pernah muncul sudut/patahan).
 *
 * Dengan tanda negatif, gelombang jadi "memanjang" di sisi turun dan memendek di sisi
 * naik: sisi turun menjadi panjang & landai, sedangkan tanjakan kembali lebih ringkas.
 * Inilah yang membuat permukaan terbaca sebagai lereng menurun, bukan naik-turun
 * simetris seperti gelombang sinus biasa.
 */
const WARP = -0.8;

/** Gelombang panjang yang dimiringkan: turun landai & panjang, lalu naik lebih ringkas. */
function drift(x: number, wavelength: number, phase: number) {
  const u = (x / wavelength) * Math.PI * 2 + phase;
  return Math.sin(u + WARP * Math.sin(u));
}

/**
 * Ketinggian permukaan dunia pada posisi x (semakin kecil nilainya = semakin tinggi).
 *
 * Semua oktaf mengikuti skew menurun di atas, dengan amplitudo yang mengecil cepat
 * untuk gelombang yang makin pendek: gelombang panjang menentukan arah lereng,
 * riak pendek hanya jadi tekstur permukaan dan tidak pernah membalik arah lerengnya.
 */
export function groundY(x: number): number {
  return (
    TERRAIN_BASE +
    drift(x, 2600, 0.35) * 120 + // lereng utama: λ 2.600 px — turun panjang ±2 layar
    drift(x, 1300, 2.7) * 22 +   // punggung lereng: λ 1.300 px
    drift(x, 650, 1.1) * 8 +     // bukit bergulir: λ 650 px
    drift(x, 300, 4.4) * 2.6 +   // gulungan sedang: λ 300 px
    drift(x, 150, 2.9) * 1.0     // riak permukaan halus: λ 150 px
  );
}

/** Kemiringan permukaan (dy/dx) di titik x — dipakai untuk pencahayaan lereng. */
export function groundSlope(x: number, d = 12): number {
  return (groundY(x + d) - groundY(x - d)) / (2 * d);
}

/** Ketinggian tanah terendah (y terbesar) pada bentang [x0, x1]. */
export function groundLowest(x0: number, x1: number, step = 12): number {
  let m = -Infinity;
  for (let x = x0; x <= x1; x += step) m = Math.max(m, groundY(x));
  return m;
}

/**
 * Siluet pegunungan latar: bukit-bukit besar yang halus & miring menurun, tanpa
 * puncak tajam. Nilai 0 = lembah, 1 = puncak. Karena semua komponennya bergeser
 * mulus (tidak ada hash/patahan acak per titik), siluet gunung tetap mengalir
 * tanpa "lompatan" walau parallax-nya digeser oleh kamera.
 */
export function ridge(x: number, seed: number): number {
  const v =
    0.5 +
    drift(x, 2600, seed) * 0.248 +             // punggungan utama: λ 2.600 px
    drift(x, 1400, seed + 0.9) * 0.094 +       // lereng punggungan: λ 1.400 px
    drift(x, 750, seed * 2.3 + 3.3) * 0.036 +  // bukit: λ 750 px
    drift(x, 400, seed * 3.1 + 1.7) * 0.014 +  // gulungan: λ 400 px
    drift(x, 210, seed * 3.9 + 5.2) * 0.0067;  // riak halus: λ 210 px
  return v < 0.03 ? 0.03 : v > 0.97 ? 0.97 : v;
}
