"""Open GitHub + Azure DevOps PRs.

Usage:
    python open-refactor-prs.py \
        <gh_token> <az_pat> <az_repo_id> <source_branch> <target_branch> \
        <title> <body_file>

Args:
    gh_token      GitHub PAT with `repo` scope
    az_pat        Azure DevOps PAT with Pull Request Contribute scope
    az_repo_id    ADO project name (e.g. "DemoProject")
    source_branch head branch (without refs/heads/ prefix)
    target_branch base branch (without refs/heads/ prefix)
    title         PR title
    body_file     Path to file containing PR body (markdown). Use "-" for stdin.
"""
import base64
import json
import sys
import urllib.error
import urllib.request


def _read_body(path: str) -> str:
    if path == "-":
        return sys.stdin.read()
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


def post_github_pr(token: str, head: str, base: str, title: str, body: str) -> str:
    data = json.dumps({
        "title": title,
        "head": head,
        "base": base,
        "body": body,
    }).encode("utf-8")
    req = urllib.request.Request(
        "https://api.github.com/repos/JosiahSiegel/umactually/pulls",
        data=data,
        headers={
            "Authorization": "Bearer " + token,
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
            "Content-Type": "application/json",
            "User-Agent": "umactually-bot",
        },
    )
    try:
        with urllib.request.urlopen(req) as resp:
            result = json.loads(resp.read())
            return "PR #" + str(result["number"]) + ": " + result["html_url"]
    except urllib.error.HTTPError as e:
        return "GitHub error " + str(e.code) + ": " + e.read().decode("utf-8")


def post_azure_pr(pat: str, repo_id: str, source_branch: str, target_branch: str, title: str, body: str) -> str:
    data = json.dumps({
        "sourceRefName": "refs/heads/" + source_branch,
        "targetRefName": "refs/heads/" + target_branch,
        "title": title,
        "description": body,
    }).encode("utf-8")
    auth_str = base64.b64encode((":".encode() + pat.encode())).decode()
    req = urllib.request.Request(
        "https://dev.azure.com/josiah-siegel/" + repo_id + "/_apis/git/repositories/umactually/pullrequests?api-version=7.1",
        data=data,
        headers={
            "Authorization": "Basic " + auth_str,
            "Content-Type": "application/json",
            "User-Agent": "umactually-bot",
        },
    )
    try:
        with urllib.request.urlopen(req) as resp:
            result = json.loads(resp.read())
            url = "https://dev.azure.com/josiah-siegel/" + repo_id + "/_git/umactually/pullrequest/" + str(result["pullRequestId"])
            return "ADO PR #" + str(result["pullRequestId"]) + ": " + url
    except urllib.error.HTTPError as e:
        return "Azure error " + str(e.code) + ": " + e.read().decode("utf-8")


if __name__ == "__main__":
    if len(sys.argv) != 8:
        print(__doc__, file=sys.stderr)
        sys.exit(2)

    gh_token = sys.argv[1]
    az_pat = sys.argv[2]
    az_repo_id = sys.argv[3]
    source_branch = sys.argv[4]
    target_branch = sys.argv[5]
    title = sys.argv[6]
    body = _read_body(sys.argv[7])

    print("=== Opening GitHub PR ===")
    print(post_github_pr(gh_token, source_branch, target_branch, title, body))

    print("=== Opening Azure DevOps PR ===")
    print(post_azure_pr(az_pat, az_repo_id, source_branch, target_branch, title, body))