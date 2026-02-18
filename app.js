const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const cameraSelect = document.getElementById('cameraSelect');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const requestPermissionBtn = document.getElementById('requestPermissionBtn');
const status = document.getElementById('status');
const statusIndicator = document.getElementById('statusIndicator');
const facesGrid = document.getElementById('facesGrid');
const facesCount = document.getElementById('facesCount');
const placeholder = document.getElementById('placeholder');

let stream = null;
let isDetecting = false;
let detectionInterval = null;
let modelsLoaded = false;
let faces = {};
let faceIdCounter = 0;
const FACE_MATCH_THRESHOLD = 0.6;

async function loadModels() {
    try {
        status.textContent = '正在加载模型...';
        console.log('开始加载face-api.js...');
        
        const cdnUrls = [
            'https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/dist/face-api.min.js',
            'https://unpkg.com/face-api.js@0.22.2/dist/face-api.min.js',
            'https://cdnjs.cloudflare.com/ajax/libs/face-api.js/0.22.2/face-api.min.js'
        ];
        
        let scriptLoaded = false;
        
        for (const url of cdnUrls) {
            try {
                const script = document.createElement('script');
                script.src = url;
                
                await new Promise((resolve, reject) => {
                    script.onload = () => {
                        scriptLoaded = true;
                        resolve();
                    };
                    script.onerror = () => {
                        console.log(`CDN加载失败: ${url}`);
                        reject(new Error('CDN加载失败'));
                    };
                    document.head.appendChild(script);
                    
                    setTimeout(() => reject(new Error('加载超时')), 10000);
                });
                
                if (scriptLoaded) {
                    console.log(`face-api.js从 ${url} 加载完成`);
                    break;
                }
            } catch (error) {
                continue;
            }
        }
        
        if (!scriptLoaded) {
            throw new Error('所有CDN都无法加载face-api.js');
        }
        
        console.log('face-api.js加载完成');
        console.log('开始加载tinyFaceDetector模型...');
        await faceapi.nets.tinyFaceDetector.loadFromUri('./models');
        console.log('tinyFaceDetector模型加载完成');
        
        console.log('开始加载faceLandmark68Net模型...');
        await faceapi.nets.faceLandmark68Net.loadFromUri('./models');
        console.log('faceLandmark68Net模型加载完成');
        
        console.log('开始加载faceRecognitionNet模型...');
        await faceapi.nets.faceRecognitionNet.loadFromUri('./models');
        console.log('faceRecognitionNet模型加载完成');
        
        loadFacesFromStorage();
        
        modelsLoaded = true;
        status.textContent = '模型加载完成，请选择摄像头';
        console.log('所有模型加载完成');
    } catch (error) {
        status.textContent = '模型加载失败: ' + error.message;
        console.error('模型加载错误:', error);
        console.error('错误堆栈:', error.stack);
    }
}

function saveFacesToStorage() {
    const facesData = {};
    for (const [id, face] of Object.entries(faces)) {
        facesData[id] = {
            id: face.id,
            name: face.name,
            descriptor: Array.from(face.descriptor),
            image: face.image,
            time: face.time
        };
    }
    localStorage.setItem('faces', JSON.stringify(facesData));
    if (faceIdCounter > 0) {
        localStorage.setItem('faceIdCounter', faceIdCounter.toString());
    }
}

function loadFacesFromStorage() {
    const facesData = localStorage.getItem('faces');
    const savedCounter = localStorage.getItem('faceIdCounter');
    if (facesData) {
        const parsed = JSON.parse(facesData);
        faces = {};
        for (const [id, face] of Object.entries(parsed)) {
            faces[id] = {
                id: face.id,
                name: face.name,
                descriptor: new Float32Array(face.descriptor),
                image: face.image,
                time: face.time
            };
        }
        faceIdCounter = savedCounter ? parseInt(savedCounter) : 0;
        updateFacesGrid();
    }
}

function mergeSimilarFaces() {
    const faceIds = Object.keys(faces);
    if (faceIds.length < 2) return;
    
    const merged = new Set();
    
    for (let i = 0; i < faceIds.length; i++) {
        if (merged.has(faceIds[i])) continue;
        
        for (let j = i + 1; j < faceIds.length; j++) {
            if (merged.has(faceIds[j])) continue;
            
            const desc1 = faces[faceIds[i]].descriptor;
            const desc2 = faces[faceIds[j]].descriptor;
            const distance = faceapi.euclideanDistance(desc1, desc2);
            
            if (distance < FACE_MATCH_THRESHOLD) {
                if (!faces[faceIds[i]].name && faces[faceIds[j]].name) {
                    faces[faceIds[i]].name = faces[faceIds[j]].name;
                }
                delete faces[faceIds[j]];
                merged.add(faceIds[j]);
            }
        }
    }
    
    saveFacesToStorage();
    updateFacesGrid();
}

