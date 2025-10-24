// server/services/svgGenerator.js - FIXED SVG GENERATION WITH PROPER DIMENSIONS

class SVGGenerator {
    // ==================== TRIANGLE SVG ====================
    static generateTriangle(data) {
        const { type, sideA, sideB, sideC, showLabels = true, showAngles = false } = data;

        // 🔥 FIX: LARGER viewBox to prevent cutoff
        const width = 500;
        const height = 450;
        const padding = 80; // More padding for labels

        let points = '';
        let labels = '';
        let baseWidth = sideA * 15; // Scale factor

        if (type === 'equilateral') {
            // Equilateral triangle - all sides equal
            const side = sideA * 15;
            const h = (side * Math.sqrt(3)) / 2;

            const x1 = width / 2 - side / 2;
            const y1 = height - padding;
            const x2 = width / 2 + side / 2;
            const y2 = height - padding;
            const x3 = width / 2;
            const y3 = height - padding - h;

            points = `${x1},${y1} ${x2},${y2} ${x3},${y3}`;

            if (showLabels) {
                labels = `
                    <text x="${x1 - 20}" y="${y1 + 20}" class="vertex-label">A</text>
                    <text x="${x2 + 20}" y="${y2 + 20}" class="vertex-label">B</text>
                    <text x="${x3}" y="${y3 - 20}" class="vertex-label">C</text>
                    
                    <text x="${(x1 + x3) / 2 - 30}" y="${(y1 + y3) / 2}" class="side-label">${sideA}</text>
                    <text x="${(x2 + x3) / 2 + 30}" y="${(y2 + y3) / 2}" class="side-label">${sideB}</text>
                    <text x="${(x1 + x2) / 2}" y="${y1 + 40}" class="side-label">${sideC}</text>
                `;
            }
        } else if (type === 'isosceles') {
            // Isosceles triangle - two equal legs
            const base = sideA * 15;
            const leg = sideB * 15;

            // Calculate height using Pythagorean theorem
            const halfBase = base / 2;
            const h = Math.sqrt(leg * leg - halfBase * halfBase);

            const x1 = width / 2 - base / 2;
            const y1 = height - padding;
            const x2 = width / 2 + base / 2;
            const y2 = height - padding;
            const x3 = width / 2;
            const y3 = height - padding - h;

            points = `${x1},${y1} ${x2},${y2} ${x3},${y3}`;

            if (showLabels) {
                labels = `
                    <text x="${x1 - 20}" y="${y1 + 20}" class="vertex-label">A</text>
                    <text x="${x2 + 20}" y="${y2 + 20}" class="vertex-label">B</text>
                    <text x="${x3}" y="${y3 - 20}" class="vertex-label">C</text>
                    
                    <text x="${(x1 + x3) / 2 - 40}" y="${(y1 + y3) / 2}" class="side-label">${sideB}</text>
                    <text x="${(x2 + x3) / 2 + 40}" y="${(y2 + y3) / 2}" class="side-label">${sideC}</text>
                    <text x="${(x1 + x2) / 2}" y="${y1 + 40}" class="side-label">${sideA}</text>
                `;
            }
        } else if (type === 'right') {
            // Right triangle
            const legA = sideA * 15;
            const legB = sideB * 15;

            const x1 = width / 2 - legA / 2;
            const y1 = height - padding;
            const x2 = width / 2 + legA / 2;
            const y2 = height - padding;
            const x3 = x1;
            const y3 = height - padding - legB;

            points = `${x1},${y1} ${x2},${y2} ${x3},${y3}`;

            if (showLabels) {
                labels = `
                    <text x="${x1 - 20}" y="${y1 + 20}" class="vertex-label">A</text>
                    <text x="${x2 + 20}" y="${y2 + 20}" class="vertex-label">B</text>
                    <text x="${x3 - 20}" y="${y3 - 10}" class="vertex-label">C</text>
                    
                    <text x="${(x1 + x3) / 2 - 40}" y="${(y1 + y3) / 2}" class="side-label">${sideB}</text>
                    <text x="${(x2 + x3) / 2 + 40}" y="${(y2 + y3) / 2}" class="side-label">${sideC}</text>
                    <text x="${(x1 + x2) / 2}" y="${y1 + 40}" class="side-label">${sideA}</text>
                    
                    <rect x="${x1 - 15}" y="${y1 - 15}" width="15" height="15" fill="none" stroke="#9333ea" stroke-width="2"/>
                `;
            }
        } else {
            // Scalene triangle
            const base = sideA * 15;
            const scale = 15;

            const x1 = width / 2 - base / 2;
            const y1 = height - padding;
            const x2 = width / 2 + base / 2;
            const y2 = height - padding;

            // Use law of cosines to find angle and position third vertex
            const cosA = (sideB * sideB + sideA * sideA - sideC * sideC) / (2 * sideB * sideA);
            const angleA = Math.acos(cosA);

            const x3 = x1 + sideB * scale * Math.cos(angleA);
            const y3 = y1 - sideB * scale * Math.sin(angleA);

            points = `${x1},${y1} ${x2},${y2} ${x3},${y3}`;

            if (showLabels) {
                labels = `
                    <text x="${x1 - 20}" y="${y1 + 20}" class="vertex-label">A</text>
                    <text x="${x2 + 20}" y="${y2 + 20}" class="vertex-label">B</text>
                    <text x="${x3}" y="${y3 - 20}" class="vertex-label">C</text>
                    
                    <text x="${(x1 + x3) / 2 - 30}" y="${(y1 + y3) / 2}" class="side-label">${sideB}</text>
                    <text x="${(x2 + x3) / 2 + 30}" y="${(y2 + y3) / 2}" class="side-label">${sideC}</text>
                    <text x="${(x1 + x2) / 2}" y="${y1 + 40}" class="side-label">${sideA}</text>
                `;
            }
        }

        return `
            <svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" style="max-width: 100%; height: auto;">
                <defs>
                    <style>
                        .triangle-shape { 
                            fill: rgba(147, 51, 234, 0.15); 
                            stroke: #9333ea; 
                            stroke-width: 3;
                            transition: all 0.3s ease;
                        }
                        .triangle-shape:hover { 
                            fill: rgba(147, 51, 234, 0.25); 
                            stroke-width: 4;
                        }
                        .vertex-label { 
                            fill: #7c3aed; 
                            font-size: 20px; 
                            font-weight: bold; 
                            font-family: Arial, sans-serif;
                        }
                        .side-label { 
                            fill: #ec4899; 
                            font-size: 18px; 
                            font-weight: bold; 
                            font-family: Arial, sans-serif;
                        }
                    </style>
                </defs>
                <polygon points="${points}" class="triangle-shape"/>
                ${labels}
            </svg>
        `;
    }

