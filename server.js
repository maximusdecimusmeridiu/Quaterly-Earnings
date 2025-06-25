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

// Configuration
const GROQ_CONFIG = {
  endpoint: 'https://api.groq.com/openai/v1/chat/completions',
  model: 'mixtral-8x7b-32768',
  maxTokens: 4000,
  temperature: 0.2,
  topP: 0.9,
  frequencyPenalty: 0,
  presencePenalty: 0,
  apiKey: process.env.GROQ_API_KEY
};

// Validate configuration
if (!process.env.GROQ_API_KEY) {
  console.error('❌ ERROR: GROQ_API_KEY is not set in .env file');
  process.exit(1);
}

// API Endpoint to fetch earnings data
app.post('/fetch-earnings', async (req, res) => {
  const debugId = `req-${Date.now().toString().slice(-6)}`;
  
  try {
    // Input validation
    if (!req.body || !Array.isArray(req.body.companies) || req.body.companies.length === 0) {
      console.error(`[${debugId}] Invalid companies list`);
      return res.status(400).json({
        success: false,
        error: 'Please provide a valid array of company names',
        timestamp: new Date().toISOString()
      });
    }

    // Limit the number of companies to prevent abuse
    const MAX_COMPANIES = 10;
    const companies = req.body.companies.slice(0, MAX_COMPANIES);
    
    if (companies.length < req.body.companies.length) {
      console.warn(`[${debugId}] Too many companies, limiting to first ${MAX_COMPANIES}`);
    }

    console.log(`[${debugId}] Processing ${companies.length} companies`);

    // Get current date for the prompt
    const currentDate = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const prompt = `Generate HTML-formatted quarterly earnings reports for ${companies.join(", ")} using only officially released and publicly available data as of today (${currentDate}). 
For each company, provide only information that has been officially released in their earnings reports or SEC filings:
- Most recent available quarterly earnings data (revenue and EPS)
- Any officially announced key investments or strategic moves
- Year-over-year comparisons using only released data
- Big bets and major investments

If data for the current quarter is not yet released, use the most recent available quarter's data.
Clearly indicate the time period for each data point.

Format as:
<div class="company-card">
  <h3>{Company Name} (Ticker: {Ticker Symbol})</h3>
  <p><strong>Latest Available Earnings:</strong> 
    {Quarter and Year} | Revenue: ${'$'}{X.XXB} | EPS: ${'$'}{X.XX} (Released: {Date if available})
  </p>
  <p><strong>Previous Quarter:</strong> 
    {Quarter and Year} | Revenue: ${'$'}{X.XXB} | EPS: ${'$'}{X.XX}
  </p>
  <p><strong>YoY Growth (if available):</strong> X.X%</p>
  <p><strong>Recent Developments:</strong> {Only include officially announced information with dates if available}</p>
  <p><strong>Big Bets & Investments:</strong> {List any major investments or strategic initiatives with dates if available}</p>
  <p class="data-source">Source: {Provide source and date of information, e.g., 'Q2 2025 Earnings Release (MM/DD/YYYY)'}</p>
</div>

If no official data is available for a company, clearly state: 'No official earnings data available after {last known date of data}'.

Include any relevant links to official press releases or SEC filings at the end of each company's section.`;

    console.log(`[${debugId}] Sending request to Groq API...`);
    
    const response = await axios.post(
      GROQ_CONFIG.endpoint,
      {
        model: GROQ_CONFIG.model,
        messages: [{
          role: "system",
          content: "You are a financial research assistant that provides accurate, up-to-date information about company earnings and investments. Only include information that has been officially released by the companies."
        }, {
          role: "user",
          content: prompt
        }],
        temperature: GROQ_CONFIG.temperature,
        max_tokens: GROQ_CONFIG.maxTokens,
        top_p: GROQ_CONFIG.topP,
        frequency_penalty: GROQ_CONFIG.frequencyPenalty,
        presence_penalty: GROQ_CONFIG.presencePenalty
      },
      {
        headers: {
          'Authorization': `Bearer ${GROQ_CONFIG.apiKey}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        timeout: 60000 // 60 seconds timeout
      }
    );

    if (!response.data?.choices?.[0]?.message?.content) {
      throw new Error('Invalid response format from Groq API');
    }

    console.log(`[${debugId}] Successfully received response from Groq`);
    
    // Sanitize and validate the HTML content
    const htmlContent = response.data.choices[0].message.content
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove any script tags
      .replace(/on\w+=".*?"/g, ''); // Remove any inline event handlers

    res.json({ 
      success: true,
      htmlContent,
      timestamp: new Date().toISOString(),
      companiesProcessed: companies.length
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

// Start the server
app.listen(PORT, () => {
  console.log(`\n🚀 Server running on port ${PORT}`);
  console.log(`🌐 http://localhost:${PORT}`);
  console.log(`\n📊 Available Endpoints:`);
  console.log(`   GET  /              - Serve the web interface`);
  console.log(`   POST /fetch-earnings - Fetch earnings data`);
  console.log(`   GET  /health        - Check server status`);
});
