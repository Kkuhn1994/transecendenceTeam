// index.js
const express = require('express');
const app = express();

app.get('/', (req, res) => {
  res.send('sign_up_service');
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server läuft auf http://localhost:${PORT}`);
});
