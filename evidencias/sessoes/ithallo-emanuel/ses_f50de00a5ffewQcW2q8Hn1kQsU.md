# Preenchimento de pendências em M2-inscricoes.md

| | |
|---|---|
| Sessão | `ses_f50de00a5ffewQcW2q8Hn1kQsU` |
| Pasta | PROJETO FINAL — SEMANA ACADÊMICA/semana-academica |
| Período | 17/09 08:30 → 17/09 08:45 |
| Modelo | google/gemini-3.5-flash-lite |
| Requisições ao modelo | 61 |
| Tokens de entrada / saída | 571.983 / 16.586 |
| Skills | — |
| Subagentes | — |
| Execuções de teste | 0 vermelhas, 0 verdes |
| TDD | 0 ciclo(s) vermelho → verde · 0 teste(s) que já nasceram verdes · 0 vez(es) teste e código juntos |
| Arquivos editados | 0 de teste, 0 de código, 19 de entrevista, 0 de spec, 0 de contexto, 0 de auditoria |
| Alertas | — |

## Linha do tempo

- `17/09 08:30` **prompt** — Vamos responder as perguntas marcadas como PENDENTE em entrevistas/M2-inscricoes.md, uma de cada vez. Eu respondo com o que li no documento de requisitos, com as minhas palavras, citando a regra (ex.: RN-202). Registre a minha resposta na coluna Decisão e ponha a regra citada na coluna Fonte. Não crie perguntas novas e não mexa nas perguntas já respondidas. Não escreva código.
- `17/09 08:32` **prompt** — P2: as inscrições fecham 30 minutos antes do início do 1º encontro. Fonte: RN-202.
- `17/09 08:33` edita entrevista `entrevistas/M2-inscricoes.md` (2×)
- `17/09 08:34` **prompt** — P3: havendo vaga, a inscrição nasce confirmada; sem vaga, nasce em_espera no fim da fila, e lotar não é erro. A posição na espera é calculada, sendo 1 o próximo a ser convocado, na ordem de chegada. "Ocupa vaga" quem está confirmada ou convocada. Fonte: RN-205, RN-216. Obs: ao editar, complete a coluna Fonte com "—" nas linhas ainda PENDENTES da Rodada 1 (P3 a P11 ficaram com 3 colunas e quebrara…
- `17/09 08:34` edita entrevista `entrevistas/M2-inscricoes.md`
- `17/09 08:35` **prompt** — P4: toda vaga liberada (por cancelamento, convocação vencida ou aumento de vagas) convoca o 1º da espera, com prazo de 2h para confirmar. O prazo nunca ultrapassa o fecho das inscrições, e vaga liberada depois do fecho não convoca ninguém. Convocação vencida vira expirada, sai da fila e convoca o próximo, com o prazo contado a partir do vencimento, em cascata e mesmo sem ninguém acessar o sistema…
- `17/09 08:35` edita entrevista `entrevistas/M2-inscricoes.md` (2×)
- `17/09 08:37` **prompt** — P5: conflito de horário — quem vai ocupar vaga não pode ter outra inscrição que ocupe vaga com encontro sobreposto; encostar (um termina e outro começa no mesmo instante) não é conflito; quem está só na espera não é verificado. Limite de minicursos — no máximo 3 minicursos ocupando vaga por participante; palestra não conta e espera não conta. Fonte: RN-206, RN-207.
- `17/09 08:37` edita entrevista `entrevistas/M2-inscricoes.md` (2×)
- `17/09 08:39` **prompt** — P6: quando mais de uma regra recusa a mesma inscrição, vale a primeira desta ordem: inexistente (404) → atividade cancelada → inscrições encerradas → bloqueio (só em grupo com M5) → já inscrito → conflito de horário → limite de minicursos. Fonte: RN-208.
- `17/09 08:39` edita entrevista `entrevistas/M2-inscricoes.md` (2×)
- `17/09 08:39` **prompt** — P7: o participante cancela a própria inscrição até a atividade começar (relógio no início do 1º encontro ou depois → ATIVIDADE_JA_INICIADA). Inscrição já cancelada ou expirada não é cancelada de novo → INSCRICAO_INATIVA. Ordem: verifica INSCRICAO_INATIVA antes de ATIVIDADE_JA_INICIADA. Fonte: RN-209, RN-210.
- `17/09 08:40` edita entrevista `entrevistas/M2-inscricoes.md` (2×)
- `17/09 08:40` **prompt** — P8: cancelar a atividade cancela todas as inscrições ativas dela (confirmadas, em espera e convocadas). Fonte: RN-217.
- `17/09 08:40` edita entrevista `entrevistas/M2-inscricoes.md` (2×)
- `17/09 08:41` **prompt** — P9: o participante só vê e mexe nas próprias inscrições. A inscrição de outro participante responde 404, não 403, para não revelar que ela existe. Fonte: RN-218.
- `17/09 08:41` edita entrevista `entrevistas/M2-inscricoes.md` (2×)
- `17/09 08:42` **prompt** — P10: só participante se inscreve, cancela e confirma convocação. A organização lista todas as inscrições, mas não se inscreve nem cancela nem confirma por ninguém. Logo, organização nessas rotas de escrita recebe 403 SOMENTE_PARTICIPANTE. Fonte: RN-201, RN-219.
- `17/09 08:42` edita entrevista `entrevistas/M2-inscricoes.md` (2×)
- `17/09 08:44` **prompt** — P11: vale uma única inscrição ativa (confirmada, em espera ou convocada) por participante e atividade. Quem cancelou pode se inscrever de novo, entrando pelo fim da fila. Fonte: RN-204.
- `17/09 08:44` edita entrevista `entrevistas/M2-inscricoes.md` (2×)
