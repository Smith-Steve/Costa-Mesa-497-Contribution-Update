# Costa Mesa 497 Contribution Update

Monitors the [Costa Mesa 2026 disclosure statements page](https://www.costamesaca.gov/government/departments-and-divisions/city-clerk/city-elections/city-elections-2026/2026-disclosure-statements)
for new Contribution Report (Form 497) filings and sends an SMS via AWS SNS when one appears.

The page lists candidates in a table, one `<tr>` per candidate, with a `Contribution Report
(Form 497)` label followed by a `<ul>` of filed reports (links + dates) in each candidate's cell.
`check.js` parses every candidate row, hashes just that candidate's Form 497 list, and compares it
against the last run — so it only fires for an actual new/changed Form 497 filing for any of the 8
candidates across the 4 races, not for unrelated edits elsewhere on the page.

## Why it runs locally, not on AWS

The city's site is protected by an Akamai rule that returns `403 Forbidden` to requests from
datacenter/cloud IP ranges, regardless of User-Agent. Confirmed by testing directly against the
page from a cloud sandbox. Running the check from a normal home/office network (this machine)
avoids that block since it looks like ordinary browser traffic. If it's ever moved to a cloud host,
expect the same 403 until proven otherwise.

This project is fully independent of the campaign site repo — it provisions and owns its own SNS
topic rather than reusing any other project's AWS resources.

## Setup

1. `npm install`
2. Make sure AWS credentials are configured on this machine (e.g. `~/.aws/credentials` or
   environment variables) with permission to create/publish to SNS topics and subscriptions.
3. Run `node setup-sns.js` once. It creates a dedicated SNS topic
   (`costa-mesa-497-monitor-notifications`) and subscribes `+12154981116` for SMS, then prints the
   topic ARN. SMS subscriptions don't require confirmation.
4. Copy `config.example.json` to `config.json` and fill in:
   - `snsTopicArn`: the ARN printed by `setup-sns.js`.
   - `awsRegion`: defaults to `us-west-2`.
5. Run `npm run check` once manually to establish a baseline (first run never sends a notification,
   it just records each candidate's current Form 497 filings).
6. Register the recurring check: open an elevated PowerShell prompt in this folder and run
   `./setup-task.ps1`. This creates a Windows Scheduled Task (`CostaMesa497Monitor`) that runs every
   4 hours and wakes the PC from sleep if needed.

## Notes

- If the PC is fully shut down (not just asleep) at the scheduled time, the check won't run until
  the PC is next turned on.
- Each check saves a JSON snapshot of every candidate's extracted Form 497 list under `snapshots/`
  (gitignored) so you can see exactly what was parsed on any given run.
- A brand-new candidate row appearing on the page (rather than an existing candidate gaining a new
  filing) will also trigger a notification, since it's a change from "not tracked" to "tracked."
- If the page's HTML structure changes (e.g. the site redesigns the table), `check.js` will find
  zero candidate rows and exit with an error instead of silently reporting no changes — check the
  logs if that happens.
- `config.json`, `state.json`, and `snapshots/` are gitignored since they're machine-specific state,
  not project source.
