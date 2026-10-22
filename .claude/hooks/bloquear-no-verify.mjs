// Hook do Claude Code: impede commits que pulem o hook de testes (--no-verify / -n).
let entrada = ''
process.stdin.on('data', (parte) => (entrada += parte))
process.stdin.on('end', () => {
  const comando = JSON.parse(entrada).tool_input?.command ?? ''
  const commitSemVerificacao = /\bgit\b[^;&|]*\bcommit\b[^;&|]*(--no-verify|\s-[a-zA-Z]*n[a-zA-Z]*\b)/.test(comando)
  const hookDesativado = /core\.hooksPath|HUSKY=0/.test(comando) && !/core\.hooksPath \.githooks/.test(comando)
  if (commitSemVerificacao || hookDesativado) {
    console.error('Bloqueado: commits devem passar pelos testes do hook de pre-commit. Não use --no-verify nem desative o hook.')
    process.exit(2)
  }
})
