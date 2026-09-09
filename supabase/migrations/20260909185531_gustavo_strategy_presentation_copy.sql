-- Atualiza a carta estratégica apresentada ao Gustavo e consumida pelo motor editorial.
update public.gustavo_content_strategy
set
  editorial_promise = 'Gustavo não comenta simplesmente recuperações judiciais. Ele interpreta o que crises e reestruturações revelam sobre empresas.',
  strategic_rationale = 'Notícia o mercado já recebe todos os dias. Explicação jurídica também. O espaço que queremos ocupar está na interpretação: conectar fatos a decisões, sinais, riscos e consequências para quem administra empresas e capital.',
  icp = array[
    'Empresários e sócios',
    'CEOs e CFOs',
    'Conselheiros e investidores'
  ],
  icp_context = 'Decisores de empresas relevantes, prioritariamente com faturamento a partir de aproximadamente R$ 5 milhões, que enfrentam ou querem antecipar questões de liquidez, dívida, governança e continuidade.',
  content_pillars = '[
    {"title":"Crise antes do processo","description":"Ler os sinais empresariais que aparecem antes da medida jurídica.","reason":"Autoridade nasce ao ajudar o decisor a reconhecer o problema cedo, quando ainda existem mais opções."},
    {"title":"Decisões sob pressão","description":"Explicar trade-offs de caixa, dívida, credores, ativos e governança.","reason":"O ICP se identifica com escolhas reais, não com aulas abstratas sobre procedimentos."},
    {"title":"Preservação de valor","description":"Mostrar quando tempo, negociação e instrumentos protegem ou destroem valor.","reason":"Conecta a especialidade jurídica ao resultado empresarial sem fazer promessa comercial."},
    {"title":"Leitura de mercado","description":"Interpretar grandes casos, movimentos empresariais e decisões que ajudam a entender para onde o mercado está indo.","reason":"Casos conhecidos funcionam como ponto de partida para discutir decisões que também aparecem, em outra escala, nas empresas do nosso ICP."}
  ]'::jsonb,
  channel_roles = '[
    {"channel":"LinkedIn","role":"Análises mais completas, posicionamentos, teses e contexto executivo.","reason":"É o principal ambiente para alcançar decisores e sustentar raciocínios com maior profundidade."},
    {"channel":"Instagram Reels","role":"Explicações diretas e humanas que fazem o público conhecer o rosto, a voz e a forma de pensar do Gustavo.","reason":"Amplia familiaridade e alcance sem transformar Gustavo em um influenciador jurídico genérico."}
  ]'::jsonb,
  editorial_principles = array[
    'A notícia é matéria-prima, não o conteúdo final',
    'O jurídico sustenta a análise, mas não precisa ser sempre o centro',
    'Opinião só entra quando estiver registrada ou validada pelo Gustavo',
    'Todo conteúdo deve entregar uma implicação para quem decide',
    'Clareza e consistência valem mais do que volume e viralização'
  ],
  success_signals = array[
    'Gustavo passa a ser espontaneamente associado ao tema de reestruturação empresarial.',
    'Empresários e decisores passam a acompanhar, salvar, compartilhar e discutir suas análises.',
    'O conteúdo abre espaço para conversas, eventos, conexões e oportunidades qualificadas.',
    'Com o tempo, essa autoridade contribui para geração de demanda qualificada para o escritório.'
  ]
where id = 'main';
