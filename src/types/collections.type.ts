import z from "zod";

export const collectionId = z.uuid();

export const productIds = z.array(z.uuid()).min(1);

export const addCollectionParamSchema = z.string();

export const updateCollectionParamsSchema = z.strictObject({
  id: collectionId,
  name: addCollectionParamSchema,
});

export const addRemoveProductToCollectionParamsSchema = z.strictObject({
  id: collectionId,
  productIds,
});

export const removeProductFromCollectionParamsSchema = z.strictObject({
  id: collectionId,
  productIds,
});

export const deleteCollectionParamSchema = collectionId;
