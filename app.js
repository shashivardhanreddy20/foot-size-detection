// ShoeFit AI Pro - Debug Version

class ShoeFitAI {
    constructor() {
        this.originalImage = null;
        this.scaleFactor = null;
        this.debugMode = true;
        
        this.uploadArea = document.getElementById('uploadArea');
        this.fileInput = document.getElementById('fileInput');
        this.analysisSection = document.getElementById('analysisSection');
        this.mainCanvas = document.getElementById('mainCanvas');
        this.overlayCanvas = document.getElementById('overlayCanvas');
        this.processBtn = document.getElementById('processBtn');
        this.resetBtn = document.getElementById('resetBtn');
        this.results = document.getElementById('results');
        
        this.ctx = this.mainCanvas.getContext('2d');
        this.overlayCtx = this.overlayCanvas.getContext('2d');
        
        this.init();
    }
    
    init() {
        this.uploadArea.addEventListener('click', () => this.fileInput.click());
        this.fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) this.loadImage(e.target.files[0]);
        });
        
        this.processBtn.addEventListener('click', () => this.analyzeImage());
        this.resetBtn.addEventListener('click', () => this.reset());
        
        if (typeof cv !== 'undefined') {
            document.getElementById('loading').style.display = 'none';
        }
    }
    
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
    
    async analyzeImage() {
        if (typeof cv === 'undefined') {
            alert('OpenCV not loaded. Please wait and try again.');
            return;
        }
        
        if (!this.originalImage) {
            alert('Please upload an image first');
            return;
        }
        
        this.processBtn.disabled = true;
        this.processBtn.textContent = 'Processing...';
        this.results.style.display = 'none';
        this.overlayCtx.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);
        
        try {
            await this.processWithOpenCV();
        } catch (error) {
            console.error('Error:', error);
            alert(error.message);
        } finally {
            this.processBtn.disabled = false;
            this.processBtn.textContent = 'Analyze Foot';
        }
    }
    
    async processWithOpenCV() {
        // Read image from canvas
        let src = cv.imread(this.mainCanvas);
        
        // Convert to grayscale
        let gray = new cv.Mat();
        cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
        
        // Apply threshold to find white paper (better than edges for your photo)
        let thresh = new cv.Mat();
        cv.threshold(gray, thresh, 200, 255, cv.THRESH_BINARY);
        
        // Find contours on thresholded image
        let contours = new cv.MatVector();
        let hierarchy = new cv.Mat();
        cv.findContours(thresh, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
        
        console.log('Total contours found:', contours.size());
        
        // Analyze contours
        let analysis = this.analyzeContours(contours, src);
        
        // If no A4 found, try edge detection as fallback
        if (!analysis.a4) {
            console.log('Trying edge detection...');
            
            let edges = new cv.Mat();
            cv.Canny(gray, edges, 50, 150);
            
            let kernel = cv.Mat.ones(3, 3, cv.CV_8U);
            cv.dilate(edges, edges, kernel);
            kernel.delete();
            
            let edgeContours = new cv.MatVector();
            let edgeHierarchy = new cv.Mat();
            cv.findContours(edges, edgeContours, edgeHierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
            
            console.log('Edge contours:', edgeContours.size());
            
            analysis = this.analyzeContours(edgeContours, src);
            
            edges.delete();
            edgeContours.delete();
            edgeHierarchy.delete();
        }
        
        // Draw ALL contours for debugging
        this.drawDebugContours(analysis.allContours);
        
        // Check results
        if (!analysis.a4) {
            // Show debug info instead of error
            this.showDebugInfo(analysis);
            throw new Error('A4 not detected. Check debug overlay above. Try better lighting or contrast.');
        }
        
        if (!analysis.foot) {
            this.showDebugInfo(analysis);
            throw new Error('Foot not detected. Check debug overlay. Ensure foot is next to A4.');
        }
        
        // Draw final results
        this.drawResults(analysis);
        this.calculateMeasurements(analysis);
        
        // Cleanup
        src.delete();
        gray.delete();
        thresh.delete();
        contours.delete();
        hierarchy.delete();
    }
    
    analyzeContours(contours, src) {
        let results = {
            foot: null,
            a4: null,
            allContours: []
        };
        
        let imgArea = src.cols * src.rows;
        let minArea = imgArea * 0.01;  // Very small threshold
        let maxArea = imgArea * 0.9;
        
        for (let i = 0; i < contours.size(); i++) {
            let contour = contours.get(i);
            let area = cv.contourArea(contour);
            
            if (area < minArea || area > maxArea) continue;
            
            let rect = cv.boundingRect(contour);
            let aspectRatio = rect.width / rect.height;
            
            // Get rotated rectangle
            let rotatedRect = cv.minAreaRect(contour);
            let rotW = rotatedRect.size.width;
            let rotH = rotatedRect.size.height;
            let rotatedAspect = Math.max(rotW, rotH) / Math.min(rotW, rotH);
            
            // Calculate extent
            let extent = area / (rect.width * rect.height);
            
            // Convex hull
            let hull = new cv.Mat();
            cv.convexHull(contour, hull);
            let hullArea = cv.contourArea(hull);
            let solidity = (hullArea > 0) ? area / hullArea : 0;
            hull.delete();
            
            // VERY RELAXED A4 detection
            // A4 is approximately 1.4 aspect ratio
            let isA4Shape = (rotatedAspect > 1.2 && rotatedAspect < 1.8) || 
                           (aspectRatio > 0.5 && aspectRatio < 0.9) ||
                           (aspectRatio > 1.1 && aspectRatio < 2.0);
            
            // Paper is usually the most rectangular (high extent)
            let isA4 = isA4Shape && extent > 0.6;
            
            // Foot detection - more irregular shape
            let isFootShape = (aspectRatio > 0.2 && aspectRatio < 1.0) || 
                             (aspectRatio > 1.0 && aspectRatio < 4.0);
            let isFoot = isFootShape && solidity < 0.95 && extent < 0.85;
            
            results.allContours.push({
                id: i,
                contour: contour,
                area: area,
                rect: rect,
                rotatedRect: rotatedRect,
                aspectRatio: aspectRatio,
                rotatedAspect: rotatedAspect,
                extent: extent,
                solidity: solidity,
                isA4: isA4,
                isFoot: isFoot,
                centerX: rect.x + rect.width/2,
                centerY: rect.y + rect.height/2
            });
        }
        
        // Sort by area
        results.allContours.sort((a, b) => b.area - a.area);
        
        console.log('All contours:', results.allContours.map(c => ({
            id: c.id,
            area: Math.round(c.area),
            aspect: c.aspectRatio.toFixed(2),
            rotAspect: c.rotatedAspect.toFixed(2),
            extent: c.extent.toFixed(2),
            isA4: c.isA4,
            isFoot: c.isFoot
        })));
        
        // Find A4 - largest rectangular object with ~1.4 aspect
        let a4Candidates = results.allContours.filter(c => c.rotatedAspect > 1.2 && c.rotatedAspect < 1.8 && c.extent > 0.5);
        if (a4Candidates.length > 0) {
            // Pick the one closest to 1.414
            results.a4 = a4Candidates.sort((a, b) => 
                Math.abs(a.rotatedAspect - 1.414) - Math.abs(b.rotatedAspect - 1.414)
            )[0];
            console.log('A4 found:', results.a4.id, 'aspect:', results.a4.rotatedAspect.toFixed(2));
        } else {
            // Fallback: just pick largest reasonable object
            let fallback = results.allContours.find(c => c.rotatedAspect > 1.0 && c.rotatedAspect < 2.5);
            if (fallback) {
                results.a4 = fallback;
                console.log('A4 fallback:', fallback.id);
            }
        }
        
        // Find foot - object near A4
        if (results.a4) {
            let footCandidates = results.allContours.filter(c => {
                if (c === results.a4) return false;
                
                // Calculate distance from A4
                let dx = c.centerX - results.a4.centerX;
                let dy = c.centerY - results.a4.centerY;
                let distance = Math.sqrt(dx*dx + dy*dy);
                
                // Foot should be nearby
                return distance < 500 && c.area > results.a4.area * 0.1;
            });
            
            if (footCandidates.length > 0) {
                // Pick the largest one near A4
                results.foot = footCandidates.sort((a, b) => b.area - a.area)[0];
                console.log('Foot found:', results.foot.id, 'area:', Math.round(results.foot.area));
            }
        }
        
        return results;
    }
    
    drawDebugContours(allContours) {
        // Draw all detected contours with numbers
        allContours.forEach((item, idx) => {
            // Color code: Red = A4 candidate, Green = Foot candidate, White = Other
            let color = item.isA4 ? 'rgba(255,0,0,0.7)' : 
                       item.isFoot ? 'rgba(0,255,0,0.7)' : 
                       'rgba(255,255,255,0.3)';
            
            this.drawContour(item.contour, color, idx.toString(), 2);
            
            // Draw info text below each contour
            let rect = item.rect;
            this.overlayCtx.fillStyle = color;
            this.overlayCtx.font = '10px Arial';
            let text = `#${idx} A:${Math.round(item.area/1000)}k R:${item.rotatedAspect.toFixed(1)}`;
            this.overlayCtx.fillText(text, rect.x, rect.y + rect.height + 12);
        });
        
        // Draw legend
        this.overlayCtx.fillStyle = 'rgba(255,0,0,0.7)';
        this.overlayCtx.fillRect(10, 10, 15, 15);
        this.overlayCtx.fillStyle = 'white';
        this.overlayCtx.font = '12px Arial';
        this.overlayCtx.fillText('= A4 Candidate', 30, 22);
        
        this.overlayCtx.fillStyle = 'rgba(0,255,0,0.7)';
        this.overlayCtx.fillRect(10, 35, 15, 15);
        this.overlayCtx.fillStyle = 'white';
        this.overlayCtx.fillText('= Foot Candidate', 30, 47);
    }
    
    showDebugInfo(analysis) {
        // Create debug info display
        let info = `Detected ${analysis.allContours.length} objects:\n`;
        analysis.allContours.forEach(c => {
            info += `#${c.id}: Area=${Math.round(c.area)}, Aspect=${c.rotatedAspect.toFixed(2)}, Extent=${c.extent.toFixed(2)}\n`;
        });
        
        if (analysis.a4) {
            info += `\nBest A4 match: #${analysis.a4.id} (aspect ${analysis.a4.rotatedAspect.toFixed(2)})`;
        } else {
            info += `\nNo A4 found - check aspect ratios (should be ~1.4)`;
        }
        
        console.log(info);
        
        // Show on screen
        let debugDiv = document.createElement('div');
        debugDiv.style.cssText = 'background:#1e293b;color:#94a3b8;padding:15px;margin:10px 0;border-radius:8px;font-family:monospace;font-size:12px;white-space:pre-wrap;';
        debugDiv.textContent = info;
        
        let existing = document.getElementById('debugInfo');
        if (existing) existing.remove();
        debugDiv.id = 'debugInfo';
        
        this.results.parentNode.insertBefore(debugDiv, this.results);
    }
    
    drawResults(analysis) {
        // Remove debug info
        let debugDiv = document.getElementById('debugInfo');
        if (debugDiv) debugDiv.remove();
        
        this.overlayCtx.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);
        
        if (analysis.a4) {
            this.drawRotatedRect(analysis.a4.rotatedRect, '#6366f1', 'A4 ✓', 4);
        }
        
        if (analysis.foot) {
            this.drawContour(analysis.foot.contour, '#10b981', 'FOOT ✓', 4);
        }
    }
    
    drawContour(contour, color, label, lineWidth) {
        let points = [];
        for (let i = 0; i < contour.data32S.length; i += 2) {
            points.push({x: contour.data32S[i], y: contour.data32S[i+1]});
        }
        
        if (points.length === 0) return;
        
        this.overlayCtx.strokeStyle = color;
        this.overlayCtx.lineWidth = lineWidth;
        this.overlayCtx.beginPath();
        this.overlayCtx.moveTo(points[0].x, points[0].y);
        
        for (let i = 1; i < points.length; i++) {
            this.overlayCtx.lineTo(points[i].x, points[i].y);
        }
        
        this.overlayCtx.closePath();
        this.overlayCtx.stroke();
        
        if (label) {
            let rect = cv.boundingRect(contour);
            this.overlayCtx.fillStyle = color;
            this.overlayCtx.font = 'bold 12px Arial';
            let tw = this.overlayCtx.measureText(label).width;
            this.overlayCtx.fillRect(rect.x, rect.y - 18, tw + 6, 16);
            this.overlayCtx.fillStyle = '#fff';
            this.overlayCtx.fillText(label, rect.x + 3, rect.y - 6);
        }
    }
    
    drawRotatedRect(rotatedRect, color, label, lineWidth) {
        let vertices = cv.RotatedRect.points(rotatedRect);
        
        this.overlayCtx.strokeStyle = color;
        this.overlayCtx.lineWidth = lineWidth;
        this.overlayCtx.beginPath();
        this.overlayCtx.moveTo(vertices[0].x, vertices[0].y);
        
        for (let i = 1; i < 4; i++) {
            this.overlayCtx.lineTo(vertices[i].x, vertices[i].y);
        }
        
        this.overlayCtx.closePath();
        this.overlayCtx.stroke();
        
        if (label) {
            let cx = rotatedRect.center.x;
            let cy = rotatedRect.center.y;
            this.overlayCtx.font = 'bold 14px Arial';
            let tw = this.overlayCtx.measureText(label).width;
            this.overlayCtx.fillStyle = color;
            this.overlayCtx.fillRect(cx - tw/2 - 5, cy - 30, tw + 10, 22);
            this.overlayCtx.fillStyle = '#fff';
            this.overlayCtx.textAlign = 'center';
            this.overlayCtx.fillText(label, cx, cy - 15);
            this.overlayCtx.textAlign = 'left';
        }
        
        vertices.delete();
    }
    
    calculateMeasurements(analysis) {
        let A4_HEIGHT_MM = 297;
        
        let a4Rect = analysis.a4.rotatedRect;
        let a4W = Math.max(a4Rect.size.width, a4Rect.size.height);
        
        let mmPerPx = A4_HEIGHT_MM / a4W;
        
        let footRect = analysis.foot.rect;
        let footLengthPx = Math.max(footRect.width, footRect.height);
        let footWidthPx = Math.min(footRect.width, footRect.height);
        
        let footLengthMM = footLengthPx * mmPerPx;
        let footWidthMM = footWidthPx * mmPerPx;
        
        document.getElementById('footLength').textContent = footLengthMM.toFixed(1) + ' mm';
        document.getElementById('footWidth').textContent = footWidthMM.toFixed(1) + ' mm';
        document.getElementById('refObject').textContent = '✓ A4 Paper Verified';
        document.getElementById('refObject').style.color = '#10b981';
        
        this.results.style.display = 'block';
        this.results.scrollIntoView({ behavior: 'smooth' });
        
        console.log('Final result:', footLengthMM.toFixed(1), 'x', footWidthMM.toFixed(1), 'mm');
    }
    
    reset() {
        this.originalImage = null;
        this.scaleFactor = null;
        
        this.ctx.clearRect(0, 0, this.mainCanvas.width, this.mainCanvas.height);
        this.overlayCtx.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);
        
        this.analysisSection.style.display = 'none';
        this.results.style.display = 'none';
        this.fileInput.value = '';
        
        let debugDiv = document.getElementById('debugInfo');
        if (debugDiv) debugDiv.remove();
        
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.shoeFitAI = new ShoeFitAI();
});

function onOpenCvReady() {
    console.log('OpenCV ready');
    let loading = document.getElementById('loading');
    if (loading) loading.style.display = 'none';
}