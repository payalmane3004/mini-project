import test from "node:test";
import assert from "node:assert/strict";
import { validateInspectionReport } from "./inspectionReport.js";

const validReport = { sourceText: [{ text: "Library", type: "TEXT" }], modelSpaceEntityCount: 3, rendererRenderedEntityCounts: { TEXT: 2, LINE: 1 } };

test("accepts well-formed inspection reports, including empty annotations", () => {
  assert.equal(validateInspectionReport(validReport), validReport);
  assert.deepEqual(validateInspectionReport({ ...validReport, sourceText: [] }).sourceText, []);
});

test("rejects malformed reports before the inspector renders them", () => {
  for (const report of [null, { ...validReport, sourceText: {} }, { ...validReport, sourceText: [{ text: 12 }] },
    { ...validReport, modelSpaceEntityCount: "many" }, { ...validReport, rendererRenderedEntityCounts: { LINE: NaN } }]) {
    assert.throws(() => validateInspectionReport(report), TypeError);
  }
});
