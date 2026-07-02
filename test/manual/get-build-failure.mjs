// get-build-failure.mjs
const PAT = process.env.DEVOPS_PAT;
const ORG = "josiah-siegel";
const PROJ = "abf8f327-5813-41d2-923d-62f2a9b84d67";
const BUILD_ID = 72;

const auth = "Basic " + Buffer.from(`${ORG}:${PAT}`).toString("base64");

async function main() {
  // Get timeline records (one per step)
  const timeline = await fetch(
    `https://dev.azure.com/${ORG}/${PROJ}/_apis/build/builds/${BUILD_ID}/timeline?api-version=7.1`,
    { headers: { Authorization: auth } },
  ).then((r) => r.json());

  // Get logs
  const logUrl = `https://dev.azure.com/${ORG}/${PROJ}/_apis/build/builds/${BUILD_ID}/logs?api-version=7.1`;
  const logs = await fetch(logUrl, { headers: { Authorization: auth } }).then((r) => r.json());
  console.log("=== TIMELINE ===");
  for (const rec of timeline.records ?? []) {
    if (rec.type === "Task" || rec.type === "Job" || rec.type === "Phase") {
      console.log(`[${rec.type}] ${rec.name} state=${rec.state} result=${rec.result} issues=${(rec.issues||[]).length}`);
      for (const issue of rec.issues ?? []) {
        console.log(`  ISSUE: ${issue.category} ${issue.type}: ${issue.message}`);
      }
    }
  }
  console.log("=== LOGS ===");
  for (const log of logs.value ?? []) {
    if (log.id === 0) continue;
    console.log(`--- log id=${log.id} (${log.lineCount ?? "?"} lines) ---`);
    const text = await fetch(log.url, { headers: { Authorization: auth } }).then((r) => r.text());
    console.log(text);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
