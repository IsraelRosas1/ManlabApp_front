import 'dotenv/config';
import express from 'express';

const app = express();
const port = Number(process.env.PORT ?? 3001);

app.use(express.json());

app.get('/health', (_request, response) => {
  response.json({ ok: true, service: 'manlab-backend' });
});

app.get('/', (_request, response) => {
  response.json({ ok: true, message: 'ManLab backend running' });
});

app.listen(port, () => {
  console.log(`ManLab backend listening on http://localhost:${port}`);
});