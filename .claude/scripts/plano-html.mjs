// Gera a versão HTML do plano de implementação a partir do Markdown mantido pelo agente
// plano-implementacao. O Markdown continua sendo a fonte; o HTML é só para visualização.
// Uso: node .claude/scripts/plano-html.mjs [entrada.md] [saida.html]
// Padrão: docs/plano-implementacao.md → mesmo caminho com extensão .html.
import { readFileSync, writeFileSync } from 'node:fs'
import { basename, resolve } from 'node:path'

const entrada = resolve(process.argv[2] ?? 'docs/plano-implementacao.md')
const saida = resolve(process.argv[3] ?? entrada.replace(/\.md$/i, '.html'))

const STATUS = [
  { chave: 'concluida', rotulo: 'Concluída', icone: '✓' },
  { chave: 'andamento', rotulo: 'Em andamento', icone: '◔' },
  { chave: 'reaberta', rotulo: 'Reaberta', icone: '↺' },
  { chave: 'bloqueada', rotulo: 'Bloqueada', icone: '⊘' },
  { chave: 'pendente', rotulo: 'Pendente', icone: '○' },
  { chave: 'cancelada', rotulo: 'Cancelada', icone: '✕' },
]
const DESCONHECIDO = { chave: 'desconhecido', rotulo: 'Sem status', icone: '?' }
// Ordem dos segmentos nas barras; o restante (pendentes) é a trilha vazia.
const SEGMENTOS = ['concluida', 'andamento', 'reaberta', 'bloqueada']

// ---------- utilitários ----------

const normalizar = (texto) =>
  texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

const escapar = (texto) =>
  String(texto).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const statusPorChave = (chave) => STATUS.find((s) => s.chave === chave) ?? DESCONHECIDO

const percentual = (feitas, total) => (total === 0 ? 0 : Math.round((feitas / total) * 100))

// Markdown em linha: código, escapes, negrito, itálico e links.
function emLinha(texto) {
  const protegidos = []
  // Marcador em área de uso privado do Unicode, que não aparece no texto do plano.
  const proteger = (html) => `${protegidos.push(html) - 1}`
  let s = texto.replace(/`([^`]+)`/g, (_, codigo) => proteger(`<code>${escapar(codigo)}</code>`))
  s = s.replace(/\\([\\`*_{}[\]()#+\-.!|>~])/g, (_, c) => proteger(escapar(c)))
  s = escapar(s)
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, rotulo, destino) => `<a href="${destino}">${rotulo}</a>`)
  s = s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  s = s.replace(/(^|[\s(])\*(?!\s)([^*]+?)\*(?![\w])/g, '$1<em>$2</em>')
  return s.replace(/(\d+)/g, (_, i) => protegidos[Number(i)])
}

// Divide uma linha de tabela em células, respeitando `\|` e código entre crases.
function celulas(linha) {
  const conteudo = linha.trim().replace(/^\|/, '').replace(/\|$/, '')
  const resultado = []
  let atual = ''
  let emCodigo = false
  for (let i = 0; i < conteudo.length; i++) {
    const c = conteudo[i]
    if (c === '`') emCodigo = !emCodigo
    if (c === '|' && !emCodigo && conteudo[i - 1] !== '\\') {
      resultado.push(atual.trim())
      atual = ''
    } else atual += c
  }
  resultado.push(atual.trim())
  return resultado
}

// ---------- leitura do Markdown em blocos ----------

