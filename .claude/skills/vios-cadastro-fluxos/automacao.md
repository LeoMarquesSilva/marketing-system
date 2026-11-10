# VIOS — scripts testados para operações em lote

Todos rodam no `javascript_tool` com uma aba do VIOS já logada (navegador do app ou Chrome). Foram
usados em produção em 27/10/2026: 753 prorrogações, 251 inserções, 122 cancelamentos, 251 edições
de etiqueta e 12 feriados.

## Regras de todo lote

1. **Leia antes de gravar.** Se o valor atual não é o esperado da planilha, pule a tarefa e
   registre `PULADA`. Se já está no valor novo, registre `já estava`. Assim o lote pode ser
   rodado de novo sem estragar nada.
2. **Grave e releia.** O POST nem sempre redireciona. O sucesso se confirma relendo o formulário.
3. **Rode em segundo plano.** O `javascript_tool` corta em ~45 s. Dispare o lote em `window.__x`
   e consulte o andamento em chamadas seguintes (fila + `window.__log` + `window.__fim`).
4. Use concorrência 1 ou 2. Com o painel do navegador oculto, a página desacelera.
5. Guarde o lote (`dados/lote-*.txt`) e o log (`dados/log-*.json`) no projeto. É a trilha de
   auditoria e de rollback.

## Ler um formulário

```js
const ler = async url => {
  const html = await fetch(url, {credentials:'include'})
    .then(r => r.arrayBuffer()).then(b => new TextDecoder('iso-8859-1').decode(b));
  return new DOMParser().parseFromString(html, 'text/html');
};
// valor original: getAttribute('value') ou option[selected]
```

## Gravar um formulário lido

```js
const gravar = async (form, url, ajustar) => {
  const fd = new FormData(form);
  ajustar(fd);
  const b = [...form.querySelectorAll('button[type=submit],input[type=submit]')]
    .find(b => /Gravar/.test(b.textContent || b.value));
  if (b && b.name) fd.set(b.name, b.value || 'Gravar');
  const r = await fetch(new URL(form.getAttribute('action') || url, location.href).href,
                        {method:'POST', credentials:'include', body:fd});
  return r.arrayBuffer().then(b => new TextDecoder('iso-8859-1').decode(b));
};
```

## Prorrogar (mudar a data de uma tarefa)

```js
const url = `/index.php?pag=sys/processos/pxe-obs.php&pxe_id=${pxe}&acao=Prorrogar`;
const d = await ler(url); const ini = d.querySelector('[name="fo[data_prevista]"]');
// conferir: ini.getAttribute('value') === atualEsperado
await gravar(ini.form, url, fd => {
  fd.set('fo[data_prevista]', novo); fd.set('fo[data_limite]', novo);
  fd.set('tipo_prorrogacao_id', '1941');                 // Reagendamento
  fd.set('form[pxo_obs]', '<p>Motivo da mudança (dd/mm/aaaa).</p>');
});
// reler: fo[data_prevista] e fo[data_limite] === novo
```

## Cancelar

```js
const url = `/index.php?pag=sys/processos/pxe/pxe-cancelar.php&pxe_id=${pxe}&processos_id=${ci}`;
const d = await ler(url); const sel = d.querySelector('[name="form[cancelamento_tipos_id]"]');
if (!sel) return 'já cancelada ou concluída';
const t = await gravar(sel.form, url, fd => {
  fd.set('form[cancelamento_tipos_id]', '2318');         // DUPLICIDADE (o padrão 2319 está errado)
  fd.set('form[obs]', '<p>Duplicidade: ... mantida a tarefa X.</p>');
});
/cancelada com sucesso/i.test(t);
```

Cancele as filhas primeiro e a audiência por último, porque cancelar a audiência não cancela as
filhas.

## Acrescentar uma etiqueta numa tarefa existente

