import { render, screen, within } from '@testing-library/react'
import { useEffect } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { ProvedorSessaoFalso } from '../test/ProvedorSessaoFalso'
import { FILIAIS, acessoFalso } from '../test/sessaoFalsa'
import { usuarioRapido } from '../test/usuario'
import type { Perfil } from '../types/dominio'
import type { Aba } from '../sessao/permissoes'
import { useAlertasMenu } from './AlertasMenu'
import { LayoutPrincipal } from './LayoutPrincipal'

/** Tela falsa que informa ao layout se a sua aba tem alertas, como a aba Indicadores fará. */
function TelaComAlerta({ aba, ativo }: { aba: Aba; ativo: boolean }) {
  const { definirAlerta } = useAlertasMenu()
  useEffect(() => {
    definirAlerta(aba, ativo)
  }, [definirAlerta, aba, ativo])
  return <p>{`Conteúdo de ${aba}`}</p>
}

function renderizar(perfil: Perfil, caminho: string, alerta: boolean) {
  const acesso = acessoFalso({ perfil, todasAsFiliais: perfil !== 'preenchedor', filiais: FILIAIS })
  return render(
    <ProvedorSessaoFalso sessao={{ acesso }}>
      <MemoryRouter initialEntries={[caminho]}>
        <Routes>
          <Route element={<LayoutPrincipal />}>
            <Route path="/" element={<p>Conteúdo do Início</p>} />
            <Route path="/indicadores" element={<TelaComAlerta aba="indicadores" ativo={alerta} />} />
            <Route path="/apontamentos" element={<p>Conteúdo de Apontamentos</p>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </ProvedorSessaoFalso>,
  )
}

const abas = () => screen.getByRole('navigation', { name: 'Abas' })
const linkIndicadores = () => within(abas()).getByRole('link', { name: /^Indicadores/ })
const marcador = (link: HTMLElement) => within(link).queryByRole('img', { name: 'Com alertas' })

describe('F6.3 — LayoutPrincipal: sinal de alerta na aba Indicadores do menu (RF-33)', () => {
  it('sem alerta, o link "Indicadores" não tem o marcador', () => {
    renderizar('admin', '/indicadores', false)

    expect(marcador(linkIndicadores())).toBeNull()
  })

  it('quando a tela informa alerta na aba, o link "Indicadores" ganha o marcador "Com alertas" (imagem acessível) sem mudar o texto do link', () => {
    renderizar('admin', '/indicadores', true)

    const link = linkIndicadores()
    expect(marcador(link)).not.toBeNull()
    expect(link.textContent).toBe('Indicadores')
    expect(link).toHaveClass('layout-principal__aba--com-alerta')
  })

  it('o marcador fica só na aba com alerta; as outras continuam sem', () => {
    renderizar('validador', '/indicadores', true)

    for (const nome of ['Início', 'Tipos', 'Apontamentos', 'Dados Externos', 'Faixas', 'Dashboards', 'Preenchimento', 'Fechamentos']) {
      expect(marcador(within(abas()).getByRole('link', { name: nome }))).toBeNull()
    }
    expect(marcador(linkIndicadores())).not.toBeNull()
  })

  it('o marcador permanece ao navegar para outra aba (o estado vive no layout, não na tela)', async () => {
    const user = usuarioRapido()
    renderizar('admin', '/indicadores', true)
    expect(marcador(linkIndicadores())).not.toBeNull()

    await user.click(within(abas()).getByRole('link', { name: 'Apontamentos' }))

    expect(screen.getByText('Conteúdo de Apontamentos')).toBeInTheDocument()
    expect(marcador(linkIndicadores())).not.toBeNull()
  })

  it('Preenchedor não tem a aba Indicadores, logo nenhum marcador aparece no menu', () => {
    renderizar('preenchedor', '/', true)

    expect(within(abas()).queryByRole('link', { name: /Indicadores/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('img', { name: 'Com alertas' })).not.toBeInTheDocument()
  })
})
