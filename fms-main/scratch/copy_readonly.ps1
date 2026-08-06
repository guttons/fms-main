$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$files = @(
    @{ src = '../SUMMER 2026 Ver.08.xlsx'; dst = (Join-Path (Get-Location) 'scratch/summer.xlsx') },
    @{ src = '../WINTER 2026-27 Ver.01.xlsx'; dst = (Join-Path (Get-Location) 'scratch/winter.xlsx') }
)

foreach ($item in $files) {
    try {
        $fullPath = Resolve-Path $item.src
        # Open(Filename, UpdateLinks, ReadOnly)
        $wb = $excel.Workbooks.Open($fullPath, 0, $true)
        $wb.SaveCopyAs($item.dst)
        $wb.Close($false)
        Write-Host "Successfully saved copy of $($item.src) -> $($item.dst)"
    } catch {
        Write-Host "Failed to open/save $($item.src): $_"
    }
}
$excel.Quit()
