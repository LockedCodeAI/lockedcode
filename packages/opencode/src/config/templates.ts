import { Schema } from "effect"
import { zod } from "@opencode-ai/core/effect-zod"
import { withStatics } from "@opencode-ai/core/schema"

export const Info = Schema.Struct({
  urls: Schema.optional(Schema.Array(Schema.String)).annotate({
    description: "URLs to fetch templates from (must serve an index.json listing template files)",
  }),
}).pipe(withStatics((s) => ({ zod: zod(s) })))

export type Info = Schema.Schema.Type<typeof Info>

export * as ConfigTemplates from "./templates"
