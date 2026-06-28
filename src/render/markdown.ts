type EvidenceBlockInput = {
  readonly evidenceQuote: string;
  readonly falsificationTest: string;
};

export function renderEvidenceBlock(input: EvidenceBlockInput): string {
  const evidence = wrapInlineCode(input.evidenceQuote);
  const falsification = quoteMarkdownLines(input.falsificationTest);

  return `> **Evidence:** ${evidence}\n\n> **Falsification test:**\n${falsification.join("\n")}`;
}

function wrapInlineCode(value: string): string {
  const body = value.replace(/\r\n|\r|\n/g, " ").trim();

  if (body.length === 0) {
    return "` `";
  }

  const fence = "`".repeat(Math.max(1, longestBacktickRun(body) + 1));
  const paddedBody = body.endsWith("`") ? `${body} ` : body;

  return `${fence}${paddedBody}${fence}`;
}

function quoteMarkdownLines(value: string): readonly string[] {
  const normalized = value.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();

  return normalized.split("\n").map((line) => (line.length === 0 ? ">" : `> ${line}`));
}

function longestBacktickRun(value: string): number {
  let longest = 0;
  let current = 0;

  for (const character of value) {
    if (character === "`") {
      current += 1;
      longest = Math.max(longest, current);
    } else {
      current = 0;
    }
  }

  return longest;
}
