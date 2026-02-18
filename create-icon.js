const fs = require('fs');
const { createCanvas } = require('canvas');

const canvas = createCanvas(256, 256);
const ctx = canvas.getContext('2d');

ctx.fillStyle = '#1a1a1a';
ctx.fillRect(0, 0, 256, 256);

ctx.strokeStyle = '#00ff00';
ctx.lineWidth = 3;
ctx.beginPath();
ctx.arc(128, 120, 60, 0, Math.PI * 2);
ctx.stroke();

ctx.fillStyle = '#00ff00';
ctx.beginPath();
ctx.arc(105, 105, 8, 0, Math.PI * 2);
ctx.fill();

ctx.beginPath();
ctx.arc(151, 105, 8, 0, Math.PI * 2);
ctx.fill();

ctx.beginPath();
ctx.arc(128, 130, 25, 0.1 * Math.PI, 0.9 * Math.PI);
ctx.stroke();

ctx.strokeStyle = '#00ff00';
ctx.lineWidth = 3;
ctx.strokeRect(50, 40, 156, 176);

const buffer = canvas.toBuffer('image/png');
fs.writeFileSync('icon.png', buffer);
console.log('图标已生成: icon.png');
