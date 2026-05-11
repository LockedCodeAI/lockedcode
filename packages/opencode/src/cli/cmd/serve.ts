import { Effect } from "effect"
import { Server } from "../../server/server"
import { effectCmd } from "../effect-cmd"
import { withNetworkOptions, resolveNetworkOptions } from "../network"
import { Flag } from "@opencode-ai/core/flag/flag"
import { ServerAuth } from "@/server/auth"

export const ServeCommand = effectCmd({
  command: "serve",
  builder: (yargs) =>
    withNetworkOptions(yargs).option("no-auth", {
      type: "boolean",
      describe: "disable authentication (not recommended)",
      default: false,
    }),
  describe: "starts a headless lockedcode server",
  // Server loads instances per-request via x-opencode-directory header — no
  // need for an ambient project InstanceContext at startup.
  instance: false,
  handler: Effect.fn("Cli.serve")(function* (args) {
    const opts = yield* resolveNetworkOptions(args)

    if (opts.hostname !== "127.0.0.1" && opts.hostname !== "localhost") {
      console.log("WARNING: LockedCode server exposed to network on " + opts.hostname + ". Ensure auth is enabled.")
    }

    if (!Flag.LOCKEDCODE_SERVER_PASSWORD && !args["no-auth"]) {
      const token = process.env.LOCKEDCODE_AUTH_TOKEN || ServerAuth.generateToken()
      process.env.LOCKEDCODE_SERVER_PASSWORD = token
      process.env.LOCKEDCODE_SERVER_USERNAME = "lockedcode"
      console.log("LockedCode server started. Auth token: " + token)
    } else if (args["no-auth"]) {
      console.log("WARNING: LockedCode server running without authentication.")
    }

    const server = yield* Effect.promise(() => Server.listen(opts))
    console.log(`lockedcode server listening on http://${server.hostname}:${server.port}`)

    yield* Effect.never
  }),
})
