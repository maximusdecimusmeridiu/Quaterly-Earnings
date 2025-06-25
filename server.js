require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs');
const app = express();
const PORT = 5001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Load subscriptions
const SUBSCRIPTIONS_FILE = path.join(__dirname, 'subscriptions.json');

function getSubscriptions() {
  try {
    return JSON.parse(fs.readFileSync(SUBSCRIPTIONS_FILE, 'utf8'));
  } catch (error) {
    return [];
  }
}

function saveSubscription(email) {
  const subscriptions = getSubscriptions();
  if (!subscriptions.includes(email)) {
    subscriptions.push(email);
    fs.writeFileSync(SUBSCRIPTIONS_FILE, JSON.stringify(subscriptions, null, 2));
    console.log(`New subscription: ${email}`);
    return true;
  }
  return false;
}

// Load environment variables from config.env file
require('dotenv').config({ path: 'config.env' });

// Email configuration
const EMAIL_USER = process.env.EMAIL_USER || 'avinashpulavarti14812@gmail.com';
const EMAIL_PASS = process.env.EMAIL_PASS;

if (!EMAIL_PASS) {
  console.error('❌ ERROR: EMAIL_PASS is not set in .env file');
  process.exit(1);
}

console.log('📧 Email service configured for:', EMAIL_USER);

// Create test email function
async function sendTestEmail() {
  const testTransporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,  // Try port 587 with STARTTLS
    secure: false,  // true for 465, false for other ports
    requireTLS: true,
    auth: {
      user: EMAIL_USER,
      pass: EMAIL_PASS
    },
    debug: true,
    logger: true,
    tls: {
      // Do not fail on invalid certs
      rejectUnauthorized: false
    }
  });

  try {
    console.log('🔄 Testing email connection...');
    await testTransporter.verify();
    console.log('✅ Server is ready to send emails');
    
    // Send a test email
    const info = await testTransporter.sendMail({
      from: `"Earnings App" <${EMAIL_USER}>`,
      to: EMAIL_USER,
      subject: 'Test Email from Earnings App',
      text: 'This is a test email to verify the configuration.',
      html: '<h1>Test Email</h1><p>This is a test email to verify the configuration.</p>'
    });
    
    console.log('📤 Test email sent:', info.messageId);
    return testTransporter;
  } catch (error) {
    console.error('❌ Email test failed:');
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);
    console.log('\n🔧 Troubleshooting Steps:');
    console.log('1. Go to: https://myaccount.google.com/apppasswords');
    console.log('2. Generate a new app password (select "Other" and name it)');
    console.log('3. Copy the 16-character password (with spaces)');
    console.log('4. Update the EMAIL_PASS in server.js with the new password');
    console.log('5. Make sure 2-Step Verification is enabled on your Google account');
    process.exit(1);
  }
}

// Initialize email transporter
const transporter = sendTestEmail();

// Professional email template
const getEmailTemplate = (content, quarter) => `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #0056b3; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; border: 1px solid #ddd; }
        .footer { text-align: center; padding: 20px; font-size: 12px; color: #777; }
        .button { 
            display: inline-block; 
            padding: 10px 20px; 
            background-color: #0056b3; 
            color: white; 
            text-decoration: none; 
            border-radius: 4px; 
            margin: 15px 0;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>Quarterly Earnings Report</h1>
        <p>${quarter} - Market Insights</p>
    </div>
    <div class="content">
        ${content}
        <p>Thank you for subscribing to our Quarterly Earnings Report service. Here's what you get as a subscriber:</p>
        <ul>
            <li>Early access to quarterly earnings reports</li>
            <li>Exclusive market insights and analysis</li>
            <li>Custom alerts for your watched companies</li>
            <li>Quarterly webinars with financial experts</li>
        </ul>
        <p>Stay ahead of the market with our premium insights!</p>
        <a href="#" class="button">View Full Report</a>
    </div>
    <div class="footer">
        <p>© 2025 Earnings Insights. All rights reserved.</p>
        <p><a href="#" style="color: #0056b3;">Unsubscribe</a> | <a href="#" style="color: #0056b3;">Manage Preferences</a></p>
    </div>
</body>
</html>`;