    // ==================== RECTANGLE SVG ====================
    static generateRectangle(data) {
        const { width: rectWidth, height: rectHeight, showLabels = true } = data;

        const svgWidth = 500;
        const svgHeight = 400;
        const padding = 80;

        const scaleW = rectWidth * 20;
        const scaleH = rectHeight * 20;

        const x = (svgWidth - scaleW) / 2;
        const y = (svgHeight - scaleH) / 2;

        let labels = '';
        if (showLabels) {
            labels = `
                <text x="${x - 15}" y="${y - 10}" class="vertex-label">A</text>
                <text x="${x + scaleW + 15}" y="${y - 10}" class="vertex-label">B</text>
                <text x="${x + scaleW + 15}" y="${y + scaleH + 25}" class="vertex-label">C</text>
                <text x="${x - 15}" y="${y + scaleH + 25}" class="vertex-label">D</text>
                
                <text x="${x + scaleW / 2}" y="${y - 20}" class="side-label">${rectWidth} ס"מ</text>
                <text x="${x + scaleW / 2}" y="${y + scaleH + 40}" class="side-label">${rectWidth} ס"מ</text>
                <text x="${x - 40}" y="${y + scaleH / 2}" class="side-label">${rectHeight} ס"מ</text>
                <text x="${x + scaleW + 40}" y="${y + scaleH / 2}" class="side-label">${rectHeight} ס"מ</text>
            `;
        }

        return `
            <svg viewBox="0 0 ${svgWidth} ${svgHeight}" xmlns="http://www.w3.org/2000/svg" style="max-width: 100%; height: auto;">
                <defs>
                    <style>
                        .rectangle-shape { 
                            fill: rgba(236, 72, 153, 0.15); 
                            stroke: #ec4899; 
                            stroke-width: 3;
                            transition: all 0.3s ease;
                        }
                        .rectangle-shape:hover { 
                            fill: rgba(236, 72, 153, 0.25); 
                            stroke-width: 4;
                        }
                        .vertex-label { 
                            fill: #7c3aed; 
                            font-size: 20px; 
                            font-weight: bold; 
                            font-family: Arial, sans-serif;
                        }
                        .side-label { 
                            fill: #ec4899; 
                            font-size: 18px; 
                            font-weight: bold; 
                            font-family: Arial, sans-serif;
                        }
                    </style>
                </defs>
                <rect x="${x}" y="${y}" width="${scaleW}" height="${scaleH}" class="rectangle-shape"/>
                ${labels}
            </svg>
        `;
    }

    // ==================== CIRCLE SVG ====================
    static generateCircle(data) {
        const { radius, showLabels = true } = data;

        const svgWidth = 500;
        const svgHeight = 400;

        const scale = radius * 15;
        const cx = svgWidth / 2;
        const cy = svgHeight / 2;

        let labels = '';
        if (showLabels) {
            labels = `
                <text x="${cx - 15}" y="${cy - 10}" class="center-label">O</text>
                <line x1="${cx}" y1="${cy}" x2="${cx + scale}" y2="${cy}" stroke="#9333ea" stroke-width="2" stroke-dasharray="5,5"/>
                <text x="${cx + scale / 2}" y="${cy - 15}" class="side-label">r = ${radius}</text>
                <circle cx="${cx}" cy="${cy}" r="4" fill="#7c3aed"/>
                <circle cx="${cx + scale}" cy="${cy}" r="4" fill="#ec4899"/>
            `;
        }

        return `
            <svg viewBox="0 0 ${svgWidth} ${svgHeight}" xmlns="http://www.w3.org/2000/svg" style="max-width: 100%; height: auto;">
                <defs>
                    <style>
                        .circle-shape { 
                            fill: rgba(147, 51, 234, 0.15); 
                            stroke: #9333ea; 
                            stroke-width: 3;
                            transition: all 0.3s ease;
                        }
                        .circle-shape:hover { 
                            fill: rgba(147, 51, 234, 0.25); 
                            stroke-width: 4;
                        }
                        .center-label { 
                            fill: #7c3aed; 
                            font-size: 20px; 
                            font-weight: bold; 
                            font-family: Arial, sans-serif;
                        }
                        .side-label { 
                            fill: #ec4899; 
                            font-size: 18px; 
                            font-weight: bold; 
                            font-family: Arial, sans-serif;
                        }
                    </style>
                </defs>
                <circle cx="${cx}" cy="${cy}" r="${scale}" class="circle-shape"/>
                ${labels}
            </svg>
        `;
    }
}

export default SVGGenerator;