function blocos(linhas) {
  const lista = []
  let i = 0
  while (i < linhas.length) {
    const linha = linhas[i]
    if (linha.trim() === '' || /^---+\s*$/.test(linha)) {
      i++
    } else if (/^\s*\|/.test(linha)) {
      const tabela = []
      while (i < linhas.length && /^\s*\|/.test(linhas[i])) tabela.push(linhas[i++])
      const [cabecalho, , ...corpo] = tabela
      lista.push({ tipo: 'tabela', cabecalho: celulas(cabecalho), linhas: corpo.map(celulas) })
    } else if (/^\s*([-*]|\d+\.)\s+/.test(linha)) {
      const itens = []
      while (i < linhas.length) {
        const item = linhas[i].match(/^(\s*)(?:[-*]|\d+\.)\s+(.*)$/)
        if (item) {
          itens.push({ nivel: Math.floor(item[1].length / 2), texto: item[2] })
        } else if (linhas[i].trim() !== '' && /^\s+/.test(linhas[i]) && itens.length > 0) {
          itens[itens.length - 1].texto += ` ${linhas[i].trim()}`
        } else break
        i++
      }
      lista.push({ tipo: 'lista', itens })
    } else if (/^#{3,6}\s/.test(linha)) {
      lista.push({ tipo: 'titulo', texto: linha.replace(/^#+\s*/, '') })
      i++
    } else {
      const partes = []
      while (i < linhas.length && linhas[i].trim() !== '' && !/^\s*(\||[-*]\s|\d+\.\s|#{3,6}\s)/.test(linhas[i])) {
        partes.push(linhas[i++].trim())
      }
      lista.push({ tipo: 'paragrafo', texto: partes.join(' ') })
    }
  }
  return lista
}

function renderizarBlocos(lista) {
  return lista
    .map((bloco) => {
      if (bloco.tipo === 'tabela') {
        const cab = bloco.cabecalho.map((c) => `<th scope="col">${emLinha(c)}</th>`).join('')
        const corpo = bloco.linhas
          .map((linha) => `<tr>${linha.map((c) => `<td>${emLinha(c)}</td>`).join('')}</tr>`)
          .join('')
        return `<div class="rolagem"><table><thead><tr>${cab}</tr></thead><tbody>${corpo}</tbody></table></div>`
      }
      if (bloco.tipo === 'lista') {
        const itens = bloco.itens
          .map((item) => `<li style="margin-left:${item.nivel * 1.25}rem">${emLinha(item.texto)}</li>`)
          .join('')
        return `<ul>${itens}</ul>`
      }
      if (bloco.tipo === 'titulo') return `<h4>${emLinha(bloco.texto)}</h4>`
      return `<p>${emLinha(bloco.texto)}</p>`
    })
    .join('\n')
}

// ---------- interpretação do plano ----------

function lerStatus(texto) {
  const limpo = texto.trim()
  const status = STATUS.find((s) => normalizar(limpo).startsWith(normalizar(s.rotulo))) ?? DESCONHECIDO
  let resto = status === DESCONHECIDO ? limpo : limpo.slice(status.rotulo.length)
  const data = resto.match(/^\s*\((\d{2}\/\d{2}\/\d{4})\)/)
  if (data) resto = resto.slice(data[0].length)
  return { chave: status.chave, data: data?.[1] ?? '', nota: resto.replace(/^[\s.:;,—–-]+/, '').trim() }
}

function lerPlano(markdown) {
  const linhas = markdown.split(/\r?\n/)
  let titulo = 'Plano de Implementação'
  const preambulo = []
  const secoes = []
  for (const linha of linhas) {
    if (/^#\s/.test(linha) && secoes.length === 0 && preambulo.length === 0) titulo = linha.replace(/^#\s*/, '')
    else if (/^##\s/.test(linha)) secoes.push({ titulo: linha.replace(/^##\s*/, ''), linhas: [] })
    else if (secoes.length > 0) secoes[secoes.length - 1].linhas.push(linha)
    else preambulo.push(linha)
  }

  const meta = []
  const preambuloLivre = []
  for (const linha of preambulo) {
    const item = linha.match(/^\*\*(.+?):\*\*\s*(.*)$/)
    if (item) meta.push({ chave: item[1], valor: item[2] })
    else preambuloLivre.push(linha)
  }

  const descricoesFase = new Map()
  const fases = []
  const outras = []
  let historico = []
  let duvidas = null

  for (const secao of secoes) {
    const lista = blocos(secao.linhas)
    const fase = secao.titulo.match(/^(F\d+)\s*[—–-]\s*(.+)$/)
    const nome = normalizar(secao.titulo)

    if (fase) {
      const tabela = lista.find((b) => b.tipo === 'tabela' && b.cabecalho.some((c) => normalizar(c) === 'status'))
      const coluna = (rotulo) => tabela?.cabecalho.findIndex((c) => normalizar(c).startsWith(rotulo)) ?? -1
      const indices = {
        id: coluna('id'),
        atividade: coluna('atividade'),
        requisitos: coluna('requisito'),
        agente: coluna('agente'),
        depende: coluna('depende'),
        criterio: coluna('criterio'),
        status: coluna('status'),
        arquivos: coluna('arquivo'),
        testes: coluna('teste'),
      }
      const ler = (linha, campo) => (indices[campo] >= 0 ? (linha[indices[campo]] ?? '') : '')
      const atividades = (tabela?.linhas ?? []).map((linha) => {
        const idBruto = ler(linha, 'id')
        return {
          id: idBruto.replace(/\\/g, '').replace(/\*/g, ''),
          naoPlanejada: idBruto.includes('*'),
          atividade: ler(linha, 'atividade'),
          requisitos: ler(linha, 'requisitos'),
          agente: ler(linha, 'agente'),
          depende: ler(linha, 'depende'),
          criterio: ler(linha, 'criterio'),
          arquivos: ler(linha, 'arquivos'),
          testes: ler(linha, 'testes'),
          ...lerStatus(ler(linha, 'status')),
        }
      })
      fases.push({ id: fase[1], nome: fase[2], atividades, extras: lista.filter((b) => b !== tabela) })
    } else if (nome === 'fases') {
      const tabela = lista.find((b) => b.tipo === 'tabela')
      for (const linha of tabela?.linhas ?? []) descricoesFase.set(linha[0], linha[1] ?? '')
      const extras = lista.filter((b) => b !== tabela)
      if (extras.length > 0) outras.push({ titulo: 'Observações sobre as fases', blocos: extras })
    } else if (nome.startsWith('historico')) {
      historico = lista
        .filter((b) => b.tipo === 'lista')
        .flatMap((b) => b.itens)
        .map((item) => {
          const partes = item.texto.match(/^(\d{2}\/\d{2}\/\d{4})\s*[—–-]\s*(?:\[([^\]]+)\]\s*)?([\s\S]*)$/)
          return partes
            ? { data: partes[1], tipo: partes[2] ?? 'outro', texto: partes[3] }
            : { data: '', tipo: 'outro', texto: item.texto }
        })
    } else if (nome.startsWith('duvidas')) {
      duvidas = lista
    } else {
      outras.push({ titulo: secao.titulo, blocos: lista })
    }
  }

  for (const fase of fases) fase.descricao = descricoesFase.get(fase.id) ?? ''
  return { titulo, meta, preambulo: blocos(preambuloLivre), fases, historico, duvidas, outras }
}

// ---------- cálculos ----------

function contar(atividades) {
  const contagem = Object.fromEntries([...STATUS, DESCONHECIDO].map((s) => [s.chave, 0]))
  for (const atividade of atividades) contagem[atividade.chave]++
  const total = atividades.length - contagem.cancelada
  return { contagem, total, concluidas: contagem.concluida, percentual: percentual(contagem.concluida, total) }
}

function liberadas(fases) {
  const porId = new Map(fases.flatMap((f) => f.atividades.map((a) => [a.id, a])))
  return fases.flatMap((fase) =>
    fase.atividades
      .filter((a) => a.chave === 'pendente' || a.chave === 'reaberta')
      .filter((a) =>
        (a.depende.match(/F\d+\.\d+/g) ?? []).every((id) => {
          const dependencia = porId.get(id)
          return !dependencia || dependencia.chave === 'concluida' || dependencia.chave === 'cancelada'
        }),
      )
      .map((a) => ({ ...a, fase: fase.id })),
  )
}

// ---------- HTML ----------

const selo = (chave, data = '') => {
  const s = statusPorChave(chave)
  return `<span class="selo selo--${s.chave}"><span aria-hidden="true">${s.icone}</span> ${s.rotulo}${data ? ` <span class="selo__data">${data}</span>` : ''}</span>`
}

function barra({ contagem, total }, rotulo) {
  if (total === 0) return '<div class="barra barra--vazia" aria-hidden="true"></div>'
  const segmentos = SEGMENTOS.filter((chave) => contagem[chave] > 0).map((chave) => {
    const s = statusPorChave(chave)
    const texto = `${rotulo} · ${s.rotulo}: ${contagem[chave]} de ${total}`
    return `<span class="barra__seg barra__seg--${chave}" style="flex-grow:${contagem[chave]}" data-dica="${escapar(texto)}"></span>`
  })
  const restantes = total - SEGMENTOS.reduce((soma, chave) => soma + contagem[chave], 0)
  if (restantes > 0) {
    segmentos.push(
      `<span class="barra__seg barra__seg--trilha" style="flex-grow:${restantes}" data-dica="${escapar(`${rotulo} · Pendentes: ${restantes} de ${total}`)}"></span>`,
    )
  }
  return `<div class="barra" role="img" aria-label="${escapar(`${rotulo}: ${SEGMENTOS.map((c) => `${statusPorChave(c).rotulo} ${contagem[c]}`).join(', ')}, Pendentes ${restantes}`)}">${segmentos.join('')}</div>`
}

function legenda(contagem) {
  return `<ul class="legenda">${STATUS.map(
    (s) =>
      `<li><span class="legenda__amostra legenda__amostra--${s.chave}" aria-hidden="true"></span>${s.rotulo} <strong>${contagem[s.chave]}</strong></li>`,
  ).join('')}</ul>`
}

function tabelaAtividades(fase) {
  const linhas = fase.atividades.map((a, i) => {
    const detalhes = [
      ['Critério de pronto', a.criterio],
      ['Observações', a.nota],
      ['Arquivos', a.arquivos],
      ['Testes', a.testes],
    ].filter(([, valor]) => valor && valor !== '—')
    const idDetalhe = `det-${fase.id}-${i}`
    return `<tr class="atividade" data-status="${a.chave}" data-fase="${fase.id}">
  <th scope="row" class="col-id">${escapar(a.id)}${a.naoPlanejada ? '<span class="nao-planejada" title="Atividade não planejada">*</span>' : ''}</th>
  <td class="col-atividade">${emLinha(a.atividade)}</td>
  <td class="col-req">${emLinha(a.requisitos)}</td>
  <td>${emLinha(a.agente)}</td>
  <td class="col-dep">${emLinha(a.depende)}</td>
  <td>${selo(a.chave, a.data)}</td>
  <td>${detalhes.length > 0 ? `<button type="button" class="botao-detalhe" aria-expanded="false" aria-controls="${idDetalhe}">Detalhes</button>` : ''}</td>
</tr>${
      detalhes.length > 0
        ? `<tr class="detalhe" id="${idDetalhe}" hidden><td colspan="7"><dl>${detalhes
            .map(([rotulo, valor]) => `<dt>${rotulo}</dt><dd>${emLinha(valor)}</dd>`)
            .join('')}</dl></td></tr>`
        : ''
    }`
  })
  return `<div class="rolagem"><table class="tabela-atividades">
<thead><tr><th scope="col">ID</th><th scope="col">Atividade</th><th scope="col">Requisitos</th><th scope="col">Agente</th><th scope="col">Depende de</th><th scope="col">Status</th><th scope="col"><span class="oculto">Detalhes</span></th></tr></thead>
<tbody>${linhas.join('\n')}</tbody></table></div>`
}

function gerarHtml(plano, origem) {
  const todas = plano.fases.flatMap((f) => f.atividades)
  const geral = contar(todas)
  const metaPorChave = new Map(plano.meta.map((m) => [normalizar(m.chave), m.valor]))
  const objetivo = metaPorChave.get('objetivo') ?? ''
  const atualizado = metaPorChave.get('atualizado em') ?? '—'
  const progressoInformado = metaPorChave.get('progresso geral') ?? ''
  const outrasMeta = plano.meta.filter((m) => !['objetivo', 'atualizado em', 'progresso geral'].includes(normalizar(m.chave)))
  const proximas = liberadas(plano.fases)
  const bloqueadas = plano.fases.flatMap((f) => f.atividades.filter((a) => a.chave === 'bloqueada').map((a) => ({ ...a, fase: f.id })))
  const tiposHistorico = [...new Set(plano.historico.map((h) => h.tipo))]
  const agora = new Date()
  const geradoEm = `${agora.toLocaleDateString('pt-BR')} ${agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
  const divergencia =
    progressoInformado && !progressoInformado.startsWith(`${geral.percentual}%`)
      ? `<p class="aviso">O Markdown informa “${escapar(progressoInformado)}”; o valor acima foi recalculado a partir das tabelas de atividades.</p>`
      : ''

  const blocoFases = plano.fases
    .map((fase) => {
      const c = contar(fase.atividades)
      const rotulo = `${fase.id} — ${fase.nome}`
      return `<section class="fase" id="fase-${fase.id}" data-fase="${fase.id}">
<details${c.percentual < 100 ? ' open' : ''}>
<summary>
  <span class="fase__titulo"><span class="fase__id">${fase.id}</span> ${emLinha(fase.nome)}</span>
  <span class="fase__progresso">${barra(c, rotulo)}<span class="fase__pct">${c.percentual}% <span class="suave">(${c.concluidas}/${c.total})</span></span></span>
</summary>
${fase.descricao ? `<p class="fase__descricao">${emLinha(fase.descricao)}</p>` : ''}
${tabelaAtividades(fase)}
${renderizarBlocos(fase.extras)}
</details>
</section>`
    })
    .join('\n')

  const graficoFases = plano.fases
    .map((fase) => {
      const c = contar(fase.atividades)
      return `<li><a class="grafico__rotulo" href="#fase-${fase.id}"><span class="fase__id">${fase.id}</span> ${emLinha(fase.nome)}</a>${barra(c, `${fase.id} — ${fase.nome}`)}<span class="grafico__valor">${c.percentual}% <span class="suave">${c.concluidas}/${c.total}</span></span></li>`
    })
    .join('')

  const listaCurta = (itens, vazio, comNota) =>
    itens.length === 0
      ? `<p class="suave">${vazio}</p>`
      : `<ul class="lista-curta">${itens
          .map(
            (a) =>
              `<li><a href="#fase-${a.fase}" class="fase__id">${escapar(a.id)}</a> <span>${emLinha(a.atividade)}${comNota && a.nota ? `<span class="lista-curta__nota">${emLinha(a.nota)}</span>` : ''}</span></li>`,
          )
          .join('')}</ul>`

  const historico = plano.historico
    .map(
      (h) =>
        `<li class="evento" data-tipo="${escapar(h.tipo)}"><span class="evento__data">${escapar(h.data)}</span><span class="evento__tipo">${escapar(h.tipo)}</span><div class="evento__texto">${emLinha(h.texto)}</div></li>`,
    )
    .join('')

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapar(plano.titulo)}</title>
<style>
:root {
  color-scheme: light;
  --fundo: #f4f4f1; --superficie: #fcfcfb; --superficie-2: #f0efeb;
  --texto: #0b0b0b; --texto-2: #52514e; --texto-3: #6f6e69;
  --borda: rgba(11,11,11,0.10); --grade: #e1e0d9; --trilha: #e4e3dc;
  --destaque: #2a78d6; --link: #1f63b5;
  --concluida: #0ca30c; --andamento: #2a78d6; --reaberta: #c98500; --bloqueada: #d03b3b;
  --pendente: #8a8983; --cancelada: #a3a29b;
  --texto-concluida: #006300; --texto-bloqueada: #b02a2a; --texto-reaberta: #8a5b00; --texto-andamento: #1f63b5;
  --sombra: 0 1px 2px rgba(11,11,11,0.06);
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    color-scheme: dark;
    --fundo: #121211; --superficie: #1a1a19; --superficie-2: #232321;
    --texto: #f0efec; --texto-2: #c3c2b7; --texto-3: #9a998f;
    --borda: rgba(255,255,255,0.10); --grade: #2c2c2a; --trilha: #33332f;
    --destaque: #3987e5; --link: #7fb2f0;
    --andamento: #3987e5;
    --texto-concluida: #3fc23f; --texto-bloqueada: #f07a7a; --texto-reaberta: #e0a733; --texto-andamento: #7fb2f0;
    --sombra: none;
  }
}
:root[data-theme="dark"] {
  color-scheme: dark;
  --fundo: #121211; --superficie: #1a1a19; --superficie-2: #232321;
  --texto: #f0efec; --texto-2: #c3c2b7; --texto-3: #9a998f;
  --borda: rgba(255,255,255,0.10); --grade: #2c2c2a; --trilha: #33332f;
  --destaque: #3987e5; --link: #7fb2f0;
  --andamento: #3987e5;
  --texto-concluida: #3fc23f; --texto-bloqueada: #f07a7a; --texto-reaberta: #e0a733; --texto-andamento: #7fb2f0;
  --sombra: none;
}
* { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; }
body { margin: 0; background: var(--fundo); color: var(--texto); font: 15px/1.5 system-ui, -apple-system, "Segoe UI", Ubuntu, Roboto, sans-serif; overflow-x: hidden; }
a { color: var(--link); }
code { font: 0.86em/1.4 ui-monospace, "Cascadia Mono", Consolas, monospace; background: var(--superficie-2); padding: 0.05em 0.3em; border-radius: 4px; overflow-wrap: anywhere; }
.pagina { max-width: 1240px; margin: 0 auto; padding: 24px 16px 64px; }
.cabecalho { display: flex; flex-wrap: wrap; gap: 12px 24px; align-items: flex-start; justify-content: space-between; margin-bottom: 20px; }
.cabecalho h1 { margin: 0; font-size: 1.6rem; line-height: 1.2; letter-spacing: -0.01em; }
.cabecalho__meta { margin: 6px 0 0; color: var(--texto-2); font-size: 0.9rem; }
.botao-tema, .botao-detalhe, .chip { font: inherit; color: var(--texto); background: var(--superficie); border: 1px solid var(--borda); border-radius: 999px; padding: 4px 12px; cursor: pointer; }
.botao-tema:hover, .botao-detalhe:hover, .chip:hover { background: var(--superficie-2); }
.botao-detalhe { font-size: 0.82rem; padding: 2px 10px; white-space: nowrap; }
:focus-visible { outline: 2px solid var(--destaque); outline-offset: 2px; }
.cartao { background: var(--superficie); border: 1px solid var(--borda); border-radius: 12px; padding: 16px 18px; box-shadow: var(--sombra); }
.objetivo { margin: 0 0 16px; color: var(--texto-2); }
.grade-kpi { display: grid; grid-template-columns: minmax(240px, 2fr) repeat(auto-fit, minmax(120px, 1fr)); gap: 12px; margin-bottom: 16px; }
.kpi__rotulo { font-size: 0.82rem; color: var(--texto-2); margin: 0; display: flex; gap: 6px; align-items: center; }
.kpi__valor { font-size: 1.9rem; font-weight: 650; line-height: 1.1; margin: 4px 0 0; font-variant-numeric: tabular-nums; }
.kpi--hero .kpi__valor { font-size: 2.6rem; }
.kpi--hero .barra { margin-top: 10px; height: 12px; }
.kpi__nota { margin: 8px 0 0; font-size: 0.82rem; color: var(--texto-2); }
.amostra { width: 10px; height: 10px; border-radius: 3px; display: inline-block; }
.aviso { margin: 8px 0 0; font-size: 0.82rem; color: var(--texto-reaberta); }
.suave { color: var(--texto-3); font-weight: 400; }
.oculto { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
h2 { font-size: 1.15rem; margin: 0 0 12px; }
.secao { margin-top: 20px; }
.duas-colunas { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 12px; margin-top: 12px; }
.barra { display: flex; gap: 2px; height: 10px; border-radius: 4px; overflow: hidden; background: var(--superficie); min-width: 80px; flex: 1; }
.barra--vazia { background: var(--trilha); }
.barra__seg { display: block; min-width: 3px; height: 100%; }
.barra__seg--concluida { background: var(--concluida); }
.barra__seg--andamento { background: var(--andamento); }
.barra__seg--reaberta { background: var(--reaberta); }
.barra__seg--bloqueada { background: var(--bloqueada); }
.barra__seg--trilha { background: var(--trilha); }
.legenda { list-style: none; display: flex; flex-wrap: wrap; gap: 6px 16px; margin: 0 0 12px; padding: 0; font-size: 0.85rem; color: var(--texto-2); }
.legenda li { display: flex; align-items: center; gap: 6px; }
.legenda strong { color: var(--texto); font-variant-numeric: tabular-nums; }
.legenda__amostra { width: 12px; height: 12px; border-radius: 3px; display: inline-block; }
.legenda__amostra--concluida { background: var(--concluida); }
.legenda__amostra--andamento { background: var(--andamento); }
.legenda__amostra--reaberta { background: var(--reaberta); }
.legenda__amostra--bloqueada { background: var(--bloqueada); }
.legenda__amostra--pendente { background: var(--trilha); box-shadow: inset 0 0 0 1px var(--borda); }
.legenda__amostra--cancelada { background: repeating-linear-gradient(45deg, var(--cancelada) 0 2px, transparent 2px 5px); box-shadow: inset 0 0 0 1px var(--borda); }
.grafico { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
.grafico li { display: grid; grid-template-columns: minmax(140px, 300px) 1fr 92px; gap: 12px; align-items: center; }
.grafico__rotulo { color: var(--texto); text-decoration: none; font-size: 0.9rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.grafico__rotulo:hover { text-decoration: underline; }
.grafico__valor { font-variant-numeric: tabular-nums; font-size: 0.88rem; text-align: right; white-space: nowrap; }
.fase__id { font-weight: 650; font-variant-numeric: tabular-nums; color: var(--texto); text-decoration: none; }
.lista-curta { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; font-size: 0.9rem; }
.lista-curta li { display: grid; grid-template-columns: 56px 1fr; gap: 8px; }
.lista-curta__nota { display: block; color: var(--texto-2); font-size: 0.84rem; margin-top: 2px; }
.lista-rolagem { max-height: 360px; overflow: auto; padding-right: 4px; }
.filtros { position: sticky; top: 0; z-index: 5; display: flex; flex-wrap: wrap; gap: 8px 12px; align-items: center; padding: 10px 0; background: var(--fundo); border-bottom: 1px solid var(--borda); margin-bottom: 12px; }
.filtros input[type="search"], .filtros select { font: inherit; color: var(--texto); background: var(--superficie); border: 1px solid var(--borda); border-radius: 8px; padding: 5px 10px; min-width: 0; }
.filtros input[type="search"] { flex: 1 1 220px; }
.filtros select { flex: 0 1 260px; max-width: 100%; text-overflow: ellipsis; }
.pagina > *, .grade-kpi > *, .duas-colunas > *, .grafico li > *, .fase summary > * { min-width: 0; }
.chips { display: flex; flex-wrap: wrap; gap: 6px; }
.chip[aria-pressed="true"] { background: var(--texto); color: var(--superficie); border-color: var(--texto); }
.filtros__total { font-size: 0.85rem; color: var(--texto-2); margin-left: auto; }
.fase { margin-bottom: 12px; }
.fase details { background: var(--superficie); border: 1px solid var(--borda); border-radius: 12px; box-shadow: var(--sombra); }
.fase summary { cursor: pointer; list-style: none; display: grid; grid-template-columns: 14px 1fr minmax(160px, 340px); gap: 12px; align-items: center; padding: 14px 18px; }
.fase summary::-webkit-details-marker { display: none; }
.fase summary::before { content: "▸"; color: var(--texto-3); }
.fase details[open] summary::before { content: "▾"; }
.fase__titulo { font-weight: 600; }
.fase__progresso { display: flex; gap: 10px; align-items: center; }
.fase__pct { font-variant-numeric: tabular-nums; font-size: 0.88rem; white-space: nowrap; }
.fase__descricao { margin: 0 18px 10px; color: var(--texto-2); font-size: 0.9rem; }
.fase details > :not(summary) { margin-left: 18px; margin-right: 18px; }
.fase details > :last-child { margin-bottom: 16px; }
.rolagem { overflow-x: auto; -webkit-overflow-scrolling: touch; }
table { border-collapse: collapse; width: 100%; font-size: 0.88rem; }
th, td { text-align: left; vertical-align: top; padding: 8px 10px; border-bottom: 1px solid var(--grade); }
thead th { font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--texto-2); font-weight: 600; white-space: nowrap; }
.tabela-atividades { min-width: 900px; }
.col-id { white-space: nowrap; font-variant-numeric: tabular-nums; }
.col-atividade { min-width: 320px; }
.col-req, .col-dep { min-width: 110px; }
.nao-planejada { color: var(--texto-reaberta); margin-left: 1px; }
tr.detalhe td { background: var(--superficie-2); }
dl { margin: 0; display: grid; grid-template-columns: max-content 1fr; gap: 6px 16px; }
dt { font-weight: 600; color: var(--texto-2); }
dd { margin: 0; overflow-wrap: anywhere; }
.selo { display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: 999px; font-size: 0.8rem; font-weight: 600; white-space: nowrap; border: 1px solid currentColor; }
.selo__data { font-weight: 400; opacity: 0.85; }
.selo--concluida { color: var(--texto-concluida); }
.selo--andamento { color: var(--texto-andamento); }
.selo--reaberta { color: var(--texto-reaberta); }
.selo--bloqueada { color: var(--texto-bloqueada); }
.selo--pendente, .selo--desconhecido { color: var(--texto-2); }
.selo--cancelada { color: var(--texto-3); text-decoration: line-through; }
.historico { list-style: none; margin: 0; padding: 0; }
.evento { display: grid; grid-template-columns: 92px 110px 1fr; gap: 4px 12px; padding: 10px 0; border-bottom: 1px solid var(--grade); font-size: 0.9rem; }
.evento__data { font-variant-numeric: tabular-nums; color: var(--texto-2); }
.evento__tipo { font-size: 0.78rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: var(--texto-2); }
.evento__texto { overflow-wrap: anywhere; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; cursor: pointer; }
.evento__texto.aberto { display: block; }
.outras details { background: var(--superficie); border: 1px solid var(--borda); border-radius: 12px; margin-bottom: 10px; }
.outras summary { cursor: pointer; padding: 12px 18px; font-weight: 600; }
.outras details > :not(summary) { margin-left: 18px; margin-right: 18px; }
.outras details > :last-child { margin-bottom: 14px; }
.outras p, .outras li, .duvidas p, .duvidas li { overflow-wrap: anywhere; }
.duvidas ul { padding-left: 20px; }
.rodape { margin-top: 32px; font-size: 0.8rem; color: var(--texto-3); }
.dica { position: fixed; pointer-events: none; z-index: 20; background: var(--texto); color: var(--superficie); padding: 6px 10px; border-radius: 8px; font-size: 0.82rem; max-width: 280px; box-shadow: 0 4px 12px rgba(0,0,0,0.18); }
.vazio { padding: 24px; text-align: center; color: var(--texto-2); }
@media (max-width: 720px) {
  .grade-kpi { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .kpi--hero { grid-column: 1 / -1; }
  .grafico { gap: 14px; }
  .grafico li { grid-template-columns: 1fr 74px; row-gap: 4px; }
  .grafico li .barra { grid-column: 1 / -1; grid-row: 2; }
  .fase summary { grid-template-columns: 14px 1fr; }
  .fase__progresso { grid-column: 2; }
  .evento { grid-template-columns: 1fr auto; }
  .evento__texto { grid-column: 1 / -1; }
  .filtros__total { margin-left: 0; }
}
@media print {
  .filtros, .botao-tema, .botao-detalhe { display: none; }
  .fase details, .outras details { break-inside: avoid-page; }
  .evento__texto { display: block; }
}
@media (forced-colors: active) {
  .barra__seg { border: 1px solid CanvasText; }
}
</style>
</head>
<body>
<div class="pagina">
<header class="cabecalho">
  <div>
    <h1>${escapar(plano.titulo)}</h1>
    <p class="cabecalho__meta">Atualizado em ${emLinha(atualizado)} · gerado em ${geradoEm} a partir de <code>${escapar(origem)}</code></p>
  </div>
  <button type="button" class="botao-tema" id="botao-tema" aria-label="Alternar tema">Tema: automático</button>
</header>

${objetivo ? `<p class="objetivo"><strong>Objetivo:</strong> ${emLinha(objetivo)}</p>` : ''}

<section aria-label="Resumo" class="grade-kpi">
  <div class="cartao kpi kpi--hero">
    <p class="kpi__rotulo">Progresso geral</p>
    <p class="kpi__valor">${geral.percentual}%</p>
    ${barra(geral, 'Projeto')}
    <p class="kpi__nota">${geral.concluidas} de ${geral.total} atividades concluídas${geral.contagem.cancelada > 0 ? ` · ${geral.contagem.cancelada} cancelada(s) fora do cálculo` : ''}</p>
    ${divergencia}
  </div>
  ${['andamento', 'pendente', 'bloqueada', 'reaberta']
    .map((chave) => {
      const s = statusPorChave(chave)
      return `<div class="cartao kpi"><p class="kpi__rotulo"><span class="selo selo--${chave}" style="border:0;padding:0"><span aria-hidden="true">${s.icone}</span></span>${s.rotulo}</p><p class="kpi__valor">${geral.contagem[chave]}</p></div>`
    })
    .join('\n  ')}
</section>

<section class="cartao secao" aria-labelledby="titulo-grafico">
  <h2 id="titulo-grafico">Progresso por fase</h2>
  ${legenda(geral.contagem)}
  <ul class="grafico">${graficoFases}</ul>
</section>

<div class="duas-colunas">
  <section class="cartao" aria-labelledby="titulo-proximas">
    <h2 id="titulo-proximas">Próximas atividades liberadas <span class="suave">(${proximas.length})</span></h2>
    <div class="lista-rolagem">${listaCurta(proximas, 'Nenhuma atividade pendente com as dependências concluídas.', false)}</div>
  </section>
  <section class="cartao" aria-labelledby="titulo-bloqueadas">
    <h2 id="titulo-bloqueadas">Bloqueadas <span class="suave">(${bloqueadas.length})</span></h2>
    <div class="lista-rolagem">${listaCurta(bloqueadas, 'Nenhuma atividade bloqueada.', true)}</div>
  </section>
</div>

<section class="secao" aria-labelledby="titulo-atividades">
  <h2 id="titulo-atividades">Atividades por fase</h2>
  <div class="filtros" role="search">
    <label class="oculto" for="busca">Buscar atividades</label>
    <input type="search" id="busca" placeholder="Buscar por ID, atividade, requisito, agente ou arquivo">
    <label class="oculto" for="filtro-fase">Fase</label>
    <select id="filtro-fase">
      <option value="">Todas as fases</option>
      ${plano.fases.map((f) => `<option value="${f.id}">${f.id} — ${escapar(f.nome)}</option>`).join('')}
    </select>
    <div class="chips" role="group" aria-label="Filtrar por status">
      ${STATUS.map((s) => `<button type="button" class="chip" data-status="${s.chave}" aria-pressed="false">${s.icone} ${s.rotulo}</button>`).join('')}
    </div>
    <span class="filtros__total" id="total-filtrado" aria-live="polite"></span>
  </div>
  ${blocoFases}
  <p class="vazio" id="sem-resultados" hidden>Nenhuma atividade corresponde aos filtros.</p>
</section>

${
  plano.duvidas
    ? `<section class="cartao secao duvidas" aria-labelledby="titulo-duvidas"><h2 id="titulo-duvidas">Dúvidas em aberto</h2>${renderizarBlocos(plano.duvidas)}</section>`
    : ''
}

${
  plano.historico.length > 0
    ? `<section class="cartao secao" aria-labelledby="titulo-historico">
  <h2 id="titulo-historico">Histórico <span class="suave">(${plano.historico.length})</span></h2>
  <div class="chips" role="group" aria-label="Filtrar histórico por tipo" style="margin-bottom:8px">
    ${tiposHistorico.map((t) => `<button type="button" class="chip chip-historico" data-tipo="${escapar(t)}" aria-pressed="false">${escapar(t)}</button>`).join('')}
  </div>
  <ol class="historico">${historico}</ol>
</section>`
    : ''
}

${
  outrasMeta.length > 0 || plano.outras.length > 0 || plano.preambulo.length > 0
    ? `<section class="secao outras" aria-labelledby="titulo-outras">
  <h2 id="titulo-outras">Outras seções do plano</h2>
  ${
    outrasMeta.length > 0 || plano.preambulo.length > 0
      ? `<details><summary>Sobre o plano</summary><dl>${outrasMeta.map((m) => `<dt>${emLinha(m.chave)}</dt><dd>${emLinha(m.valor)}</dd>`).join('')}</dl>${renderizarBlocos(plano.preambulo)}</details>`
      : ''
  }
  ${plano.outras.map((s) => `<details><summary>${emLinha(s.titulo)}</summary>${renderizarBlocos(s.blocos)}</details>`).join('\n  ')}
</section>`
    : ''
}

<p class="rodape">Versão de visualização gerada automaticamente. A fonte oficial é o arquivo <code>${escapar(origem)}</code>; não edite este HTML.</p>
</div>
<div class="dica" id="dica" hidden></div>
<script>
(() => {
  const raiz = document.documentElement
  const botaoTema = document.getElementById('botao-tema')
  const temas = ['auto', 'light', 'dark']
  const nomes = { auto: 'automático', light: 'claro', dark: 'escuro' }
  let tema = 'auto'
  try { tema = localStorage.getItem('plano-tema') || 'auto' } catch {}
  const aplicarTema = () => {
    if (tema === 'auto') raiz.removeAttribute('data-theme')
    else raiz.setAttribute('data-theme', tema)
    botaoTema.textContent = 'Tema: ' + nomes[tema]
  }
  aplicarTema()
  botaoTema.addEventListener('click', () => {
    tema = temas[(temas.indexOf(tema) + 1) % temas.length]
    try { localStorage.setItem('plano-tema', tema) } catch {}
    aplicarTema()
  })

  const normalizar = (t) => t.normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLowerCase()
  const linhas = [...document.querySelectorAll('tr.atividade')].map((tr) => {
    const detalhe = tr.nextElementSibling && tr.nextElementSibling.classList.contains('detalhe') ? tr.nextElementSibling : null
    return { tr, detalhe, texto: normalizar(tr.textContent + ' ' + (detalhe ? detalhe.textContent : '')) }
  })
  const fases = [...document.querySelectorAll('section.fase')]
  const busca = document.getElementById('busca')
  const filtroFase = document.getElementById('filtro-fase')
  const chips = [...document.querySelectorAll('.chip[data-status]')]
  const total = document.getElementById('total-filtrado')
  const semResultados = document.getElementById('sem-resultados')

  const filtrar = () => {
    const termo = normalizar(busca.value.trim())
    const status = chips.filter((c) => c.getAttribute('aria-pressed') === 'true').map((c) => c.dataset.status)
    const fase = filtroFase.value
    const filtrando = termo !== '' || status.length > 0 || fase !== ''
    let visiveis = 0
    for (const { tr, detalhe, texto } of linhas) {
      const ok = (!termo || texto.includes(termo)) && (status.length === 0 || status.includes(tr.dataset.status)) && (!fase || tr.dataset.fase === fase)
      tr.hidden = !ok
      if (detalhe && !ok) detalhe.hidden = true
      if (ok) visiveis++
    }
    for (const secao of fases) {
      const algum = secao.querySelector('tr.atividade:not([hidden])')
      secao.hidden = !algum && filtrando
      if (filtrando && algum) secao.querySelector('details').open = true
    }
    total.textContent = visiveis + ' de ' + linhas.length + ' atividades'
    semResultados.hidden = visiveis > 0
  }
  busca.addEventListener('input', filtrar)
  filtroFase.addEventListener('change', filtrar)
  for (const chip of chips) {
    chip.addEventListener('click', () => {
      chip.setAttribute('aria-pressed', chip.getAttribute('aria-pressed') === 'true' ? 'false' : 'true')
      filtrar()
    })
  }
  filtrar()

  document.addEventListener('click', (evento) => {
    const botao = evento.target.closest('.botao-detalhe')
    if (botao) {
      const alvo = document.getElementById(botao.getAttribute('aria-controls'))
      const aberto = botao.getAttribute('aria-expanded') === 'true'
      botao.setAttribute('aria-expanded', aberto ? 'false' : 'true')
      botao.textContent = aberto ? 'Detalhes' : 'Ocultar'
      alvo.hidden = aberto
      return
    }
    const texto = evento.target.closest('.evento__texto')
    if (texto && !evento.target.closest('a')) texto.classList.toggle('aberto')
  })

  const chipsHistorico = [...document.querySelectorAll('.chip-historico')]
  const eventos = [...document.querySelectorAll('.evento')]
  for (const chip of chipsHistorico) {
    chip.addEventListener('click', () => {
      chip.setAttribute('aria-pressed', chip.getAttribute('aria-pressed') === 'true' ? 'false' : 'true')
      const tipos = chipsHistorico.filter((c) => c.getAttribute('aria-pressed') === 'true').map((c) => c.dataset.tipo)
      for (const e of eventos) e.hidden = tipos.length > 0 && !tipos.includes(e.dataset.tipo)
    })
  }

  const dica = document.getElementById('dica')
  document.addEventListener('pointermove', (evento) => {
    const seg = evento.target.closest('[data-dica]')
    if (!seg) { dica.hidden = true; return }
    dica.textContent = seg.dataset.dica
    dica.hidden = false
    const x = Math.min(evento.clientX + 12, window.innerWidth - dica.offsetWidth - 8)
    dica.style.left = x + 'px'
    dica.style.top = (evento.clientY + 16) + 'px'
  })
  document.addEventListener('pointerleave', () => { dica.hidden = true })
})()
</script>
</body>
</html>
`
}

const plano = lerPlano(readFileSync(entrada, 'utf8'))
writeFileSync(saida, gerarHtml(plano, basename(entrada)), 'utf8')
const atividades = plano.fases.reduce((soma, fase) => soma + fase.atividades.length, 0)
console.log(`Plano HTML gerado: ${saida} (${plano.fases.length} fases, ${atividades} atividades)`)
