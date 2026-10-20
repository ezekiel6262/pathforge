export function createReport(input, validation, lifecycle) {
  return {
    reportVersion: "pathforge-preflight/0.1",
    reportId: crypto.randomUUID(),
    generatedAt: new Date().toISOString(),
    environment: "testnet",
    project: {
      name: input.projectName || null,
      tokenAddress: input.tokenAddress || null,
      ticker: validation.derived.ticker
    },
    status: validation.valid ? "READY" : "BLOCKED",
    summary: validation.summary,
    derived: validation.derived,
    lifecycle,
    blockers: validation.checks.filter((item) => item.severity === "blocker" && !item.passed),
    warnings: validation.checks.filter((item) => item.severity === "warning" && !item.passed),
    passedChecks: validation.checks.filter((item) => item.passed).map((item) => item.id),
    disclaimer: "Independent PathForge preflight. This is not an official Ascend qualification, listing guarantee, signature, or transaction submission."
  };
}
