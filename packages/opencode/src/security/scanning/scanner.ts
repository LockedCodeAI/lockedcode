import { Effect } from "effect"
import type { ScanFinding, ScanMetadata } from "../types"

/**
 * Scanner interface — all scanning engines implement this.
 *
 * Each scanner is self-contained: it knows how to check its own availability
 * and how to scan content for its specific pattern types.
 */
export interface Scanner {
  /** Unique identifier for this scanner (e.g., "semgrep", "yara", "entropy"). */
  readonly name: string

  /**
   * Check whether this scanner's dependencies are available.
   * Returns true if the scanner can run, false otherwise.
   * Results should be cached per session.
   */
  readonly isAvailable: () => Effect.Effect<boolean>

  /**
   * Scan the given content and return findings.
   * Called only when isAvailable() returns true.
   *
   * @param content - The content to scan (file contents, command text, etc.)
   * @param metadata - Context about what is being scanned
   * @returns Array of findings (empty if nothing detected)
   */
  readonly scan: (content: string, metadata: ScanMetadata) => Effect.Effect<ScanFinding[]>
}
