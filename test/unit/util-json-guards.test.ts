// SPDX-License-Identifier: MIT
//
// Unit tests for src/util/json-guards.ts. The module centralizes the
// type-narrowed JSON readers and guards that were previously duplicated
// across azure/review/provider/sonar modules. Every helper is exercised
// on its missing/non-string/non-number/non-array/non-object branch so
// the contract is locked for any future consumer.

import { describe, expect, it } from "vitest";

import {
  isPositiveSafeInteger,
  isRecord,
  isSafeInteger,
  isUnknownArray,
  readArrayField,
  readJsonArray,
  readJsonRecord,
  readRecordField,
  readSafeIntegerField,
  readSafeIntegerFieldOrThrow,
  readStringField,
  readStringFieldOrThrow,
  tryParseJson,
} from "../../src/util/json-guards.js";

describe("isRecord", () => {
  it.each([
    ["plain object", { a: 1 }, true],
    ["empty object", {}, true],
    ["nested object", { a: { b: 2 } }, true],
    ["array (rejected)", [1, 2, 3], false],
    ["null (rejected)", null, false],
    ["string (rejected)", "string", false],
    ["number (rejected)", 42, false],
    ["boolean (rejected)", true, false],
    ["undefined (rejected)", undefined, false],
  ] as const)("returns %s -> %s", (_label, value, expected) => {
    expect(isRecord(value)).toBe(expected);
  });
});

describe("isUnknownArray", () => {
  it.each([
    ["plain array", [1, 2, 3], true],
    ["empty array", [], true],
    ["array of mixed types", [1, "x", null, {}], true],
    ["object (rejected)", { a: 1 }, false],
    ["null (rejected)", null, false],
    ["string (rejected)", "string", false],
    ["undefined (rejected)", undefined, false],
  ] as const)("returns %s -> %s", (_label, value, expected) => {
    expect(isUnknownArray(value)).toBe(expected);
  });
});

describe("isSafeInteger / isPositiveSafeInteger", () => {
  it("isSafeInteger accepts safe integers including zero and negatives", () => {
    expect(isSafeInteger(0)).toBe(true);
    expect(isSafeInteger(-1)).toBe(true);
    expect(isSafeInteger(Number.MAX_SAFE_INTEGER)).toBe(true);
    expect(isSafeInteger(Number.MIN_SAFE_INTEGER)).toBe(true);
  });

  it.each([
    ["NaN", NaN],
    ["Infinity", Infinity],
    ["-Infinity", -Infinity],
    ["non-integer float", 1.5],
    ["string", "1"],
    ["boolean", true],
    ["null", null],
    ["undefined", undefined],
    ["object", {}],
  ] as const)("isSafeInteger rejects %s", (_label, value) => {
    expect(isSafeInteger(value)).toBe(false);
  });

  it("isPositiveSafeInteger accepts strictly positive safe integers", () => {
    expect(isPositiveSafeInteger(1)).toBe(true);
    expect(isPositiveSafeInteger(Number.MAX_SAFE_INTEGER)).toBe(true);
  });

  it.each([
    ["zero", 0],
    ["negative", -1],
    ["NaN", NaN],
    ["Infinity", Infinity],
    ["float", 1.5],
    ["string", "1"],
  ] as const)("isPositiveSafeInteger rejects %s", (_label, value) => {
    expect(isPositiveSafeInteger(value)).toBe(false);
  });
});

describe("readStringField", () => {
  it("returns the value when the key holds a string", () => {
    expect(readStringField({ name: "ada" }, "name")).toBe("ada");
  });

  it("returns null when the key is missing", () => {
    expect(readStringField({}, "name")).toBeNull();
  });

  it.each([
    ["number", { x: 42 }],
    ["boolean", { x: true }],
    ["null", { x: null }],
    ["array", { x: [] }],
    ["object", { x: {} }],
    ["undefined", { x: undefined }],
  ] as const)("returns null when the value is %s (not a string)", (_label, record) => {
    expect(readStringField(record, "x")).toBeNull();
  });
});

describe("readStringFieldOrThrow", () => {
  it("returns the value when the key holds a string", () => {
    expect(readStringFieldOrThrow({ name: "ada" }, "name")).toBe("ada");
  });

  it("uses the custom label in the thrown TypeError when missing", () => {
    expect(() => readStringFieldOrThrow({}, "name", "userName")).toThrowError(
      TypeError,
    );
    expect(() => readStringFieldOrThrow({}, "name", "userName")).toThrow(
      /Expected field 'userName' to be a string/,
    );
  });

  it("falls back to the key name when no label is supplied", () => {
    expect(() => readStringFieldOrThrow({}, "name")).toThrow(
      /Expected field 'name' to be a string/,
    );
  });

  it.each([
    ["number", { x: 42 }, "number"],
    ["boolean", { x: true }, "boolean"],
    ["null", { x: null }, "object"],
    ["array", { x: [] }, "object"],
    ["object", { x: {} }, "object"],
    ["undefined", { x: undefined }, "undefined"],
  ] as const)(
    "throws TypeError when the value is %s (typeof = %s)",
    (_label, record, expectedType) => {
      expect(() => readStringFieldOrThrow(record, "x")).toThrow(
        new RegExp(`to be a string, received: ${expectedType}`),
      );
    },
  );
});

