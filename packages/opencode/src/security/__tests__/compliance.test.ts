import { describe, expect, test } from "bun:test"
import { FRAMEWORKS } from "../compliance/frameworks"
import { generateReport } from "../compliance/generator"
import { formatMarkdown, formatJSON } from "../compliance/markdown"

describe("framework mappings", () => {
  test("SOC2 has 5 controls", () => {
    const soc2 = FRAMEWORKS.find((f) => f.framework === "soc2")
    expect(soc2).toBeDefined()
    expect(soc2!.controls.length).toBe(5)
  })

  test("ISO 27001 has 4 controls", () => {
    const iso = FRAMEWORKS.find((f) => f.framework === "iso27001")
    expect(iso).toBeDefined()
    expect(iso!.controls.length).toBe(4)
  })

  test("HIPAA has 4 controls", () => {
    const hipaa = FRAMEWORKS.find((f) => f.framework === "hipaa")
    expect(hipaa).toBeDefined()
    expect(hipaa!.controls.length).toBe(4)
  })

  test("FedRAMP has 4 controls", () => {
    const fed = FRAMEWORKS.find((f) => f.framework === "fedramp")
    expect(fed).toBeDefined()
    expect(fed!.controls.length).toBe(4)
  })

  test("all frameworks defined", () => {
    expect(FRAMEWORKS.length).toBe(4)
  })
})

describe("report generator", () => {
  test("generates SOC2 report with correct number of controls", () => {
    const report = generateReport({ framework: "soc2" })
    expect(report.controls.length).toBe(5)
    expect(report.metadata.framework).toBe("soc2")
  })

  test("generates all-frameworks report", () => {
    const report = generateReport({})
    expect(report.controls.length).toBe(17)
    expect(report.metadata.framework).toBe("all")
  })

  test("report summary has correct counts", () => {
    const report = generateReport({ framework: "soc2" })
    expect(report.summary.totalControls).toBe(5)
    expect(report.summary.evidenced + report.summary.partial + report.summary.gap).toBe(5)
  })

  test("report includes disclaimer", () => {
    const report = generateReport({})
    expect(report.metadata.disclaimer).toContain("not a compliance certification tool")
  })

  test("time range filtering works", () => {
    const now = Date.now()
    const report = generateReport({ startTime: now - 86400000, endTime: now })
    expect(report.metadata.startTime).toBe(now - 86400000)
    expect(report.metadata.endTime).toBe(now)
  })
})

describe("formatters", () => {
  test("markdown formatter produces valid output", () => {
    const report = generateReport({ framework: "soc2" })
    const md = formatMarkdown(report)
    expect(md).toContain("# LockedCode Compliance Report")
    expect(md).toContain("SOC2")
    expect(md).toContain("CC6.1")
    expect(md).toContain("| Metric |")
  })

  test("JSON formatter produces parseable output", () => {
    const report = generateReport({ framework: "hipaa" })
    const json = formatJSON(report)
    const parsed = JSON.parse(json)
    expect(parsed.metadata.framework).toBe("hipaa")
    expect(parsed.controls.length).toBe(4)
    expect(parsed.summary).toBeDefined()
  })
})
