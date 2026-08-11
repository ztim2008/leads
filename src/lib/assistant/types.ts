export type AssistantActionType =
  | "list_partners"
  | "partner_status"
  | "renew_month"
  | "toggle_collection"
  | "test_telegram"
  | "get_install_command"
  | "save_vps_ip"
  | "create_partner";

export interface PendingAction {
  id: string;
  type: AssistantActionType;
  label: string;
  params: Record<string, string | number | boolean>;
  missing?: string[];
}

export interface AssistantReply {
  reply: string;
  pendingAction?: PendingAction;
  hints?: { vpsIp?: string; hostname?: string; email?: string };
  llmUsed?: boolean;
}

export interface IntentMatch {
  type: AssistantActionType | "help" | "vps_hint" | "unknown";
  params: Record<string, string | number | boolean>;
  confidence: number;
}
