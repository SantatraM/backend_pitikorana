export async function processImageWithCloudflare(input, images) {
  if (!images || typeof input.stream !== "function") {
    throw new Error("Processeur Cloudflare Images indisponible");
  }

  const response = (
    await images
      .input(input.stream())
      .transform({ width: 1200, height: 1200, fit: "scale-down" })
      .output({ format: "image/webp", quality: 80 })
  ).response();

  return new Uint8Array(await response.arrayBuffer());
}
