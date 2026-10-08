import ProfileForm from "@/components/radar/profile-form";
import { ensureRadarProfile } from "@/lib/radar/profile";

export default async function RadarProfilePage() {
  const profile = await ensureRadarProfile();
  return (
    <ProfileForm
      profile={{
        specialization: profile.specialization,
        about: profile.about,
        directions: profile.directions,
        skills: profile.skills,
        formats: profile.formats,
        exclusions: profile.exclusions,
        searchQueries: profile.searchQueries,
        tildaQueries: profile.tildaQueries,
        aiQueries: profile.aiQueries,
        webQueries: profile.webQueries,
      }}
    />
  );
}
