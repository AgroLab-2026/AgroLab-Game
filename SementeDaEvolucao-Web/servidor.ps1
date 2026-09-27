# Servidor estatico minimo em PowerShell (ja vem no Windows; nao precisa instalar nada).
# Uso: powershell -ExecutionPolicy Bypass -File servidor.ps1 [-Porta 8080]
param([int]$Porta = 8080)

$raiz = [IO.Path]::GetFullPath((Split-Path -Parent $MyInvocation.MyCommand.Path))
$tipos = @{
  '.html' = 'text/html; charset=utf-8'; '.js' = 'text/javascript; charset=utf-8'; '.mjs' = 'text/javascript; charset=utf-8'
  '.css' = 'text/css; charset=utf-8'; '.json' = 'application/json; charset=utf-8'; '.png' = 'image/png'
  '.jpg' = 'image/jpeg'; '.jpeg' = 'image/jpeg'; '.svg' = 'image/svg+xml'; '.woff2' = 'font/woff2'
  '.ico' = 'image/x-icon'; '.md' = 'text/markdown; charset=utf-8'
}

$ouvinte = New-Object System.Net.HttpListener
$ouvinte.Prefixes.Add("http://localhost:$Porta/")
try {
  $ouvinte.Start()
} catch {
  Write-Host "Nao consegui abrir a porta $Porta. Talvez outro programa ja esteja usando essa porta."
  Write-Host "Detalhe: $($_.Exception.Message)"
  exit 1
}
Write-Host "Semente da Evolucao rodando em http://localhost:$Porta/  (feche esta janela para parar o jogo)"

while ($ouvinte.IsListening) {
  $ctx = $ouvinte.GetContext()
  $resp = $ctx.Response
  try {
    $caminho = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath).TrimStart('/')
    if ($caminho -eq '' -or $caminho.EndsWith('/')) { $caminho = $caminho + 'index.html' }
    $arquivo = [IO.Path]::GetFullPath((Join-Path $raiz $caminho))
    if ($arquivo.StartsWith($raiz) -and (Test-Path -LiteralPath $arquivo -PathType Leaf)) {
      $bytes = [IO.File]::ReadAllBytes($arquivo)
      $ext = [IO.Path]::GetExtension($arquivo).ToLower()
      if ($tipos.ContainsKey($ext)) { $resp.ContentType = $tipos[$ext] } else { $resp.ContentType = 'application/octet-stream' }
      $resp.Headers.Add('Cache-Control', 'no-cache')
      $resp.ContentLength64 = $bytes.Length
      $resp.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
      $resp.StatusCode = 404
    }
  } catch {
    $resp.StatusCode = 500
  } finally {
    $resp.Close()
  }
}
