export function slugify(text: string | string[]): string {
  if (Array.isArray(text)) {
    return text.map((t) => slugify(t)).join("-");
  }

  return text
    .toLowerCase()
    .replaceAll(" ", "-")
    .replaceAll("/", "-")
    .replaceAll(",", "-");
}

export function extractKeyValue(str: string): [string, string] | [] {
  const match = str.match(/\(([^)]+)\)=\(([^)]+)\)/);
  return match ? [match[1] ?? "", match[2] ?? ""] : [];
}

export function hashPassword(password: string) {
  return Bun.password.hashSync(password, {
    algorithm: "argon2id",
    memoryCost: 65536,
    timeCost: 3,
  });
}

export function verifyPassword(password: string, hashedPassword: string) {
  return Bun.password.verifySync(password, hashedPassword, "argon2id");
}
