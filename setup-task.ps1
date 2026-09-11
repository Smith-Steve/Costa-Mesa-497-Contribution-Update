# Registers a Windows Scheduled Task that runs check.js at 9am, 11am, 1pm, 3pm,
# 5pm, and 7pm daily (every 2 hours during 9-5 business hours, plus one more
# check 2 hours after close), waking the computer from sleep if necessary.
# Run this once, from an elevated PowerShell prompt, in this project's folder.

$ProjectDir = $PSScriptRoot
$NodePath = (Get-Command node).Source

$Times = @("09:00", "11:00", "13:00", "15:00", "17:00", "19:00")
$Triggers = $Times | ForEach-Object { New-ScheduledTaskTrigger -Daily -At $_ }

$Action = New-ScheduledTaskAction -Execute $NodePath -Argument "check.js" -WorkingDirectory $ProjectDir
$Settings = New-ScheduledTaskSettingsSet -WakeToRun -StartWhenAvailable -DontStopOnIdleEnd -ExecutionTimeLimit (New-TimeSpan -Minutes 5)

Register-ScheduledTask -TaskName "CostaMesa497Monitor" `
    -Action $Action `
    -Trigger $Triggers `
    -Settings $Settings `
    -Description "Checks the Costa Mesa 2026 disclosure statements page for Form 497 updates at 9am, 11am, 1pm, 3pm, 5pm, and 7pm daily." `
    -Force

Write-Host "Scheduled task 'CostaMesa497Monitor' registered for 9am, 11am, 1pm, 3pm, 5pm, and 7pm daily."
Write-Host "It will wake the PC from sleep to run if needed."
Write-Host "It will NOT run if the PC is fully shut down; Task Scheduler will catch up on next boot instead."
