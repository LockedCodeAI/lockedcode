// mDNS removed — LockedCode does not advertise itself on the network.

export function publish(_port: number, _domain?: string) {}

export function unpublish() {}

export * as MDNS from "./mdns"
