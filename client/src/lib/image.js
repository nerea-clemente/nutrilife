// Redimensiona en el móvil antes de subir: menos datos y sin metadatos EXIF (ubicación, etc.).
async function toCanvas(file, max) {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * scale);
  const h = Math.round(bmp.height * scale);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  c.getContext('2d').drawImage(bmp, 0, 0, w, h);
  bmp.close?.();
  return c;
}

const blob = (c, q) => new Promise((r) => c.toBlob(r, 'image/jpeg', q));

export async function prepareImage(file) {
  const full = await blob(await toCanvas(file, 1600), 0.84);
  const thumb = await blob(await toCanvas(file, 420), 0.78);
  return { full, thumb };
}
