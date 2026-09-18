# Rodada 2 de M4-certificados.md

| | |
|---|---|
| Sessão | `ses_f4e5e3f43ffekBGsPSLX8M8kHf` |
| Pasta | GitHub/semana-academica |
| Período | 17/09 20:09 → 17/09 20:15 |
| Modelo | google/gemini-3.6-flash, opencode/gpt-6-astra, opencode/union-alpha, opencode/muse-spark-1.3-contributor-free |
| Requisições ao modelo | 34 |
| Tokens de entrada / saída | 130.083 / 10.572 |
| Skills | — |
| Subagentes | — |
| Execuções de teste | 0 vermelhas, 0 verdes |
| TDD | 0 ciclo(s) vermelho → verde · 0 teste(s) que já nasceram verdes · 0 vez(es) teste e código juntos |
| Arquivos editados | 0 de teste, 0 de código, 11 de entrevista, 0 de spec, 0 de contexto, 0 de auditoria |
| Alertas | — |

## Linha do tempo

- `17/09 20:09` **prompt** — Vamos concluir a rodada 2 de entrevistas/M4-certificados.md. Vou fornecer minhas respostas de P-02 a P-12. Registre uma de cada vez, preservando o texto e sem alterar P-01 nem as perguntas existentes. Não crie perguntas novas. Use estas referências na coluna Fonte: - P-02: RN-401 a RN-405. - P-03: RN-407, RN-413 e contrato-api.md. - P-04: RN-407 e RN-305. - P-05: RN-408, RN-409 e contrato-api.md …
- `17/09 20:10` **prompt** — Quais condições o participante precisa cumprir para emitir o certificado? Para emitir, o participante precisa ter inscrição confirmada em uma atividade não cancelada, que já tenha terminado, e presença em pelo menos 75% dos encontros. A atividade é considerada encerrada a partir do instante do fim do último encontro, inclusive. A frequência mínima não pode ser arredondada para favorecer o partici…
- `17/09 20:10` edita entrevista `entrevistas/M4-certificados.md`
- `17/09 20:10` **prompt** — A primeira solicitação que atende às condições cria o certificado e retorna status 201. Nas solicitações seguintes, o sistema retorna o mesmo certificado com status 200, sem gerar outro código ou uma nova emissão.
- `17/09 20:10` edita entrevista `entrevistas/M4-certificados.md`
- `17/09 20:11` **prompt** — O código deve seguir o formato SA26-XXXX-XXXX. Os oito caracteres variáveis devem usar o alfabeto ABCDEFGHJKLMNPQRSTUVWXYZ23456789, sem os caracteres 0, O, 1 e I. Cada código precisa ser único entre os certificados do sistema. Ele é criado na primeira emissão e nunca muda. Não há um algoritmo específico de geração definido; a implementação deve garantir o formato e impedir códigos duplicados.
- `17/09 20:11` edita entrevista `entrevistas/M4-certificados.md`
- `17/09 20:11` **prompt** — Qualquer pessoa pode consultar um certificado pelo código, sem informar X-Usuario. A consulta aceita letras minúsculas. Se o código não existir, deve retornar status 404 com NAO_ENCONTRADO. A resposta apresenta o código, o nome abreviado do participante, a atividade, a carga horária e a data de emissão.
- `17/09 20:11` edita entrevista `entrevistas/M4-certificados.md`
- `17/09 20:11` **prompt** — O extrato deve incluir todas as atividades para as quais o participante já pode receber certificado, mesmo que ainda não tenha solicitado a emissão. Isso significa que a atividade precisa estar encerrada, não pode estar cancelada, a inscrição deve estar confirmada e a frequência deve atingir o mínimo exigido. Quando o certificado já foi emitido, o campo codigo vem preenchido. Quando ainda não foi…
- `17/09 20:11` edita entrevista `entrevistas/M4-certificados.md`
- `17/09 20:13` **prompt** — continue
- `17/09 20:13` **prompt** — continue
- `17/09 20:14` **prompt** — continue
- `17/09 20:14` **prompt** — palestrasMinutos é a soma das cargas horárias das palestras elegíveis. minicursosMinutos é a soma das cargas horárias dos minicursos elegíveis. totalMinutos é a soma desses dois valores, sem aplicar os tetos. Para calcular aproveitadoMinutos, primeiro considero no máximo 240 minutos de palestras. Depois somo os minutos de minicursos e aplico o limite total de 1200 minutos. A fórmula fica: aprovei…
- `17/09 20:14` edita entrevista `entrevistas/M4-certificados.md`
- `17/09 20:14` **prompt** — Primeiro são feitas as verificações gerais: identificação do usuário, perfil de participante, existência da atividade e validação do corpo, quando aplicável. Para a primeira emissão, a ordem dos impedimentos é: Atividade inexistente: NAO_ENCONTRADO, status 404. Atividade cancelada: ATIVIDADE_CANCELADA, status 422. Inscrição não confirmada: NAO_INSCRITO, status 403. Atividade ainda não encerrada: …
- `17/09 20:14` edita entrevista `entrevistas/M4-certificados.md`
- `17/09 20:14` **prompt** — A emissão fica disponível a partir do instante do fim do último encontro. Não há prazo máximo definido para solicitar, então não deve ser acrescentada uma data de expiração.
- `17/09 20:14` edita entrevista `entrevistas/M4-certificados.md`
- `17/09 20:14` **prompt** — Sim. Uma tentativa recusada por frequência insuficiente não impede uma nova solicitação. Se as presenças offline forem aceitas e o participante atingir a frequência mínima, ele poderá emitir normalmente. A sincronização pode ser feita até duas horas após o fim do encontro, incluindo o instante limite, desde que cumpra as demais condições de validação. Não precisa esperar esse prazo terminar para …
- `17/09 20:14` edita entrevista `entrevistas/M4-certificados.md`
- `17/09 20:15` **prompt** — O certificado deve informar a carga horária integral da atividade, calculada pela soma da duração de todos os encontros, em minutos. A frequência determina se o participante tem direito ao certificado, mas não reduz a carga horária. Por exemplo, quem comparece a três dos quatro encontros e atende ao mínimo recebe a carga horária total da atividade.
- `17/09 20:15` edita entrevista `entrevistas/M4-certificados.md`
- `17/09 20:15` **prompt** — O código nunca muda, e uma nova solicitação deve devolver o mesmo certificado, sem criar outra emissão ou mudar a data original. Minha interpretação é preservar também a carga horária e as quantidades de presenças e encontros registradas na primeira emissão. Porém, não está definida uma política completa de correção, revogação ou atualização posterior. Por isso, considero a preservação dos valore…
- `17/09 20:15` edita entrevista `entrevistas/M4-certificados.md`
- `17/09 20:15` **prompt** — Confira se P-02 a P-12 estão registradas com resposta e Fonte, preservando as ressalvas existentes. Mostre o resumo e as lacunas restantes. Confira o diff e faça commit apenas de entrevistas/M4-certificados.md com a mensagem "M4: rodada 2". Não faça push e não avance para a spec.
