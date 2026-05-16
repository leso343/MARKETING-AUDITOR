const fs = require('fs');
const path = require('path');

const file = 'C:/Users/Lester/Downloads/Take-Charge-Roofing-Ads-Apr-15-2023-May-15-2026.csv';

function parseCSV(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split(/\r?\n/).filter(l => l.trim() !== '');
    
    const parseLine = (line) => {
        let row = [];
        let current = '';
        let inQuotes = false;
        for (let j = 0; j < line.length; j++) {
            const char = line[j];
            if (char === '"') inQuotes = !inQuotes;
            else if (char === ',' && !inQuotes) { row.push(current.trim()); current = ''; }
            else current += char;
        }
        row.push(current.trim());
        return row.map(r => r.replace(/^"|"$/g, ''));
    };

    const headers = parseLine(lines[0]);
    const data = [];
    for (let i = 1; i < lines.length; i++) {
        const row = parseLine(lines[i]);
        const item = {};
        headers.forEach((h, idx) => { item[h] = row[idx] || ''; });
        data.push(item);
    }
    return data;
}

const data = parseCSV(file);

const results = data.map(row => {
    const name = row['Ad name'] || 'Unknown Ad';
    const spend = parseFloat((row['Amount spent (USD)'] || '0').replace(/[^0-9.]/g, '')) || 0;
    const imps = parseInt((row['Impressions'] || '0').replace(/[^0-9]/g, '')) || 0;
    const leads = parseInt((row['Leads'] || '0').replace(/[^0-9]/g, '')) || 0;
    const ctr = parseFloat((row['CTR (link click-through rate)'] || '0').replace(/[^0-9.]/g, '')) || 0;
    
    const s3 = parseInt((row['3-second video plays'] || '0').replace(/[^0-9]/g, '')) || 0;
    const thru = parseInt((row['ThruPlays'] || '0').replace(/[^0-9]/g, '')) || 0;

    // Hook Rate: 3s Plays / Impressions
    const hookRate = imps > 0 ? (s3 / imps) * 100 : 0;
    
    // Hold Rate: ThruPlays / 3s Plays
    const holdRate = s3 > 0 ? (thru / s3) * 100 : 0;

    return {
        Ad: name,
        Spend: spend,
        Leads: leads,
        CTR: ctr.toFixed(2) + '%',
        'Hook Rate': hookRate.toFixed(2) + '%',
        'Hold Rate': holdRate.toFixed(2) + '%',
        CPL: leads > 0 ? '$' + (spend / leads).toFixed(2) : 'N/A'
    };
}).filter(r => r.Spend > 5) // Ignore tiny spend ads
  .sort((a, b) => b.Spend - a.Spend);

console.log("======== CREATIVE PERFORMANCE HEATMAP ========");
console.table(results.map(r => ({ ...r, Spend: '$' + r.Spend.toFixed(2) })));
