' Run the recurring bridge check without showing a console window.
Set shell = CreateObject("WScript.Shell")
command = "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File ""D:\Universidad\SW1\Grupal\deploy\local-ai\start-bridge.ps1"""
exitCode = shell.Run(command, 0, True)
WScript.Quit exitCode
