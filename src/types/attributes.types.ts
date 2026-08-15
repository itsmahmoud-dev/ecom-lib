import z from "zod";
import { attributes } from "../db/schema";

export const attributeIdSchema = z.uuid();

export const addAttributeParamSchema = z.strictObject({
  key: z.string(),
  value: z.string(),
  parentId: z.uuid().nullish(),
  target: z.enum(attributes.target.enumValues).optional(),
  type: z.enum(attributes.type.enumValues).optional(),
  formatting: z.string().nullish(),
});

export const removeAttributeParamSchema = attributeIdSchema;
