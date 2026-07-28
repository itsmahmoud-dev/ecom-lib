import z from "zod";
import { attributes } from "../db/schema";

export const addAttributeSchema = z.strictObject({
  key: z.string("Please enter a key"),

  value: z.string("Please enter a value"),

  parentId: z.uuid("That doesn't look like a valid attribute").nullish(),

  target: z
    .enum(attributes.target.enumValues, "Please select a valid target")
    .optional(),

  type: z
    .enum(attributes.type.enumValues, "Please select a valid type")
    .optional(),

  formatting: z.string().nullish(),
});
