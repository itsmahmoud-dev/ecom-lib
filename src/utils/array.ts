export function diffArrays<T>(
  original: T[],
  edited: T[],
): { added: T[]; removed: T[] } {
  const originalSet = new Set(original);
  const editedSet = new Set(edited);

  return {
    added: [...editedSet].filter((item) => !originalSet.has(item)),
    removed: [...originalSet].filter((item) => !editedSet.has(item)),
  };
}
