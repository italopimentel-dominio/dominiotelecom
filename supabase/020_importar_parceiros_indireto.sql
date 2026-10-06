-- =====================================================================
-- Importação única: parceiros da planilha "Indireto - Acompanhamento Diário Parceiros"
-- (101 parceiros e 191 treinamentos). Rodar DEPOIS do 019.
-- Não apaga nada e não duplica: parceiro com o mesmo CPF/CNPJ ou o mesmo nome é
-- mantido como está; treinamento igual (parceiro, tipo, data e observação) não entra de novo.
-- =====================================================================

drop table if exists imp_parceiros;
create temporary table imp_parceiros as
select * from jsonb_to_recordset($json$[
{
"nome": "ADILSO DA SILVA DOS SANTOS",
"cpf": null,
"cnpj": null,
"email": null,
"tel": null,
"status": "base",
"ativ": null,
"obs": "Cadastrado pela importação: participante de treinamento na planilha, fora da lista de parceiros.",
"focal": null
},
{
"nome": "ALEKSANDRO MARCON ALVES DA ANUNCIAÇÃO",
"cpf": null,
"cnpj": null,
"email": null,
"tel": null,
"status": "base",
"ativ": null,
"obs": "Cadastrado pela importação: participante de treinamento na planilha, fora da lista de parceiros.",
"focal": null
},
{
"nome": "ALINE CAMARGO DA SILVA",
"cpf": null,
"cnpj": null,
"email": "alinestella1989@gmail.com",
"tel": "11988504940",
"status": "ativo",
"ativ": "2026-08-31",
"obs": null,
"focal": "elias"
},
{
"nome": "ANA CAROLINA RASINO DE OLIVEIRA",
"cpf": null,
"cnpj": null,
"email": "anaclaroparceiro@gmail.com",
"tel": "17 981802817",
"status": "ativo",
"ativ": "2026-09-15",
"obs": "Obs. planilha: x",
"focal": "tayna"
},
{
"nome": "ANA PAULA CARVALHO CARDOSO",
"cpf": "36934271866",
"cnpj": null,
"email": "paulacardosomts47@yahoo.com",
"tel": "19996741502",
"status": "ativo",
"ativ": "2026-09-23",
"obs": null,
"focal": "elias"
},
{
"nome": "ANA PAULA VITAL",
"cpf": null,
"cnpj": null,
"email": "aninhatalvi1@gmail.com",
"tel": "12992214833",
"status": "ativo",
"ativ": "2026-08-30",
"obs": null,
"focal": "elias"
},
{
"nome": "ANDERSON AMARAL",
"cpf": null,
"cnpj": null,
"email": null,
"tel": null,
"status": "base",
"ativ": null,
"obs": "Status na planilha em 14/09/2026",
"focal": "tayna"
},
{
"nome": "ANDERSON PEREIRA MOREIRA (BETEL)",
"cpf": null,
"cnpj": null,
"email": "adm@betel-sc.com.br",
"tel": "48 99150-4893",
"status": "ativo",
"ativ": "2026-09-25",
"obs": "Obs. planilha: v",
"focal": "tayna"
},
{
"nome": "ANDRESA CARLA CRISTALDI",
"cpf": null,
"cnpj": null,
"email": null,
"tel": null,
"status": "base",
"ativ": null,
"obs": "Cadastrado pela importação: participante de treinamento na planilha, fora da lista de parceiros.",
"focal": null
},
{
"nome": "ANDRESSA CARLA CRISTALDI",
"cpf": null,
"cnpj": null,
"email": "andresa.cristaldi@fastsolucoestelecom.com",
"tel": "11947755802",
"status": "ativo",
"ativ": "2026-09-12",
"obs": null,
"focal": "elias"
},
{
"nome": "ANTONIO CARLOS GALDINO",
"cpf": "35552266811",
"cnpj": null,
"email": "thonygaldino@gmail.com",
"tel": "11922924454",
"status": "ativo",
"ativ": "2026-09-14",
"obs": null,
"focal": "elias"
},
{
"nome": "ARISDELLY CORVELLO SANTIM",
"cpf": null,
"cnpj": null,
"email": "arisdelly@telecomconsultoria.com.br",
"tel": "11993007994",
"status": "ativo",
"ativ": "2026-08-26",
"obs": null,
"focal": "elias"
},
{
"nome": "ARTHUR BELSOLE BOCCALLETTI",
"cpf": null,
"cnpj": null,
"email": "arthur@abbsolutions.com.br",
"tel": "11958116195",
"status": "ativo",
"ativ": "2026-09-18",
"obs": "Obs. planilha: v",
"focal": "tayna"
},
{
"nome": "ARTHUR FARIAS DE OLIVEIRA",
"cpf": null,
"cnpj": null,
"email": "arthur02022005@gmail.com",
"tel": "34998005809",
"status": "ativo",
"ativ": "2026-08-31",
"obs": null,
"focal": "elias"
},
{
"nome": "AUGUSTO CESAR TOFANINI",
"cpf": null,
"cnpj": null,
"email": "tofaninitelecom@gmail.com",
"tel": "19999114767",
"status": "ativo",
"ativ": "2026-09-15",
"obs": "Obs. planilha: somente energia",
"focal": "tayna"
},
{
"nome": "BRUNO KANG",
"cpf": null,
"cnpj": null,
"email": null,
"tel": null,
"status": "base",
"ativ": null,
"obs": "Cadastrado pela importação: participante de treinamento na planilha, fora da lista de parceiros.",
"focal": null
},
{
"nome": "CARLOS ALBERTO RAMALHO ALVES",
"cpf": null,
"cnpj": null,
"email": "tel.fonecorporativo@gmail.com",
"tel": "11944856011",
"status": "aguardando_interacao",
"ativ": null,
"obs": null,
"focal": null
},
{
"nome": "CARLOS MONFORTE",
"cpf": null,
"cnpj": null,
"email": null,
"tel": null,
"status": "base",
"ativ": null,
"obs": "Cadastrado pela importação: participante de treinamento na planilha, fora da lista de parceiros.",
"focal": null
},
{
"nome": "CAROLINE CARVALHO DE MOARES PINHEIRO",
"cpf": null,
"cnpj": null,
"email": "carolmoraes111@gmail.com",
"tel": "19 98235-0395",
"status": "ativo",
"ativ": "2026-09-23",
"obs": "Obs. planilha: novo",
"focal": "tayna"
},
{
"nome": "CAYQUE GOMES DOS SANTOS",
"cpf": null,
"cnpj": null,
"email": null,
"tel": "11 99876-4631",
"status": "base",
"ativ": null,
"obs": "Status na planilha em 17/08/2026",
"focal": "tayna"
},
{
"nome": "CECILIA DOMENIKA NOGUEIRA RAIMUNDO",
"cpf": null,
"cnpj": null,
"email": "ceciliadomenikanogueira@gmail.com",
"tel": "11983142481",
"status": "ativo",
"ativ": "2026-08-30",
"obs": null,
"focal": "elias"
},
{
"nome": "CLAUDINEI FERNANDES DOS SANTOS",
"cpf": null,
"cnpj": null,
"email": null,
"tel": null,
"status": "base",
"ativ": null,
"obs": "Cadastrado pela importação: participante de treinamento na planilha, fora da lista de parceiros.",
"focal": null
},
{
"nome": "DANIEL LUCARELLI DE SOUZA",
"cpf": null,
"cnpj": null,
"email": "duda.12elucarelli@gmail.com",
"tel": "19 98353-1328",
"status": "ativo",
"ativ": "2026-09-03",
"obs": "Obs. planilha: v",
"focal": "tayna"
},
{
"nome": "DANILO FREITAS CANDIDO",
"cpf": null,
"cnpj": null,
"email": "danilo@expandetelecom.com.br",
"tel": "19 98216-4116",
"status": "ativo",
"ativ": "2026-09-15",
"obs": "Obs. planilha: v",
"focal": "tayna"
},
{
"nome": "DAVI PIETRO MALE",
"cpf": null,
"cnpj": null,
"email": null,
"tel": null,
"status": "base",
"ativ": null,
"obs": "Status na planilha em 01/08/2026",
"focal": "elias"
},
{
"nome": "DAVID HENRIQUE CIRINEU",
"cpf": null,
"cnpj": null,
"email": null,
"tel": "19 97412-7070",
"status": "ativo",
"ativ": "2026-09-21",
"obs": "Obs. planilha: v",
"focal": "tayna"
},
{
"nome": "DAVID WALDEMAR DIAMANTINO RIBEIRO",
"cpf": null,
"cnpj": null,
"email": "daviddiamantino.dp@gmail.com",
"tel": "19 99211-8472",
"status": "ativo",
"ativ": "2026-09-16",
"obs": "Obs. planilha: x",
"focal": "tayna"
},
{
"nome": "DOUGLAS PINTO SANTOS",
"cpf": null,
"cnpj": null,
"email": null,
"tel": null,
"status": "base",
"ativ": null,
"obs": "Cadastrado pela importação: participante de treinamento na planilha, fora da lista de parceiros.",
"focal": null
},
{
"nome": "EDSON JOSÈ DO NASCIMENTO",
"cpf": null,
"cnpj": null,
"email": "edsonjosèdonascimento",
"tel": "19 98822-2790",
"status": "ativo",
"ativ": "2026-08-21",
"obs": "Obs. planilha: v",
"focal": "tayna"
},
{
"nome": "EDWILLIANS VIDAL RIBEIRO",
"cpf": null,
"cnpj": null,
"email": null,
"tel": null,
"status": "base",
"ativ": null,
"obs": "Cadastrado pela importação: participante de treinamento na planilha, fora da lista de parceiros.",
"focal": null
},
{
"nome": "ETELVINO CARDOSO",
"cpf": null,
"cnpj": null,
"email": "contato@credprimetelecom.com.br",
"tel": "11996562372",
"status": "ativo",
"ativ": "2026-08-18",
"obs": "Obs. planilha: v",
"focal": "tayna"
},
{
"nome": "FABIO CARVALHO SINATRA",
"cpf": null,
"cnpj": null,
"email": null,
"tel": "12 99604-9608",
"status": "base",
"ativ": null,
"obs": "Status na planilha em 20/08/2026",
"focal": "tayna"
},
{
"nome": "FABIO LACOMB CAMPOS",
"cpf": null,
"cnpj": null,
"email": "fabiocampos.consultor@gmail.com",
"tel": "19989303911",
"status": "ativo",
"ativ": "2026-09-10",
"obs": "Obs. planilha: v",
"focal": "tayna"
},
{
"nome": "FABIO MONFORTE",
"cpf": null,
"cnpj": null,
"email": null,
"tel": null,
"status": "base",
"ativ": null,
"obs": "Cadastrado pela importação: participante de treinamento na planilha, fora da lista de parceiros.",
"focal": null
},
{
"nome": "FERNANDO DORIA",
"cpf": null,
"cnpj": null,
"email": null,
"tel": "11992321281",
"status": "ativo",
"ativ": "2026-08-01",
"obs": null,
"focal": "elias"
},
{
"nome": "FERNANDO DORIA RODRIGUES",
"cpf": null,
"cnpj": null,
"email": null,
"tel": null,
"status": "base",
"ativ": null,
"obs": "Cadastrado pela importação: participante de treinamento na planilha, fora da lista de parceiros.",
"focal": null
},
{
"nome": "FRANCIEL D ANGLES",
"cpf": null,
"cnpj": null,
"email": "francieles2crosara@gmail.com",
"tel": "18996799261",
"status": "ativo",
"ativ": "2026-09-01",
"obs": null,
"focal": "elias"
},
{
"nome": "GABRIEL COSTA GUERRA PEREIRA",
"cpf": null,
"cnpj": null,
"email": "gabrielguerra.vivo@gmail.com",
"tel": "12981852885",
"status": "aguardando_interacao",
"ativ": null,
"obs": null,
"focal": null
},
{
"nome": "GRACE CIBELE BAGATIN",
"cpf": null,
"cnpj": null,
"email": "gracebagatin@yahoo.com.br",
"tel": "(15)998010773",
"status": "ativo",
"ativ": "2026-09-25",
"obs": "Obs. planilha: novo",
"focal": "tayna"
},
{
"nome": "HILTON ROGER CALDEIRA",
"cpf": "38356828813",
"cnpj": null,
"email": "h_roger1@hotmail.com",
"tel": "11981976775",
"status": "ativo",
"ativ": "2026-09-11",
"obs": null,
"focal": "elias"
},
{
"nome": "IZABEL BORGES DE OLIVEIRA",
"cpf": null,
"cnpj": null,
"email": null,
"tel": null,
"status": "base",
"ativ": null,
"obs": "Cadastrado pela importação: participante de treinamento na planilha, fora da lista de parceiros.",
"focal": null
},
{
"nome": "Israel Ferreira da Silva",
"cpf": "53601272873",
"cnpj": null,
"email": "israelfesi1508@gmail.com",
"tel": "19991415607",
"status": "ativo",
"ativ": "2026-09-01",
"obs": null,
"focal": "elias"
},
{
"nome": "JEFFERSON CAFAZZO",
"cpf": null,
"cnpj": null,
"email": null,
"tel": null,
"status": "base",
"ativ": null,
"obs": "Cadastrado pela importação: participante de treinamento na planilha, fora da lista de parceiros.",
"focal": null
},
{
"nome": "JOAO CARLOS STEPAN",
"cpf": null,
"cnpj": null,
"email": null,
"tel": null,
"status": "base",
"ativ": null,
"obs": "Cadastrado pela importação: participante de treinamento na planilha, fora da lista de parceiros.",
"focal": null
},
{
"nome": "JOAS NATHAN TORRES SANTOS",
"cpf": null,
"cnpj": null,
"email": "joasnathantorressantos@gmail.com",
"tel": "11955712306",
"status": "em_contato",
"ativ": null,
"obs": null,
"focal": "tayna"
},
{
"nome": "JORGE GUSTAVO MOYANO MENARES",
"cpf": null,
"cnpj": null,
"email": "upconsultoriatelecom@gmail.com",
"tel": "11989162906",
"status": "em_contato",
"ativ": null,
"obs": null,
"focal": "tayna"
},
{
"nome": "JOSE RENATO FLOQUET",
"cpf": null,
"cnpj": null,
"email": "zeka.floquet@hotmail.com",
"tel": "11974864100",
"status": "ativo",
"ativ": "2026-08-24",
"obs": null,
"focal": "elias"
},
{
"nome": "JUAN WILLIAN FREITAS MORAIS",
"cpf": null,
"cnpj": null,
"email": "juanmorais@ideallconsult.com",
"tel": "12997821110",
"status": "ativo",
"ativ": "2026-09-11",
"obs": "Obs. planilha: v",
"focal": "tayna"
},
{
"nome": "JULIO CESAR BRANDAO ROMANO",
"cpf": null,
"cnpj": null,
"email": "julio.bromano@terra.com.br",
"tel": "11989339197",
"status": "ativo",
"ativ": "2026-08-20",
"obs": "Obs. planilha: próximo mes",
"focal": "tayna"
},
{
"nome": "JULIO CESAR DA SILVA GALVAO",
"cpf": "13233280840",
"cnpj": null,
"email": "julio.galvao76@gmail.com",
"tel": "11988526722",
"status": "ativo",
"ativ": "2026-09-11",
"obs": null,
"focal": "elias"
},
{
"nome": "JÚLIO CESAR FERRAZ DA SILVA",
"cpf": null,
"cnpj": null,
"email": null,
"tel": "11 98243-7768",
"status": "ativo",
"ativ": "2026-08-20",
"obs": "Obs. planilha: v",
"focal": "tayna"
},
{
"nome": "LEANDRO RODRIGUES MENDONCA",
"cpf": null,
"cnpj": null,
"email": null,
"tel": null,
"status": "base",
"ativ": null,
"obs": "Cadastrado pela importação: participante de treinamento na planilha, fora da lista de parceiros.",
"focal": null
},
{
"nome": "LEONARDO SERGIO DE ASSIS LAFIANDRA",
"cpf": null,
"cnpj": null,
"email": null,
"tel": null,
"status": "base",
"ativ": null,
"obs": "Cadastrado pela importação: participante de treinamento na planilha, fora da lista de parceiros.",
"focal": null
},
{
"nome": "LEONARDO VASCONCELLOS BARBOSA",
"cpf": null,
"cnpj": null,
"email": "booking.lnrd@gmail.com",
"tel": "12 99779-3772",
"status": "ativo",
"ativ": "2026-09-21",
"obs": "Obs. planilha: novo/saúde",
"focal": "tayna"
},
{
"nome": "LIGIANE BRITO SANTOS",
"cpf": null,
"cnpj": null,
"email": null,
"tel": "11 96286-5747",
"status": "base",
"ativ": null,
"obs": "Status na planilha em 17/08/2026",
"focal": "tayna"
},
{
"nome": "LUCIANA MARTINS NORONHA",
"cpf": null,
"cnpj": null,
"email": "lmn_noronha@hotmail.com",
"tel": "19993103915",
"status": "ativo",
"ativ": "2026-08-13",
"obs": "Obs. planilha: x",
"focal": "tayna"
},
{
"nome": "LUIS FABIANO DA SILVA",
"cpf": null,
"cnpj": null,
"email": "luisfabianodasilva35@gmail.com",
"tel": "11953327165",
"status": "ativo",
"ativ": "2026-08-21",
"obs": "Obs. planilha: falta no neo",
"focal": "tayna"
},
{
"nome": "LUIZ FABIO DE OLIVEIRA",
"cpf": null,
"cnpj": null,
"email": "lufabio100@gmail.com",
"tel": "11996194581",
"status": "em_contato",
"ativ": null,
"obs": "Obs. planilha: Sem retorno, no momento. | Status na planilha em 15/08/2026",
"focal": "tayna"
},
{
"nome": "LUIZ SANTANA NUSSI",
"cpf": null,
"cnpj": null,
"email": "luiz.nussi@planocerto.com",
"tel": "11976242425",
"status": "ativo",
"ativ": "2026-08-27",
"obs": "Obs. planilha: v",
"focal": "tayna"
},
{
"nome": "MARCELO BARBOSA DOS SANTOS (RODRIGO FARIAS)",
"cpf": null,
"cnpj": null,
"email": "marcelo.cepac@gmail.com",
"tel": "11910315931",
"status": "em_contato",
"ativ": null,
"obs": "Obs. planilha: Sem retorno, no momento. | Status na planilha em 15/08/2026",
"focal": "tayna"
},
{
"nome": "MARCIO EDUARDO MARTINS LOMBA",
"cpf": null,
"cnpj": null,
"email": null,
"tel": null,
"status": "base",
"ativ": null,
"obs": null,
"focal": "tayna"
},
{
"nome": "MARCOS SILVA SANTOS",
"cpf": null,
"cnpj": null,
"email": null,
"tel": null,
"status": "base",
"ativ": null,
"obs": "Cadastrado pela importação: participante de treinamento na planilha, fora da lista de parceiros.",
"focal": null
},
{
"nome": "MARGARETE DE FATIMA MELO",
"cpf": null,
"cnpj": null,
"email": "margarete.telecom@hotmail.com",
"tel": "19984538509",
"status": "ativo",
"ativ": "2026-09-17",
"obs": "Obs. planilha: v",
"focal": "tayna"
},
{
"nome": "MARIA EDUARDA FARIA DE SOUZA",
"cpf": "56333140856",
"cnpj": null,
"email": "mariaeduardafaia94@gmail.com",
"tel": "19982333621",
"status": "ativo",
"ativ": "2026-10-01",
"obs": "Obs. planilha: x",
"focal": "tayna"
},
{
"nome": "MATHEUS HENRIQUE DE SOUZA",
"cpf": null,
"cnpj": null,
"email": "matheushenriquedesouza",
"tel": "19 99573-0271",
"status": "ativo",
"ativ": "2026-08-31",
"obs": "Obs. planilha: v",
"focal": "tayna"
},
{
"nome": "MAURINO MATOS RIBEIRO ROCHA",
"cpf": null,
"cnpj": null,
"email": "megaassesso1@gmail.com",
"tel": "11 94013-9860",
"status": "ativo",
"ativ": "2026-09-14",
"obs": "Obs. planilha: v",
"focal": "tayna"
},
{
"nome": "MIRIAN JULIO DA SILVA",
"cpf": null,
"cnpj": null,
"email": "mirian.serv.telec@hotmail.com",
"tel": "11988602850",
"status": "aguardando_interacao",
"ativ": null,
"obs": null,
"focal": null
},
{
"nome": "NATHALIA DA SILVA PORTO",
"cpf": null,
"cnpj": null,
"email": "nathalia.porto27@gmail.com",
"tel": "19997976065",
"status": "ativo",
"ativ": "2026-09-25",
"obs": "Obs. planilha: novo",
"focal": "tayna"
},
{
"nome": "NEIFA ADRIANA DE MELLO RIGOBELLO",
"cpf": null,
"cnpj": null,
"email": "neifamrigobello@gmail.com",
"tel": "19991983919",
"status": "ativo",
"ativ": "2026-08-10",
"obs": "Obs. planilha: x",
"focal": "tayna"
},
{
"nome": "NELSON AVESSO",
"cpf": null,
"cnpj": null,
"email": "contato@agenciaavesso.com.br",
"tel": "16991488774",
"status": "ativo",
"ativ": "2026-08-11",
"obs": null,
"focal": "elias"
},
{
"nome": "NELSON JOSÉ RIBEIRO JÚNIOR",
"cpf": "13225819832",
"cnpj": null,
"email": null,
"tel": "16 99148-8774",
"status": "ativo",
"ativ": "2026-09-16",
"obs": "Obs. planilha: v",
"focal": "tayna"
},
{
"nome": "NILTON RIBEIRO DE ARAUJO",
"cpf": null,
"cnpj": "19187739000182",
"email": "niltonma2010@gmail.com",
"tel": "19 99395-1090",
"status": "ativo",
"ativ": "2026-09-03",
"obs": null,
"focal": "elias"
},
{
"nome": "PAOLA CRISTALDI",
"cpf": null,
"cnpj": null,
"email": "paola.cristaldi@fastsolucoestelecom.com",
"tel": "11992861716",
"status": "em_contato",
"ativ": null,
"obs": "Status na planilha em 15/08/2026",
"focal": "tayna"
},
{
"nome": "PAULO CESAR DE MELO",
"cpf": null,
"cnpj": null,
"email": null,
"tel": null,
"status": "base",
"ativ": null,
"obs": "Cadastrado pela importação: participante de treinamento na planilha, fora da lista de parceiros.",
"focal": null
},
{
"nome": "PAULO ROBERTO DOS SANTOS",
"cpf": null,
"cnpj": null,
"email": "pr1578985@gmail.com",
"tel": "11956176870",
"status": "ativo",
"ativ": "2026-08-14",
"obs": "Obs. planilha: v",
"focal": "tayna"
},
{
"nome": "PEDRO DUARTE",
"cpf": null,
"cnpj": null,
"email": "pedroduartcru2@gmail.com",
"tel": "19996873482",
"status": "ativo",
"ativ": "2026-08-13",
"obs": null,
"focal": "elias"
},
{
"nome": "PEDRO DUARTE DA CRUZ",
"cpf": null,
"cnpj": null,
"email": "pedroduartcru2@gmail.com",
"tel": "19 99687-3482",
"status": "ativo",
"ativ": "2026-08-13",
"obs": "Obs. planilha: v",
"focal": "tayna"
},
{
"nome": "POLIANA SENA SANTOS",
"cpf": null,
"cnpj": null,
"email": "poliana.santos@vivocorp.net",
"tel": "11994342353",
"status": "base",
"ativ": null,
"obs": null,
"focal": "tayna"
},
{
"nome": "PRISCILA RODRIGUES",
"cpf": null,
"cnpj": null,
"email": null,
"tel": null,
"status": "base",
"ativ": null,
"obs": "Cadastrado pela importação: participante de treinamento na planilha, fora da lista de parceiros.",
"focal": null
},
{
"nome": "RAFAEL SIMOES FLAUSINO",
"cpf": null,
"cnpj": null,
"email": "rafaelsimoes2016@hotmail.com",
"tel": "16991650253",
"status": "ativo",
"ativ": "2026-08-17",
"obs": "Obs. planilha: x",
"focal": "tayna"
},
{
"nome": "RENATO CAMPOS",
"cpf": null,
"cnpj": null,
"email": null,
"tel": "11 95166-3609",
"status": "base",
"ativ": null,
"obs": "Status na planilha em 13/08/2026",
"focal": "tayna"
},
{
"nome": "ROBERTA APARECIDA PIMENTA (EDIVALDO FERNANDES)",
"cpf": null,
"cnpj": null,
"email": null,
"tel": null,
"status": "base",
"ativ": null,
"obs": "Cadastrado pela importação: participante de treinamento na planilha, fora da lista de parceiros.",
"focal": null
},
{
"nome": "ROBERTO APARECIDO SANCHES CALISTER",
"cpf": null,
"cnpj": null,
"email": null,
"tel": "11941079122",
"status": "ativo",
"ativ": "2026-09-24",
"obs": null,
"focal": "elias"
},
{
"nome": "ROGÉRIO SIQUEIRA LIMA",
"cpf": null,
"cnpj": null,
"email": "rogerio.lima@hpsystem.com.br",
"tel": "11940011339",
"status": "ativo",
"ativ": "2026-09-25",
"obs": "Obs. planilha: novo",
"focal": "tayna"
},
{
"nome": "ROQUE NELSON DA COSTA FERREIRA",
"cpf": null,
"cnpj": null,
"email": "roque@inovatelecombrasil.com.br",
"tel": "11999135582",
"status": "ativo",
"ativ": "2026-08-14",
"obs": "Obs. planilha: x",
"focal": "tayna"
},
{
"nome": "ROSAUBA LIMA",
"cpf": null,
"cnpj": null,
"email": null,
"tel": "11 98775-0799",
"status": "base",
"ativ": null,
"obs": "Status na planilha em 13/08/2026",
"focal": "tayna"
},
{
"nome": "RUBENS DE MELO PARANHOS",
"cpf": null,
"cnpj": null,
"email": null,
"tel": "13 99685-5726",
"status": "base",
"ativ": null,
"obs": "Status na planilha em 14/08/2026",
"focal": "tayna"
},
{
"nome": "SAMANTHA SCYLLA DE LIMA",
"cpf": null,
"cnpj": null,
"email": "scylla123@gmail.com",
"tel": "11954271239",
"status": "ativo",
"ativ": "2026-08-14",
"obs": "Obs. planilha: x",
"focal": "tayna"
},
{
"nome": "SANDRA REGINA DA SILVA",
"cpf": null,
"cnpj": null,
"email": "drasandra1968@gmail.com",
"tel": "11987609040",
"status": "ativo",
"ativ": "2026-08-17",
"obs": null,
"focal": "elias"
},
{
"nome": "SAULO REIS",
"cpf": null,
"cnpj": null,
"email": "saulo@grupoconexus.com.br",
"tel": "11954830147",
"status": "aguardando_interacao",
"ativ": null,
"obs": null,
"focal": null
},
{
"nome": "SILVIA MARIA MONTEIRO",
"cpf": null,
"cnpj": null,
"email": "silviamonteiro.rp@bol.com.br",
"tel": "16992142778",
"status": "ativo",
"ativ": "2026-09-21",
"obs": "Obs. planilha: v",
"focal": "tayna"
},
{
"nome": "SILVIO CESAR DE OLIVEIRA",
"cpf": null,
"cnpj": null,
"email": "silviocezaroliveira@hotmail.com",
"tel": "16994043782",
"status": "ativo",
"ativ": "2026-08-31",
"obs": "Obs. planilha: x",
"focal": "tayna"
},
{
"nome": "STEPHANIE BOAVENTURA",
"cpf": null,
"cnpj": null,
"email": "stephanie",
"tel": "19 99186-7091",
"status": "ativo",
"ativ": "2026-08-31",
"obs": "Obs. planilha: x",
"focal": "tayna"
},
{
"nome": "TATIANE AFONSO",
"cpf": "35173382813",
"cnpj": null,
"email": "tatiane.antoniazzi33@gmail.com",
"tel": "11994352103",
"status": "ativo",
"ativ": "2026-09-10",
"obs": null,
"focal": "elias"
},
{
"nome": "TAYNA GABRIELI GARCIA",
"cpf": null,
"cnpj": null,
"email": null,
"tel": null,
"status": "base",
"ativ": null,
"obs": "Cadastrado pela importação: participante de treinamento na planilha, fora da lista de parceiros.",
"focal": null
},
{
"nome": "THARLES EDUARDO SOLCIA",
"cpf": "22121356886",
"cnpj": null,
"email": "eduardo.vivofibra@hotmail.com",
"tel": "11957749656",
"status": "ativo",
"ativ": "2026-09-08",
"obs": null,
"focal": "elias"
},
{
"nome": "THIAGO MEGIORIN",
"cpf": null,
"cnpj": null,
"email": "comercialconsultoria@outlook.com.br",
"tel": "11943716517",
"status": "ativo",
"ativ": "2026-08-14",
"obs": "Obs. planilha: x",
"focal": "tayna"
},
{
"nome": "TIAGO RODRIGO DOS SANTOS BARROS",
"cpf": null,
"cnpj": null,
"email": "tiagorodrigo.barros@gmailcom",
"tel": "18997762626",
"status": "ativo",
"ativ": "2026-08-14",
"obs": "Obs. planilha: x",
"focal": "tayna"
},
{
"nome": "WAGNER SOARES",
"cpf": null,
"cnpj": null,
"email": null,
"tel": null,
"status": "base",
"ativ": null,
"obs": "Cadastrado pela importação: participante de treinamento na planilha, fora da lista de parceiros.",
"focal": null
},
{
"nome": "WILSON BARBOSA DE OLIVEIRA",
"cpf": null,
"cnpj": null,
"email": "wilson_oliveiraa@hotmail.com",
"tel": "19987340089",
"status": "ativo",
"ativ": "2026-08-10",
"obs": "Obs. planilha: ativo mas sem venda",
"focal": "tayna"
},
{
"nome": "YURI DOS SANTOS SIMIONATO",
"cpf": null,
"cnpj": null,
"email": null,
"tel": null,
"status": "base",
"ativ": null,
"obs": "Cadastrado pela importação: participante de treinamento na planilha, fora da lista de parceiros.",
"focal": null
}
]$json$::jsonb)
  as x(nome text, cpf text, cnpj text, email text, tel text, status text, ativ date, obs text, focal text);

