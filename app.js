// app.js
const express = require('express');
const cors = require('cors');
const path = require('path');
const Datastore = require('nedb');

const app = express();

// Cria o servidor HTTP e integra o Socket.IO
const http = require('http');
const server = http.createServer(app);
const { Server } = require('socket.io');
const io = new Server(server, {
  cors: {
    origin: 'http://localhost:3000',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 3999;

// Configura o CORS para o Express
app.use(cors({
  origin: 'http://localhost:3000'
}));

// Middlewares para interpretar dados de formulários e JSON
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Serve os arquivos estáticos da pasta "public"
app.use(express.static(path.join(__dirname, 'public')));

// ─────────────────────────────────────────────────────────────
// Configuração do NeDB para persistir as rotas
// ─────────────────────────────────────────────────────────────
const routesDb = new Datastore({ 
  filename: path.join(__dirname, 'routes.db'), 
  autoload: true 
});

// Rota para persistir as informações da rota
app.post('/api/route', (req, res) => {
  const routeInfo = req.body;

  // Validação básica: são necessários condId, trackerId, origin e destination
  if (
    !routeInfo ||
    !routeInfo.condId ||
    !routeInfo.trackerId ||
    !routeInfo.origin ||
    !routeInfo.destination
  ) {
    return res.status(400).json({ 
      error: 'Dados incompletos. São necessários condId, trackerId, origin e destination.' 
    });
  }

  // Supondo que `origin` e `destination` sejam objetos com { lat, lng, description }
  routeInfo.createdAt = new Date().toISOString();
  routeInfo.status = routeInfo.status || 'em andamento';

  routesDb.insert(routeInfo, (err, newDoc) => {
    if (err) {
      console.error('Erro ao inserir rota:', err);
      return res.status(500).json({ error: 'Falha ao salvar rota.' });
    }
    return res.status(201).json({ message: 'Rota salva com sucesso.', id: newDoc._id });
  });
});

// Rota para recuperar as rotas de um condomínio (filtrando pelo condId)
app.get('/api/routes/:condId', (req, res) => {
  const condId = req.params.condId;
  routesDb.find({ condId }).sort({ createdAt: -1 }).exec((err, docs) => {
    if (err) {
      console.error('Erro ao recuperar rotas:', err);
      return res.status(500).json({ error: 'Falha ao recuperar rotas.' });
    }
    return res.json(docs);
  });
});

// ─────────────────────────────────────────────────────────────
// Rota já existente para gerar o tracker (exemplo)
// ─────────────────────────────────────────────────────────────
app.post('/generate', (req, res) => {
  const trackerId = req.body.trackerId || 'default';
  const origin = req.body.origin;
  const destination = req.body.destination;

  if (!origin || !destination) {
    return res.status(400).send('Origem ou destino não informados.');
  }

  // Monta os parâmetros para a URL (codificados)
  const query = `?trackerId=${encodeURIComponent(trackerId)}&orig=${encodeURIComponent(origin)}&dest=${encodeURIComponent(destination)}`;
  res.redirect('/tracker.html' + query);
});


app.post('/api/route/end', (req, res) => {
  const { routeId } = req.body;
  if (!routeId) {
    return res.status(400).json({ error: 'Route ID is required.' });
  }

  // Atualiza o status da rota para "encerrado"
  routesDb.update(
    { _id: routeId },
    { $set: { status: 'encerrado', endedAt: new Date().toISOString() } },
    {},
    (err, numUpdated) => {
      if (err) {
        console.error('Erro ao encerrar a rota:', err);
        return res.status(500).json({ error: 'Falha ao encerrar a rota.' });
      }
      if (numUpdated === 0) {
        return res.status(404).json({ error: 'Rota não encontrada.' });
      }
      return res.json({ message: 'Rota encerrada com sucesso.' });
    }
  );
});

// ─────────────────────────────────────────────────────────────
// Configuração do Socket.IO para atualização de localização
// ─────────────────────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log('Socket conectado:', socket.id);

  socket.on('locationUpdate', (data) => {
    console.log('Localização recebida do tracker', data.trackerId, ':', data.lat, data.lng);
    socket.to(data.trackerId).emit('locationUpdate', data);
  });

  socket.on('joinTrackerRoom', (trackerId) => {
    socket.join(trackerId);
    console.log(`Socket ${socket.id} entrou na sala: ${trackerId}`);
  });

  socket.on('disconnect', () => {
    console.log('Socket desconectado:', socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
