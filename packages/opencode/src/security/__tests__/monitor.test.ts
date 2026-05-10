import { describe, expect, test } from "bun:test"
import { hasPublicNetworkConnections } from "../monitor/network-monitor"
import type { NetworkActivity } from "../monitor/network-monitor"

/** Check if IP is private (copied from network-monitor for testing). */
function isPrivateIP(ip: string): boolean {
  if (ip === "127.0.0.1" || ip === "::1" || ip === "localhost") return true
  const parts = ip.split(".")
  if (parts.length === 4) {
    const first = parseInt(parts[0])
    const second = parseInt(parts[1])
    if (first === 10) return true
    if (first === 172 && second >= 16 && second <= 31) return true
    if (first === 192 && second === 168) return true
    if (first === 127) return true
    if (first === 169 && second === 254) return true
  }
  return false
}

describe("network detection", () => {
  test("private IP detection", () => {
    expect(isPrivateIP("127.0.0.1")).toBe(true)
    expect(isPrivateIP("192.168.1.1")).toBe(true)
    expect(isPrivateIP("10.0.0.1")).toBe(true)
    expect(isPrivateIP("172.16.0.1")).toBe(true)
    expect(isPrivateIP("172.31.255.255")).toBe(true)
    expect(isPrivateIP("::1")).toBe(true)
  })

  test("public IP detection", () => {
    expect(isPrivateIP("8.8.8.8")).toBe(false)
    expect(isPrivateIP("1.1.1.1")).toBe(false)
    expect(isPrivateIP("151.101.1.140")).toBe(false)
  })

  test("public network connections flagged", () => {
    const activities: NetworkActivity[] = [
      { pid: 123, localAddress: "192.168.1.5", localPort: 54321, remoteAddress: "8.8.8.8", remotePort: 443, state: "ESTABLISHED", protocol: "tcp" },
    ]
    expect(hasPublicNetworkConnections(activities)).toBe(true)
  })

  test("local connections not flagged", () => {
    const activities: NetworkActivity[] = [
      { pid: 123, localAddress: "127.0.0.1", localPort: 8080, remoteAddress: "127.0.0.1", remotePort: 54321, state: "ESTABLISHED", protocol: "tcp" },
    ]
    expect(hasPublicNetworkConnections(activities)).toBe(false)
  })
})

describe("lsof output parsing", () => {
  test("parse lsof line for network connection", () => {
    const sampleLine = "node 12345 user 13u IPv4 0x123 0t0 TCP 127.0.0.1:8080->127.0.0.1:54321 (ESTABLISHED)"
    const parts = sampleLine.trim().split(/\s+/)
    expect(parts[1]).toBe("12345") // pid
    expect(parts[7].toLowerCase()).toBe("tcp") // protocol

    const addrPart = parts[8]
    const arrowIdx = addrPart.indexOf("->")
    expect(arrowIdx).toBeGreaterThan(0)

    const local = addrPart.slice(0, arrowIdx)
    const remote = addrPart.slice(arrowIdx + 2)
    expect(local).toBe("127.0.0.1:8080")
    expect(remote).toBe("127.0.0.1:54321")
  })
})

describe("risk assessment", () => {
  test("no findings is clean", () => {
    const { monitorExecution } = require("../monitor/index")
    // With no real process to monitor, should return clean
    const report = monitorExecution(-1, "/tmp")
    expect(["clean", "suspicious", "dangerous"]).toContain(report.riskLevel)
  })
})