```js
const url = `/index.php?pag=sys/processos/pxe.php&pxe_id=${id}&act=edit`;
const d = await ler(url);
const et = [...d.querySelectorAll('[name="etiquetas[]"] option[selected]')].map(o => o.value);
if (!et.includes('204')) await gravar(d.querySelector('[name="etiquetas[]"]').form, url, fd => {
  fd.delete('etiquetas[]'); for (const v of [...et, '204']) fd.append('etiquetas[]', v);
});
// reler: etiqueta presente, usuarios[] e datas iguais aos de antes
```

## Trocar os responsáveis de uma tarefa

Mesmo caminho da etiqueta: `fd.delete('usuarios[]')` e um `fd.append('usuarios[]', id)` por pessoa. A edição
não muda tipo nem etiqueta, mas tem dois efeitos que apareceram em 09/11/2026:

- **Texto fora do Latin-1 vira "?".** O `FormData` envia UTF-8, e o VIOS converte para ISO-8859-1. Na descrição, `&ldquo;a&rdquo;` e `a&#768;` chegam ao `DOMParser` já decodificados e voltam como `?a?`. Antes de gravar, troque esses caracteres pela referência numérica: `nome.replace(/[^\u0000-ÿ]/g, c => '&#' + c.codePointAt(0) + ';')`, e faça `fd.set('form[pxe_nome]', ...)`.
- **Tarefa com data em feriado processual é empurrada** para o próximo dia útil ao gravar (930656: 20/11 → 23/11). Liste antes as tarefas em feriado e avise o usuário.

Compare tipo, etiquetas, datas, horários e descrição antes e depois de cada gravação. Foi essa comparação que pegou os dois efeitos.

## Ações de lote na pasta

Um POST com a seleção para `processos-lista.php` grava a seleção na sessão e responde `location.href="./?pag=<tela>"`. Na tela, `new FormData(form)` traz `processos[]` (ou `form[processos_id][]`): confira que são exatamente os CIs da lista e grave com `fd.set('Gravar', 'Gravar')`. Com `fetch` a validação da tela não roda, então confira os valores antes.

```js
const fd = new FormData();
cis.forEach((ci, i) => {
  fd.append(`fselect[${i}][select]`, '1');
  fd.append(`fselect[${i}][id]`, 'processos_id');
  fd.append(`fselect[${i}][valor]`, ci);
});
fd.append('acao', acao); fd.append('Processar', 'Processar');
```

Campos de cada ação: [reference.md](reference.md). A resposta do Gravar não traz mensagem: confira por export ou pela página da pasta.

## Marcar uma opção de feriado

```js
const url = `/index.php?pag=sys/agenda/cal_feriados.php&cal_feriados_id=${id}&act=edit`;
const d = await ler(url);
const cb = [...d.querySelectorAll('[name="form[flag_prazo]"]')].find(e => e.type === 'checkbox');
if (!cb.hasAttribute('checked')) await gravar(cb.form, url, fd => fd.append('form[flag_prazo]', '1'));
// reler: as outras opções (não processuais, compromissos, recorrente) continuam iguais
```

## Inserir uma tarefa (num iframe, porque o tipo preenche os responsáveis por JS)

```js
const criar = (ci, tipo, data) => new Promise(resolve => {
  const ifr = document.createElement('iframe');
  ifr.style.cssText = 'position:fixed;left:-3000px;top:0;width:1200px;height:900px;';
  let fase = 0; const fim = r => { ifr.remove(); resolve(r); };
  const to = setTimeout(() => fim('ERRO timeout fase ' + fase), 30000);
  ifr.onload = async () => { const w = ifr.contentWindow, doc = ifr.contentDocument;
    if (fase === 0) { fase = 1;
      const s = doc.querySelector('[name="form[processos_etapas_id]"]');
      w.jQuery(s).val(tipo).trigger('change'); await new Promise(r => setTimeout(r, 800));
      for (const n of ['form[data_prevista]', 'form[data_limite]'])
        w.jQuery(doc.querySelector(`[name="${n}"]`)).val(data).trigger('input').trigger('change');
      // conferir usuarios[] preenchido antes de gravar
      [...doc.querySelectorAll('button[type=submit]')].find(b => /Gravar/.test(b.innerText)).click();
      for (let k = 0; k < 12; k++) { await new Promise(r => setTimeout(r, 250));
        const p = doc.querySelector('.swal2-popup');
        if (p && /mais de 6 meses a frente/.test(p.innerText)) {
          [...p.querySelectorAll('button')].find(b => b.innerText.trim() === 'Confirmar').click(); break; } }
    } else { clearTimeout(to);
      const erro = [...doc.querySelectorAll('.swal2-popup')].map(p => p.innerText).join(' ');
      fim(/Erro|mesma descrição/i.test(erro) ? 'ERRO ' + erro : 'GRAVADO'); } };
  ifr.src = `/index.php?pag=sys/processos/pxe.php&processos_id=${ci}&act=insert`;
  document.body.appendChild(ifr);
});
```

