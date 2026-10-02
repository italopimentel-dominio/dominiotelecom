/**
 * Integração Formulário Google -> Duomni (Controle Indireto)
 *
 * Onde colar: no Formulário Google, menu ⋮ > Editor de scripts (Apps Script).
 * Depois: Acionadores (ícone de relógio) > Adicionar acionador >
 *   função "aoEnviar", origem "Do formulário", evento "Ao enviar formulário".
 * Para mandar as respostas antigas: selecione "enviarTodas" e clique em Executar (uma vez).
 *
 * O sistema procura sozinho, nas respostas, um CPF ou CNPJ válido (ou o e-mail)
 * para achar o parceiro. Inclua uma pergunta de CPF/CNPJ no formulário.
 */
const URL_SISTEMA = 'https://dominiotelecom.vercel.app/api/forms';
const SEGREDO = 'COLE_AQUI_O_MESMO_VALOR_DE_FORMS_WEBHOOK_SECRET';
const TIPO_TREINAMENTO = 'onboarding'; // onboarding, telecom ou servicos

function aoEnviar(e) {
  enviar_(e.response);
}

function enviarTodas() {
  const respostas = FormApp.getActiveForm().getResponses();
  respostas.forEach(function (r) { enviar_(r); Utilities.sleep(200); });
  Logger.log(respostas.length + ' respostas enviadas.');
}

function enviar_(r) {
  const respostas = {};
  r.getItemResponses().forEach(function (ir) {
    const v = ir.getResponse();
    respostas[ir.getItem().getTitle()] = Array.isArray(v) ? v.join(', ') : String(v);
  });
  const email = r.getRespondentEmail();
  if (email) respostas['E-mail do respondente'] = email;
  const resp = UrlFetchApp.fetch(URL_SISTEMA, {
    method: 'post',
    contentType: 'application/json',
    headers: { 'x-webhook-secret': SEGREDO },
    payload: JSON.stringify({
      resposta_id: r.getId(),
      formulario: FormApp.getActiveForm().getTitle(),
      tipo: TIPO_TREINAMENTO,
      respondido_em: r.getTimestamp().toISOString(),
      respostas: respostas,
    }),
    muteHttpExceptions: true,
  });
  Logger.log(resp.getResponseCode() + ' ' + resp.getContentText());
}
