require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Load environment variables
require('dotenv').config({ path: 'config.env' });

// Configuration
const GROQ_CONFIG = {
  endpoint: 'https://api.groq.com/openai/v1/chat/completions',
  model: 'Compound-Beta-Mini',
  maxTokens: 2000,
  temperature: 0.7,
  topP: 1,
  frequencyPenalty: 0,
  presencePenalty: 0,
  apiKey: process.env.GROQ_API_KEY
};

// Validate configuration
if (!process.env.GROQ_API_KEY) {
  console.error('❌ ERROR: GROQ_API_KEY is not set in .env file');
  process.exit(1);
}

// Get current quarter and year
function getCurrentQuarter() {
  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();
  
  let quarter;
  if (month >= 0 && month <= 2) quarter = 1;
  else if (month >= 3 && month <= 5) quarter = 2;
  else if (month >= 6 && month <= 8) quarter = 3;
  else quarter = 4;
  
  return { quarter, year };
}

// API Endpoint to fetch earnings data
app.post('/fetch-earnings', async (req, res) => {
  const debugId = `req-${Date.now().toString().slice(-6)}`;
  
  try {
    console.log(`[${debugId}] Starting request with companies:`, req.body.companies);
    
    if (!req.body.companies || !Array.isArray(req.body.companies) || req.body.companies.length === 0) {
      console.error(`[${debugId}] Invalid companies list`);
      return res.status(400).json({
        success: false,
        error: 'Please provide a valid array of company names'
      });
    }

    // Limit the number of companies to prevent abuse
    const MAX_COMPANIES = 10;
    const companies = req.body.companies.slice(0, MAX_COMPANIES);
    
    if (companies.length < req.body.companies.length) {
      console.warn(`[${debugId}] Too many companies, limiting to first ${MAX_COMPANIES}`);
    }

    console.log(`[${debugId}] Processing ${companies.length} companies`);

    // Get current quarter and year
    const { quarter, year } = getCurrentQuarter();
    
    // Prepare the prompt for Groq
    const prompt = `Generate a detailed earnings report for the following companies for Q${quarter} ${year}. 
    For each company, provide:
    1. Revenue and earnings (actual vs. estimates)
    2. Key business highlights
    3. Management commentary
    4. Future outlook
    
    Companies: ${companies.join(', ')}
    
    Format the response in HTML with proper styling.`;

    console.log(`[${debugId}] Sending request to Groq API...`);
    
    const response = await axios.post(
      GROQ_CONFIG.endpoint,
      {
        model: GROQ_CONFIG.model,
        messages: [
          {
            role: 'system',
            content: 'You are a financial analyst providing detailed earnings reports for public companies.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: GROQ_CONFIG.maxTokens,
        temperature: GROQ_CONFIG.temperature,
        top_p: GROQ_CONFIG.topP,
        frequency_penalty: GROQ_CONFIG.frequencyPenalty,
        presence_penalty: GROQ_CONFIG.presencePenalty
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${GROQ_CONFIG.apiKey}`
        },
        timeout: 60000 // 60 seconds timeout
      }
    );

    console.log(`[${debugId}] Successfully received response from Groq`);
    
    const content = response.data.choices[0]?.message?.content;
    
    if (!content) {
      throw new Error('No content in response from Groq API');
    }

    // Send response
    res.json({
      success: true,
      htmlContent: content,
      debugId
    });

  } catch (error) {
    console.error(`[${debugId}] Error:`, error.message);
    console.error('Error details:', error.response?.data || error.stack);
    
    res.status(500).json({
      success: false,
      error: 'Failed to fetch earnings data',
      details: error.message,
      debugId
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    service: 'Earnings Report API',
    version: '1.0.0'
  });
});

// Serve the main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Start the server
app.listen(PORT, () => {
  console.log(`\n🚀 Server running on port ${PORT}`);
  console.log(`🌐 http://localhost:${PORT}`);
  console.log(`\n📊 Available Endpoints:`);
  console.log(`   GET  /              - Serve the web interface`);
  console.log(`   POST /fetch-earnings - Fetch earnings data`);
  console.log(`   GET  /health        - Check server status`);
});