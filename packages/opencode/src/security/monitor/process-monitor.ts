import { execFileSync } from "child_process"

export interface ProcessNode {
  readonly pid: number
  readonly ppid: number
  readonly command: string
  readonly args: string
}

let isMonitoring = false
let trackedPids = new Set<number>()
let unexpectedProcs: ProcessNode[] = []
let processTree: ProcessNode[] = []

/**
 * Get child PIDs of a process cross-platform.
 */
function getChildPids(parentPid: number): ProcessNode[] {
  const children: ProcessNode[] = []

  try {
    if (process.platform === "linux") {
      const output = execFileSync("ps", ["--ppid", String(parentPid), "-o", "pid,args"], { encoding: "utf-8", timeout: 1000 })
      const lines = output.trim().split("\n").slice(1)
      for (const line of lines) {
        const parts = line.trim().split(/\s+/)
        if (parts.length >= 1 && /^\d+$/.test(parts[0])) {
          children.push({ pid: parseInt(parts[0]), ppid: parentPid, command: parts[1] ?? "", args: parts.slice(2).join(" ") })
        }
      }
    } else {
      // macOS and others
      const output = execFileSync("ps", ["-o", "pid,ppid,comm", "-ax"], { encoding: "utf-8", timeout: 1000 })
      const lines = output.trim().split("\n").slice(1)
      for (const line of lines) {
        const parts = line.trim().split(/\s+/)
        if (parts.length >= 3 && parseInt(parts[1]) === parentPid) {
          children.push({ pid: parseInt(parts[0]), ppid: parentPid, command: parts[2] ?? "", args: "" })
        }
      }
    }
  } catch {}

  return children
}

/**
 * Check if a process is "expected" — matches typical development tools.
 */
function isExpectedProcess(proc: ProcessNode): boolean {
  const expected = ["node", "bun", "npm", "npx", "yarn", "pnpm", "git", "make", "cmake",
    "gcc", "clang", "rustc", "cargo", "go", "python", "python3", "pip", "java", "javac",
    "sh", "bash", "zsh", "dash", "ls", "cat", "grep", "find", "sort", "uniq", "wc",
    "echo", "printf", "sed", "awk", "tee", "head", "tail", "cp", "mv", "rm", "mkdir",
    "chmod", "chown", "date", "sleep", "true", "false", "kill", "ps", "env", "which",
    "curl", "wget", "tar", "gzip", "gunzip", "unzip", "xz", "bzip2",
  ]
  const base = proc.command.split("/").pop()?.toLowerCase() ?? ""
  return expected.includes(base)
}

/**
 * Start monitoring a process tree.
 */
export function startMonitoring(pid: number): { stop: () => ProcessNode[] } {
  const rootPid = pid
  trackedPids.add(pid)
  isMonitoring = true
  unexpectedProcs = []
  processTree = []

  const stop = () => {
    isMonitoring = false
    return unexpectedProcs
  }

  // Single poll
  try {
    const allProcs: ProcessNode[] = []
    const queue = [rootPid]
    const seen = new Set<number>()

    while (queue.length > 0) {
      const current = queue.shift()!
      if (seen.has(current)) continue
      seen.add(current)

      const children = getChildPids(current)
      for (const child of children) {
        allProcs.push(child)
        if (!isExpectedProcess(child)) {
          unexpectedProcs.push(child)
        }
        if (!seen.has(child.pid)) {
          queue.push(child.pid)
        }
      }
    }

    processTree = allProcs
  } catch {}

  return { stop }
}
