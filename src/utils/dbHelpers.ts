import { NotFoundError } from "./errors";

export async function insertOneOrThrow<T>(query: Promise<T[]>, entity: string) {
  const [result] = await query;
  if (!result) throw new Error(`Error inserting ${entity}`);
  return result;
}

export async function insertManyOrThrow<T>(query: Promise<T[]>, entity: string) {
  const result = await query;
  if (result.length === 0) throw new Error(`Error inserting ${entity}`);
  return result;
}

export async function mutateOneOrThrow<T>(
  query: Promise<T[]>,
  entity: string,
  context?: string,
) {
  const [result] = await query;
  if (!result) throw new NotFoundError(entity, context);
  return result;
}

export async function mutateManyOrThrow<T>(
  query: Promise<T[]>,
  entity: string,
  context?: string,
) {
  const result = await query;
  if (result.length === 0) throw new NotFoundError(entity, context);
  return result;
}
