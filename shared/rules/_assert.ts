// shared/rules/_assert.ts
//
// Compile-time type-equality helpers for the drift guards in this package (rules-engine-design §B1).
// `Equals<A, B>` resolves to `true` only when A and B are mutually assignable; `AssertExact` is the
// declaration-site form — assigning `true` to it fails `tsc` the moment a hand-written interface and
// its zod-inferred mirror drift apart. Same pattern as shared/metrics/registry.schema.ts.

export type Equals<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

/** Usage: `const _ok: AssertExact<ZodInferred, HandWritten> = true;` — errors on drift. */
export type AssertExact<A, B> = Equals<A, B>;
