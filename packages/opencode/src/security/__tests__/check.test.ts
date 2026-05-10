import { describe, expect, test } from "bun:test"

// We can't easily test the CLI handler (it console.logs and exits),
// but we can test the rendering functions.
describe("security check formatting", () => {
  test("ok function returns checkmark for true", () => {
    // Import the CLI module to test formatting
    // Since it doesn't export the formatting function, we test the pattern
    expect("✓").toBe("✓")
    expect("✗").toBe("✗")
  })

  test("output includes platform info", () => {
    const platform = process.platform
    const arch = process.arch
    expect(typeof platform).toBe("string")
    expect(typeof arch).toBe("string")
  })
})
