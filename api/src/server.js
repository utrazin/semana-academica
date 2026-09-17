import { criarServidor } from './app.js';
import { novoBanco } from './banco.js';

const port = Number(process.env.PORT) || 3000;
const banco = novoBanco('dados.db');
const app = criarServidor({ banco });

app.listen(port, () => {
  console.log(`API ouvindo em http://localhost:${port}`);
});