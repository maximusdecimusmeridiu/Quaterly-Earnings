require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const app = express();
const PORT = 5001;

// Configuration
const GROQ_CONFIG = {
  endpoint: 'https://api.groq.com/openai/v1/chat/completions',
  model: 'Compound-Beta-Mini', // Updated model name
  timeout: 20000 // Increased timeout
};

// Middleware
app.use(cors());
app.use(express.json());

// Debug middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// API Endpoint
app.post('/fetch-earnings', async (req, res) => {
  const debugId = `req-${Date.now().toString().slice(-6)}`;
  
  try {
    console.log(`\n[${debugId}] Starting request with companies:`, req.body.companies);

    if (!process.env.GROQ_API_KEY) {
      throw new Error('Missing GROQ_API_KEY in .env file');
    }

    const prompt = `Generate HTML-formatted quarterly earnings reports for: ${req.body.companies.join(", ")}.
                  For each company, provide:
                  - Revenue and EPS
                  - Key investments
                  Format as:
                  <div class="company-card">
                    <h3>{Company Name}</h3>
                    <p><strong>Earnings:</strong> Revenue: ${'$'}X.XXB | EPS: ${'$'}X.XX</p>
                    <p><strong>Investments:</strong> {Key initiatives}</p>
                  </div>`;

    const response = await axios.post(
      GROQ_CONFIG.endpoint,
      {
        model: GROQ_CONFIG.model,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: 2000
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: GROQ_CONFIG.timeout
      }
    );

    console.log(`[${debugId}] Successfully received response from Groq`);
    res.json({ 
      success: true,
      htmlContent: response.data.choices[0].message.content 
    });

  } catch (error) {
    console.error(`[${debugId}] Groq API Error:`, {
      code: error.code,
      message: error.message,
      response: {
        status: error.response?.status,
        data: error.response?.data
      }
    });

    res.status(500).json({
      success: false,
      error: "Failed to process request",
      details: {
        code: error.response?.status || 'NO_RESPONSE',
        message: error.response?.data?.error?.message || error.message
      }
    });
  }
});

app.listen(PORT, () => {
  console.log(`\n🚀 Server running on http://localhost:${PORT}`);
  console.log(`🔑 Using Groq Model: ${GROQ_CONFIG.model}`);
  console.log(`🌐 CORS Enabled: All origins`);
});