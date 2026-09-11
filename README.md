# Costa Mesa 497 Contribution Update

Monitors the [Costa Mesa 2026 disclosure statements page](https://www.costamesaca.gov/government/departments-and-divisions/city-clerk/city-elections/city-elections-2026/2026-disclosure-statements)
for changes and sends a notification (email + SMS via AWS SNS) when it changes.

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
   - `contentSelector`: a CSS selector for the page's main content area. Defaults to `main` with
     fallbacks (`#main-content`, `.main-content`, `.field--name-body`, `article`, `body`). Once you
     can view the page's HTML in a browser, tighten this to the actual content container so
     navigation/footer noise doesn't cause false positives.
5. Run `npm run check` once manually to establish a baseline (first run never sends a notification,
   it just records the current page hash).
6. Register the recurring check: open an elevated PowerShell prompt in this folder and run
   `./setup-task.ps1`. This creates a Windows Scheduled Task (`CostaMesa497Monitor`) that runs every
   4 hours and wakes the PC from sleep if needed.

## Notes

- If the PC is fully shut down (not just asleep) at the scheduled time, the check won't run until
  the PC is next turned on.
- Each check saves a text snapshot of the page content under `snapshots/` (gitignored) so you can
  diff what changed manually if needed.
- `config.json`, `state.json`, and `snapshots/` are gitignored since they're machine-specific state,
  not project source.
