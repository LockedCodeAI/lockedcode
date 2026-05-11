import { Effect } from "effect"
import { Server } from "../../server/server"
import { UI } from "../ui"
import { effectCmd } from "../effect-cmd"
import { withNetworkOptions, resolveNetworkOptions } from "../network"
import { Flag } from "@opencode-ai/core/flag/flag"
import { ServerAuth } from "@/server/auth"
import open from "open"
import { networkInterfaces } from "os"

function getNetworkIPs() {
  const nets = networkInterfaces()
  const results: string[] = []

  for (const name of Object.keys(nets)) {
    const net = nets[name]
    if (!net) continue

    for (const netInfo of net) {
      // Skip internal and non-IPv4 addresses
      if (netInfo.internal || netInfo.family !== "IPv4") continue

      // Skip Docker bridge networks (typically 172.x.x.x)
      if (netInfo.address.startsWith("172.")) continue

      results.push(netInfo.address)
    }
  }

  return results
}

export const WebCommand = effectCmd({
  command: "web",
  builder: (yargs) =>
    withNetworkOptions(yargs).option("no-auth", {
      type: "boolean",
      describe: "disable authentication (not recommended)",
      default: false,
    }),
  describe: "start lockedcode server and open web interface",
  // Server loads instances per-request via x-opencode-directory header — no
  // ambient project InstanceContext needed at startup.
  instance: false,
  handler: Effect.fn("Cli.web")(function* (args) {
    const opts = yield* resolveNetworkOptions(args)

    if (opts.hostname !== "127.0.0.1" && opts.hostname !== "localhost") {
      UI.println(
        UI.Style.TEXT_WARNING_BOLD + "WARNING: LockedCode server exposed to network on " + opts.hostname + ".",
      )
      UI.println(UI.Style.TEXT_WARNING_BOLD + "Ensure auth is enabled.")
    }

    if (!Flag.LOCKEDCODE_SERVER_PASSWORD && !args["no-auth"]) {
      const token = process.env.LOCKEDCODE_AUTH_TOKEN || ServerAuth.generateToken()
      process.env.LOCKEDCODE_SERVER_PASSWORD = token
      process.env.LOCKEDCODE_SERVER_USERNAME = "lockedcode"
      UI.println(UI.Style.TEXT_INFO_BOLD + "  Auth token:        ", UI.Style.TEXT_NORMAL, token)
    } else if (args["no-auth"]) {
      UI.println(UI.Style.TEXT_WARNING_BOLD + "  WARNING: Server running without authentication.")
    }

    const server = yield* Effect.promise(() => Server.listen(opts))
    UI.empty()
    UI.println(UI.logo("  "))
    UI.empty()

    if (opts.hostname === "0.0.0.0") {
      // Show localhost for local access
      const localhostUrl = `http://localhost:${server.port}`
      UI.println(UI.Style.TEXT_INFO_BOLD + "  Local access:      ", UI.Style.TEXT_NORMAL, localhostUrl)

      // Show network IPs for remote access
      const networkIPs = getNetworkIPs()
      if (networkIPs.length > 0) {
        for (const ip of networkIPs) {
          UI.println(
            UI.Style.TEXT_INFO_BOLD + "  Network access:    ",
            UI.Style.TEXT_NORMAL,
            `http://${ip}:${server.port}`,
          )
        }
      }

      // Open localhost in browser
      open(localhostUrl).catch(() => {})
    } else {
      const displayUrl = server.url.toString()
      UI.println(UI.Style.TEXT_INFO_BOLD + "  Web interface:    ", UI.Style.TEXT_NORMAL, displayUrl)
      open(displayUrl).catch(() => {})
    }

    yield* Effect.never
  }),
})
