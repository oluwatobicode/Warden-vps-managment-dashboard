import type { NotificationChannelType, NotificationEvent } from "shared-types";

export const EVENT_GROUPS: ReadonlyArray<{ label: string; events: ReadonlyArray<{ id: NotificationEvent; label: string }> }> = [
  {
    label: "Deploys",
    events: [
      { id: "deploy.started", label: "Started" },
      { id: "deploy.succeeded", label: "Succeeded" },
      { id: "deploy.failed", label: "Failed" },
      { id: "deploy.gate_failed", label: "Health check failed" },
      { id: "deploy.rolled_back", label: "Rolled back" },
      { id: "deploy.cancelled", label: "Cancelled" },
    ],
  },
  {
    label: "Servers",
    events: [
      { id: "server.offline", label: "Unreachable" },
      { id: "server.recovered", label: "Back online" },
      { id: "server.disk_high", label: "Disk almost full" },
      { id: "docker.cleanup_failed", label: "Cleanup failed" },
    ],
  },
  {
    label: "Databases",
    events: [{ id: "database.backup_failed", label: "Backup failed" }],
  },
  {
    label: "Team",
    events: [
      { id: "member.joined", label: "Member joined" },
      { id: "member.removed", label: "Member removed" },
    ],
  },
];

/** Standalone wording for chips on a channel card ("Server unreachable", not "Unreachable"). */
export const EVENT_CHIP: Record<NotificationEvent, string> = {
  "deploy.started": "Deploy started",
  "deploy.succeeded": "Deploy succeeded",
  "deploy.failed": "Deploy failed",
  "deploy.gate_failed": "Health check failed",
  "deploy.rolled_back": "Rolled back",
  "deploy.cancelled": "Deploy cancelled",
  "server.offline": "Server unreachable",
  "server.recovered": "Server back online",
  "server.disk_high": "Disk almost full",
  "docker.cleanup_failed": "Docker cleanup failed",
  "database.backup_failed": "Database backup failed",
  "member.joined": "Member joined",
  "member.removed": "Member removed",
};

export const TYPE_LABEL: Record<NotificationChannelType, string> = { SLACK: "Slack", DISCORD: "Discord", EMAIL: "Email" };

export const TEST_FAILURE: Record<string, string> = {
  timeout: "The provider didn't answer within 5 seconds",
  unreachable: "Couldn't reach the provider",
  rejected: "The provider refused it. Check the webhook URL or recipients",
  not_configured: "Email isn't set up on this Warden (no Resend key)",
};
