Set fso = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")
toolsDir = fso.GetParentFolderName(WScript.ScriptFullName)
projectDir = fso.GetParentFolderName(toolsDir)
shell.CurrentDirectory = projectDir
shell.Run "node """ & toolsDir & "\real-student.mjs"" --open-live", 0, False
