import { execFileSync } from "child_process"

export interface NetworkActivity {
  readonly pid: number
  readonly remoteAddress: string
  readonly remotePort: number
  readonly localAddress: string
  readonly localPort: number
  readonly state: string
  readonly protocol: "tcp" | "udp"
}

/** Private IP ranges. */
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

/**
 * Parse lsof output lines into network activities.
 */
function parseLsofOutput(output: string): NetworkActivity[] {
  const activities: NetworkActivity[] = []
  const lines = output.trim().split("\n")

  for (const line of lines) {
    const parts = line.trim().split(/\s+/)
    if (parts.length < 9) continue

    const pid = parseInt(parts[1])
    if (isNaN(pid)) continue

    const protocol = parts[7].toLowerCase() === "tcp" ? "tcp" : "udp"
    const addrPart = parts[8]

    // lsof format: IP:port->IP:port or *:port (LISTEN)
    const arrowIdx = addrPart.indexOf("->")
    if (arrowIdx === -1) continue // skip LISTEN entries

    const local = addrPart.slice(0, arrowIdx)
    const remote = addrPart.slice(arrowIdx + 2)

    const localParts = local.split(":")
    const remoteParts = remote.split(":")

    if (localParts.length < 2 || remoteParts.length < 2) continue

    const localAddr = localParts.slice(0, -1).join(":")
    const localPort = parseInt(localParts[localParts.length - 1])
    const remoteAddr = remoteParts.slice(0, -1).join(":")
    const remotePort = parseInt(remoteParts[remoteParts.length - 1])

    activities.push({
      pid, localAddress: localAddr, localPort,
      remoteAddress: remoteAddr, remotePort,
      state: "ESTABLISHED", protocol,
    })
  }

  return activities
}

/**
 * Check network activity for a process.
 */
export function checkNetworkActivity(pid: number): NetworkActivity[] {
  try {
    const output = execFileSync("lsof", ["-i", "-n", "-P", "-p", String(pid)], { encoding: "utf-8", timeout: 2000 })
    return parseLsofOutput(output)
  } catch {
    return []
  }
}

/**
 * Check if any network connections go to public IPs.
 */
export function hasPublicNetworkConnections(activities: NetworkActivity[]): boolean {
  return activities.some((a) => !isPrivateIP(a.remoteAddress))
}
