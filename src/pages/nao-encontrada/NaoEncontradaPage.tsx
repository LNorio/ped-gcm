/**
 * Página "não encontrada" (F2.3 — RF-02): exibida para qualquer URL que não corresponda a uma
 * aba, dentro do layout principal (cabeçalho, abas e rodapé continuam visíveis) e com a URL
 * preservada — não há redirecionamento silencioso. A única ação é voltar ao Início.
 */
import { Link } from 'react-router-dom'
import { CAMINHOS } from '../../caminhos'
import { Card } from '../../components/Card'
import './NaoEncontradaPage.css'

export function NaoEncontradaPage() {
  return (
    <Card className="nao-encontrada">
      <div className="nao-encontrada__corpo">
        <span className="nao-encontrada__codigo" aria-hidden="true">
          404
        </span>
        <h1 className="nao-encontrada__titulo">Página não encontrada</h1>
        <p className="nao-encontrada__texto">O endereço informado não existe ou foi movido.</p>
        <Link to={CAMINHOS.inicio} className="nao-encontrada__voltar foco-anel">
          Voltar ao Início
        </Link>
      </div>
    </Card>
  )
}
