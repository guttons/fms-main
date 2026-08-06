$files = @(
    @{ src = '../SUMMER 2026 Ver.08.xlsx'; dst = 'scratch/summer.xlsx' },
    @{ src = '../WINTER 2026-27 Ver.01.xlsx'; dst = 'scratch/winter.xlsx' }
)

foreach ($item in $files) {
    try {
        $fullPath = Resolve-Path $item.src
        $inStream = [System.IO.File]::Open($fullPath, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, [System.IO.FileShare]::ReadWrite)
        $outStream = [System.IO.File]::Create($item.dst)
        $inStream.CopyTo($outStream)
        $inStream.Close()
        $outStream.Close()
        Write-Host "Successfully copied $($item.src) -> $($item.dst)"
    } catch {
        Write-Host "Failed to copy $($item.src): $_"
    }
}
