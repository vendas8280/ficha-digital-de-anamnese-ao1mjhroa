export type FormType = 'geral' | 'labios' | 'botox'
export type FormStatus = 'pendente' | 'codigo_validado' | 'preenchida' | 'expirada'
export type EmailDeliveryStatus = 'nao_enviado' | 'enviado' | 'falha'

export interface TermDefinition {
  type: FormType
  title: string
  subtitle: string
  content: string
}

export const TERMS_DATA: Record<FormType, TermDefinition> = {
  geral: {
    type: 'geral',
    title: 'Termo de Consentimento Livre e Esclarecido - Anamnese Estética Geral',
    subtitle: 'Andresa Souza Clinic • Procedimentos Estéticos Faciais e Corporais',
    content: `TERMO DE CONSENTIMENTO LIVRE E ESCLARECIDO - ANAMNESE ESTÉTICA GERAL
ANDRESA SOUZA CLINIC - ESTÉTICA AVANÇADA E SAÚDE INTEGRATIVA

1. OBJETIVO DO PROCEDIMENTO E AVALIAÇÃO CLÍNICA
Declaro, para os devidos fins de direito, que forneci voluntariamente todas as informações relativas ao meu estado de saúde atual e pregressos, histórico familiar, uso de medicamentos contínuos ou esporádicos, alergias, procedimentos estéticos ou cirúrgicos prévios, tratamentos dermatológicos e estilo de vida.

2. VERACIDADE DAS INFORMAÇÕES
Reconheço que a omissão ou inexatidão deliberada de qualquer informação médica, incluindo mas não se limitando a gestação, lactação, uso de anticoagulantes, distúrbios de cicatrização (queloide) ou doenças autoimunes, pode comprometer a eficácia do procedimento planejado e acarretar riscos imprevisíveis à minha saúde física e estética.

3. ESCLARECIMENTOS E CUIDADOS
Fui informado(a) minuciosamente pelo profissional responsável sobre a natureza das técnicas a serem realizadas, objetivos clínicos, resultados esperados e limitações inerentes à resposta biológica individual de cada organismo. Estou ciente de que a estética avançada não é uma ciência exata e resultados podem variar conforme idade, fototipo, hábitos e adesão aos cuidados domiciliares.

4. CUIDADOS PRÉ E PÓS-PROCEDIMENTO
Comprometo-me a seguir rigorosamente todas as recomendações fornecidas pela clínica, tais como proteção solar diária, restrição de atividades físicas intensas quando orientado, abstenção de exposição a fontes de calor excessivo (sauna, sol) e utilização estrita dos dermocosméticos ou medicamentos receitados.

5. REGISTRO FOTOGRÁFICO E PRONTUÁRIO
Autorizo a realização de registros fotográficos da área tratada para acompanhamento da evolução clínica no prontuário, resguardado o sigilo profissional.

6. CONSENTIMENTO E AUTORIZAÇÃO LGPD
Em conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018), autorizo a Andresa Souza Clinic a armazenar meus dados cadastrais e respostas de saúde em ambiente seguro e criptografado para fins exclusivos de acompanhamento clínico, elaboração de prontuário e cumprimento de obrigações legais sanitárias.`,
  },
  labios: {
    type: 'labios',
    title: 'Termo de Consentimento - Micropigmentação e Revitalização Labial',
    subtitle: 'Andresa Souza Clinic • Dermopigmentação Labial Avançada',
    content: `TERMO DE CONSENTIMENTO ESPECÍFICO - MICROPIGMENTAÇÃO E REVITALIZAÇÃO LABIAL
ANDRESA SOUZA CLINIC - ESTÉTICA AVANÇADA

1. DESCRIÇÃO DA TÉCNICA E IMPLANTAÇÃO DE PIGMENTO
Declaro ter sido integralmente orientada(o) pela equipe da Andresa Souza Clinic sobre o procedimento de micropigmentação labial, técnica estética que consiste na implantação subepidérmica de pigmentos biocompatíveis nos lábios, com o intuito de restaurar contorno, cor, simetria e viço labial.

2. SENSIBILIDADE E REAÇÕES ESPERADAS
Estou ciente de que durante e após a sessão podem ocorrer inchaço (edema), vermelhidão, sensação de calor, ressecamento e leve desconforto nos primeiros 3 a 5 dias. Compreendo que a cor nos primeiros dias parecerá significativamente mais escura e intensa, clareando em até 40% a 60% após a completa cicatrização e descamação natural.

3. HISTÓRICO DE HERPES SIMPLEX
Declaro ter respondido com verdade sobre meu histórico de infecções por Herpes Labial. Fui orientada(o) de que o microagulhamento pode estimular a manifestação do vírus dormente caso não haja profilaxia adequada com medicação antiviral previamente prescrita por médico responsável.

4. RETOQUE E PRAZO DE CICATRIZAÇÃO
Reconheço que a completa fixação e revelação do pigmento requer de 30 a 45 dias, período após o qual será avaliada a necessidade de sessão de retoque. O retoque é indispensável para equalização do tom e pequenos ajustes de formato quando indicado.

5. RESTRIÇÕES PÓS-PROCEDIMENTO
Comprometo-me a não arrancar as casquinhas prematuramente, não consumir alimentos ácidos, picantes ou muito quentes nas primeiras 48 horas, hidratar constantemente com a pomada cicatrizante indicada e evitar beijos, atrito ou uso de batons até a cicatrização completa.`,
  },
  botox: {
    type: 'botox',
    title: 'Termo de Consentimento - Aplicação de Toxina Botulínica Tipo A',
    subtitle: 'Andresa Souza Clinic • Modulação Muscular e Rejuvenescimento',
    content: `TERMO DE CONSENTIMENTO LIVRE E ESCLARECIDO - TOXINA BOTULÍNICA (TIPO A)
ANDRESA SOUZA CLINIC - ESTÉTICA AVANÇADA

1. APLICAÇÃO E MECANISMO DE AÇÃO
Declaro ter sido amplamente esclarecida(o) sobre o tratamento com Toxina Botulínica Tipo A na Andresa Souza Clinic. O procedimento tem a finalidade de paralisar temporariamente a musculatura facial dinâmica hiperativa, amenizando linhas de expressão na fronte (testa), glabela (entre as sobrancelhas) e região periocular (pés de galinha).

2. INÍCIO DA AÇÃO E DURABILIDADE
Compreendo que o efeito relaxante não é imediato: o início do bloqueio ocorre habitualmente entre 48 e 72 horas após a injeção, com efeito máximo atingido por volta do 14º ao 15º dia. A duração média dos resultados varia individualmente entre 3 e 5 meses, dependendo do metabolismo, força muscular e prática de atividade física intensa.

3. CONTRAINDICAÇÕES EXPRESSAS
Declaro expressamente que NÃO estou grávida, NÃO estou amamentando e NÃO possuo doenças neuromusculares conhecidas (como Miastenia Gravis, Síndrome de Lambert-Eaton ou Esclerose Lateral Amiotrófica), nem alergia comprovada à albumina humana ou aos excipientes da toxina.

4. POSSÍVEIS EFEITOS ADVERSOS
Fui alertada(o) de que podem surgir pequenos hematomas (roxos) nos pontos de punção, leve dor de cabeça transitória nas primeiras 24 horas e leve assimetria temporária passível de equalização no retorno programado (em até 15 a 21 dias). Complicações raras como ptose palpebral (queda temporária da pálpebra) foram devidamente esclarecidas.

5. RECOMENDAÇÕES PÓS-INJEÇÃO
Comprometo-me formalmente a: não deitar a cabeça horizontalmente pelas 4 horas seguintes; não massagear ou pressionar as áreas aplicadas; não realizar exercícios físicos nas 24 horas seguintes; não realizar viagens de avião nas primeiras 12 horas pós-aplicação.`,
  },
}
