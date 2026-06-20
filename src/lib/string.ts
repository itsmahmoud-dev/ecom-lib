export function slugify(text: any) {
  if (typeof text === "string") {
    return text.toLowerCase().replaceAll(" ", "-").replaceAll("/", "-");
  }
  return String(text).toLowerCase().replaceAll(" ", "-").replaceAll("/", "-");
}

export function extractKeyValue(str: string): [string, string] | [] {
  const match = str.match(/\(([^)]+)\)=\(([^)]+)\)/);
  return match ? [match[1] ?? "", match[2] ?? ""] : [];
}
