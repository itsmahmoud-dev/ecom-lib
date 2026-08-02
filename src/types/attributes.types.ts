import z from "zod";
import { attributes } from "../db/schema";

export const addAttributeSchema = z.strictObject({
  key: z.string(),
  value: z.string(),
  parentId: z.uuid().nullish(),
  target: z.enum(attributes.target.enumValues).optional(),
  type: z.enum(attributes.type.enumValues).optional(),
  formatting: z.string().nullish(),
});
