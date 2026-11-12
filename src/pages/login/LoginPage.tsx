/**
 * Tela de login (RF-03, RNF-05, RNF-06, RNF-08) — protótipo em docs/tela-login.jpg.
 *
 * A autenticação em si é feita por `useSessao().entrar`; a tela só coleta usuário e senha,
 * controla o estado de envio e navega para o Início em caso de sucesso. A senha fica apenas
 * no estado do componente: nunca vai a storage nem a log.
 *
 * Limite de tentativas (F2.2): em `ApiError` 429, o envio fica bloqueado por `tentarNovamenteEm`
 * segundos (ou 60 s, se a API não informar), com contagem regressiva fora de região viva.
 */
import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { CAMINHOS } from '../../caminhos'
import { Aviso } from '../../components/Aviso'
import { Botao } from '../../components/Botao'
import { Campo } from '../../components/Campo'
import { Etiqueta } from '../../components/Etiqueta'
import { Marca } from '../../components/Marca'
import { Rodape } from '../../components/Rodape'
import { ApiError } from '../../services/api'
import { useSessao } from '../../sessao/SessaoProvider'
import './LoginPage.css'

function IconeOlho({ aberto }: { aberto: boolean }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
      {aberto ? null : <path d="M3 3l18 18" />}
    </svg>
  )
}

/** Bloqueio usado quando a API responde 429 sem informar o tempo de espera. */
const SEGUNDOS_BLOQUEIO_PADRAO = 60

function segundosRestantes(fim: number): number {
  return Math.ceil((fim - Date.now()) / 1000)
}

export function LoginPage() {
  const { entrar, erro } = useSessao()
  const navigate = useNavigate()
  const [usuario, setUsuario] = useState('')
  const [senha, setSenha] = useState('')
  const [mostrarSenha, setMostrarSenha] = useState(false)
  const [enviando, setEnviando] = useState(false)
  /** Instante (ms) em que o bloqueio por limite de tentativas termina; `null` sem bloqueio. */
  const [fimBloqueio, setFimBloqueio] = useState<number | null>(null)
  const [restantes, setRestantes] = useState(0)
  const bloqueado = fimBloqueio !== null

  // Contagem regressiva do bloqueio, recalculada pelo relógio a cada segundo; limpa ao desmontar.
  useEffect(() => {
    if (fimBloqueio === null) return
    const intervalo = setInterval(() => {
      const segundos = segundosRestantes(fimBloqueio)
      if (segundos <= 0) {
        clearInterval(intervalo)
        setFimBloqueio(null)
        setRestantes(0)
      } else {
        setRestantes(segundos)
      }
    }, 1000)
    return () => clearInterval(intervalo)
  }, [fimBloqueio])

  async function aoEnviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (enviando || bloqueado) return

    setEnviando(true)
    try {
      await entrar(usuario, senha)
      navigate(CAMINHOS.inicio)
    } catch (falha) {
      // A mensagem já foi refletida em `erro` pela sessão; a tela permanece com os campos preenchidos.
      if (falha instanceof ApiError && falha.status === 429) {
        const segundos = falha.tentarNovamenteEm ?? SEGUNDOS_BLOQUEIO_PADRAO
        setFimBloqueio(Date.now() + segundos * 1000)
        setRestantes(segundos)
      }
      setEnviando(false)
    }
  }

  return (
    <div className="tela-publica login">
      <main className="tela-publica__conteudo">
        <Marca />

        <section className="tela-publica__cartao" aria-labelledby="login-titulo">
          {/* Não é <header>: a tela de login não tem o cabeçalho (banner) do sistema. */}
          <div className="login__cabecalho">
            <Etiqueta tom="dourado">PED</Etiqueta>
            <h1 id="login-titulo" className="login__titulo">
              Programa de Excelência em Distribuição
            </h1>
            <p className="login__subtitulo">Cadastro, preenchimento e fechamento</p>
          </div>

          <form className="login__formulario" onSubmit={aoEnviar} noValidate>
            {erro ? <Aviso tipo="erro">{erro}</Aviso> : null}

            <Campo
              rotulo="Usuário"
              type="text"
              name="usuario"
              placeholder="Seu login"
              autoComplete="username"
              value={usuario}
              onChange={(event) => setUsuario(event.target.value)}
            />

            <Campo
              rotulo="Senha"
              type={mostrarSenha ? 'text' : 'password'}
              name="senha"
              placeholder="Sua senha"
              autoComplete="current-password"
              value={senha}
              onChange={(event) => setSenha(event.target.value)}
              sufixo={
                <Botao
                  type="button"
                  variante="link"
                  className="campo__sufixo"
                  aria-label={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
                  onClick={() => setMostrarSenha((atual) => !atual)}
                >
                  <IconeOlho aberto={!mostrarSenha} />
                </Botao>
              }
            />

            <Botao type="submit" className="login__entrar" disabled={enviando || bloqueado}>
              {bloqueado ? `Aguarde ${restantes} s` : 'Entrar'}
            </Botao>

            {/* Fora de região viva: a contagem não é anunciada a cada segundo (o alerta já informa). */}
            {bloqueado ? <p className="login__espera">{`Tente novamente em ${restantes} s.`}</p> : null}
          </form>
        </section>
      </main>

      <Rodape tom="claro" />
    </div>
  )
}
