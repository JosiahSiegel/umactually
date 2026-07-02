// get-build-tasks.mjs
const PAT = process.env.DEVOPS_PAT;
const ORG = "josiah-siegel";
const PROJ = "abf8f327-5813-41d2-923d-62f2a9b84d67";
const BUILD_ID = 72;

const auth = "Basic " + Buffer.from(`${ORG}:${PAT}`).toString("base64");

async function main() {
  const timeline = await fetch(
    `https://dev.azure.com/${ORG}/${PROJ}/_apis/build/builds/${BUILD_ID}/timeline?api-version=7.1`,
    { headers: { Authorization: auth } },
  ).then((r) => r.json());

  for (const rec of timeline.records ?? []) {
    if (rec.type === "Task") {
      const logId = rec.log?.id;
      console.log(`task: ${rec.name} state=${rec.state} result=${rec.result} logId=${logId ?? "N/A"}`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
