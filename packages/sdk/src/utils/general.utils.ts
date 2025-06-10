export function uid() {
  return (Date.now() + Math.random())
    .toString(36)
    .replace(".", "")
    .toUpperCase();
}
