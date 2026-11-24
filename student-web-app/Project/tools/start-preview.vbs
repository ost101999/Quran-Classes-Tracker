Set fso = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")
toolsDir = fso.GetParentFolderName(WScript.ScriptFullName)
projectDir = fso.GetParentFolderName(toolsDir)
shell.CurrentDirectory = projectDir

checkCmd = "powershell -NoProfile -WindowStyle Hidden -Command ""try { Invoke-WebRequest -Uri 'http://127.0.0.1:5174/__health' -TimeoutSec 1 -UseBasicParsing | Out-Null; exit 0 } catch { exit 1 }"""
isUp = shell.Run(checkCmd, 0, True)
If isUp <> 0 Then
  shell.Run "node """ & toolsDir & "\dev-server.mjs""", 0, False
  waitCmd = "powershell -NoProfile -WindowStyle Hidden -Command ""for ($i=0; $i -lt 20; $i++) { try { Invoke-WebRequest -Uri 'http://127.0.0.1:5174/__health' -TimeoutSec 1 -UseBasicParsing | Out-Null; exit 0 } catch { Start-Sleep -Milliseconds 150 } }; exit 1"""
  shell.Run waitCmd, 0, True
End If

shell.Run "http://localhost:5174/", 1, False
