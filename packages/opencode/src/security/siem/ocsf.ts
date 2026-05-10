import type { SecurityEvent, Severity } from "../types"

/**
 * Map LockedCode severity to OCSF severity_id.
 * OCSF spec: 1=Informational, 2=Low, 3=Medium, 4=High, 5=Critical
 */
function ocsfSeverity(severity: Severity): number {
  switch (severity) {
    case "info": return 1
    case "warning": return 3
    case "high": return 4
    case "critical": return 5
  }
}

function ocsfSeverityName(severity: Severity): string {
  switch (severity) {
    case "info": return "Informational"
    case "warning": return "Medium"
    case "high": return "High"
    case "critical": return "Critical"
  }
}

/**
 * Map event type to OCSF class_uid.
 * 2001 = Security Finding, 2002 = Policy Violation, 4001 = Data Security
 */
function ocsfClass(eventType: string): { classUid: number; categoryUid: number; activityId: number } {
  if (eventType.startsWith("security.dlp")) {
    return { classUid: 4001, categoryUid: 4, activityId: eventType.includes("blocked") ? 2 : 1 }
  }
  if (eventType.startsWith("security.confinement") || eventType.startsWith("security.action")) {
    return { classUid: 2002, categoryUid: 2, activityId: eventType.includes("approved") ? 2 : 1 }
  }
  return { classUid: 2001, categoryUid: 2, activityId: 1 }
}

/**
 * Format a security event as OCSF JSON.
 */
export function formatOCSF(event: SecurityEvent): Record<string, unknown> {
  const sevId = ocsfSeverity(event.severity ?? "info")
  const klass = ocsfClass(event.eventType)

  return {
    class_uid: klass.classUid,
    category_uid: klass.categoryUid,
    severity_id: sevId,
    activity_id: klass.activityId,
    time: event.timestamp,
    message: `Security event: ${event.eventType} (${event.actionTaken})`,
    metadata: {
      product: { name: "LockedCode", vendor_name: "LockedCodeAI", version: "1.0.0" },
      version: "1.1.0",
    },
    actor: { session: { uid: event.sessionId } },
    finding_info: {
      uid: event.contentHash ?? event.sessionId,
      title: event.eventType,
      types: [event.eventType],
    },
    severity: ocsfSeverityName(event.severity ?? "info"),
    status: event.actionTaken,
    ...(event.toolName ? { resources: [{ name: event.toolName, type: "tool" }] } : {}),
    ...(event.modelId ? { cloud: { provider: event.modelId } } : {}),
  }
}
