import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarServidor } from './src/app.js';
import { novoBanco } from './src/banco.js';

process.env.MODO_TESTE = '1';

const banco = novoBanco(':memory:');
const app = criarServidor({ banco });
const http = require('http');

function fetch(url, headers) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: '127.0.0.1',
      port: 0,
      path: url,
      method: 'GET',
      headers: headers || {},
    };
    // Can't easily use port 0 with manual HTTP, let's use the servidor approach
    reject(new Error('use servidor approach'));
  });
}

async function run() {
  // Test that /painel/bloqueios route works
  // First, let's check the schema
  console.log('bloqueios table columns:', banco.prepare('PRAGMA table_info(bloqueios)').all());
  console.log('inscricoes table columns:', banco.prepare('PRAGMA table_info(inscricoes)').all());
  console.log('presencas table columns:', banco.prepare('PRAGMA table_info(presencas)').all());
  console.log('atividades table columns:', banco.prepare('PRAGMA table_info(atividades)').all());
  
  // Check that the route's SQL queries reference valid columns
  const sqls = [
    'SELECT id, cancelada FROM atividades WHERE cancelada = 0',
    "SELECT participanteId FROM inscricoes WHERE atividadeId = ? AND status = 'confirmada' GROUP BY participanteId",
    'SELECT id FROM presencas WHERE encontroId = ? AND participanteId = ? AND origem != ?',
    'INSERT OR REPLACE INTO bloqueios (participanteId, nome, atividades, bloqueadoDesde) VALUES (?, ?, ?, ?)',
  ];
  
  for (const sql of sqls) {
    try {
      const stmt = banco.prepare(sql);
      console.log('OK:', sql.substring(0, 50));
    } catch (e) {
      console.log('ERROR:', sql.substring(0, 50), e.message);
    }
  }
  
  // Now test the actual endpoint
  const servidor = await new Promise((resolve) => {
    const srv = app.listen(0);
    srv.once('listening', () => resolve(srv));
  });
  
  const base = `http://127.0.0.1:${servidor.address().port}`;
  
  // Reset and seed data
  banco.prepare('INSERT INTO bloqueios (participanteId, nome, atividades, bloqueadoDesde) VALUES (?, ?, ?, ?)').run('p-test', 'Test', '[]', new Date().toISOString());
  
  try {
    const res = await new Promise((resolve, reject) => {
      http.get(`${base}/painel/bloqueios`, { headers: { 'X-Usuario': 'org-ana' } }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(data) }));
      }).on('error', reject);
    });
    
    console.log('Status:', res.status);
    console.log('Body count:', res.body.length);
    console.log('Blocked participants:', res.body.map(b => b.participanteId));
  } finally {
    servidor.close();
  }
}

run().catch(console.error);