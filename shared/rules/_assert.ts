// shared/rules/_assert.ts
//
// Compile-time type-equality helpers for the drift guards in this package (rules-engine-design §B1).
// `Equals<A, B>` resolves to `true` only when A and B are STRUCTURALLY IDENTICAL; `AssertExact` is the
// declaration-site form — assigning `true` to it fails `tsc` the moment a hand-written interface and
// its zod-inferred mirror drift apart. Same pattern as shared/metrics/registry.schema.ts.
//
// The conditional-generic identity form (not `[A] extends [B] ? [B] extends [A]` mutual assignability)
// is used so `Equals<any, T>` is `false` and optional-property-vs-`| undefined` drift is caught (A5):
// a zod inference that degrades to `any` fails the guard rather than silently passing it.

export type Equals<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2)
  ? true
  : false;

/** Usage: `const _ok: AssertExact<ZodInferred, HandWritten> = true;` — errors on drift. */
export type AssertExact<A, B> = Equals<A, B>;
