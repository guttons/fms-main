$files = @('../SUMMER 2026 Ver.08.xlsx', '../WINTER 2026-27 Ver.01.xlsx')
$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false

foreach ($fn in $files) {
    $fullPath = Resolve-Path $fn
    Write-Host "============================================"
    Write-Host "FILE: $fn"
    Write-Host "============================================"
    $wb = $excel.Workbooks.Open($fullPath)
    foreach ($ws in $wb.Worksheets) {
        Write-Host "--- SHEET: $($ws.Name) (Rows: $($ws.UsedRange.Rows.Count), Cols: $($ws.UsedRange.Columns.Count)) ---"
        $maxR = [Math]::Min(35, $ws.UsedRange.Rows.Count)
        $maxC = [Math]::Min(25, $ws.UsedRange.Columns.Count)
        for ($r = 1; $r -le $maxR; $r++) {
            $rowVals = @()
            for ($c = 1; $c -le $maxC; $c++) {
                $val = $ws.Cells.Item($r, $c).Text
                if ($val -and $val.Trim() -ne "") {
                    $rowVals += "Col${c}: $val"
                }
            }
            if ($rowVals.Count -gt 0) {
                Write-Host "Row ${r} -> $($rowVals -join ' | ')"
            }
        }
    }
    $wb.Close($false)
}
$excel.Quit()
