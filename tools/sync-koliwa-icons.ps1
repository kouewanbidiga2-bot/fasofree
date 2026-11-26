# Génère les icônes des trois interfaces à partir de la géométrie de référence.
param([switch]$Client)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$repo = Split-Path -Parent $PSScriptRoot
if ($Client) {
    $clientPublic = Join-Path $repo 'fasofree-frontend-client/public'
    $markPath = Join-Path $clientPublic 'koliwa-mark.svg'
    [xml]$wordmark = Get-Content -LiteralPath (Join-Path $clientPublic 'koliwa-wordmark.svg') -Raw
    $a = ($wordmark.svg.g.path.d -replace '\s+', ' ').Trim()
    $scale = 3
    $left = -399
    $top = -9
    $markSource = @"
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 140 140">
  <g fill="#D3E976">
    <path id="koliwa-icon-glyph" fill-rule="evenodd" transform="matrix($scale 0 0 $scale $left $top)" d="$a"/>
  </g>
</svg>
"@
    [IO.File]::WriteAllText($markPath, $markSource)
    $paper = '#171914'
    $targets = @('fasofree-frontend-client')
} else {
    & $PSCommandPath -Client
    $markSource = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'koliwa-mark.svg') -Raw
    $paper = '#41241C'
    $targets = @('fasofree-frontend', 'fasofree-agent')
}
[xml]$markXml = $markSource

function New-LogoPath([string]$definition) {
    # Les tracés de référence emploient les quatre commandes absolues M L C Z.
    $tokens = [regex]::Matches($definition, '[MLCZ]|-?\d+(?:\.\d+)?')
    $path = [System.Drawing.Drawing2D.GraphicsPath]::new()
    $cursor = [System.Drawing.PointF]::Empty
    for ($i = 0; $i -lt $tokens.Count; $i++) {
        switch ($tokens[$i].Value) {
            'M' {
                $path.StartFigure()
                $cursor = [System.Drawing.PointF]::new($tokens[++$i].Value, $tokens[++$i].Value)
            }
            'L' {
                $end = [System.Drawing.PointF]::new($tokens[++$i].Value, $tokens[++$i].Value)
                $path.AddLine($cursor, $end)
                $cursor = $end
            }
            'C' {
                $first = [System.Drawing.PointF]::new($tokens[++$i].Value, $tokens[++$i].Value)
                $second = [System.Drawing.PointF]::new($tokens[++$i].Value, $tokens[++$i].Value)
                $end = [System.Drawing.PointF]::new($tokens[++$i].Value, $tokens[++$i].Value)
                $path.AddBezier($cursor, $first, $second, $end)
                $cursor = $end
            }
            'Z' { $path.CloseFigure() }
            default { throw 'Commande non prise en charge dans le tracé Koliwa.' }
        }
    }
    return $path
}

function New-IconPng([int]$size, [bool]$maskable) {
    $bitmap = [System.Drawing.Bitmap]::new($size, $size)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $buffer = [System.IO.MemoryStream]::new()
    try {
        $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
        $graphics.ScaleTransform($size / 140, $size / 140)
        $background = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml($paper))
        try {
            if ($maskable) {
                $graphics.FillRectangle($background, 0, 0, 140, 140)
                $graphics.TranslateTransform(12.6, 12.6)
                $graphics.ScaleTransform(0.82, 0.82)
            } else {
                $boundary = [System.Drawing.Drawing2D.GraphicsPath]::new()
                try {
                    $boundary.AddArc(0, 0, 64, 64, 180, 90)
                    $boundary.AddArc(76, 0, 64, 64, 270, 90)
                    $boundary.AddArc(76, 76, 64, 64, 0, 90)
                    $boundary.AddArc(0, 76, 64, 64, 90, 90)
                    $boundary.CloseFigure()
                    $graphics.FillPath($background, $boundary)
                } finally { $boundary.Dispose() }
            }
        } finally { $background.Dispose() }

        foreach ($group in $markXml.svg.g) {
            $brush = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml($group.fill))
            try {
                foreach ($shape in $group.path) {
                    $path = New-LogoPath $shape.d
                    try {
                        if ($Client) {
                            $fit = [System.Drawing.Drawing2D.Matrix]::new($scale, 0, 0, $scale, $left, $top)
                            try { $path.Transform($fit) } finally { $fit.Dispose() }
                        }
                        $graphics.FillPath($brush, $path)
                    } finally { $path.Dispose() }
                }
            } finally { $brush.Dispose() }
        }
        $bitmap.Save($buffer, [System.Drawing.Imaging.ImageFormat]::Png)
        return ,$buffer.ToArray()
    } finally {
        $buffer.Dispose()
        $graphics.Dispose()
        $bitmap.Dispose()
    }
}

$canvas = 'viewBox="0 0 140 140">'
$tile = '  <rect width="140" height="140" rx="32" fill="{0}"/>' -f $paper
$iconSvg = $markSource.Replace($canvas, "$canvas`n$tile")
$markContent = [regex]::Match($iconSvg, '(?s)<svg[^>]*>(.*)</svg>').Groups[1].Value.TrimEnd()
$lockupSvg = @"
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 440 140" role="img" aria-label="Koliwa">
  <g>
$markContent
  </g>
  <text x="165" y="97" fill="#41241C" font-family="Georgia, serif" font-size="76">Koliwa</text>
</svg>
"@
$png32 = New-IconPng 32 $false
$pngs = [ordered]@{
    'favicon-16.png' = New-IconPng 16 $false
    'favicon-32.png' = $png32
    'apple-touch-icon.png' = New-IconPng 180 $true
    'icon-192.png' = New-IconPng 192 $false
    'icon-512.png' = New-IconPng 512 $false
    'icon-512-maskable.png' = New-IconPng 512 $true
}

# Entrée ICO 32 bits contenant le même PNG pour les clients historiques.
$icoBuffer = [System.IO.MemoryStream]::new()
$writer = [System.IO.BinaryWriter]::new($icoBuffer)
try {
    $writer.Write([byte[]](0, 0, 1, 0, 1, 0, 32, 32, 0, 0, 1, 0, 32, 0))
    $writer.Write([uint32]$png32.Length)
    $writer.Write([uint32]22)
    $writer.Write([byte[]]$png32)
    $ico = $icoBuffer.ToArray()
} finally { $writer.Dispose() }

foreach ($target in $targets) {
    $public = Join-Path $repo "$target/public"
    [System.IO.File]::WriteAllText((Join-Path $public 'favicon.svg'), $iconSvg)
    if ($target -eq 'fasofree-frontend') {
        [System.IO.File]::WriteAllText((Join-Path $public 'koliwa-mark.svg'), $markSource)
    } elseif ($target -eq 'fasofree-agent') {
        [System.IO.File]::WriteAllText((Join-Path $public 'logo-icon.svg'), $iconSvg)
        [System.IO.File]::WriteAllText((Join-Path $public 'logo.svg'), $lockupSvg)
    }
    foreach ($entry in $pngs.GetEnumerator()) {
        $file = Join-Path $public $entry.Key
        if (Test-Path -LiteralPath $file) { [System.IO.File]::WriteAllBytes($file, $entry.Value) }
    }
    $icoFile = Join-Path $public 'favicon.ico'
    if (Test-Path -LiteralPath $icoFile) { [System.IO.File]::WriteAllBytes($icoFile, $ico) }
}
if (!$Client) {
    [System.IO.File]::WriteAllText((Join-Path $repo 'fasofree-frontend/src/assets/logo.svg'), $lockupSvg)
}