function findMatchingFace(descriptor) {
    let bestMatch = null;
    let bestDistance = Infinity;
    
    for (const [id, face] of Object.entries(faces)) {
        const distance = faceapi.euclideanDistance(descriptor, face.descriptor);
        if (distance < bestDistance && distance < FACE_MATCH_THRESHOLD) {
            bestDistance = distance;
            bestMatch = id;
        }
    }
    
    return bestMatch;
}

async function getCameras() {
    try {
        let devices;
        try {
            devices = await navigator.mediaDevices.enumerateDevices();
        } catch (e) {
            console.error('enumerateDevices失败:', e);
        }
        
        let videoDevices = devices ? devices.filter(device => device.kind === 'videoinput') : [];
        
        cameraSelect.innerHTML = '<option value="">选择摄像头</option>';
        videoDevices.forEach((device, index) => {
            const option = document.createElement('option');
            option.value = device.deviceId;
            option.textContent = device.label || `摄像头 ${index + 1}`;
            cameraSelect.appendChild(option);
        });
    } catch (error) {
        console.error('获取摄像头错误:', error);
    }
}

async function startCamera(deviceId) {
    try {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
        }
        
        const constraints = {
            video: {
                deviceId: deviceId ? { exact: deviceId } : undefined,
                width: { ideal: 1280 },
                height: { ideal: 720 }
            }
        };
        
        status.textContent = '正在请求摄像头权限...';
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        video.srcObject = stream;
        
        await new Promise((resolve) => {
            video.onloadedmetadata = () => {
                const videoWrapper = document.querySelector('.video-wrapper');
                canvas.width = videoWrapper.clientWidth;
                canvas.height = videoWrapper.clientHeight;
                resolve();
            };
        });
        
        await getCameras();
        
        status.textContent = '摄像头已启动';
    } catch (error) {
        let errorMsg = '启动摄像头失败: ';
        if (error.name === 'NotAllowedError') {
            errorMsg += '请允许访问摄像头权限';
        } else if (error.name === 'NotFoundError') {
            errorMsg += '未找到摄像头';
        } else if (error.name === 'NotReadableError') {
            errorMsg += '摄像头被其他程序占用';
        } else {
            errorMsg += error.message;
        }
        status.textContent = errorMsg;
        console.error('启动摄像头错误:', error);
    }
}

async function requestCameraPermission() {
    try {
        status.textContent = '正在请求摄像头权限...';
        
        const tempStream = await navigator.mediaDevices.getUserMedia({ video: true });
        tempStream.getTracks().forEach(track => track.stop());
        
        await getCameras();
        
        status.textContent = '摄像头权限已获得，请选择摄像头';
        requestPermissionBtn.disabled = true;
    } catch (error) {
        let errorMsg = '请求权限失败: ';
        if (error.name === 'NotAllowedError') {
            errorMsg += '请允许访问摄像头权限';
        } else {
            errorMsg += error.message;
        }
        status.textContent = errorMsg;
        console.error('请求权限错误:', error);
    }
}

function getFaceId(box) {
    const centerX = box.x + box.width / 2;
    const centerY = box.y + box.height / 2;
    
    for (const [id, face] of Object.entries(faces)) {
        const faceCenterX = face.box.x + face.box.width / 2;
        const faceCenterY = face.box.y + face.box.height / 2;
        const distance = Math.sqrt(Math.pow(centerX - faceCenterX, 2) + Math.pow(centerY - faceCenterY, 2));
        
        if (distance < 50) {
            return id;
        }
    }
    
    return null;
}

function captureFace(box) {
    const faceCanvas = document.createElement('canvas');
    faceCanvas.width = box.width;
    faceCanvas.height = box.height;
    const faceCtx = faceCanvas.getContext('2d');
    
    faceCtx.drawImage(video, box.x, box.y, box.width, box.height, 0, 0, box.width, box.height);
    
    return faceCanvas.toDataURL('image/jpeg', 0.8);
}

function updateFacesGrid() {
    const faceIds = Object.keys(faces);
    facesCount.textContent = `共 ${faceIds.length} 张`;
    
    if (faceIds.length === 0) {
        facesGrid.innerHTML = '<div class="no-faces">暂无识别到的人脸</div>';
        return;
    }
    
    facesGrid.innerHTML = '';
    
    faceIds.forEach(id => {
        const face = faces[id];
        const faceItem = document.createElement('div');
        faceItem.className = 'face-item';
        
        const img = document.createElement('img');
        img.className = 'face-image';
        img.src = face.image;
        
        const info = document.createElement('div');
        info.className = 'face-info';
        
        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.className = 'face-name-input';
        nameInput.value = face.name || '';
        nameInput.placeholder = '输入名字';
        nameInput.addEventListener('change', () => {
            faces[id].name = nameInput.value.trim() || null;
            saveFacesToStorage();
        });
        
        const time = document.createElement('div');
        time.className = 'face-time';
        time.textContent = face.time;
        
        info.appendChild(nameInput);
        info.appendChild(time);
        faceItem.appendChild(img);
        faceItem.appendChild(info);
        facesGrid.appendChild(faceItem);
    });
}

