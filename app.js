// ShoeFit AI Pro - Debug Version WITH CAMERA SUPPORT

class ShoeFitAI {
    constructor() {
        this.originalImage = null;
        this.scaleFactor = null;
        this.debugMode = true;

        // FILE UPLOAD ELEMENTS
        this.uploadArea = document.getElementById('uploadArea');
        this.fileInput = document.getElementById('fileInput');
        this.analysisSection = document.getElementById('analysisSection');
        this.mainCanvas = document.getElementById('mainCanvas');
        this.overlayCanvas = document.getElementById('overlayCanvas');
        this.processBtn = document.getElementById('processBtn');
        this.resetBtn = document.getElementById('resetBtn');
        this.results = document.getElementById('results');

        // CAMERA ELEMENTS
        this.startCameraBtn = document.getElementById("startCameraBtn");
        this.stopCameraBtn = document.getElementById("stopCameraBtn");
        this.captureBtn = document.getElementById("captureBtn");
        this.cameraVideo = document.getElementById("cameraVideo");
        this.captureCanvas = document.getElementById("captureCanvas");
        this.cameraContainer = document.getElementById("cameraContainer");

        this.cameraStream = null;

        this.ctx = this.mainCanvas.getContext('2d');
        this.overlayCtx = this.overlayCanvas.getContext('2d');

        this.init();
    }

    init() {
        // FILE UPLOAD EVENTS
        this.uploadArea.addEventListener('click', () => this.fileInput.click());

        this.fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) this.loadImage(e.target.files[0]);
        });

        this.processBtn.addEventListener('click', () => this.analyzeImage());
        this.resetBtn.addEventListener('click', () => this.reset());

        // CAMERA EVENTS
        this.startCameraBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            this.startCamera();
        });

        this.stopCameraBtn.addEventListener("click", () => this.stopCamera());
        this.captureBtn.addEventListener("click", () => this.capturePhoto());

        if (typeof cv !== 'undefined') {
            document.getElementById('loading').style.display = 'none';
        }
    }

    // ================= CAMERA FUNCTIONS =================

    async startCamera() {
        try {
            this.cameraStream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: "environment" }
            });

            this.cameraVideo.srcObject = this.cameraStream;
            this.cameraContainer.style.display = "block";

        } catch (err) {
            alert("Camera access denied or not supported.");
            console.error(err);
        }
    }

    stopCamera() {
        if (this.cameraStream) {
            this.cameraStream.getTracks().forEach(track => track.stop());
        }
        this.cameraContainer.style.display = "none";
    }

    capturePhoto() {
        const ctx = this.captureCanvas.getContext("2d");

        this.captureCanvas.width = this.cameraVideo.videoWidth;
        this.captureCanvas.height = this.cameraVideo.videoHeight;

        ctx.drawImage(this.cameraVideo, 0, 0);

        const img = new Image();
        img.onload = () => {
            this.originalImage = img;
            this.displayImage(img);
            this.analysisSection.style.display = 'block';
            this.results.style.display = 'none';
            this.analysisSection.scrollIntoView({ behavior: 'smooth' });
        };

        img.src = this.captureCanvas.toDataURL("image/png");

        this.stopCamera();
    }

    // ================= IMAGE LOAD =================

    loadImage(file) {
        if (!file.type.startsWith('image/')) {
            alert('Please upload an image file');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                this.originalImage = img;
                this.displayImage(img);
                this.analysisSection.style.display = 'block';
                this.results.style.display = 'none';
                this.analysisSection.scrollIntoView({ behavior: 'smooth' });
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }

    displayImage(img) {
        const maxWidth = 800;
        const scale = Math.min(1, maxWidth / img.width);

        this.mainCanvas.width = img.width * scale;
        this.mainCanvas.height = img.height * scale;
        this.overlayCanvas.width = this.mainCanvas.width;
        this.overlayCanvas.height = this.mainCanvas.height;

        this.ctx.drawImage(img, 0, 0, this.mainCanvas.width, this.mainCanvas.height);
    }

    // ================= OPEN CV ANALYSIS =================

    async analyzeImage() {
        if (typeof cv === 'undefined') {
            alert('OpenCV not loaded.');
            return;
        }

        if (!this.originalImage) {
            alert('Upload or capture an image first');
            return;
        }

        this.processBtn.disabled = true;
        this.processBtn.textContent = 'Processing...';

        try {
            await this.processWithOpenCV();
        } finally {
            this.processBtn.disabled = false;
            this.processBtn.textContent = 'Analyze Foot';
        }
    }

    async processWithOpenCV() {
        let src = cv.imread(this.mainCanvas);
        let gray = new cv.Mat();
        cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

        let thresh = new cv.Mat();
        cv.threshold(gray, thresh, 200, 255, cv.THRESH_BINARY);

        let contours = new cv.MatVector();
        let hierarchy = new cv.Mat();

        cv.findContours(thresh, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

        alert("Contours detected: " + contours.size());

        src.delete(); gray.delete(); thresh.delete();
        contours.delete(); hierarchy.delete();
    }

    reset() {
        this.originalImage = null;
        this.ctx.clearRect(0, 0, this.mainCanvas.width, this.mainCanvas.height);
        this.overlayCtx.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);
        this.analysisSection.style.display = 'none';
        this.results.style.display = 'none';
        this.fileInput.value = '';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.shoeFitAI = new ShoeFitAI();
});

function onOpenCvReady() {
    console.log('OpenCV ready');
    document.getElementById('loading').style.display = 'none';
}
