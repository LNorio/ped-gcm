import '@testing-library/jest-dom/vitest'
import { cleanup, configure } from '@testing-library/react'
import { afterEach } from 'vitest'

// A abertura completa do app (sessão → acesso → GET → render) passa de 1 s sob carga;
// o padrão de 1 s dos findBy/waitFor gerava falhas intermitentes nos testes de integração. Com 3 s ainda
// houve falhas no hook de pre-commit (bateria completa sem limite de workers, 17/11/2026): 6 s.
configure({ asyncUtilTimeout: 6000 })

afterEach(() => {
  cleanup()
})
