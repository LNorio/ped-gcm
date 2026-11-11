/**
 * Faixas de validação dos JSONs da integração no `DialogoConcluirConstrucao` (F5.7, F5.14, F5.18).
 *
 * Recebem o resultado em vigor (do back-end para o texto atual, senão o do motor local) e o exibem num
 * `role="status"` com nome acessível: vazio não mostra nada; válido mostra "JSON válido" e o resumo
 * (saída) ou as variáveis usadas, os cálculos e a prévia (entrada); inválido mostra o título e a(s)
 * mensagem(ns). Na saída, os erros do back-end (`erros`) aparecem em lista; na entrada válida, os avisos
 * (ex.: `%filial%` sem valor numa consulta de todas as filiais) aparecem sem bloquear. Os estilos ficam
 * em `DialogoConcluirConstrucao.css`.
 */
import type { ResultadoEntrada } from '../../utils/integracao/entrada'
import type { ResultadoSaidaExibido } from './useValidacaoServidor'

function classesValidacao(estado: 'vazio' | 'valido' | 'invalido'): string {
  const classes = ['dialogo-concluir__validacao']
  if (estado === 'valido') classes.push('dialogo-concluir__validacao--valida')
  if (estado === 'invalido') classes.push('dialogo-concluir__validacao--invalida')
  return classes.join(' ')
}

export function ValidacaoSaida({ resultado }: { resultado: ResultadoSaidaExibido }) {
  return (
    <div role="status" aria-label="Validação dos parâmetros de saída" aria-atomic="true" className={classesValidacao(resultado.estado)}>
      {resultado.estado === 'valido' ? (
        <>
          <p className="dialogo-concluir__validacao-titulo">JSON válido</p>
          <p>{resultado.resumo}</p>
        </>
      ) : null}
      {resultado.estado === 'invalido' ? (
        <>
          <p className="dialogo-concluir__validacao-titulo">JSON de saída inválido</p>
          <p>{resultado.mensagem}</p>
          {resultado.erros && resultado.erros.length > 0 ? (
            <ul className="dialogo-concluir__erros">
              {resultado.erros.map((texto, indice) => (
                <li key={indice}>{texto}</li>
              ))}
            </ul>
          ) : null}
        </>
      ) : null}
    </div>
  )
}

export function ValidacaoEntrada({ resultado }: { resultado: ResultadoEntrada }) {
  return (
    <div role="status" aria-label="Validação dos parâmetros de entrada" aria-atomic="true" className={classesValidacao(resultado.estado)}>
      {resultado.estado === 'valido' ? (
        <>
          <p className="dialogo-concluir__validacao-titulo">JSON válido</p>
          {resultado.variaveisUsadas.length > 0 ? (
            <p>{`Variáveis usadas: ${resultado.variaveisUsadas.map((nome) => `%${nome}%`).join(', ')}`}</p>
          ) : null}
          {resultado.calculos.length > 0 ? (
            <ul className="dialogo-concluir__calculos">
              {resultado.calculos.map((calculo, indice) => (
                <li key={`${calculo.caminho}-${indice}`}>{`${calculo.caminho}: ${calculo.expressao} = ${calculo.resultado}`}</li>
              ))}
            </ul>
          ) : null}
          <pre className="dialogo-concluir__previa">{resultado.previa}</pre>
          {resultado.avisos.map((aviso) => (
            <p key={aviso} className="dialogo-concluir__aviso">
              {aviso}
            </p>
          ))}
        </>
      ) : null}
      {resultado.estado === 'invalido' ? (
        <>
          <p className="dialogo-concluir__validacao-titulo">JSON de entrada inválido</p>
          <ul className="dialogo-concluir__erros">
            {resultado.erros.map((mensagem, indice) => (
              <li key={indice}>{mensagem}</li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  )
}
