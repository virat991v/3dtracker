import { HandLandmarker, FilesetResolver } from 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3';

const video = document.getElementById("webcam");
const canvasElement = document.getElementById("output_canvas");
const canvasCtx = canvasElement.getContext("2d");
const loadingEl = document.getElementById("loading");
const clearBtn = document.getElementById("clear-btn");
const colorPicker = document.getElementById("ink-color");

let handLandmarker = undefined;
let webcamRunning = false;
let lastVideoTime = -1;

let prevX = null;
let prevY = null;
let inkColor = colorPicker.value;

colorPicker.addEventListener("input", (e) => {
    inkColor = e.target.value;
});

const createHandLandmarker = async () => {
    // Load the vision tasks models
    const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
    );
    handLandmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
            delegate: "GPU"
        },
        runningMode: "VIDEO",
        numHands: 1
    });
    
    // Hide loading pill and start camera
    loadingEl.style.display = "none";
    enableCam();
};
createHandLandmarker();

function enableCam() {
    if (!handLandmarker) return;
    const constraints = { video: { width: 1280, height: 720 } };
    
    navigator.mediaDevices.getUserMedia(constraints).then((stream) => {
        video.srcObject = stream;
        video.addEventListener("loadeddata", predictWebcam);
    });
}

function predictWebcam() {
    // Sync canvas resolution to video stream resolution
    if (canvasElement.width !== video.videoWidth) {
        canvasElement.width = video.videoWidth;
        canvasElement.height = video.videoHeight;
    }
    
    let startTimeMs = performance.now();
    if (lastVideoTime !== video.currentTime) {
        lastVideoTime = video.currentTime;
        let results = handLandmarker.detectForVideo(video, startTimeMs);
        
        if (results.landmarks && results.landmarks.length > 0) {
            const landmarks = results.landmarks[0];
            
            // Check finger states
            const indexTip = landmarks[8];
            const indexBase = landmarks[5];
            const middleTip = landmarks[12];
            const middleBase = landmarks[9];
            const ringTip = landmarks[16];
            const ringBase = landmarks[13];
            const pinkyTip = landmarks[20];
            const pinkyBase = landmarks[17];
            
            const indexUp = indexTip.y < indexBase.y;
            const middleUp = middleTip.y < middleBase.y;
            const ringUp = ringTip.y < ringBase.y;
            const pinkyUp = pinkyTip.y < pinkyBase.y;
            
            // The coordinates are 0-1, multiply by canvas width/height to get pixels
            const px = indexTip.x * canvasElement.width;
            const py = indexTip.y * canvasElement.height;

            if (indexUp && middleUp && ringUp && pinkyUp) {
                // All fingers up: clear the canvas
                canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
                prevX = null;
                prevY = null;
            } else if (indexUp && !middleUp) {
                // ONLY index finger up: Draw Mode!
                if (prevX !== null && prevY !== null) {
                    canvasCtx.beginPath();
                    canvasCtx.moveTo(prevX, prevY);
                    canvasCtx.lineTo(px, py);
                    canvasCtx.lineWidth = 6;
                    canvasCtx.lineCap = 'round';
                    canvasCtx.strokeStyle = inkColor;
                    
                    // Shiny neon glow effect
                    canvasCtx.shadowColor = inkColor;
                    canvasCtx.shadowBlur = 15;
                    
                    canvasCtx.stroke();
                }
                prevX = px;
                prevY = py;
            } else {
                // Stop Drawing (e.g., Peace sign or making a fist)
                prevX = null;
                prevY = null;
            }
        } else {
            // Hand not detected
            prevX = null;
            prevY = null;
        }
    }
    window.requestAnimationFrame(predictWebcam);
}

// Manual clear button
clearBtn.addEventListener("click", () => {
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
});
