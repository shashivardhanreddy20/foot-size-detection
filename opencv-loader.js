// OpenCV.js loader and initialization
let cvReady = false;
let cvLoading = false;

function onOpenCvReady() {
    console.log('OpenCV.js is ready');
    cvReady = true;
    document.getElementById('loading').style.display = 'none';
}

// Check if OpenCV is loaded
function isCvReady() {
    return typeof cv !== 'undefined' && cvReady;
}


async function waitForCv(timeout = 30000) {
    const startTime = Date.now();
    
    while (!isCvReady()) {
        if (Date.now() - startTime > timeout) {
            throw new Error('OpenCV.js failed to load within timeout period');
        }
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    return true;
}