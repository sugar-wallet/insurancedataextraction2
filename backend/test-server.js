const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  console.log('Health check request received');
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.post('/api/upload-pdf', (req, res) => {
  console.log('Upload request received');
  res.status(500).json({ error: 'Test error to check frontend error handling' });
});

app.listen(PORT, () => {
  console.log(`Test server running on port ${PORT}`);
});