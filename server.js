require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 5001;

// Middleware
app.use(cors());
app.use(express.json());

// Configuration
const GROQ_CONFIG = {
  endpoint: 'https://api.groq.com/openai/v1/chat/completions',
  apiKey: process.env.GROQ_API_KEY,
  model: 'Compound-Beta-Mini',
  maxTokens: 2000,
  temperature: 0.7
};

// Validate API Key
if (!process.env.GROQ_API_KEY) {
  console.error('❌ Missing GROQ_API_KEY in environment variables');
  process.exit(1);
}

// API Endpoint
app.post('/fetch-earnings', async (req, res) => {
  try {
    const { companies } = req.body;
    if (!companies || !Array.isArray(companies) || companies.length === 0) {
      return res.status(400).json({ success: false, error: 'Invalid company list provided' });
    }

    const prompt = `Generate HTML-formatted earnings data for: ${companies.join(', ')}.`;

    const response = await axios.post(
      GROQ_CONFIG.endpoint,
      {
        model: GROQ_CONFIG.model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: GROQ_CONFIG.maxTokens,
        temperature: GROQ_CONFIG.temperature
      },
      {
        headers: { Authorization: `Bearer ${GROQ_CONFIG.apiKey}` }
      }
    );

    const content = response.data.choices[0]?.message?.content || 'No content generated';
    res.json({ success: true, htmlContent: content });

  } catch (error) {
    console.error('Error fetching data:', error.message);
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
