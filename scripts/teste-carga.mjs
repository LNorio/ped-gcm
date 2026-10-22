// Teste de carga do sistema PED.
// Sem LOAD_TEST_URL: gera um build temporário em .carga-dist, sobe o `vite preview` e testa a aplicação.
// Com LOAD_TEST_URL: testa a URL informada (ex.: endpoint do backend).
import autocannon from 'autocannon'
import { rm } from 'node:fs/promises'
import { build, preview } from 'vite'

const LIMITES = {
  conexoes: 50,
  duracaoSegundos: 10,
  latenciaP99MaxMs: 500,
}
const PASTA_TEMPORARIA = '.carga-dist'
const PORTA = 4199

async function executar(url) {
  const resultado = await autocannon({
    url,
    connections: LIMITES.conexoes,
    duration: LIMITES.duracaoSegundos,
  })
  const falhas = []
  if (resultado.errors > 0) falhas.push(`${resultado.errors} erros de conexão`)
  if (resultado.timeouts > 0) falhas.push(`${resultado.timeouts} timeouts`)
  if (resultado.non2xx > 0) falhas.push(`${resultado.non2xx} respostas com status diferente de 2xx`)
  if (resultado.latency.p99 > LIMITES.latenciaP99MaxMs) {
    falhas.push(`latência p99 de ${resultado.latency.p99} ms (limite: ${LIMITES.latenciaP99MaxMs} ms)`)
  }
  return { resultado, falhas }
}

let servidor
let codigoSaida = 0
try {
  let url = process.env.LOAD_TEST_URL
  if (!url) {
    await build({ logLevel: 'warn', build: { outDir: PASTA_TEMPORARIA, emptyOutDir: true } })
    servidor = await preview({
      logLevel: 'warn',
      build: { outDir: PASTA_TEMPORARIA },
      preview: { port: PORTA, strictPort: true },
    })
    url = `http://localhost:${PORTA}/`
  }

  const { resultado, falhas } = await executar(url)
  const total = resultado.requests.total
  const sucesso = total === 0 ? 0 : ((resultado['2xx'] / total) * 100).toFixed(2)

  console.log(`\nTeste de carga: ${url}`)
  console.log(`Requisições: ${total} | Sucesso: ${sucesso}% | Latência média: ${resultado.latency.average} ms | p99: ${resultado.latency.p99} ms`)
  if (falhas.length > 0) {
    console.error(`TESTE DE CARGA FALHOU:\n- ${falhas.join('\n- ')}`)
    codigoSaida = 1
  } else {
    console.log('TESTE DE CARGA APROVADO')
  }
} catch (erro) {
  console.error('TESTE DE CARGA FALHOU: erro ao executar o teste.', erro)
  codigoSaida = 1
} finally {
  if (servidor) await new Promise((resolve) => servidor.httpServer.close(resolve))
  await rm(PASTA_TEMPORARIA, { recursive: true, force: true })
}
process.exit(codigoSaida)
