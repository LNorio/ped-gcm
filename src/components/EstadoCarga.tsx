import { Aviso } from './Aviso'
import { Botao } from './Botao'
import { RegiaoStatus } from './RegiaoStatus'
import './EstadoCarga.css'

export interface EstadoCargaProps {
  /** Indica uma carga em andamento; a mensagem é anunciada na região de status. */
  carregando: boolean
  /** Texto anunciado durante a carga (ex.: "Carregando apontamentos..."). */
  mensagemCarregando: string
  /** Mensagem de falha da carga; quando presente, exibe o alerta e o botão "Tentar novamente". */
  erro: string | null
  /** Chamado ao clicar em "Tentar novamente". */
  onTentarNovamente: () => void
}

/**
 * Estado de carga de uma consulta: anuncia o carregamento em uma região ARIA live (sempre no DOM)
 * e, em caso de erro, mostra o alerta com a ação "Tentar novamente".
 */
export function EstadoCarga({ carregando, mensagemCarregando, erro, onTentarNovamente }: EstadoCargaProps) {
  return (
    <div className="estado-carga">
      <RegiaoStatus mensagem={carregando ? mensagemCarregando : null} />
      {erro ? (
        <div className="estado-carga__erro">
          <Aviso tipo="erro">{erro}</Aviso>
          <Botao type="button" variante="contorno" onClick={onTentarNovamente} disabled={carregando}>
            Tentar novamente
          </Botao>
        </div>
      ) : null}
    </div>
  )
}
