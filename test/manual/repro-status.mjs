// repro-status.mjs — try to reproduce the status POST failure
const PAT = process.env.DEVOPS_PAT;
const ORG = "josiah-siegel";
const PROJ = "abf8f327-5813-41d2-923d-62f2a9b84d67";
const REPO = "dcdada42-ca08-4664-b02a-42720508abba";
const PR = 42;
const auth = "Basic " + Buffer.from(`${ORG}:${PAT}`).toString("base64");

// Try with the summary we saw in Comment#3
const summary = "The diff is a large mega-PR introducing the entire UmActually PR review action: action.yml, large compiled dist bundles, source under src/, Azure pipelines doc + root pipeline, docs, examples, and tests. Reviewed for azure platform correctness. Several real issues found.";

const body = JSON.stringify({
  state: "failed",
  description: summary.slice(0, 255),
  context: { name: "UmActually", genre: "pr-review" },
});

console.log("BODY:", body);

const url = `https://dev.azure.com/${ORG}/${PROJ}/_apis/git/repositories/${REPO}/pullRequests/${PR}/statuses?api-version=7.1`;
const res = await fetch(url, {
  method: "POST",
  headers: { Authorization: auth, "Content-Type": "application/json", Accept: "application/json" },
  body,
});
console.log("STATUS:", res.status);
console.log("RESPONSE:", await res.text());