describe("readSafeIntegerField", () => {
  it("returns the value when the key holds a safe integer", () => {
    expect(readSafeIntegerField({ count: 0 }, "count")).toBe(0);
    expect(readSafeIntegerField({ count: 42 }, "count")).toBe(42);
    expect(readSafeIntegerField({ count: -7 }, "count")).toBe(-7);
  });

  it("returns null when the key is missing", () => {
    expect(readSafeIntegerField({}, "count")).toBeNull();
  });

  it.each([
    ["NaN", { x: NaN }],
    ["Infinity", { x: Infinity }],
    ["-Infinity", { x: -Infinity }],
    ["non-integer float", { x: 1.5 }],
    ["string", { x: "1" }],
    ["boolean", { x: true }],
    ["null", { x: null }],
    ["object", { x: {} }],
  ] as const)("returns null when the value is %s", (_label, record) => {
    expect(readSafeIntegerField(record, "x")).toBeNull();
  });
});

describe("readSafeIntegerFieldOrThrow", () => {
  it("returns the value when the key holds a safe integer", () => {
    expect(readSafeIntegerFieldOrThrow({ count: 42 }, "count")).toBe(42);
  });

  it("uses the custom label in the thrown TypeError when missing", () => {
    expect(() => readSafeIntegerFieldOrThrow({}, "count", "lineNumber")).toThrow(
      /Expected field 'lineNumber' to be a number/,
    );
  });

  it("falls back to the key name when no label is supplied", () => {
    expect(() => readSafeIntegerFieldOrThrow({}, "count")).toThrow(
      /Expected field 'count' to be a number/,
    );
  });

  it.each([
    ["NaN", { x: NaN }],
    ["Infinity", { x: Infinity }],
    ["float", { x: 1.5 }],
    ["string", { x: "1" }],
    ["null", { x: null }],
    ["undefined", { x: undefined }],
  ] as const)("throws TypeError when the value is %s", (_label, record) => {
    expect(() => readSafeIntegerFieldOrThrow(record, "x")).toThrowError(TypeError);
  });
});

describe("readArrayField", () => {
  it("returns the array when the key holds one", () => {
    const arr = [1, "x", null];
    expect(readArrayField({ list: arr }, "list")).toBe(arr);
  });

  it("returns null when the key is missing", () => {
    expect(readArrayField({}, "list")).toBeNull();
  });

  it.each([
    ["object", { x: { a: 1 } }],
    ["string", { x: "string" }],
    ["number", { x: 42 }],
    ["boolean", { x: true }],
    ["null", { x: null }],
    ["undefined", { x: undefined }],
  ] as const)("returns null when the value is %s", (_label, record) => {
    expect(readArrayField(record, "x")).toBeNull();
  });
});

describe("readRecordField", () => {
  it("returns the inner record when both the value and the key are objects", () => {
    const inner = { sub: "value" };
    expect(readRecordField({ nested: inner }, "nested")).toBe(inner);
  });

  it("returns null when the outer value is not a record", () => {
    expect(readRecordField(null, "nested")).toBeNull();
    expect(readRecordField("string", "nested")).toBeNull();
    expect(readRecordField([1, 2, 3], "nested")).toBeNull();
  });

  it("returns null when the key is missing", () => {
    expect(readRecordField({ a: 1 }, "nested")).toBeNull();
  });

  it("returns null when the inner value is not a record (array rejected)", () => {
    expect(readRecordField({ nested: [1, 2] }, "nested")).toBeNull();
  });
});

describe("readJsonRecord / readJsonArray / tryParseJson", () => {
  it("readJsonRecord returns the parsed object on a valid JSON object body", () => {
    const result = readJsonRecord('{"a":1,"b":"x"}');
    expect(result).toEqual({ a: 1, b: "x" });
  });

  it("readJsonRecord returns null on an empty body", () => {
    expect(readJsonRecord("")).toBeNull();
  });

  it("readJsonRecord returns null on a syntactically-invalid body", () => {
    expect(readJsonRecord("not json")).toBeNull();
  });

  it("readJsonRecord returns null when the parsed value is not an object (array rejected)", () => {
    expect(readJsonRecord("[1,2,3]")).toBeNull();
  });

  it("readJsonArray returns the parsed array on a valid JSON array body", () => {
    const result = readJsonArray("[1,2,3]");
    expect(result).toEqual([1, 2, 3]);
  });

  it("readJsonArray returns null on an empty body", () => {
    expect(readJsonArray("")).toBeNull();
  });

  it("readJsonArray returns null on a syntactically-invalid body", () => {
    expect(readJsonArray("not json")).toBeNull();
  });

  it("readJsonArray returns null when the parsed value is not an array (object rejected)", () => {
    expect(readJsonArray('{"a":1}')).toBeNull();
  });

  it("tryParseJson returns the parsed value on success", () => {
    expect(tryParseJson('{"a":1}')).toEqual({ a: 1 });
    expect(tryParseJson("[1,2]")).toEqual([1, 2]);
    expect(tryParseJson('"hello"')).toBe("hello");
    expect(tryParseJson("42")).toBe(42);
    expect(tryParseJson("null")).toBeNull();
    expect(tryParseJson("true")).toBe(true);
  });

  it("tryParseJson returns undefined on a parse failure (never throws)", () => {
    expect(tryParseJson("not json")).toBeUndefined();
    expect(tryParseJson("{")).toBeUndefined();
  });
});