async function detectFaces() {
    if (!isDetecting || !modelsLoaded) return;
    
    try {
        const detectionsWithLandmarks = await faceapi.detectAllFaces(video, new faceapi.TinyFaceDetectorOptions({
            inputSize: 512,
            scoreThreshold: 0.3
        })).withFaceLandmarks().withFaceDescriptors();
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        const videoRatio = video.videoWidth / video.videoHeight;
        const canvasRatio = canvas.width / canvas.height;
        
        let drawWidth, drawHeight, offsetX, offsetY;
        
        if (videoRatio > canvasRatio) {
            drawWidth = canvas.width;
            drawHeight = canvas.width / videoRatio;
            offsetX = 0;
            offsetY = (canvas.height - drawHeight) / 2;
        } else {
            drawHeight = canvas.height;
            drawWidth = canvas.height * videoRatio;
            offsetX = (canvas.width - drawWidth) / 2;
            offsetY = 0;
        }
        
        const scaleX = drawWidth / video.videoWidth;
        const scaleY = drawHeight / video.videoHeight;
        
        detectionsWithLandmarks.forEach((result, index) => {
            const box = result.detection.box;
            const displayBox = {
                x: box.x * scaleX + offsetX,
                y: box.y * scaleY + offsetY,
                width: box.width * scaleX,
                height: box.height * scaleY
            };
            
            const descriptor = result.descriptor;
            const matchingId = findMatchingFace(descriptor);
            const id = matchingId || (++faceIdCounter).toString();
            
            const now = new Date();
            const timeStr = now.toLocaleTimeString('zh-CN');
            
            if (!matchingId) {
                faces[id] = {
                    id: id,
                    descriptor: descriptor,
                    image: captureFace(box),
                    time: timeStr
                };
            } else {
                faces[id].descriptor = descriptor;
                faces[id].image = captureFace(box);
                faces[id].time = timeStr;
            }
            
            const name = faces[id].name || `人脸 #${id}`;
            ctx.strokeStyle = '#00ff00';
            ctx.lineWidth = 2;
            ctx.strokeRect(displayBox.x, displayBox.y, displayBox.width, displayBox.height);
            
            ctx.fillStyle = '#00ff00';
            ctx.font = '14px Arial';
            ctx.fillText(name, displayBox.x, displayBox.y - 5);
        });
        
        saveFacesToStorage();
        mergeSimilarFaces();
        updateFacesGrid();
        
        status.textContent = `检测到 ${detectionsWithLandmarks.length} 张人脸，共记录 ${Object.keys(faces).length} 张`;
    } catch (error) {
        console.error('人脸检测错误:', error);
        console.error('错误堆栈:', error.stack);
    }
}

async function startDetection() {
    if (!modelsLoaded) {
        status.textContent = '请等待模型加载完成';
        return;
    }
    
    const deviceId = cameraSelect.value;
    if (!deviceId) {
        status.textContent = '请先选择摄像头';
        return;
    }
    
    await startCamera(deviceId);
    
    placeholder.style.display = 'none';
    video.style.display = 'block';
    statusIndicator.classList.add('active');
    
    isDetecting = true;
    startBtn.disabled = true;
    stopBtn.disabled = false;
    cameraSelect.disabled = true;
    
    detectionInterval = setInterval(detectFaces, 100);
}

function stopDetection() {
    isDetecting = false;
    
    if (detectionInterval) {
        clearInterval(detectionInterval);
        detectionInterval = null;
    }
    
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
    }
    
    placeholder.style.display = 'block';
    video.style.display = 'none';
    statusIndicator.classList.remove('active');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    faces = {};
    faceIdCounter = 0;
    facesGrid.innerHTML = '<div class="no-faces">暂无识别到的人脸</div>';
    facesCount.textContent = '共 0 张';
    
    startBtn.disabled = false;
    stopBtn.disabled = true;
    cameraSelect.disabled = false;
    requestPermissionBtn.disabled = false;
    
    status.textContent = '检测已停止';
}

requestPermissionBtn.addEventListener('click', requestCameraPermission);
startBtn.addEventListener('click', startDetection);
stopBtn.addEventListener('click', stopDetection);
cameraSelect.addEventListener('change', async () => {
    if (isDetecting) {
        await startCamera(cameraSelect.value);
    }
});

window.addEventListener('resize', () => {
    if (isDetecting) {
        const videoWrapper = document.querySelector('.video-wrapper');
        canvas.width = videoWrapper.clientWidth;
        canvas.height = videoWrapper.clientHeight;
    }
});

loadModels();
getCameras();
