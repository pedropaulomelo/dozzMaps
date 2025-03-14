const express = require('express');

// Cria um novo app Express somente para a integridade
const integrityApp = express();

integrityApp.get('/', (req, res) => {
  res.sendStatus(200);
});

integrityApp.listen(3995, () => {
  console.log('Servidor de integridade rodando em http://localhost:3995');
});
