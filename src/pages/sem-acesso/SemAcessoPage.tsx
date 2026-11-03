/**
 * Tela de usuário sem acesso (F2.8 — RF-03, RF-04, INT-01).
 *
 * Exibida quando o login é válido, mas o usuário não tem perfil no PED (`acesso.perfil === null`).
 * Mantém o visual da tela de login (fundo em gradiente e cartão centralizado), sem cabeçalho,
 * navegação ou links do sistema. A única ação é voltar ao login, encerrando a sessão.
 */
import { useNavigate } from 'react-router-dom'
import { CAMINHOS } from '../../caminhos'
import { Aviso } from '../../components/Aviso'
import { Botao } from '../../components/Botao'
import { Etiqueta } from '../../components/Etiqueta'
import { Marca } from '../../components/Marca'
import { Rodape } from '../../components/Rodape'
import { useSessao } from '../../sessao/SessaoProvider'
import './SemAcessoPage.css'

const MENSAGEM_SEM_ACESSO =
  'Usuário sem acesso ao sistema, favor verificar com a equipe de Departamento Pessoal'

export function SemAcessoPage() {
  const { sair } = useSessao()
  const navigate = useNavigate()

  function voltarAoLogin() {
    sair()
    navigate(CAMINHOS.login)
  }

  return (
    <div className="tela-publica sem-acesso">
      <main className="tela-publica__conteudo">
        <div className="tela-publica__cartao sem-acesso__cartao">
          <div className="sem-acesso__marca">
            <Marca tom="escuro" className="sem-acesso__marca-logo" />
            <Etiqueta tom="dourado">PED</Etiqueta>
          </div>

          <Aviso tipo="alerta" className="sem-acesso__aviso">
            {/* A mensagem é o título da tela: único conteúdo além da ação de voltar. */}
            <h1 className="sem-acesso__mensagem">{MENSAGEM_SEM_ACESSO}</h1>
          </Aviso>

          <Botao className="sem-acesso__voltar" onClick={voltarAoLogin}>
            Voltar ao login
          </Botao>
        </div>
      </main>
      <Rodape tom="claro" />
    </div>
  )
}
