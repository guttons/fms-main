try {
    $excel = [System.Runtime.InteropServices.Marshal]::GetActiveObject("Excel.Application")
    Write-Host "Connected to active Excel instance!"
    Write-Host "Open workbooks count: $($excel.Workbooks.Count)"
    foreach ($wb in $excel.Workbooks) {
        Write-Host "Workbook: $($wb.Name)"
        $destPath = Join-Path (Get-Location) ("scratch_active_" + $wb.Name)
        $wb.SaveCopyAs($destPath)
        Write-Host "Saved copy as: $destPath"
    }
} catch {
    Write-Host "Could not connect to active Excel: $_"
}
