$files = @('../SUMMER 2026 Ver.08.xlsx', '../WINTER 2026-27 Ver.01.xlsx')

foreach ($fn in $files) {
    try {
        $fullPath = Resolve-Path $fn
        $destPath = "scratch_temp_" + [System.IO.Path]::GetFileName($fn)
        $inStream = [System.IO.File]::Open($fullPath, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, [System.IO.FileShare]::ReadWrite)
        $outStream = [System.IO.File]::Create($destPath)
        $inStream.CopyTo($outStream)
        $inStream.Close()
        $outStream.Close()
        Write-Host "Successfully copied ${fn} -> ${destPath}"
    } catch {
        Write-Host "Failed to copy ${fn}: $_"
    }
}
