const fs = require('fs');
const path = require('path');

const downloads = 'C:/Users/Lester/Downloads';
const files = [
    'Take-Charge-Roofing-Campaigns-Apr-15-2023-May-15-2026 (1).csv',
    'Take-Charge-Roofing-Campaigns-Apr-15-2023-May-15-2026 (2).csv',
    'Take-Charge-Roofing-Campaigns-Apr-15-2023-May-15-2026 (3).csv'
];

function parseCSV(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    // Split by windows or unix line break
    const lines = content.split(/\r?\n/).filter(l => l.trim() !== '');
    if (lines.length === 0) return { headers: [], data: [] };

    const parseLine = (line) => {
        let row = [];
        let current = '';
        let inQuotes = false;
        for (let j = 0; j < line.length; j++) {
            const char = line[j];
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                row.push(current.trim().replace(/^"|"$/g, ''));
                current = '';
            } else {
                current += char;
            }
        }
        row.push(current.trim().replace(/^"|"$/g, ''));
        return row;
    };

    const headers = parseLine(lines[0]).map(h => h.trim());
    const data = [];

    for (let i = 1; i < lines.length; i++) {
        const row = parseLine(lines[i]);
        const item = {};
        headers.forEach((h, index) => {
            item[h] = row[index] ? row[index].trim() : '';
        });
        // Add some derived metadata
        item.__raw_row = row;
        data.push(item);
    }
    return { headers, data };
}

console.log("========= CRITICAL INSIGHT INGESTION =========");

files.forEach((file, idx) => {
    const fullPath = path.join(downloads, file);
    if (!fs.existsSync(fullPath)) return;
    
    const { headers, data } = parseCSV(fullPath);
    console.log(`\n📂 FILE ${idx + 1}: ${file} (${data.length} data rows)`);

    const hasAge = headers.some(h => h.toLowerCase() === 'age');
    const hasPlacement = headers.some(h => h.toLowerCase() === 'placement');
    const hasLeads = headers.some(h => h.toLowerCase().includes('website leads') || h.toLowerCase().includes('meta leads') || h.toLowerCase() === 'leads');

    if (hasAge) {
        console.log("🔍 TYPE: AGE DEMOGRAPHICS BREAKDOWN");
        const ageSummary = {};
        data.forEach(row => {
            const age = row['Age'] || 'Unknown';
            if (age === 'Unknown' || !age) return;
            
            const spendStr = row['Amount spent (USD)'] || row['Amount spent'] || '0';
            const spend = parseFloat(spendStr.replace(/[^0-9.]/g, '')) || 0;
            
            const leadsStr = row['Leads'] || row['Results'] || '0';
            const leads = parseInt(leadsStr.replace(/[^0-9]/g, '')) || 0;

            if (!ageSummary[age]) ageSummary[age] = { spend: 0, leads: 0 };
            ageSummary[age].spend += spend;
            ageSummary[age].leads += leads;
        });

        console.table(Object.keys(ageSummary).sort().map(age => ({
            Age: age,
            Spend: '$' + ageSummary[age].spend.toFixed(2),
            Leads: ageSummary[age].leads,
            CPL: ageSummary[age].leads > 0 ? '$' + (ageSummary[age].spend / ageSummary[age].leads).toFixed(2) : 'N/A'
        })));
    }

    if (hasPlacement) {
        console.log("🔍 TYPE: PLACEMENT BREAKDOWN");
        const placementSummary = {};
        data.forEach(row => {
            let platform = row['Platform'] || '';
            let placement = row['Placement'] || '';
            if (!placement || placement.includes('Total')) return;
            
            const label = `${platform} - ${placement}`;
            const spendStr = row['Amount spent (USD)'] || row['Amount spent'] || '0';
            const spend = parseFloat(spendStr.replace(/[^0-9.]/g, '')) || 0;
            
            const leadsStr = row['Leads'] || row['Results'] || '0';
            const leads = parseInt(leadsStr.replace(/[^0-9]/g, '')) || 0;

            if (!placementSummary[label]) placementSummary[label] = { spend: 0, leads: 0 };
            placementSummary[label].spend += spend;
            placementSummary[label].leads += leads;
        });

        const results = Object.keys(placementSummary)
            .map(lbl => ({
                Placement: lbl,
                Spend: placementSummary[lbl].spend,
                Leads: placementSummary[lbl].leads,
                CPL: placementSummary[lbl].leads > 0 ? '$' + (placementSummary[lbl].spend / placementSummary[lbl].leads).toFixed(2) : 'N/A'
            }))
            .filter(p => p.Spend > 0)
            .sort((a, b) => b.Spend - a.Spend);

        console.table(results.slice(0, 12).map(r => ({...r, Spend: '$' + r.Spend.toFixed(2)})));
    }

    if (hasLeads && idx === 2) {
        console.log("🔍 TYPE: CORE LEADS & ATTRIBUTION");
        // Let's look at the columns related to Leads, Meta Leads, Website Leads
        const relevantHeaders = headers.filter(h => h.toLowerCase().includes('lead') || h.toLowerCase().includes('amount spent'));
        console.log("Lead Tracking Headers Detected:", relevantHeaders.join(' | '));

        data.forEach(row => {
            const name = row['Campaign name'] || 'Unknown';
            if (!name || name.includes('Total') || name === 'Unknown') return;
            
            const spend = row['Amount spent (USD)'] || row['Amount spent'] || '0';
            
            console.log(`\n📊 CAMPAIGN: ${name}`);
            console.log(`   └─ Spend: ${spend}`);
            
            // Log non-empty lead related values
            relevantHeaders.forEach(h => {
                if (h.toLowerCase().includes('spend')) return;
                const val = row[h];
                if (val && val !== '0' && val !== '') {
                    console.log(`   └─ ${h}: ${val}`);
                }
            });
        });
    }
});