// Get current quarter
function getCurrentQuarter() {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  let quarter;
  
  if (month >= 1 && month <= 3) quarter = 'Q1';
  else if (month >= 4 && month <= 6) quarter = 'Q2';
  else if (month >= 7 && month <= 9) quarter = 'Q3';
  else quarter = 'Q4';
  
  return `${year} ${quarter}`;
}

// Configuration
const GROQ_CONFIG = {
  endpoint: 'https://api.groq.com/openai/v1/chat/completions',
  model: 'Compound-Beta-Mini', // Updated model name
  timeout: 20000 // Increased timeout
};

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from the current directory
app.use(express.static(__dirname));

// Debug middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// API Endpoint
// Subscribe email
app.post('/api/subscribe', async (req, res) => {
  const { email } = req.body;
  
  if (!email || !validateEmail(email)) {
    return res.status(400).json({ success: false, error: 'Please provide a valid email address' });
  }

  try {
    const isNew = saveSubscription(email);
    const currentQuarter = getCurrentQuarter();
    
    if (isNew) {
      // Send welcome email
      const mailOptions = {
        from: 'Earnings Insights <avinashpulavarti14812@gmail.com>',
        to: email,
        subject: `Welcome to Quarterly Earnings Insights - ${currentQuarter}`,
        html: getEmailTemplate(`
          <h2>Welcome to Earnings Insights!</h2>
          <p>Thank you for subscribing to our Quarterly Earnings Report service. You'll now receive the latest earnings reports directly to your inbox.</p>
          <p>As a valued subscriber, you'll get:</p>
          <ul>
            <li>Quarterly earnings reports for top companies</li>
            <li>Exclusive market analysis</li>
            <li>Early access to financial insights</li>
            <li>Custom alerts for your favorite stocks</li>
          </ul>
          <p>Stay tuned for our next report!</p>
        `, currentQuarter)
      };

      await transporter.sendMail(mailOptions);
      console.log(`New subscription confirmed: ${email}`);
      res.json({ 
        success: true, 
        message: 'Subscription successful! Check your email for confirmation.' 
      });
    } else {
      res.json({ 
        success: true, 
        message: 'You are already subscribed to our newsletter.' 
      });
    }
  } catch (error) {
    console.error('Subscription error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to process subscription',
      details: error.message 
    });
  }
});

// Send report to all subscribers
app.post('/api/send-newsletter', async (req, res) => {
  const { htmlContent } = req.body;
  const subscribers = getSubscriptions();
  const currentQuarter = getCurrentQuarter();
  
  if (!htmlContent) {
    return res.status(400).json({ success: false, error: 'Content is required' });
  }

  try {
    const results = [];
    
    for (const email of subscribers) {
      const mailOptions = {
        from: 'Earnings Insights <avinashpulavarti14812@gmail.com>',
        to: email,
        subject: `Quarterly Earnings Report - ${currentQuarter}`,
        html: getEmailTemplate(htmlContent, currentQuarter)
      };

      try {
        const info = await transporter.sendMail(mailOptions);
        results.push({ email, success: true, message: 'Sent', messageId: info.messageId });
      } catch (error) {
        results.push({ email, success: false, error: error.message });
      }
    }

    res.json({ 
      success: true, 
      message: `Newsletter sent to ${results.filter(r => r.success).length} subscribers`,
      results 
    });
  } catch (error) {
    console.error('Newsletter error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to send newsletter',
      details: error.message 
    });
  }
});

// Send report to single email
app.post('/api/send-report', async (req, res) => {
  const { email, htmlContent } = req.body;
  
  if (!email || !htmlContent) {
    return res.status(400).json({ success: false, error: 'Email and content are required' });
  }

  try {
    const currentQuarter = getCurrentQuarter();
    const mailOptions = {
      from: 'Earnings Insights <avinashpulavarti14812@gmail.com>',
      to: email,
      subject: `Quarterly Earnings Report - ${currentQuarter}`,
      html: getEmailTemplate(htmlContent, currentQuarter)
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`Report sent to: ${email}`, info.messageId);
    
    res.json({ 
      success: true, 
      message: 'Report sent successfully!',
      messageId: info.messageId 
    });
  } catch (error) {
    console.error('Send report error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to send report',
      details: error.message 
    });
  }
});

