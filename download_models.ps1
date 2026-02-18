# Model download script
Write-Host "Downloading face-api.js model files..." -ForegroundColor Green

$baseUrl = "https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights"
$cdnUrl = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model"
$models = @(
    "tiny_face_detector_model-weights_manifest.json",
    "tiny_face_detector_model-shard1",
    "face_landmark_68_model-weights_manifest.json",
    "face_landmark_68_model-shard1",
    "face_landmark_68_model-shard2",
    "face_recognition_model-weights_manifest.json",
    "face_recognition_model-shard1",
    "face_recognition_model-shard2"
)

$modelsDir = "models"
if (-not (Test-Path $modelsDir)) {
    New-Item -ItemType Directory -Path $modelsDir -Force | Out-Null
}

foreach ($model in $models) {
    $url = "$baseUrl/$model"
    $output = "$modelsDir\$model"
    
    Write-Host "Downloading $model..." -ForegroundColor Yellow
    
    $downloaded = $false
    
    try {
        $ProgressPreference = 'SilentlyContinue'
        Invoke-WebRequest -Uri $url -OutFile $output -UseBasicParsing -TimeoutSec 60
        Write-Host "OK $model downloaded" -ForegroundColor Green
        $downloaded = $true
    } catch {
        Write-Host "GitHub download failed, trying CDN..." -ForegroundColor Yellow
        
        try {
            $cdnDownloadUrl = "$cdnUrl/$model"
            $ProgressPreference = 'SilentlyContinue'
            Invoke-WebRequest -Uri $cdnDownloadUrl -OutFile $output -UseBasicParsing -TimeoutSec 60
            Write-Host "OK $model downloaded" -ForegroundColor Green
            $downloaded = $true
        } catch {
            Write-Host "FAIL $model download failed: $_" -ForegroundColor Red
        }
    }
    
    if (-not $downloaded) {
        Write-Host "WARNING: $model download failed, may affect functionality" -ForegroundColor Yellow
    }
}

Write-Host "`nModel download complete!" -ForegroundColor Green
