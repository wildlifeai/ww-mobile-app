# Documentation, and the commit-time check

#### File: .agents/skills/references/documentation.md
#### Author: Claude, with Victor Anton
#### 19 September 2026

## Where each kind of document lives

- `documentation/onboarding/` is the guided path, six numbered guides.
- `documentation/resources/` holds the deep dives.
- `documentation/development reports/` records how decisions were reached.

Point at code for anything that drifts, such as the schema version, table counts or route
lists. `npm run docs:validate` fails CI on a dead path or link.

## Development reports

They follow the firmware repo's convention, set out in
[development reports/README.md](../../../documentation/development%20reports/README.md). Three
rules matter when you write one:

1. Docs are the record, GitHub issues are the tracker. A document is never the only place an
   open task lives.
2. A thread is a folder named `YYYY-MM-DD_short-description/` whose README carries **Status,
   Outcome and Open items**. Append as it evolves, do not rewrite it.
3. **A report records how the work happened, not how the code works.** Anything a future
   developer needs about current behaviour belongs in `onboarding/` or `resources/`. Nobody
   should have to read a thread to find out how something behaves now.

Head every new markdown file with `#### File:`, `#### Author:` and the date, so a reader can
place it without digging through git history.

## House style

- **No em dashes.** Use commas, or start a new sentence. This applies to every document and
  anything else that gets pasted somewhere: em dashes read as machine-written to the people who
  fund this work. Existing code comments still carry them; leave those alone unless you are
  already rewriting the file.
- Verify against the code, not the docs. A July 2026 audit found about 40 documented facts that
  had drifted from reality. They were fixed in v0.0.62, and `npm run docs:validate` now guards
  paths and links, but not claims. Treat any undated claim as a hypothesis.

## The commit-time check

Before every commit, look at what the change means for the agent layer, meaning `AGENTS.md`,
this skill and its reference files, and decide whether anything needs to be added, edited or
deleted. It takes a few seconds and it is what keeps this layer from rotting.

Three questions, in order:

1. **Did I learn something that would have saved me time today?** A trap, a contract, a command
   that does not behave as its name suggests. That belongs in [traps.md](traps.md) or
   [ble.md](ble.md), with the date and what it cost.
2. **Did I make something here wrong?** A renamed file, a deleted hook, a changed command, a
   workflow that now works differently. Fix the line that is now false in the same commit.
   A confidently wrong skill is worse than a thin one.
3. **Is something here now redundant?** A trap whose cause was fixed, a workaround for firmware
   nobody runs, a rule the code now enforces. Delete it, and say in the commit message what was
   removed and why. This file grows by default; only deliberate pruning shrinks it.

If the answer to all three is no, commit and say nothing. The check is a habit, not a ritual to
document each time.