drop table if exists imp_treinos;
create temporary table imp_treinos as
select * from jsonb_to_recordset($json$[
{
"nome": "LUIS FABIANO DA SILVA",
"tipo": "onboarding",
"data": "2026-08-28",
"instrutor": "Tayná",
"obs": "Planilha: ONB Duomni"
},
{
"nome": "LUIS FABIANO DA SILVA",
"tipo": "servicos",
"data": "2026-08-28",
"instrutor": "Tayná",
"obs": "Planilha: treinamento DUOMNI"
},
{
"nome": "Rosauba Lima",
"tipo": "telecom",
"data": "2026-08-13",
"instrutor": "Elias",
"obs": "Planilha: treinamento TELECOM"
},
{
"nome": "WILSON BARBOSA DE OLIVEIRA",
"tipo": "onboarding",
"data": "2026-09-03",
"instrutor": "Elias",
"obs": "Planilha: ONB Duomni"
},
{
"nome": "WILSON BARBOSA DE OLIVEIRA",
"tipo": "onboarding",
"data": "2026-08-13",
"instrutor": "Tayná",
"obs": "Planilha: ONB Telecom"
},
{
"nome": "ADILSO DA SILVA DOS SANTOS",
"tipo": "telecom",
"data": "2026-09-22",
"instrutor": "Elias",
"obs": "Planilha: treinamento TELECOM"
},
{
"nome": "ALEKSANDRO MARCON ALVES DA ANUNCIAÇÃO",
"tipo": "telecom",
"data": "2026-09-22",
"instrutor": "Elias",
"obs": "Planilha: treinamento TELECOM"
},
{
"nome": "ANDRESA CARLA CRISTALDI",
"tipo": "telecom",
"data": "2026-09-22",
"instrutor": "Elias",
"obs": "Planilha: treinamento TELECOM"
},
{
"nome": "BRUNO KANG",
"tipo": "telecom",
"data": "2026-09-22",
"instrutor": "Elias",
"obs": "Planilha: treinamento TELECOM"
},
{
"nome": "CARLOS ALBERTO RAMALHO ALVES",
"tipo": "telecom",
"data": "2026-09-22",
"instrutor": "Elias",
"obs": "Planilha: treinamento TELECOM"
},
{
"nome": "CLAUDINEI FERNANDES DOS SANTOS",
"tipo": "servicos",
"data": "2026-08-20",
"instrutor": "Tayná",
"obs": "Planilha: treinamento DUOMNI"
},
{
"nome": "CLAUDINEI FERNANDES DOS SANTOS",
"tipo": "telecom",
"data": "2026-09-22",
"instrutor": "Elias",
"obs": "Planilha: treinamento TELECOM"
},
{
"nome": "DOUGLAS PINTO SANTOS",
"tipo": "telecom",
"data": "2026-09-22",
"instrutor": "Elias",
"obs": "Planilha: treinamento TELECOM"
},
{
"nome": "EDWILLIANS VIDAL RIBEIRO",
"tipo": "telecom",
"data": "2026-09-22",
"instrutor": "Elias",
"obs": "Planilha: treinamento TELECOM"
},
{
"nome": "FABIO CARVALHO SINATRA",
"tipo": "telecom",
"data": "2026-09-22",
"instrutor": "Elias",
"obs": "Planilha: treinamento TELECOM"
},
{
"nome": "FERNANDO DORIA RODRIGUES",
"tipo": "telecom",
"data": "2026-09-22",
"instrutor": "Elias",
"obs": "Planilha: treinamento TELECOM"
},
{
"nome": "GABRIEL COSTA GUERRA PEREIRA",
"tipo": "telecom",
"data": "2026-09-22",
"instrutor": "Elias",
"obs": "Planilha: treinamento TELECOM"
},
{
"nome": "IZABEL BORGES DE OLIVEIRA",
"tipo": "telecom",
"data": "2026-09-22",
"instrutor": "Elias",
"obs": "Planilha: treinamento TELECOM"
},
{
"nome": "JOAS NATHAN TORRES SANTOS",
"tipo": "telecom",
"data": "2026-09-22",
"instrutor": "Elias",
"obs": "Planilha: treinamento TELECOM"
},
{
"nome": "JORGE GUSTAVO MOYANO MENARES",
"tipo": "telecom",
"data": "2026-09-22",
"instrutor": "Elias",
"obs": "Planilha: treinamento TELECOM"
},
{
"nome": "JUAN WILLIAN FREITAS MORAIS",
"tipo": "telecom",
"data": "2026-09-22",
"instrutor": "Elias",
"obs": "Planilha: treinamento TELECOM"
},
{
"nome": "TIAGO RODRIGO DOS SANTOS BARROS",
"tipo": "onboarding",
"data": "2026-08-14",
"instrutor": "Tayná",
"obs": "Planilha: ONB Duomni"
},
{
"nome": "TIAGO RODRIGO DOS SANTOS BARROS",
"tipo": "onboarding",
"data": "2026-08-14",
"instrutor": "Tayná",
"obs": "Planilha: ONB Telecom"
},
{
"nome": "TIAGO RODRIGO DOS SANTOS BARROS",
"tipo": "servicos",
"data": "2026-08-14",
"instrutor": "Tayná",
"obs": "Planilha: treinamento DUOMNI"
},
{
"nome": "JULIO CESAR BRANDÃO ROMANO",
"tipo": "telecom",
"data": "2026-08-14",
"instrutor": "Elias",
"obs": "Planilha: treinamento TELECOM"
},
{
"nome": "LEANDRO RODRIGUES MENDONCA",
"tipo": "telecom",
"data": "2026-09-22",
"instrutor": "Elias",
"obs": "Planilha: treinamento TELECOM"
},
{
"nome": "LEONARDO SERGIO DE ASSIS LAFIANDRA",
"tipo": "telecom",
"data": "2026-09-22",
"instrutor": "Elias",
"obs": "Planilha: treinamento TELECOM"
},
{
"nome": "LUIZ FABIO DE OLIVEIRA",
"tipo": "telecom",
"data": "2026-09-22",
"instrutor": "Elias",
"obs": "Planilha: treinamento TELECOM"
},
{
"nome": "MARCELO BARBOSA DOS SANTOS (RODRIGO FARIAS)",
"tipo": "telecom",
"data": "2026-09-22",
"instrutor": "Elias",
"obs": "Planilha: treinamento TELECOM"
},
{
"nome": "MIRIAN JULIO DA SILVA",
"tipo": "telecom",
"data": "2026-09-22",
"instrutor": "Elias",
"obs": "Planilha: treinamento TELECOM"
},
{
"nome": "PAULO CESAR DE MELO",
"tipo": "telecom",
"data": "2026-09-22",
"instrutor": "Elias",
"obs": "Planilha: treinamento TELECOM"
},
{
"nome": "PEDRO DUARTE DA CRUZ",
"tipo": "telecom",
"data": "2026-09-22",
"instrutor": "Elias",
"obs": "Planilha: treinamento TELECOM"
},
{
"nome": "ROBERTA APARECIDA PIMENTA (EDIVALDO FERNANDES)",
"tipo": "telecom",
"data": "2026-09-22",
"instrutor": "Elias",
"obs": "Planilha: treinamento TELECOM"
},
{
"nome": "RUBENS DE MELO PARANHOS",
"tipo": "telecom",
"data": "2026-09-22",
"instrutor": "Elias",
"obs": "Planilha: treinamento TELECOM"
},
{
"nome": "SANDRA REGINA DA SILVA",
"tipo": "telecom",
"data": "2026-09-22",
"instrutor": "Elias",
"obs": "Planilha: treinamento TELECOM"
},
{
"nome": "PEDRO DUARTE DA CRUZ",
"tipo": "onboarding",
"data": "2026-08-20",
"instrutor": "Tayná",
"obs": "Planilha: ONB Duomni"
},
{
"nome": "PEDRO DUARTE DA CRUZ",
"tipo": "servicos",
"data": "2026-08-20",
"instrutor": "Tayná",
"obs": "Planilha: treinamento DUOMNI"
},
{
"nome": "THIAGO MEGIORIN",
"tipo": "onboarding",
"data": "2026-08-14",
"instrutor": "Tayná",
"obs": "Planilha: ONB Duomni"
},
{
"nome": "THIAGO MEGIORIN",
"tipo": "onboarding",
"data": "2026-08-14",
"instrutor": "Tayná",
"obs": "Planilha: ONB Telecom"
},
{
"nome": "THIAGO MEGIORIN",
"tipo": "servicos",
"data": "2026-08-14",
"instrutor": "Tayná",
"obs": "Planilha: treinamento DUOMNI"
},
{
"nome": "TAYNA GABRIELI GARCIA",
"tipo": "telecom",
"data": "2026-09-22",
"instrutor": "Elias",
"obs": "Planilha: treinamento TELECOM"
},
{
"nome": "YURI DOS SANTOS SIMIONATO",
"tipo": "telecom",
"data": "2026-09-22",
"instrutor": "Elias",
"obs": "Planilha: treinamento TELECOM"
},
{
"nome": "ANDERSON AMARAL",
"tipo": "telecom",
"data": "2026-09-22",
"instrutor": "Elias",
"obs": "Planilha: treinamento TELECOM"
},
{
"nome": "CARLOS MONFORTE",
"tipo": "telecom",
"data": "2026-09-22",
"instrutor": "Elias",
"obs": "Planilha: treinamento TELECOM"
},
{
"nome": "WAGNER SOARES",
"tipo": "telecom",
"data": "2026-09-22",
"instrutor": "Elias",
"obs": "Planilha: treinamento TELECOM"
},
{
"nome": "ETELVINO CARDOSO",
"tipo": "onboarding",
"data": "2026-09-02",
"instrutor": "Elias",
"obs": "Planilha: ONB Duomni"
},
{
"nome": "ETELVINO CARDOSO",
"tipo": "onboarding",
"data": "2026-08-18",
"instrutor": "Tayná",
"obs": "Planilha: ONB Telecom"
},
{
"nome": "ETELVINO CARDOSO",
"tipo": "servicos",
"data": "2026-08-18",
"instrutor": "Tayná",
"obs": "Planilha: treinamento DUOMNI"
},
{
"nome": "SAULO REIS",
"tipo": "telecom",
"data": "2026-09-22",
"instrutor": "Elias",
"obs": "Planilha: treinamento TELECOM"
},
{
"nome": "JOAO CARLOS STEPAN",
"tipo": "telecom",
"data": "2026-09-22",
"instrutor": "Elias",
"obs": "Planilha: treinamento TELECOM"
},
{
"nome": "PAULO ROBERTO DOS SANTOS",
"tipo": "onboarding",
"data": "2026-08-14",
"instrutor": "Tayná",
"obs": "Planilha: ONB Duomni"
},
{
"nome": "PAULO ROBERTO DOS SANTOS",
"tipo": "servicos",
"data": "2026-08-14",
"instrutor": "Tayná",
"obs": "Planilha: treinamento DUOMNI"
},
{
"nome": "THARLES EDUARDO SOLCIA",
"tipo": "onboarding",
"data": "2026-09-10",
"instrutor": "Conjunto",
"obs": "Planilha: ONB Duomni"
},
{
"nome": "THARLES EDUARDO SOLCIA",
"tipo": "onboarding",
"data": "2026-09-10",
"instrutor": "Conjunto",
"obs": "Planilha: ONB Telecom"
},
{
"nome": "PAULO ROBERTO DOS SANTOS",
"tipo": "telecom",
"data": "2026-09-22",
"instrutor": "Elias",
"obs": "Planilha: treinamento TELECOM"
},
{
"nome": "FABIO MONFORTE",
"tipo": "telecom",
"data": "2026-09-22",
"instrutor": "Elias",
"obs": "Planilha: treinamento TELECOM"
},
{
"nome": "MARCOS SILVA SANTOS",
"tipo": "telecom",
"data": "2026-09-22",
"instrutor": "Elias",
"obs": "Planilha: treinamento TELECOM"
},
{
"nome": "JEFFERSON CAFAZZO",
"tipo": "telecom",
"data": "2026-09-22",
"instrutor": "Elias",
"obs": "Planilha: treinamento TELECOM"
},
{
"nome": "PRISCILA RODRIGUES",
"tipo": "telecom",
"data": "2026-09-22",
"instrutor": "Elias",
"obs": "Planilha: treinamento TELECOM"
},
{
"nome": "PAOLA CRISTALDI",
"tipo": "telecom",
"data": "2026-09-22",
"instrutor": "Elias",
"obs": "Planilha: treinamento TELECOM"
},
{
"nome": "SILVIO CESAR DE OLIVEIRA",
"tipo": "onboarding",
"data": "2026-08-31",
"instrutor": "Tayná",
"obs": "Planilha: ONB Duomni"
},
{
"nome": "SILVIO CESAR DE OLIVEIRA",
"tipo": "servicos",
"data": "2026-08-31",
"instrutor": "Tayná",
"obs": "Planilha: treinamento DUOMNI"
},
{
"nome": "LUIZ SANTANA NUSSI",
"tipo": "onboarding",
"data": "2026-08-27",
"instrutor": "Tayná",
"obs": "Planilha: ONB Duomni"
},
{
"nome": "LUIZ SANTANA NUSSI",
"tipo": "servicos",
"data": "2026-08-27",
"instrutor": "Tayná",
"obs": "Planilha: treinamento DUOMNI"
},
{
"nome": "SILVIA MARIA MONTEIRO",
"tipo": "onboarding",
"data": "2026-09-18",
"instrutor": "Tayná",
"obs": "Planilha: ONB Duomni"
},
{
"nome": "SILVIA MARIA MONTEIRO",
"tipo": "servicos",
"data": "2026-09-18",
"instrutor": "Tayná",
"obs": "Planilha: treinamento DUOMNI"
},
{
"nome": "SAMANTHA SCYLLA DE LIMA",
"tipo": "onboarding",
"data": "2026-09-10",
"instrutor": "Elias",
"obs": "Planilha: ONB Duomni"
},
{
"nome": "SAMANTHA SCYLLA DE LIMA",
"tipo": "onboarding",
"data": "2026-08-14",
"instrutor": "Tayná",
"obs": "Planilha: ONB Telecom"
},
{
"nome": "SAMANTHA SCYLLA DE LIMA",
"tipo": "servicos",
"data": "2026-08-14",
"instrutor": "Tayná",
"obs": "Planilha: treinamento DUOMNI"
},
{
"nome": "ROQUE NELSON DA COSTA FERREIRA",
"tipo": "onboarding",
"data": "2026-08-14",
"instrutor": "Tayná",
"obs": "Planilha: ONB Duomni"
},
{
"nome": "ROQUE NELSON DA COSTA FERREIRA",
"tipo": "servicos",
"data": "2026-08-14",
"instrutor": "Tayná",
"obs": "Planilha: treinamento DUOMNI"
},
{
"nome": "RAFAEL SIMOES FLAUSINO",
"tipo": "onboarding",
"data": "2026-08-17",
"instrutor": "Tayná",
"obs": "Planilha: ONB Duomni"
},
{
"nome": "RAFAEL SIMOES FLAUSINO",
"tipo": "servicos",
"data": "2026-08-17",
"instrutor": "Tayná",
"obs": "Planilha: treinamento DUOMNI"
},
{
"nome": "POLIANA SENA SANTOS",
"tipo": "onboarding",
"data": "2026-09-15",
"instrutor": "Tayná",
"obs": "Planilha: ONB Duomni"
},
{
"nome": "POLIANA SENA SANTOS",
"tipo": "servicos",
"data": "2026-09-15",
"instrutor": "Tayná",
"obs": "Planilha: treinamento DUOMNI"
},
{
"nome": "NILTON RIBEIRO DE ARAUJO",
"tipo": "onboarding",
"data": "2026-09-03",
"instrutor": "Elias",
"obs": "Planilha: ONB Duomni"
},
{
"nome": "NILTON RIBEIRO DE ARAUJO",
"tipo": "onboarding",
"data": "2026-08-17",
"instrutor": "Tayná",
"obs": "Planilha: ONB Telecom"
},
{
"nome": "NILTON RIBEIRO DE ARAUJO",
"tipo": "servicos",
"data": "2026-08-17",
"instrutor": "Tayná",
"obs": "Planilha: treinamento DUOMNI"
},
{
"nome": "NEIFA ADRIANA DE MELLO RIGOBELLO",
"tipo": "onboarding",
"data": "2026-09-08",
"instrutor": "Elias",
"obs": "Planilha: ONB Duomni"
},
{
"nome": "NEIFA ADRIANA DE MELLO RIGOBELLO",
"tipo": "onboarding",
"data": "2026-08-10",
"instrutor": "Tayná",
"obs": "Planilha: ONB Telecom"
},
{
"nome": "NEIFA ADRIANA DE MELLO RIGOBELLO",
"tipo": "servicos",
"data": "2026-08-10",
"instrutor": "Tayná",
"obs": "Planilha: treinamento DUOMNI"
},
{
"nome": "MARGARETE DE FATIMA MELO",
"tipo": "onboarding",
"data": "2026-09-17",
"instrutor": "Tayná",
"obs": "Planilha: ONB Duomni"
},
{
"nome": "MARGARETE DE FATIMA MELO",
"tipo": "servicos",
"data": "2026-09-17",
"instrutor": "Tayná",
"obs": "Planilha: treinamento DUOMNI"
},
{
"nome": "LUIS FABIANO DA SILVA",
"tipo": "onboarding",
"data": "2026-09-17",
"instrutor": "Conjunto",
"obs": "Planilha: ONB Duomni | pontuação 5 | respondeu em #REF!"
},
{
"nome": "LUIS FABIANO DA SILVA",
"tipo": "onboarding",
"data": "2026-08-28",
"instrutor": "Tayná",
"obs": "Planilha: ONB Telecom"
},
{
"nome": "LUIS FABIANO DA SILVA",
"tipo": "servicos",
"data": "2026-08-28",
"instrutor": "Tayná",
"obs": "Planilha: treinamento DUOMNI"
},
{
"nome": "LUCIANA MARTINS NORONHA",
"tipo": "onboarding",
"data": "2026-09-08",
"instrutor": "Elias",
"obs": "Planilha: ONB Duomni"
},
{
"nome": "LUCIANA MARTINS NORONHA",
"tipo": "onboarding",
"data": "2026-08-13",
"instrutor": "Tayná",
"obs": "Planilha: ONB Telecom"
},
{
"nome": "LUCIANA MARTINS NORONHA",
"tipo": "servicos",
"data": "2026-08-13",
"instrutor": "Tayná",
"obs": "Planilha: treinamento DUOMNI"
},
{
"nome": "AUGUSTO CESAR TOFANINI",
"tipo": "onboarding",
"data": "2026-09-15",
"instrutor": "Tayná",
"obs": "Planilha: ONB Duomni"
},
{
"nome": "AUGUSTO CESAR TOFANINI",
"tipo": "servicos",
"data": "2026-09-15",
"instrutor": "Tayná",
"obs": "Planilha: treinamento DUOMNI"
},
{
"nome": "JULIO CESAR BRANDAO ROMANO",
"tipo": "onboarding",
"data": "2026-08-20",
"instrutor": "Tayná",
"obs": "Planilha: ONB Duomni"
},
{
"nome": "JULIO CESAR BRANDAO ROMANO",
"tipo": "servicos",
"data": "2026-08-20",
"instrutor": "Tayná",
"obs": "Planilha: treinamento DUOMNI"
},
{
"nome": "JUAN WILLIAN FREITAS MORAIS",
"tipo": "onboarding",
"data": "2026-09-11",
"instrutor": "Tayná",
"obs": "Planilha: ONB Duomni"
},
{
"nome": "JUAN WILLIAN FREITAS MORAIS",
"tipo": "servicos",
"data": "2026-09-11",
"instrutor": "Tayná",
"obs": "Planilha: treinamento DUOMNI"
},
{
"nome": "FABIO LACOMB CAMPOS",
"tipo": "onboarding",
"data": "2026-09-10",
"instrutor": "Tayná",
"obs": "Planilha: ONB Duomni"
},
{
"nome": "FABIO LACOMB CAMPOS",
"tipo": "servicos",
"data": "2026-09-10",
"instrutor": "Tayná",
"obs": "Planilha: treinamento DUOMNI"
},
{
"nome": "ARTHUR BELSOLE BOCCALLETTI",
"tipo": "onboarding",
"data": "2026-09-18",
"instrutor": "Tayná",
"obs": "Planilha: ONB Duomni"
},
{
"nome": "ARISDELLY CORVELLO SANTIM",
"tipo": "onboarding",
"data": "2026-09-10",
"instrutor": "Conjunto",
"obs": "Planilha: ONB Duomni"
},
{
"nome": "EDSON JOSÈ DO NASCIMENTO",
"tipo": "onboarding",
"data": "2026-08-21",
"instrutor": "Tayná",
"obs": "Planilha: ONB Duomni"
},
{
"nome": "EDSON JOSÈ DO NASCIMENTO",
"tipo": "servicos",
"data": "2026-08-21",
"instrutor": "Tayná",
"obs": "Planilha: treinamento DUOMNI"
},
{
"nome": "MATHEUS HENRIQUE DE SOUZA",
"tipo": "onboarding",
"data": "2026-09-17",
"instrutor": "Conjunto",
"obs": "Planilha: ONB Duomni"
},
{
"nome": "MATHEUS HENRIQUE DE SOUZA",
"tipo": "onboarding",
"data": "2026-08-31",
"instrutor": "Tayná",
"obs": "Planilha: ONB Telecom"
},
{
"nome": "MATHEUS HENRIQUE DE SOUZA",
"tipo": "servicos",
"data": "2026-08-31",
"instrutor": "Tayná",
"obs": "Planilha: treinamento DUOMNI"
},
{
"nome": "STEPHANIE BOAVENTURA",
"tipo": "onboarding",
"data": "2026-09-25",
"instrutor": "Conjunto",
"obs": "Planilha: ONB Duomni"
},
{
"nome": "STEPHANIE BOAVENTURA",
"tipo": "onboarding",
"data": "2026-08-31",
"instrutor": "Tayná",
"obs": "Planilha: ONB Telecom"
},
{
"nome": "STEPHANIE BOAVENTURA",
"tipo": "servicos",
"data": "2026-08-31",
"instrutor": "Tayná",
"obs": "Planilha: treinamento DUOMNI"
},
{
"nome": "DANIEL LUCARELLI DE SOUZA",
"tipo": "onboarding",
"data": "2026-09-03",
"instrutor": "Conjunto",
"obs": "Planilha: ONB Duomni"
},
{
"nome": "DANIEL LUCARELLI DE SOUZA",
"tipo": "servicos",
"data": "2026-09-03",
"instrutor": "Tayná",
"obs": "Planilha: treinamento DUOMNI"
},
{
"nome": "Israel Ferreira da Silva",
"tipo": "onboarding",
"data": "2026-09-10",
"instrutor": "Conjunto",
"obs": "Planilha: ONB Duomni"
},
{
"nome": "Israel Ferreira da Silva",
"tipo": "servicos",
"data": "2026-09-16",
"instrutor": "Tayná",
"obs": "Planilha: treinamento DUOMNI"
},
{
"nome": "TATIANE AFONSO",
"tipo": "onboarding",
"data": "2026-09-14",
"instrutor": "Tayná",
"obs": "Planilha: ONB Telecom"
},
{
"nome": "TATIANE AFONSO",
"tipo": "servicos",
"data": "2026-09-14",
"instrutor": "Tayná",
"obs": "Planilha: treinamento DUOMNI"
},
{
"nome": "HILTON ROGER CALDEIRA",
"tipo": "onboarding",
"data": "2026-09-17",
"instrutor": "Conjunto",
"obs": "Planilha: ONB Duomni"
},
{
"nome": "HILTON ROGER CALDEIRA",
"tipo": "servicos",
"data": "2026-09-16",
"instrutor": "Tayná",
"obs": "Planilha: treinamento DUOMNI"
},
{
"nome": "JULIO CESAR DA SILVA GALVAO",
"tipo": "onboarding",
"data": "2026-09-25",
"instrutor": "Conjunto",
"obs": "Planilha: ONB Duomni"
},
{
"nome": "PAULO ROBERTO DOS SANTOS",
"tipo": "onboarding",
"data": "2026-09-02",
"instrutor": "Elias",
"obs": "Planilha: ONB Duomni"
},
{
"nome": "PAULO ROBERTO DOS SANTOS",
"tipo": "onboarding",
"data": "2026-09-02",
"instrutor": "Elias",
"obs": "Planilha: ONB Telecom"
},
{
"nome": "ANA PAULA VITAL",
"tipo": "onboarding",
"data": "2026-09-02",
"instrutor": "Elias",
"obs": "Planilha: ONB Duomni"
},
{
"nome": "JOSE RENATO FLOQUET",
"tipo": "onboarding",
"data": "2026-09-02",
"instrutor": "Elias",
"obs": "Planilha: ONB Duomni"
},
{
"nome": "JOSE RENATO FLOQUET",
"tipo": "onboarding",
"data": "2026-09-11",
"instrutor": "Tayná",
"obs": "Planilha: ONB Telecom"
},
{
"nome": "JOSE RENATO FLOQUET",
"tipo": "servicos",
"data": "2026-09-11",
"instrutor": "Tayná",
"obs": "Planilha: treinamento DUOMNI"
},
{
"nome": "NELSON AVESSO",
"tipo": "onboarding",
"data": "2026-09-02",
"instrutor": "Elias",
"obs": "Planilha: ONB Duomni"
},
{
"nome": "NELSON AVESSO",
"tipo": "onboarding",
"data": "2026-08-11",
"instrutor": "Tayná",
"obs": "Planilha: ONB Telecom"
},
{
"nome": "NELSON AVESSO",
"tipo": "servicos",
"data": "2026-08-11",
"instrutor": "Tayná",
"obs": "Planilha: treinamento DUOMNI"
},
{
"nome": "ALINE CAMARGO DA SILVA",
"tipo": "onboarding",
"data": "2026-09-03",
"instrutor": "Elias",
"obs": "Planilha: ONB Duomni"
},
{
"nome": "ALINE CAMARGO DA SILVA",
"tipo": "onboarding",
"data": "2026-09-03",
"instrutor": "Elias",
"obs": "Planilha: ONB Telecom"
},
{
"nome": "ARTHUR FARIAS DE OLIVEIRA",
"tipo": "onboarding",
"data": "2026-09-08",
"instrutor": "Elias",
"obs": "Planilha: ONB Duomni"
},
{
"nome": "ARTHUR FARIAS DE OLIVEIRA",
"tipo": "onboarding",
"data": "2026-09-10",
"instrutor": "Tayná",
"obs": "Planilha: ONB Telecom"
},
{
"nome": "ARTHUR FARIAS DE OLIVEIRA",
"tipo": "servicos",
"data": "2026-09-10",
"instrutor": "Tayná",
"obs": "Planilha: treinamento DUOMNI"
},
{
"nome": "CECILIA DOMENIKA NOGUEIRA RAIMUNDO",
"tipo": "onboarding",
"data": "2026-09-08",
"instrutor": "Elias",
"obs": "Planilha: ONB Duomni"
},
{
"nome": "CECILIA DOMENIKA NOGUEIRA RAIMUNDO",
"tipo": "onboarding",
"data": "2026-09-10",
"instrutor": "Tayná",
"obs": "Planilha: ONB Telecom"
},
{
"nome": "CECILIA DOMENIKA NOGUEIRA RAIMUNDO",
"tipo": "servicos",
"data": "2026-09-10",
"instrutor": "Tayná",
"obs": "Planilha: treinamento DUOMNI"
},
{
"nome": "LUIZ SANTANA NUSSI",
"tipo": "onboarding",
"data": "2026-09-08",
"instrutor": "Elias",
"obs": "Planilha: ONB Duomni"
},
{
"nome": "ANDRESSA CARLA CRISTALDI",
"tipo": "onboarding",
"data": "2026-09-10",
"instrutor": "Conjunto",
"obs": "Planilha: ONB Duomni"
},
{
"nome": "ANDRESSA CARLA CRISTALDI",
"tipo": "onboarding",
"data": "2026-08-14",
"instrutor": "Tayná",
"obs": "Planilha: ONB Telecom"
},
{
"nome": "ANDRESSA CARLA CRISTALDI",
"tipo": "servicos",
"data": "2026-08-14",
"instrutor": "Tayná",
"obs": "Planilha: treinamento DUOMNI"
},
{
"nome": "FRANCIEL D ANGLES",
"tipo": "onboarding",
"data": "2026-09-10",
"instrutor": "Conjunto",
"obs": "Planilha: ONB Duomni"
},
{
"nome": "FRANCIEL D ANGLES",
"tipo": "servicos",
"data": "2026-09-15",
"instrutor": "Tayná",
"obs": "Planilha: treinamento DUOMNI"
},
{
"nome": "PEDRO DUARTE",
"tipo": "onboarding",
"data": "2026-09-10",
"instrutor": "Conjunto",
"obs": "Planilha: ONB Duomni"
},
{
"nome": "PEDRO DUARTE",
"tipo": "onboarding",
"data": "2026-09-10",
"instrutor": "Conjunto",
"obs": "Planilha: ONB Telecom"
},
{
"nome": "PEDRO DUARTE",
"tipo": "servicos",
"data": "2026-08-20",
"instrutor": "Tayná",
"obs": "Planilha: treinamento DUOMNI"
},
{
"nome": "SANDRA REGINA DA SILVA",
"tipo": "onboarding",
"data": "2026-09-10",
"instrutor": "Conjunto",
"obs": "Planilha: ONB Duomni"
},
{
"nome": "MAURINO MATOS RIBEIRO ROCHA",
"tipo": "onboarding",
"data": "2026-09-17",
"instrutor": "Conjunto",
"obs": "Planilha: ONB Duomni"
},
{
"nome": "MAURINO MATOS RIBEIRO ROCHA",
"tipo": "servicos",
"data": "2026-09-14",
"instrutor": "Tayná",
"obs": "Planilha: treinamento DUOMNI"
},
{
"nome": "ANA CAROLINA RASINO DE OLIVEIRA",
"tipo": "onboarding",
"data": "2026-09-15",
"instrutor": "Conjunto",
"obs": "Planilha: ONB Duomni"
},
{
"nome": "ANA CAROLINA RASINO DE OLIVEIRA",
"tipo": "servicos",
"data": "2026-09-15",
"instrutor": "Tayná",
"obs": "Planilha: treinamento DUOMNI"
},
{
"nome": "ANTONIO CARLOS GALDINO",
"tipo": "onboarding",
"data": "2026-09-17",
"instrutor": "Conjunto",
"obs": "Planilha: ONB Duomni"
},
{
"nome": "ANTONIO CARLOS GALDINO",
"tipo": "onboarding",
"data": "2026-09-17",
"instrutor": "Conjunto",
"obs": "Planilha: ONB Telecom"
},
{
"nome": "DAVI PIETRO MALE",
"tipo": "onboarding",
"data": "2026-09-03",
"instrutor": "Elias",
"obs": "Planilha: ONB Duomni"
},
{
"nome": "DAVI PIETRO MALE",
"tipo": "onboarding",
"data": "2026-08-14",
"instrutor": "Tayná",
"obs": "Planilha: ONB Telecom"
},
{
"nome": "DAVI PIETRO MALE",
"tipo": "servicos",
"data": "2026-08-14",
"instrutor": "Tayná",
"obs": "Planilha: treinamento DUOMNI"
},
{
"nome": "DAVID WALDEMAR DIAMANTINO RIBEIRO",
"tipo": "onboarding",
"data": "2026-09-17",
"instrutor": "Conjunto",
"obs": "Planilha: ONB Duomni"
},
{
"nome": "DAVID WALDEMAR DIAMANTINO RIBEIRO",
"tipo": "servicos",
"data": "2026-09-17",
"instrutor": "Tayná",
"obs": "Planilha: treinamento DUOMNI"
},
{
"nome": "MARCIO EDUARDO MARTINS LOMBA",
"tipo": "onboarding",
"data": "2026-09-18",
"instrutor": "Tayná",
"obs": "Planilha: ONB Duomni"
},
{
"nome": "MARCIO EDUARDO MARTINS LOMBA",
"tipo": "servicos",
"data": "2026-09-18",
"instrutor": "Tayná",
"obs": "Planilha: treinamento DUOMNI"
},
{
"nome": "FERNANDO DORIA",
"tipo": "onboarding",
"data": "2026-09-17",
"instrutor": "Conjunto",
"obs": "Planilha: ONB Duomni"
},
{
"nome": "ANDERSON AMARAL",
"tipo": "onboarding",
"data": "2026-09-14",
"instrutor": "Tayná",
"obs": "Planilha: ONB Duomni"
},
{
"nome": "DANILO FREITAS CANDIDO",
"tipo": "onboarding",
"data": "2026-09-15",
"instrutor": "Tayná",
"obs": "Planilha: ONB Duomni"
},
{
"nome": "LEONARDO VASCONCELLOS BARBOSA",
"tipo": "onboarding",
"data": "2026-09-15",
"instrutor": "Tayná",
"obs": "Planilha: ONB Duomni"
},
{
"nome": "LEONARDO VASCONCELLOS BARBOSA",
"tipo": "servicos",
"data": "2026-09-15",
"instrutor": "Tayná",
"obs": "Planilha: treinamento DUOMNI"
},
{
"nome": "ROGÉRIO SIQUEIRA LIMA",
"tipo": "onboarding",
"data": "2026-09-25",
"instrutor": "Conjunto",
"obs": "Planilha: ONB Duomni"
},
{
"nome": "ROGÉRIO SIQUEIRA LIMA",
"tipo": "servicos",
"data": "2026-09-17",
"instrutor": "Tayná",
"obs": "Planilha: treinamento DUOMNI"
},
{
"nome": "NELSON JOSÉ RIBEIRO JÚNIOR",
"tipo": "onboarding",
"data": "2026-09-16",
"instrutor": "Tayná",
"obs": "Planilha: ONB Duomni"
},
{
"nome": "NELSON JOSÉ RIBEIRO JÚNIOR",
"tipo": "servicos",
"data": "2026-08-20",
"instrutor": "Tayná",
"obs": "Planilha: treinamento DUOMNI"
},
{
"nome": "CAROLINE CARVALHO DE MOARES PINHEIRO",
"tipo": "onboarding",
"data": "2026-09-25",
"instrutor": "Conjunto",
"obs": "Planilha: ONB Duomni"
},
{
"nome": "CAROLINE CARVALHO DE MOARES PINHEIRO",
"tipo": "servicos",
"data": "2026-09-23",
"instrutor": "Tayná",
"obs": "Planilha: treinamento DUOMNI"
},
{
"nome": "NATHALIA DA SILVA PORTO",
"tipo": "onboarding",
"data": "2026-09-25",
"instrutor": "Conjunto",
"obs": "Planilha: ONB Duomni"
},
{
"nome": "NATHALIA DA SILVA PORTO",
"tipo": "servicos",
"data": "2026-09-25",
"instrutor": "Tayná",
"obs": "Planilha: treinamento DUOMNI"
},
{
"nome": "ANDERSON PEREIRA MOREIRA (BETEL)",
"tipo": "onboarding",
"data": "2026-09-25",
"instrutor": "Tayná",
"obs": "Planilha: ONB Duomni"
},
{
"nome": "ANDERSON PEREIRA MOREIRA (BETEL)",
"tipo": "servicos",
"data": "2026-09-25",
"instrutor": "Tayná",
"obs": "Planilha: treinamento DUOMNI"
},
{
"nome": "GRACE CIBELE BAGATIN",
"tipo": "onboarding",
"data": "2026-09-28",
"instrutor": "Tayná",
"obs": "Planilha: ONB Duomni"
},
{
"nome": "ANA PAULA CARVALHO CARDOSO",
"tipo": "onboarding",
"data": "2026-09-25",
"instrutor": "Conjunto",
"obs": "Planilha: ONB Duomni"
},
{
"nome": "MARIA EDUARDA FARIA DE SOUZA",
"tipo": "onboarding",
"data": "2026-10-01",
"instrutor": "Tayná",
"obs": "Planilha: ONB Duomni | pontuação 6 | respondeu em #REF!"
},
{
"nome": "MARIA EDUARDA FARIA DE SOUZA",
"tipo": "servicos",
"data": "2026-10-01",
"instrutor": "Tayná",
"obs": "Planilha: treinamento DUOMNI"
},
{
"nome": "ROBERTO APARECIDO SANCHES CALISTER",
"tipo": "onboarding",
"data": "2026-08-13",
"instrutor": "Tayná",
"obs": "Planilha: ONB Duomni"
},
{
"nome": "ROBERTO APARECIDO SANCHES CALISTER",
"tipo": "servicos",
"data": "2026-08-13",
"instrutor": "Tayná",
"obs": "Planilha: treinamento DUOMNI"
},
{
"nome": "RENATO CAMPOS",
"tipo": "onboarding",
"data": "2026-08-13",
"instrutor": "Tayná",
"obs": "Planilha: ONB Duomni"
},
{
"nome": "RENATO CAMPOS",
"tipo": "servicos",
"data": "2026-08-13",
"instrutor": "Tayná",
"obs": "Planilha: treinamento DUOMNI"
},
{
"nome": "RUBENS DE MELO PARANHOS",
"tipo": "onboarding",
"data": "2026-08-14",
"instrutor": "Tayná",
"obs": "Planilha: ONB Duomni"
},
{
"nome": "RUBENS DE MELO PARANHOS",
"tipo": "servicos",
"data": "2026-08-14",
"instrutor": "Tayná",
"obs": "Planilha: treinamento DUOMNI"
},
{
"nome": "CAYQUE GOMES DOS SANTOS",
"tipo": "onboarding",
"data": "2026-08-17",
"instrutor": "Tayná",
"obs": "Planilha: ONB Duomni"
},
{
"nome": "CAYQUE GOMES DOS SANTOS",
"tipo": "servicos",
"data": "2026-08-17",
"instrutor": "Tayná",
"obs": "Planilha: treinamento DUOMNI"
},
{
"nome": "LIGIANE BRITO SANTOS",
"tipo": "onboarding",
"data": "2026-08-17",
"instrutor": "Tayná",
"obs": "Planilha: ONB Duomni"
},
{
"nome": "LIGIANE BRITO SANTOS",
"tipo": "servicos",
"data": "2026-08-17",
"instrutor": "Tayná",
"obs": "Planilha: treinamento DUOMNI"
},
{
"nome": "FABIO CARVALHO SINATRA",
"tipo": "onboarding",
"data": "2026-08-20",
"instrutor": "Tayná",
"obs": "Planilha: ONB Duomni"
},
{
"nome": "FABIO CARVALHO SINATRA",
"tipo": "servicos",
"data": "2026-08-20",
"instrutor": "Tayná",
"obs": "Planilha: treinamento DUOMNI"
},
{
"nome": "DAVID HENRIQUE CIRINEU",
"tipo": "onboarding",
"data": "2026-09-21",
"instrutor": "Tayná",
"obs": "Planilha: ONB Duomni"
},
{
"nome": "DAVID HENRIQUE CIRINEU",
"tipo": "servicos",
"data": "2026-09-21",
"instrutor": "Tayná",
"obs": "Planilha: treinamento DUOMNI"
},
{
"nome": "JÚLIO CESAR FERRAZ DA SILVA",
"tipo": "onboarding",
"data": "2026-08-20",
"instrutor": "Tayná",
"obs": "Planilha: ONB Duomni"
},
{
"nome": "JÚLIO CESAR FERRAZ DA SILVA",
"tipo": "servicos",
"data": "2026-08-20",
"instrutor": "Tayná",
"obs": "Planilha: treinamento DUOMNI"
}
]$json$::jsonb)
  as x(nome text, tipo text, data date, instrutor text, obs text);

