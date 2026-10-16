# Generates the Kidlearn icons:
#   app/Assets/kidlearn.ico      (tray icon, exe icon, installer icon)
#   extension/icons/icon{16,48,128}.png
# Run once, or again after changing the design. Needs PowerShell on Windows (System.Drawing).

Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot

function New-KidlearnBitmap([int]$size) {
    $bmp = New-Object System.Drawing.Bitmap $size, $size, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
    $g.Clear([System.Drawing.Color]::Transparent)

    # Rounded square in the Kidlearn pink (--primary on index.html)
    $s = [float]$size
    $r = [float]($size * 0.22)
    $d = 2 * $r
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $path.AddArc(0, 0, $d, $d, 180, 90)
    $path.AddArc(($s - $d), 0, $d, $d, 270, 90)
    $path.AddArc(($s - $d), ($s - $d), $d, $d, 0, 90)
    $path.AddArc(0, ($s - $d), $d, $d, 90, 90)
    $path.CloseFigure()
    $fill = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml('#FF6B9D'))
    $g.FillPath($fill, $path)

    $font = New-Object System.Drawing.Font('Segoe UI', [float]($size * 0.62), [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
    $format = New-Object System.Drawing.StringFormat
    $format.Alignment = [System.Drawing.StringAlignment]::Center
    $format.LineAlignment = [System.Drawing.StringAlignment]::Center
    $rect = New-Object System.Drawing.RectangleF(0, 0, $s, $s)
    $g.DrawString('K', $font, [System.Drawing.Brushes]::White, $rect, $format)

    $g.Dispose()
    return $bmp
}

function Save-Ico([int[]]$sizes, [string]$path) {
    # ICO files can hold PNG-compressed entries (Windows Vista and later)
    $entries = foreach ($size in $sizes) {
        $bmp = New-KidlearnBitmap $size
        $png = New-Object System.IO.MemoryStream
        $bmp.Save($png, [System.Drawing.Imaging.ImageFormat]::Png)
        $bmp.Dispose()
        [pscustomobject]@{ Size = $size; Bytes = $png.ToArray() }
    }

    $out = New-Object System.IO.MemoryStream
    $w = New-Object System.IO.BinaryWriter $out
    $w.Write([uint16]0)
    $w.Write([uint16]1)
    $w.Write([uint16]$entries.Count)

    $offset = 6 + 16 * $entries.Count
    foreach ($e in $entries) {
        $dim = if ($e.Size -ge 256) { 0 } else { $e.Size }
        $w.Write([byte]$dim)
        $w.Write([byte]$dim)
        $w.Write([byte]0)
        $w.Write([byte]0)
        $w.Write([uint16]1)
        $w.Write([uint16]32)
        $w.Write([uint32]$e.Bytes.Length)
        $w.Write([uint32]$offset)
        $offset += $e.Bytes.Length
    }
    foreach ($e in $entries) {
        $w.Write($e.Bytes)
    }
    $w.Flush()
    [System.IO.File]::WriteAllBytes($path, $out.ToArray())
}

$assets = Join-Path $root 'app\Assets'
New-Item -ItemType Directory -Force $assets | Out-Null
Save-Ico -sizes @(16, 32, 48, 256) -path (Join-Path $assets 'kidlearn.ico')

$iconDir = Join-Path $root 'extension\icons'
New-Item -ItemType Directory -Force $iconDir | Out-Null
foreach ($size in 16, 48, 128) {
    $bmp = New-KidlearnBitmap $size
    $bmp.Save((Join-Path $iconDir "icon$size.png"), [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
}

Write-Host "Icons written to $assets and $iconDir"
