export function slugify(text: string) {
  return text.toLowerCase().replace(" ", "-").replace("/", "-");
}

export function extractKeyValue(str: string): [string, string] | [] {
  const match = str.match(/\(([^)]+)\)=\(([^)]+)\)/);
  return match ? [match[1] ?? "", match[2] ?? ""] : [];
}