-- parceiros novos
insert into public.parceiros (nome_fantasia, cpf, cnpj, contato_email, contato_telefone, status, data_ativacao, observacoes, ponto_focal_id)
select i.nome, i.cpf, i.cnpj, i.email, i.tel, i.status, i.ativ, i.obs,
  (select pr.id from public.profiles pr
    where i.focal is not null and pr.ativo
      and (public.nome_normalizado(pr.nome) like i.focal || '%' or public.nome_normalizado(pr.usuario) like i.focal || '%')
    order by pr.criado_em limit 1)
from imp_parceiros i
where not exists (
  select 1 from public.parceiros p
  where public.nome_normalizado(p.nome_fantasia) = public.nome_normalizado(i.nome)
     or (i.cpf is not null and p.cpf = i.cpf)
     or (i.cnpj is not null and p.cnpj = i.cnpj));

-- treinamentos (realizados)
insert into public.parceiro_treinamentos (parceiro_id, tipo, data, status, instrutor, observacao, registrado_por)
select distinct on (p.id, t.tipo, t.data, t.obs) p.id, t.tipo, t.data, 'realizado', t.instrutor, t.obs, null::uuid
from imp_treinos t
join public.parceiros p on public.nome_normalizado(p.nome_fantasia) = public.nome_normalizado(t.nome)
where not exists (
  select 1 from public.parceiro_treinamentos x
  where x.parceiro_id = p.id and x.tipo = t.tipo and x.data = t.data and coalesce(x.observacao, '') = coalesce(t.obs, ''));

-- conferência
select 'parceiros da planilha no sistema' as item, count(*) as total
from public.parceiros p join imp_parceiros i on public.nome_normalizado(p.nome_fantasia) = public.nome_normalizado(i.nome)
union all
select 'treinamentos da planilha no sistema', count(*)
from public.parceiro_treinamentos x where x.observacao like 'Planilha:%';
