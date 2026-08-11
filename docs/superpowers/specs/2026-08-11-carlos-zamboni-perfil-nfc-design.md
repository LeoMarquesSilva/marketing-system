# Perfil público e NFC — Carlos Zamboni

## Objetivo

Criar e publicar o perfil institucional de Carlos Zamboni como consultor externo dos sócios do Bismarchi | Pires, com foto, contatos profissionais, trajetória, vídeo de reconhecimento na CPFL Energia e uma etiqueta NFC própria.

## Identidade pública

- Nome: Carlos Zamboni
- Slug: `carlos-zamboni`
- Cargo: Consultor em Liderança e Gestão Estratégica
- Área: Liderança, Gestão Estratégica e Transformação Organizacional
- Relação institucional: consultor externo com atuação junto aos sócios do escritório
- Tempo de escritório: oculto, pois não há data de ingresso como colaborador

## Texto institucional

### Chamada

Liderança não é sobre dar ordens, mas sobre inspirar, transformar e construir um legado.

### Biografia

Consultor em Liderança e Gestão Estratégica, presta consultoria aos sócios do Bismarchi | Pires com foco no fortalecimento da liderança, na tomada de decisão e na construção de culturas de alto desempenho.

Com mais de 35 anos de experiência, percorreu todas as etapas da liderança, de estagiário a presidente de grandes empresas do Grupo CPFL Energia. Ao longo dessa trajetória, liderou milhares de colaboradores e esteve à frente da gestão de grandes negócios, consolidando uma atuação marcada pela liderança humanizada, pela visão estratégica e pela transformação organizacional.

À frente da Zamboni Pro Leaders, dedica-se ao desenvolvimento de executivos, empresários e gestores, ajudando-os a construir uma liderança mais humana e de impacto, baseada em propósito, estratégia e alta performance, com resultados tangíveis e sustentáveis.

## Seções do perfil

- Atuação: consultoria aos sócios, desenvolvimento de lideranças e apoio à tomada de decisão estratégica.
- Conhecimentos: liderança humanizada, gestão estratégica, transformação organizacional, formação de líderes, cultura corporativa e alta performance.
- Destaques: mais de 35 anos de experiência; trajetória de estagiário a presidente no Grupo CPFL Energia; liderança de milhares de colaboradores; fundador da Zamboni Pro Leaders.
- Trajetória: destaque clicável “Reconhecimento à trajetória na CPFL Energia”, apontando para o Reel informado pelo usuário. O vídeo será apresentado como registro da despedida de Carlos da companhia e do reconhecimento das equipes.

## Contatos

- E-mail visível: `czambonineto@hotmail.com`
- LinkedIn visível: `https://www.linkedin.com/in/carlos-zamboni/`
- WhatsApp e site: ocultos, pois não foram informados

## Foto

Enviar `foto-zamboni.jpg` ao bucket `MARKETING-SYSTEM-FOTOS`, no diretório padronizado do usuário. A URL pública será usada tanto em `users.avatar_url` quanto no perfil profissional. Marcar a foto como coletada para que Carlos apareça corretamente no módulo Fotos dos Colaboradores.

## Publicação e etiqueta NFC

- Criar ou reutilizar de forma idempotente o usuário e o perfil de Carlos.
- Publicar o perfil somente depois de validar nome, cargo, área, chamada, biografia, foto e contatos.
- Criar uma etiqueta `professional_profile` ativa, com token público único e vínculo exclusivo ao perfil.
- Criar o cartão profissional com os próximos códigos sequenciais disponíveis.
- Manter a confirmação física pendente, pois a nova NFC ainda será gravada.
- O link público será `https://marketing-system-xi.vercel.app/perfil/carlos-zamboni`.
- Após a gravação física, acessos pelo link direto passarão pela etiqueta vinculada e serão contabilizados no módulo Etiquetas.

## Segurança e consistência

- Usar somente o cliente administrativo no script local; nenhuma chave será exposta ao navegador ou gravada no repositório.
- Recusar execução se houver mais de um usuário ou perfil compatível, evitando vinculação por suposição.
- Usar upserts e verificações por nome, e-mail e slug para permitir reexecução sem duplicar registros.
- Não alterar perfis, fotos ou etiquetas de outras pessoas.

## Validação

- Confirmar no banco usuário, perfil publicado, localização em português, seções, entradas, foto, contatos, etiqueta e cartão.
- Abrir o perfil público e verificar nome, foto, cargo, contatos e link do Reel.
- Confirmar que o link direto resolve pela etiqueta sem loop.
- Entregar o link público e o código da etiqueta para a gravação física.
