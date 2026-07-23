import z from "zod";

export const collectionId = z.uuid({
  error: (issue) =>
    issue.input
      ? "That doesn't look like a valid collection"
      : "Select a collection",
});

export const productIds = z
  .array(
    z.uuid({
      error: (issue) =>
        issue.input
          ? "That doesn't look like a valid product"
          : "Each product must be specified",
    }),
  )
  .min(1, "Select at least one product");

export const addCollectionParamSchema = z.string(
  "Please enter a collection name",
);

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
