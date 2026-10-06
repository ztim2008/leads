import SettingsForm from "@/components/radar/settings-form";
import { radarApiKey } from "@/lib/radar/ai";
import { ensureRadarProfile } from "@/lib/radar/profile";

export default async function RadarSettingsPage() {
  const profile = await ensureRadarProfile();
  return (
    <SettingsForm
      aiReady={Boolean(radarApiKey())}
      lastCheckAt={profile.lastCheckAt?.toISOString() ?? null}
      lastError={profile.lastError}
      lastNewCount={profile.lastNewCount}
      settings={{
        enabled: profile.enabled,
        alertsEnabled: profile.alertsEnabled,
        requireSalary: profile.requireSalary,
        remoteOnly: profile.remoteOnly,
        matchMin: profile.matchMin,
        trustMin: profile.trustMin,
        salaryMin: profile.salaryMin,
        dailyAlertCap: profile.dailyAlertCap,
        quietStart: profile.quietStart,
        quietEnd: profile.quietEnd,
        telegramChatId: profile.telegramChatId,
      }}
    />
  );
}
