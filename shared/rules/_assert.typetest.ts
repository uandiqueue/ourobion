// shared/rules/_assert.typetest.ts
//
// Compile-time-only self-test for the drift-guard identity form (A5). Not a runtime test — it is
// never executed by `node --test`; it exists so `tsc` fails if the `Equals` guard ever weakens back
// to mutual assignability. Included by shared/tsconfig.json via `rules/**/*.ts`.
//
// The point of the conditional-generic identity form is that `Equals<any, T>` is `false` — an `any`
// that leaks into a zod inference no longer silently satisfies the guard. The expect-error lines
// below assert exactly that failure: if the mutual-assignability form (`[A] extends [B] ? …`) were
// restored, `Equals<any, …>` would become `true`, the assignment would type-check, and the
// now-unused expect-error directive would itself become a `tsc` error.

import type { Equals } from './_assert';

type Widened = { a: string };

// An `any`-degraded type must NOT satisfy the exact-identity guard (this is the A5 fix).
// @ts-expect-error — `Equals<any, Widened>` is `false`; `true` is not assignable to it.
const _anyRejected: Equals<any, Widened> = true;

// Optional-property vs `| undefined` drift must also be caught by the identity form.
// @ts-expect-error — `{ a?: string }` and `{ a: string | undefined }` are NOT identical.
const _optionalDriftRejected: Equals<{ a?: string }, { a: string | undefined }> = true;

// A genuinely identical pair still passes — the guard is not vacuously strict.
const _identityHolds: Equals<Widened, { a: string }> = true;

void _anyRejected;
void _optionalDriftRejected;
void _identityHolds;
