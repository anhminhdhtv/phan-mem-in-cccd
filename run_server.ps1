# PowerShell Web Server for CCCD Printing & Export Tool
# Port: 5050 (to avoid conflict with print calculator on port 5000)

$port = 5050
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")

try {
    $listener.Start()
    Write-Host "=== CCCD PRINT SERVER STARTED ===" -ForegroundColor Green
    Write-Host "Listening at: http://localhost:$port" -ForegroundColor Green
    
    # Auto-open in MS Edge app mode, fallback to default browser
    try {
        Start-Process "msedge.exe" -ArgumentList "--app=http://localhost:$port", "--window-size=1280,800"
    } catch {
        Start-Process "http://localhost:$port"
    }
} catch {
    # If port already in use, just open the browser
    try {
        Start-Process "msedge.exe" -ArgumentList "--app=http://localhost:$port", "--window-size=1280,800"
    } catch {
        Start-Process "http://localhost:$port"
    }
    exit
}

$global:LastPingTime = [DateTime]::Now
$global:HasReceivedFirstPing = $false
$global:ShutdownRequested = $false
$global:ShutdownRequestTime = [DateTime]::Now

# Serve static files loop
while ($listener.IsListening) {
    try {
        $result = $listener.BeginGetContext($null, $null)
        
        # Wait for incoming connection using short polling intervals to remain responsive
        while (-not $result.AsyncWaitHandle.WaitOne(200)) {
            if (-not $listener.IsListening) {
                break
            }
            
            # Check shutdown request timeout (2 seconds grace period for page refresh)
            if ($global:ShutdownRequested) {
                $shutdownDiff = ([DateTime]::Now - $global:ShutdownRequestTime).TotalSeconds
                if ($shutdownDiff -ge 2) {
                    Write-Host "Shutdown request timeout reached. Stopping server..." -ForegroundColor Yellow
                    $listener.Stop()
                    break
                }
            }
            
            # Check heartbeat timeout
            $pingDiff = ([DateTime]::Now - $global:LastPingTime).TotalSeconds
            $timeoutLimit = if ($global:HasReceivedFirstPing) { 10 } else { 30 }
            if ($pingDiff -gt $timeoutLimit) {
                Write-Host "No heartbeat received in $pingDiff seconds. Stopping server..." -ForegroundColor Yellow
                $listener.Stop()
                break
            }
        }
        
        if (-not $listener.IsListening) {
            break
        }
        
        $context = $listener.EndGetContext($result)
        $request = $context.Request
        $response = $context.Response
        
        $path = $request.Url.LocalPath
        $method = $request.HttpMethod
        
        # Enable CORS
        $response.Headers.Add("Access-Control-Allow-Origin", "*")
        $response.Headers.Add("Cache-Control", "no-cache, no-store, must-revalidate")
        
        if ($method -eq "OPTIONS") {
            $response.StatusCode = 200
            $response.Close()
            continue
        }
        
        # Route mapping
        $fileToServe = ""
        $contentType = "text/plain"
        
        if ($path -eq "/ping") {
            $global:LastPingTime = [DateTime]::Now
            $global:HasReceivedFirstPing = $true
            $global:ShutdownRequested = $false  # Cancel any pending shutdown
            
            $response.StatusCode = 200
            $response.ContentType = "text/plain"
            $bytes = [System.Text.Encoding]::UTF8.GetBytes("pong")
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
            $response.Close()
            continue
        }
        elseif ($path -eq "/shutdown") {
            $global:ShutdownRequested = $true
            $global:ShutdownRequestTime = [DateTime]::Now
            
            $response.StatusCode = 200
            $response.ContentType = "text/plain"
            $bytes = [System.Text.Encoding]::UTF8.GetBytes("shutdown initiated")
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
            $response.Close()
            continue
        }
        elseif ($path -eq "/" -or $path -eq "/index.html") {
            $fileToServe = Join-Path $PSScriptRoot "index.html"
            $contentType = "text/html; charset=utf-8"
        }
        elseif ($path -eq "/styles.css") {
            $fileToServe = Join-Path $PSScriptRoot "styles.css"
            $contentType = "text/css; charset=utf-8"
        }
        elseif ($path -eq "/app.js") {
            $fileToServe = Join-Path $PSScriptRoot "app.js"
            $contentType = "application/javascript; charset=utf-8"
        }
        elseif ($path -eq "/opencv.js") {
            $fileToServe = Join-Path $PSScriptRoot "opencv.js"
            $contentType = "application/javascript; charset=utf-8"
        }
        elseif ($path -eq "/sample_front.png") {
            $fileToServe = Join-Path $PSScriptRoot "sample_front.png"
            $contentType = "image/png"
        }
        elseif ($path -eq "/sample_back.png") {
            $fileToServe = Join-Path $PSScriptRoot "sample_back.png"
            $contentType = "image/png"
        }
        
        if ($fileToServe -ne "" -and (Test-Path $fileToServe)) {
            $bytes = [System.IO.File]::ReadAllBytes($fileToServe)
            $response.ContentType = $contentType
            $response.StatusCode = 200
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
        } else {
            $response.StatusCode = 404
        }
        
        $response.Close()
    }
    catch {
        if (-not $listener.IsListening) {
            break
        }
        if ($response) {
            try {
                $response.StatusCode = 500
                $response.Close()
            } catch {}
        }
    }
}
