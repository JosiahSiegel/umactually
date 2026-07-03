// poll-build.mjs
const PAT = process.env.DEVOPS_PAT;
const ORG = "josiah-siegel";
const PROJ = "abf8f327-5813-41d2-923d-62f2a9b84d67";
const BUILD_ID = Number(process.argv[2] ?? 72);

const auth = "Basic " + Buffer.from(`${ORG}:${PAT}`).toString("base64");

async function poll() {
  for (let i = 1; i <= 40; i += 1) {
    const res = await fetch(
      `https://dev.azure.com/${ORG}/${PROJ}/_apis/build/builds/${BUILD_ID}?api-version=7.1`,
      { headers: { Authorization: auth } },
    );
    const j = await res.json();
    const ts = new Date().toISOString().slice(11, 19);
    console.log(`poll ${i} (${ts}): status=${j.status} result=${j.result} finishTime=${j.finishTime ?? "NONE"}`);
    if (j.finishTime) {
      console.log(`DONE: status=${j.status} result=${j.result}`);
      return j;
    }
    await new Promise((r) => setTimeout(r, 15000));
  }
  throw new Error("timed out");
}

poll().catch((e) => {
  console.error(e);
  process.exit(1);
});
