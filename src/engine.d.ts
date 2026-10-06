declare module "snowflake/fetch.js" {
  // lang -> part -> list of variant texts
  export type Variants = Record<string, Record<string, string[]>>;
  export type Analysis = {
    analysis: Record<string, Record<string, number>>; // lang -> part -> number of variants
    error: Record<string, Record<string, number | false>>; // diff with max, false = missing
    max: Record<string, number>;
    variants: Record<string, number>;
    total: Record<string, number>;
    all: { empty: string[]; single: string[]; subject?: number };
  };

  export function fetchCampaign(
    name: string | undefined,
    opts?: { local?: boolean; save?: boolean },
  ): Promise<{ analysis: Analysis; content: Variants }>;
}

declare module "snowflake/upload.js" {
  import type { Variants } from "snowflake/fetch.js";
  // one KV value per language, returns the keys written
  export function upload(
    name: string | undefined,
    variants: Variants,
  ): Promise<string[]>;
}
