import { ok, runQuery } from "./http";

export async function handler() {
  const [sources, programs, provinces, committees, areas, subjects] = await Promise.all([
    runQuery("SELECT source_code, name_en, name_fr FROM funding_source ORDER BY source_code"),
    runQuery("SELECT program_id, source_id, name_en, name_fr, group_en, group_fr FROM program ORDER BY name_en"),
    runQuery("SELECT DISTINCT province_en, province_fr FROM organization WHERE province_en IS NOT NULL ORDER BY province_en"),
    runQuery("SELECT committee_code, name_en, name_fr FROM committee ORDER BY name_en"),
    runQuery("SELECT area_code, name_en, name_fr, group_en, group_fr FROM area_of_application ORDER BY name_en"),
    runQuery("SELECT subject_code, name_en, name_fr, group_en, group_fr FROM research_subject ORDER BY name_en")
  ]);
  return ok({ sources, programs, provinces, committees, areas, subjects });
}
