import z from "zod";

export const collectionId = z.uuid();

export const productIds = z.array(z.uuid()).min(1);

export const addCollectionParamSchema = z.string();

export const updateCollectionParamSchema = z.strictObject({
  id: collectionId,
  name: addCollectionParamSchema,
});

export const addRemoveProductToCollectionParamSchema = z.strictObject({
  id: collectionId,
  productIds,
});

export const removeProductFromCollectionParamSchema = z.strictObject({
  id: collectionId,
  productIds,
});

export const deleteCollectionParamSchema = collectionId;
