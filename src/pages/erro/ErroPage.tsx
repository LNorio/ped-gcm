/**
 * Página de erro inesperado (F2.3 — RF-02): `errorElement` das rotas. Como o react-router a
 * renderiza no lugar do elemento da rota (fora do `Outlet`), ela não conta com o layout
 * principal e usa o visual de "tela pública" (login, sem acesso): degradê azul, cartão com a
 * marca e a ação de voltar ao Início, que sai do estado de erro.
 *
 * A mensagem técnica não é exibida ao usuário; em desenvolvimento ela vai para o console.
 */
import { Link, useRouteError } from 'react-router-dom'
import { CAMINHOS } from '../../caminhos'
import { Aviso } from '../../components/Aviso'
import { Etiqueta } from '../../components/Etiqueta'
import { Marca } from '../../components/Marca'
import { Rodape } from '../../components/Rodape'
import './ErroPage.css'

export function ErroPage() {
  const erro = useRouteError()
  if (import.meta.env.DEV && erro) console.error('[PED] Erro capturado pela rota:', erro)

  return (
    <div className="tela-publica erro-pagina">
      <main className="tela-publica__conteudo">
        <div className="tela-publica__cartao erro-pagina__cartao">
          <div className="erro-pagina__marca">
            <Marca tom="escuro" className="erro-pagina__marca-logo" />
            <Etiqueta tom="dourado">PED</Etiqueta>
          </div>

          <Aviso tipo="erro">
            <h1 className="erro-pagina__titulo">Ocorreu um erro inesperado</h1>
            <p className="erro-pagina__texto">
              Não foi possível exibir esta tela. Tente novamente; se o problema continuar, informe a
              equipe de TI.
            </p>
          </Aviso>

          <Link to={CAMINHOS.inicio} className="erro-pagina__voltar foco-anel">
            Voltar ao Início
          </Link>
        </div>
      </main>
      <Rodape tom="claro" />
    </div>
  )
}
