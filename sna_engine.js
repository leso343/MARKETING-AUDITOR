const axios = require('axios');
require('dotenv').config();

const ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;
const AD_ACCOUNT_ID = process.env.META_AD_ACCOUNT_ID; // Format: act_123456789
const API_VERSION = 'v19.0';

async function fetchInsights() {
    if (!ACCESS_TOKEN || !AD_ACCOUNT_ID) {
        console.error('❌ Missing META_ACCESS_TOKEN or META_AD_ACCOUNT_ID in .env file');
        return;
    }

    try {
        console.log(`🚀 Fetching live insights for Ad Account: ${AD_ACCOUNT_ID}...`);
        
        // Example: Fetching basic campaign insights
        const url = `https://graph.facebook.com/${API_VERSION}/${AD_ACCOUNT_ID}/insights`;
        const params = {
            access_token: ACCESS_TOKEN,
            level: 'campaign',
            fields: 'campaign_name,spend,inline_link_clicks,actions,reach,impressions',
            date_preset: 'last_30d',
            filtering: JSON.stringify([
                { field: 'campaign.delivery_info', operator: 'IN', value: ['active', 'scheduled'] }
            ])
        };

        const response = await axios.get(url, { params });
        const data = response.data.data;

        console.log(`✅ Successfully fetched ${data.length} campaigns.`);
        analyzeData(data);

    } catch (error) {
        console.error('❌ Error fetching insights:', error.response ? error.response.data : error.message);
    }
}

function analyzeData(data) {
    console.log('\n========= SNA FORENSIC ANALYSIS (LIVE) =========');
    
    data.forEach(campaign => {
        const name = campaign.campaign_name;
        const spend = parseFloat(campaign.spend);
        const clicks = parseInt(campaign.inline_link_clicks || 0);
        
        // Extract leads from actions array
        const leadsAction = campaign.actions ? campaign.actions.find(a => a.action_type === 'lead' || a.action_type === 'offsite_conversion.fb_pixel_lead') : null;
        const leads = leadsAction ? parseInt(leadsAction.value) : 0;

        console.log(`\n📊 Campaign: ${name}`);
        console.log(`   ├─ Spend: $${spend.toFixed(2)}`);
        console.log(`   ├─ Clicks: ${clicks}`);
        console.log(`   └─ Leads: ${leads}`);

        // Tracking Sentinel Logic
        if (spend > 10 && leads === 0) {
            console.warn(`   ⚠️  TRACKING SENTINEL ALERT: Spend detected but 0 leads tracked.`);
        }
    });
}

// Run the engine
fetchInsights();
