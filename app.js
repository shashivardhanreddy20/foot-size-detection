class ShoeFitAI {

constructor() {
this.uploadArea = document.getElementById("uploadArea");
this.fileInput = document.getElementById("fileInput");
this.mainCanvas = document.getElementById("mainCanvas");
this.processBtn = document.getElementById("processBtn");
this.results = document.getElementById("results");

this.ctx = this.mainCanvas.getContext("2d");

this.init();
}

init() {
this.uploadArea.onclick = () => this.fileInput.click();
this.fileInput.onchange = e => this.loadImage(e.target.files[0]);
this.processBtn.onclick = () => this.analyze();
}


// ================= LOAD IMAGE =================
loadImage(file) {
const reader = new FileReader();

reader.onload = e => {
const img = new Image();
img.onload = () => {
this.mainCanvas.width = img.width;
this.mainCanvas.height = img.height;
this.ctx.drawImage(img, 0, 0);
};
img.src = e.target.result;
};

reader.readAsDataURL(file);
}


// ================= MAIN ANALYSIS =================
analyze() {

let src = cv.imread(this.mainCanvas);
let gray = new cv.Mat();
let blur = new cv.Mat();
let edges = new cv.Mat();
let contours = new cv.MatVector();
let hierarchy = new cv.Mat();

// Convert to grayscale
cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

// Blur to remove noise
cv.GaussianBlur(gray, blur, new cv.Size(5,5), 0);

// Detect edges
cv.Canny(blur, edges, 30, 100);

// Find contours
cv.findContours(edges, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

let foot = null;
let reference = null;

for (let i = 0; i < contours.size(); i++) {

let cnt = contours.get(i);
let area = cv.contourArea(cnt);

// Ignore tiny contours
if (area < 5000) continue;

let rect = cv.boundingRect(cnt);
let aspectRatio = rect.width / rect.height;

// Detect A4 paper using aspect ratio
if ((aspectRatio > 0.6 && aspectRatio < 0.8) ||
    (aspectRatio > 1.2 && aspectRatio < 1.6)) {

reference = rect;

} else {

// Detect foot as largest remaining contour
if (!foot || area > foot.area) {
foot = { rect: rect, area: area };
}
}
}

// Check detection
if (!foot || !reference) {
alert("Ensure A4 paper and foot are clearly visible.");
return;
}


// ================= CONVERT PIXELS → CM =================

const A4_WIDTH_MM = 210; // A4 width = 210mm

let pixelsPerMM = reference.width / A4_WIDTH_MM;

let footLengthMM = Math.max(foot.rect.width, foot.rect.height) / pixelsPerMM;
let footWidthMM = Math.min(foot.rect.width, foot.rect.height) / pixelsPerMM;

let footCM = footLengthMM / 10;


// ================= SHOE SIZE CALCULATION =================

let uk = (footCM - 23) / 0.84;
let usMen = uk + 1;
let usWomen = uk + 2.5;
let eu = footCM * 1.5;


// ================= DISPLAY RESULTS =================

document.getElementById("footLength").innerText = footCM.toFixed(1) + " cm";
document.getElementById("footWidth").innerText = (footWidthMM/10).toFixed(1) + " cm";

document.getElementById("ukSize").innerText = uk.toFixed(1);
document.getElementById("usMenSize").innerText = usMen.toFixed(1);
document.getElementById("usWomenSize").innerText = usWomen.toFixed(1);
document.getElementById("euSize").innerText = eu.toFixed(1);

this.results.style.display = "block";


// Cleanup memory
src.delete();
gray.delete();
blur.delete();
edges.delete();
contours.delete();
hierarchy.delete();
}

}

document.addEventListener("DOMContentLoaded", () => new ShoeFitAI());
