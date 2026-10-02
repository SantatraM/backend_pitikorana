import sharp from "sharp";

export async function processImageWithSharp(input) {
  if (!(input.bytes instanceof Uint8Array)) {
    throw new Error("Entrée image Node invalide");
  }

  const image = await sharp(input.bytes)
    .resize({
      width: 1200,
      height: 1200,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: 80 })
    .toBuffer();

  // No sharp.rotate() here: orientation handling must remain aligned with the
  // current Cloudflare Images pipeline before it is introduced deliberately.
  return new Uint8Array(image);
}
