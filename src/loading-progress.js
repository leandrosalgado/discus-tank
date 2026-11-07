export function formatLoadingProgress(loaded, total) {
  if (!Number.isFinite(loaded) || !Number.isFinite(total)
      || loaded < 0 || total <= 0 || loaded > total) {
    return 'Loading geometry...';
  }
  return `${Math.round(loaded / total * 100)}% loaded`;
}
