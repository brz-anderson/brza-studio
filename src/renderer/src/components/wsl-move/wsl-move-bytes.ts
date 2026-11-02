/** Byte counts for the WSL move progress, split from wsl-move-copy.ts to keep it under max-lines. */
export function formatWslMoveBytes(bytes: number): string {
  // A small move read "0.0 MB of 0.0 MB".
  if (bytes < 1024) {
    return `${Math.max(0, Math.round(bytes))} B`
  }
  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} KB`
  }
  const megabytes = bytes / (1024 * 1024)
  return megabytes >= 10 ? `${Math.round(megabytes)} MB` : `${megabytes.toFixed(1)} MB`
}
