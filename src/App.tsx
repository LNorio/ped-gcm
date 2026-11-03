/**
 * Raiz da aplicação (RF-00): provê a sessão e monta o roteador do navegador com as rotas
 * declaradas em `rotas.tsx`. Sem sessão, a primeira tela é o login.
 */
import { RouterProvider, createBrowserRouter } from 'react-router-dom'
import { rotas } from './rotas'
import { SessaoProvider } from './sessao/SessaoProvider'

const roteador = createBrowserRouter(rotas)

function App() {
  return (
    <SessaoProvider>
      <RouterProvider router={roteador} />
    </SessaoProvider>
  )
}

export default App