Se um lote de inserção estourar o tempo, **não rode de novo às cegas**. Exporte o tipo, veja o
que já foi criado em cada pasta e rode só o que falta.

## Ler as tarefas de uma pasta

```js
const pasta = ci => new Promise(res => { const f = document.createElement('iframe');
  f.style.cssText = 'position:fixed;left:-3000px;width:1200px;height:900px';
  const to = setTimeout(() => { f.remove(); res({ci, erro:'timeout'}); }, 40000);
  f.onload = async () => { const d = f.contentDocument;
    for (let i = 0; i < 25 && !/Para conclusão/.test(d.body.innerText); i++) await new Promise(r => setTimeout(r, 600));
    const rows = [...new Set([...d.querySelectorAll('tr, li, .card')]
      .map(r => (r.innerText || '').replace(/\s+/g, ' ').trim()).filter(x => /^\d{6} /.test(x) && x.length < 2000))];
    clearTimeout(to); f.remove(); res({ci, rows}); };
  f.src = `/index.php?pag=sys/processos/processos-vis.php&processos_id=${ci}`; document.body.appendChild(f); });
```

As UNAs com texto longo de publicação às vezes não aparecem nessa leitura. Confira pelo export.

## Trabalhar num Chrome local com porta de depuração

Quando o navegador do app não abre o VIOS e o usuário disser que entrou num Chrome local com `--remote-debugging-port`, dá para rodar na mesma sessão dele, numa aba própria. `scripts/cdp.mjs` em `ORQESTRAI/vios-saneamento-rec-cred` faz isso com o `WebSocket` do Node 24. Limites vistos: resposta de ~4 MB derruba a conexão, então processe o CSV na página e devolva só as colunas e linhas úteis. Feche a aba ao terminar. O login é sempre do usuário.

A aba aberta assim fica em segundo plano, e o Chrome desacelera os timers dela: um laço com `setTimeout` dentro do script pode passar do tempo do cliente. Para trabalho longo, dispare em segundo plano na página (`window.__x = ...`, sem `await`) e consulte o andamento em chamadas curtas, esperando entre elas pelo shell.

A versão pronta de `cdp.mjs`, `lib-lote.js` e `csvlib.js` está em `vios-transferir-pastas/scripts/`.

## Trazer muitos dados para o shell

O `javascript_tool` corta em ~50 mil caracteres. Para trazer tudo, devolva
`JSON.stringify(dados) + 'x'.repeat(60000)`. A resposta é salva num arquivo de tool-results. No
Python, leia com `json.JSONDecoder().raw_decode(texto)`, porque sobra lixo depois do JSON (o
enchimento e "(captured at origin ...)").

## Dias úteis no Python (conferência)

Para conferir D−N, conte para trás pulando sábado, domingo e os feriados do cadastro com a opção
processual. Para o positivo (2. REVISAR = contestação + 6, 3. PROTOCOLAR = contestação + 13), conte
para frente com a mesma lista. Data calculada que cai no passado vai para o próximo dia útil a
partir de hoje (decisão de 27/10/2026). Os scripts de planilha usados estão em
`ORQESTRAI/vios-trabalhista-defesa/scripts/`.
