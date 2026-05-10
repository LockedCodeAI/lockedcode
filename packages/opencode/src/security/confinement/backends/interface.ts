import { getBestBackend } from "../platform"

export interface ConfinementBackend {
  readonly name: string
  readonly platform: "linux" | "macos" | "windows"
  readonly isAvailable: () => boolean
  readonly activate: (projectRoot: string, preApprovedPaths: string[]) => boolean
  readonly deactivate: () => void
  readonly wrapCommand: (command: string, projectRoot: string, preApprovedPaths: string[]) => string
  readonly isActive: () => boolean
  readonly getEnforcementLevel: () => "kernel" | "namespace" | "application"
}

const activeBackend: { backend: ConfinementBackend | null } = { backend: null }

/**
 * Register the active confinement backend.
 */
export function setActiveBackend(backend: ConfinementBackend): void {
  activeBackend.backend = backend
}

/**
 * Get the active backend.
 */
export function getActiveBackend(): ConfinementBackend | null {
  return activeBackend.backend
}

/**
 * Get a display string for the active backend status.
 */
export function getBackendStatus(): string {
  const backend = activeBackend.backend
  if (!backend) return "none"
  return `${backend.name} (${backend.getEnforcementLevel()})`
}
