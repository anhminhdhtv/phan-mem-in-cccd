$WshShell = New-Object -ComObject WScript.Shell

# Đường dẫn Desktop
$DesktopPath = [System.Environment]::GetFolderPath('Desktop')
$ShortcutName = "In CCCD.lnk"

# 1. Tạo shortcut trên Desktop
$Shortcut1 = $WshShell.CreateShortcut("$DesktopPath\$ShortcutName")
$Shortcut1.TargetPath = "$PSScriptRoot\chay_phan_mem.bat"
$Shortcut1.WorkingDirectory = "$PSScriptRoot"
$Shortcut1.Description = "Phần mềm cắt và in Căn cước công dân tự động"
$Shortcut1.IconLocation = "shell32.dll, 45" # Biểu tượng thẻ ID/Liên hệ trong Windows
$Shortcut1.Save()

# 2. Tạo shortcut ngay trong thư mục cài đặt
$Shortcut2 = $WshShell.CreateShortcut("$PSScriptRoot\$ShortcutName")
$Shortcut2.TargetPath = "$PSScriptRoot\chay_phan_mem.bat"
$Shortcut2.WorkingDirectory = "$PSScriptRoot"
$Shortcut2.Description = "Phần mềm cắt và in Căn cước công dân tự động"
$Shortcut2.IconLocation = "shell32.dll, 45"
$Shortcut2.Save()

Write-Host "Da tao loi tat 'In CCCD' tren Desktop va trong thu muc thanh cong!" -ForegroundColor Green
