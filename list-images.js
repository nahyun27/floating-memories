const fs = require('fs');
const path = require('path');

const g1 = fs.readdirSync('public/memories/g1').filter(f => !f.startsWith('.'));
const g2 = fs.readdirSync('public/memories/g2').filter(f => !f.startsWith('.'));
const g3 = fs.readdirSync('public/memories/g3').filter(f => !f.startsWith('.'));
const g4 = fs.readdirSync('public/memories/g4').filter(f => !f.startsWith('.'));

console.log(JSON.stringify({g1, g2, g3, g4}, null, 2));
