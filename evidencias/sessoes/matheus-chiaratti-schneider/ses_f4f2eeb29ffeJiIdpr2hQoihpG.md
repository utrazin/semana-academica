# Spec M3-presenca a partir de entrevista

| | |
|---|---|
| Sessão | `ses_f4f2eeb29ffeJiIdpr2hQoihpG` |
| Pasta | semana-academica/semana-academica |
| Período | 17/09 16:21 → 17/09 16:33 |
| Modelo | opencode/big-pickle |
| Requisições ao modelo | 19 |
| Tokens de entrada / saída | 46.386 / 40.265 |
| Skills | to-spec |
| Subagentes | — |
| Execuções de teste | 0 vermelhas, 0 verdes |
| TDD | 0 ciclo(s) vermelho → verde · 0 teste(s) que já nasceram verdes · 0 vez(es) teste e código juntos |
| Arquivos editados | 0 de teste, 0 de código, 0 de entrevista, 15 de spec, 0 de contexto, 0 de auditoria |
| Alertas | — |

## Linha do tempo

- `17/09 16:21` **prompt** — Use a skill to-spec. Escreva specs/M3-presenca.md a partir de entrevistas/M3-presenca.md. Cada regra cita a pergunta (P-xx) que a originou e, se houver, a regra do documento (RN-xxx). Antes de escrever, leia specs/M2-inscricoes.md: a spec do M3 segue exatamente a mesma estrutura de oito seções e o mesmo vocabulário. O arquivo vai em specs/, não na raiz. Duas coisas que a skill não sabe sozinha: -…
- `17/09 16:21` carrega a skill **to-spec**
- `17/09 16:25` **prompt** — Faltam três coisas — e tem um motivo para reescrever o arquivo mesmo você achando que ele está certo. O motivo: specs/M3-presenca.md foi escrito na sessão anterior, que abriu na pasta errada e rodou sem a skill to-spec carregada. Reescreva o arquivo agora, com a skill, a partir da entrevista. Não valide o que está lá: produza de novo. O que falta: 1. Uma regra de identificação e papéis, no mesmo …
- `17/09 16:27` edita spec `specs/M3-presenca.md`
- `17/09 16:29` **prompt** — Quatro correções. 1. ERRO DE REGRA no R9. Está escrito "de 15 minutos antes do início até 30 minutos depois do início, extremos dentro da janela, e não depois do fim do encontro". Esse último pedaço é invenção e precisa sair. A janela é definida só pelo início: início−15min a início+30min, e pronto. Ela não é cortada pelo fim do encontro. Num encontro das 19:00 às 19:10, a janela continua indo at…
- `17/09 16:29` edita spec `specs/M3-presenca.md` (6×)
- `17/09 16:30` **prompt** — Mais uma correção, antes de commitar. O critério 9 que você acabou de escrever não é testável: o M1 exige encontro com duração entre 1 e 4 horas (specs/M1-grade.md, R9), então um encontro das 19:00 às 19:10 não pode ser criado — dá ENCONTRO_INVALIDO. O cenário nunca existe. Consequência: como o encontro mínimo tem 1 hora, início + 30min sempre cai antes do fim. A regra R9 continua certa como está…
- `17/09 16:30` edita spec `specs/M3-presenca.md` (2×)
- `17/09 16:33` **prompt** — Quatro correções finais na spec. 1. CONTRADIÇÃO. A seção 1 (Objetivo) ainda diz que a presença é registrada "de 15 minutos antes do início até 30 minutos depois, nunca depois do fim". Isso é o texto velho, que o R9 já corrigiu. Tire o "nunca depois do fim" da seção 1: a janela é definida só pelo início. 2. O critério 10 rotula errado um instante. Num encontro das 19:00 às 22:00, "às 21:00 (dentro…
- `17/09 16:33` edita spec `specs/M3-presenca.md` (6×)