app.post('/fetch-earnings', async (req, res) => {
  const debugId = `req-${Date.now().toString().slice(-6)}`;
  
  try {
    console.log(`\n[${debugId}] Starting request with companies:`, req.body.companies);

    if (!process.env.GROQ_API_KEY) {
      throw new Error('Missing GROQ_API_KEY in .env file');
    }

    const prompt = `Generate HTML-formatted quarterly earnings reports for ${req.body.companies.join(", ")} using only officially released and publicly available data as of today (June 24, 2025). 
                  For each company, provide only information that has been officially released in their earnings reports or SEC filings:
                  - Most recent available quarterly earnings data (revenue and EPS)
                  - Any officially announced key investments or strategic moves
                  - Year-over-year comparisons using only released data
                  
                  If data for Q2 2025 is not yet released, use the most recent available quarter's data.
                  Clearly indicate the time period for each data point. add the links in the end and add big bets and investments of the company 
                  
                  Format as:
                  <div class="company-card">
                    <h3>{Company Name}</h3>
                    <p><strong>Latest Available Earnings:</strong> 
                      {Quarter and Year} | Revenue: ${'$'}X.XXB | EPS: ${'$'}X.XX (Released: {Date if available})
                    </p>
                    <p><strong>Previous Quarter:</strong> 
                      {Quarter and Year} | Revenue: ${'$'}X.XXB | EPS: ${'$'}X.XX
                    </p>
                    <p><strong>YoY Growth (if available):</strong> X.X%</p>
                    <p><strong>Recent Developments:</strong> {Only include officially announced information with dates if available}</p>
                    <p class="data-source">Source: {Indicate source of data if known, e.g., 'Company Q2 2025 Earnings Release'}</p>
                  </div>
                  
                  If no official data is available for a company, clearly state: 'No official earnings data available after {last known date of data}'.`;

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

// Subscribe endpoint
app.post('/subscribe', (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ success: false, error: 'Email is required' });
    }
    
    if (!validateEmail(email)) {
      return res.status(400).json({ success: false, error: 'Invalid email format' });
    }
    
    const isNew = saveSubscription(email);
    
    if (isNew) {
      res.json({ success: true, message: 'Successfully subscribed!' });
    } else {
      res.json({ success: true, message: 'Email already subscribed' });
    }
  } catch (error) {
    console.error('Subscription error:', error);
    res.status(500).json({ success: false, error: 'Failed to process subscription' });
  }
});

// Get all subscriptions (for testing)
app.get('/subscriptions', (req, res) => {
  try {
    const subscriptions = getSubscriptions();
    res.json({ success: true, subscriptions });
  } catch (error) {
    console.error('Error getting subscriptions:', error);
    res.status(500).json({ success: false, error: 'Failed to get subscriptions' });
  }
});

// Send email to all subscribers
app.post('/send-to-subscribers', async (req, res) => {
  try {
    const { subject, content } = req.body;
    
    if (!subject || !content) {
      return res.status(400).json({ 
        success: false, 
        error: 'Subject and content are required' 
      });
    }

    const subscribers = getSubscriptions();
    if (subscribers.length === 0) {
      return res.json({ 
        success: true, 
        message: 'No subscribers to send to',
        sentCount: 0
      });
    }

    const emailTransporter = await transporter;
    const failedEmails = [];
    let sentCount = 0;

    // Send email to each subscriber
    for (const email of subscribers) {
      try {
        await emailTransporter.sendMail({
          from: `"Earnings App" <${EMAIL_USER}>`,
          to: email,
          subject: subject,
          html: content,
          text: content.replace(/<[^>]*>/g, '') // Convert HTML to plain text
        });
        sentCount++;
        console.log(`✅ Email sent to: ${email}`);
      } catch (error) {
        console.error(`❌ Failed to send to ${email}:`, error.message);
        failedEmails.push({ email, error: error.message });
      }
    }

    res.json({
      success: true,
      message: `Emails sent to ${sentCount} subscribers`,
      sentCount,
      failedCount: failedEmails.length,
      failedEmails
    });

  } catch (error) {
    console.error('Send to subscribers error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to send emails to subscribers',
      details: error.message 
    });
  }
});



// Serve index.html for the root route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\n🚀 Server running on http://localhost:${PORT}`);
  console.log(`🔑 Using Groq Model: ${GROQ_CONFIG.model}`);
  console.log(`🌐 CORS Enabled: All origins`);
  console.log(`🌍 Open http://localhost:${PORT} in your browser`);
});