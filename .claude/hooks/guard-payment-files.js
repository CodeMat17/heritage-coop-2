#!/usr/bin/env node
// PreToolUse guard: require explicit approval before Edit/Write touches
// payment-critical files that already work and should not change casually.

const PROTECTED_EXACT = [
  "components/ContributionPayButton.tsx",
  "components/RegistrationPayButton.tsx",
  "components/SquadPayButton.tsx",
];

const PROTECTED_PREFIX = "app/api/";

function normalize(p) {
  return String(p || "").replace(/\\/g, "/").replace(/^.*heritage-coop-2\//, "");
}

function isProtected(filePath) {
  const rel = normalize(filePath);
  if (PROTECTED_EXACT.some((p) => rel.endsWith(p))) return true;
  if (rel.includes(PROTECTED_PREFIX)) return true;
  return false;
}

let input = "";
process.stdin.on("data", (chunk) => (input += chunk));
process.stdin.on("end", () => {
  let data;
  try {
    data = JSON.parse(input);
  } catch {
    process.exit(0);
  }

  const filePath = data?.tool_input?.file_path;
  if (!filePath || !isProtected(filePath)) {
    process.exit(0);
  }

  const output = {
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "ask",
      permissionDecisionReason:
        "This file is a working payment component/route (ContributionPayButton, RegistrationPayButton, SquadPayButton, or app/api/**). It should only change on explicit user request. Confirm you specifically asked for this change before approving.",
    },
  };
  process.stdout.write(JSON.stringify(output));
  process.exit(0);
});
