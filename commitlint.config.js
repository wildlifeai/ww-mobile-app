module.exports = {
  extends: ['@commitlint/config-conventional'],

  // The CI job lints every commit in a PR's base..head range. Merging main
  // into dev (or dev into main for a release) pulls main's own release
  // commits into that range - commits like "Dev (#112)" that GitHub's squash
  // button authored before this convention existed. They cannot be reworded
  // without rewriting main's history, and failing on them blocks release PRs
  // indefinitely. Ignore that one historical shape only; every commit a
  // developer actually writes is still validated.
  ignores: [(message) => /^Dev \(#\d+\)/.test(message)],
};
