// Ambient declarations for the .mjs helper so TypeScript can type-check
// the unit test that imports its exports. The runtime file is a vanilla
// ES module — there is no separate implementation to type-check; this
// file describes the exported surface for the test.
export function startPublish(): {
  readonly authUrl: string;
  readonly doneUrl: string;
};
export function findLastJsonObject(out: string): null | {
  readonly error?: { readonly code?: string; readonly authUrl?: string; readonly doneUrl?: string; readonly [key: string]: unknown };
  readonly [key: string]: unknown;
};
