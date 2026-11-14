import { repository } from "@/server/finance";
import { cookies } from "next/headers";

export const SCENARIO_COOKIE = "scenario";

/** All scenarios and the selected one (cookie), falling back to the real one. */
export async function selectedScenario() {
  const scenarios = repository.listScenarios();
  const id = Number((await cookies()).get(SCENARIO_COOKIE)?.value);
  const selected = scenarios.find((s) => s.id === id) ?? scenarios.find((s) => s.real) ?? scenarios[0];
  return { scenarios, selected };
}
