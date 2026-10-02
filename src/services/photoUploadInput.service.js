function isUploadMetadata(value) {
  return (
    value &&
    typeof value.type === "string" &&
    typeof value.size === "number" &&
    Number.isFinite(value.size)
  );
}

// This shape deliberately exposes only what the shared photo pipeline needs.
// Runtime-specific objects (a Web File or a Multer file) stay at the edge.
export function normalizeWebPhotoFile(file) {
  if (!isUploadMetadata(file) || typeof file.stream !== "function") {
    return null;
  }

  return {
    name: typeof file.name === "string" ? file.name : "photo",
    type: file.type,
    size: file.size,
    stream: () => file.stream(),
  };
}

export function normalizeMemoryPhotoFile(file) {
  if (
    !file ||
    typeof file.mimetype !== "string" ||
    typeof file.size !== "number" ||
    !Number.isFinite(file.size) ||
    !(file.buffer instanceof Uint8Array)
  ) {
    return null;
  }

  return {
    name: typeof file.originalname === "string" ? file.originalname : "photo",
    type: file.mimetype,
    size: file.size,
    bytes: new Uint8Array(file.buffer),
  };
}
