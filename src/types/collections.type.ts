import z from "zod";

export const collectionId = z.uuid();

export const productIds = z.array(z.uuid()).min(1);

export const addCollectionParamSchema = z.strictObject({
  name: z.string(),
  productIds: z.array(z.uuid()).min(1),
});

export const updateCollectionParamsSchema = z.strictObject({
  id: collectionId,
  name: z.string().optional(),
  productsToAdd: z.array(z.uuid()).min(1).optional(),
  productsToRemove: z.array(z.uuid()).min(1).optional(),
});

export const deleteCollectionParamSchema = collectionId;
