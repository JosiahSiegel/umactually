// repro-status2.mjs — try with the project NAME (not ID)
const PAT = process.env.DEVOPS_PAT;
const ORG = "josiah-siegel";
const PROJ_NAME = "Demo Project";
const REPO = "dcdada42-ca08-4664-b02a-42720508abba";
const PR = 42;
const auth = "Basic " + Buffer.from(`${ORG}:${PAT}`).toString("base64");

const summary = "The diff is a large mega-PR introducing the entire UmActually PR review action: action.yml, large compiled dist bundles, source under src/, Azure pipelines doc + root pipeline, docs, examples, and tests. Reviewed for azure platform correctness. Several real issues found.";

const body = JSON.stringify({
  state: "failed",
  description: summary.slice(0, 255),
  context: { name: "UmActually", genre: "pr-review" },
});

const url = `https://dev.azure.com/${ORG}/${encodeURIComponent(PROJ_NAME)}/_apis/git/repositories/${REPO}/pullRequests/${PR}/statuses?api-version=7.1`;
console.log("URL:", url);
console.log("BODY:", body);

const res = await fetch(url, {
  method: "POST",
  headers: { Authorization: auth, "Content-Type": "application/json", Accept: "application/json" },
  body,
});
console.log("STATUS:", res.status);
console.log("RESPONSE:", await res.text());
