import { joinAnnotations, stateForError } from "../../../data/report-runtime.js";

export const numericBoundaryCases = Object.freeze([
  { stored: "12.340", expected: 12.34 },
  { stored: "-0.125", expected: -0.125 },
  { stored: null, expected: null },
]);

export function exerciseInfrastructure(annotationArtifact) {
  const rows = [{ period: "2025-01-01", value: 12.34 }];
  return {
    joined: joinAnnotations(rows, annotationArtifact, { anchorColumn: "period", publicOnly: false }),
    schemaState: stateForError({ code: "schema-incompatibility" }),
    engineState: stateForError({ code: "shared-engine-failure" }),
  };
}
