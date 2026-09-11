# Registers a Windows Scheduled Task that runs check.js every 4 hours,
# waking the computer from sleep if necessary.
# Run this once, from an elevated PowerShell prompt, in this project's folder.

$ProjectDir = $PSScriptRoot
$NodePath = (Get-Command node).Source

$Action = New-ScheduledTaskAction -Execute $NodePath -Argument "check.js" -WorkingDirectory $ProjectDir
$Trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Hours 4) -RepetitionDuration (New-TimeSpan -Days 3650)
$Settings = New-ScheduledTaskSettingsSet -WakeToRun -StartWhenAvailable -DontStopOnIdleEnd -ExecutionTimeLimit (New-TimeSpan -Minutes 5)

Register-ScheduledTask -TaskName "CostaMesa497Monitor" `
    -Action $Action `
    -Trigger $Trigger `
    -Settings $Settings `
    -Description "Checks the Costa Mesa 2026 disclosure statements page for changes every 4 hours." `
    -Force

Write-Host "Scheduled task 'CostaMesa497Monitor' registered. It will wake the PC from sleep to run if needed."
Write-Host "It will NOT run if the PC is fully shut down; Task Scheduler will catch up on next boot instead."
