// index.js
const express = require('express');
const app = express();

app.get('/', (req, res) => {
  res.send('Hallo von Node.js hinter NGINX!');
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Server läuft auf http://localhost:${PORT}`);
});
