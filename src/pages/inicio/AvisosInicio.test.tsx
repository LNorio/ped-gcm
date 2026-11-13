import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { TEXTO_AVISO_PERIODO } from '../../test/inicioFalsos'
import type { AvisoDeAcessoInicio, PeriodoAbertoInicio } from '../../types/dominio'
import { AvisosInicio } from './AvisosInicio'

const PERIODO_OUTUBRO: PeriodoAbertoInicio = {
  mesDeReferencia: '2026-10-01',
  abertoPor: 'Ana Costa',
  abertoEm: '2026-10-01 08:00:00',
  aviso: 'Somente um periodo fica aberto por vez.',
}

function avisoPreenchedor(parcial: Partial<AvisoDeAcessoInicio> = {}): AvisoDeAcessoInicio {
  return {
    tipo: 'preenchedor',
    mensagem: 'Voce acessa apenas os seus tipos e filiais.',
    tipos: ['Comercial', 'Logística'],
    filiais: ['101 - CAMPO GRANDE'],
    ...parcial,
  }
}

const textos = () => screen.queryAllByRole('note').map((nota) => nota.textContent)

/**
 * F11.2 — Avisos do Início (`src/pages/inicio/AvisosInicio.tsx`; RF-06, RF-07).
 *
 * Props: `{ perfil: Perfil; periodoAberto: PeriodoAbertoInicio | null; avisoDeAcesso: AvisoDeAcessoInicio | null }`.
 * Cada aviso é uma nota (`Aviso`, `role="note"`), nesta ordem:
 * 1. período aberto (RF-06): "Período aberto para preenchimento: {MM/AAAA}. Apenas um período fica aberto
 *    por vez." — sem período aberto (`null`), esse aviso não aparece;
 * 2. acesso (RF-07), só quando `avisoDeAcesso` não é `null` (a API manda `null` para Admin e Validador):
 *    - Preenchedor: "Perfil Preenchedor: você visualiza e solicita apenas dados dos tipos {tipos}, somente na
 *      filial {filial}." ("somente nas filiais {f1}, {f2}" com mais de uma; sem filiais, termina nos tipos);
 *      tipos e filiais separados por ", ", na ordem da API;
 *    - outro perfil com filiais restritas: "Seu usuário tem acesso somente à filial {filial}." ou
 *      "Seu usuário tem acesso somente às filiais {f1}, {f2}.".
 */
describe('F11.2 — AvisosInicio (período aberto e acesso)', () => {
  describe('aviso do período aberto (RF-06)', () => {
    it('mostra o mês aberto (MM/AAAA) e a regra de que só um período fica aberto por vez', () => {
      render(<AvisosInicio perfil="admin" periodoAberto={PERIODO_OUTUBRO} avisoDeAcesso={null} />)

      expect(textos()).toEqual([TEXTO_AVISO_PERIODO])
    })

    it('outro mês de referência: o texto acompanha o mês (ex.: 01/2027)', () => {
      render(
        <AvisosInicio perfil="admin" periodoAberto={{ ...PERIODO_OUTUBRO, mesDeReferencia: '2027-01-01' }} avisoDeAcesso={null} />,
      )

      expect(textos()).toEqual(['Período aberto para preenchimento: 01/2027. Apenas um período fica aberto por vez.'])
    })

    it('sem período aberto (null): não mostra o aviso do período', () => {
      render(<AvisosInicio perfil="admin" periodoAberto={null} avisoDeAcesso={null} />)

      expect(screen.queryByText(/Período aberto para preenchimento/)).not.toBeInTheDocument()
      expect(textos()).toEqual([])
    })
  })

  describe('aviso de acesso (RF-07)', () => {
    it('Admin e Validador (aviso de acesso null): só o aviso do período', () => {
      const { rerender } = render(<AvisosInicio perfil="admin" periodoAberto={PERIODO_OUTUBRO} avisoDeAcesso={null} />)
      expect(textos()).toEqual([TEXTO_AVISO_PERIODO])

      rerender(<AvisosInicio perfil="validador" periodoAberto={PERIODO_OUTUBRO} avisoDeAcesso={null} />)
      expect(textos()).toEqual([TEXTO_AVISO_PERIODO])
    })

    it('Preenchedor com uma filial: cita os tipos e a filial, depois do aviso do período', () => {
      render(<AvisosInicio perfil="preenchedor" periodoAberto={PERIODO_OUTUBRO} avisoDeAcesso={avisoPreenchedor()} />)

      expect(textos()).toEqual([
        TEXTO_AVISO_PERIODO,
        'Perfil Preenchedor: você visualiza e solicita apenas dados dos tipos Comercial, Logística, somente na filial 101 - CAMPO GRANDE.',
      ])
    })

    it('Preenchedor com várias filiais: "somente nas filiais", na ordem da API', () => {
      render(
        <AvisosInicio
          perfil="preenchedor"
          periodoAberto={PERIODO_OUTUBRO}
          avisoDeAcesso={avisoPreenchedor({ tipos: ['Comercial'], filiais: ['101 - CAMPO GRANDE', '102 - DOURADOS'] })}
        />,
      )

      expect(textos()[1]).toBe(
        'Perfil Preenchedor: você visualiza e solicita apenas dados dos tipos Comercial, somente nas filiais 101 - CAMPO GRANDE, 102 - DOURADOS.',
      )
    })

    it('Preenchedor sem filiais na lista: o aviso termina nos tipos', () => {
      render(<AvisosInicio perfil="preenchedor" periodoAberto={PERIODO_OUTUBRO} avisoDeAcesso={avisoPreenchedor({ filiais: [] })} />)

      expect(textos()[1]).toBe('Perfil Preenchedor: você visualiza e solicita apenas dados dos tipos Comercial, Logística.')
    })

    it('outro perfil com uma filial restrita: "Seu usuário tem acesso somente à filial ..."', () => {
      render(
        <AvisosInicio
          perfil="validador"
          periodoAberto={PERIODO_OUTUBRO}
          avisoDeAcesso={{ tipo: 'filiais', mensagem: null, tipos: [], filiais: ['100 - MATRIZ'] }}
        />,
      )

      expect(textos()).toEqual([TEXTO_AVISO_PERIODO, 'Seu usuário tem acesso somente à filial 100 - MATRIZ.'])
    })

    it('outro perfil com várias filiais restritas: "Seu usuário tem acesso somente às filiais ..."', () => {
      render(
        <AvisosInicio
          perfil="validador"
          periodoAberto={PERIODO_OUTUBRO}
          avisoDeAcesso={{ tipo: 'filiais', mensagem: null, tipos: [], filiais: ['100 - MATRIZ', '101 - CAMPO GRANDE'] }}
        />,
      )

      expect(textos()[1]).toBe('Seu usuário tem acesso somente às filiais 100 - MATRIZ, 101 - CAMPO GRANDE.')
    })

    it('o aviso de acesso aparece mesmo sem período aberto', () => {
      render(<AvisosInicio perfil="preenchedor" periodoAberto={null} avisoDeAcesso={avisoPreenchedor()} />)

      expect(textos()).toEqual([
        'Perfil Preenchedor: você visualiza e solicita apenas dados dos tipos Comercial, Logística, somente na filial 101 - CAMPO GRANDE.',
      ])
    })
  })
})
