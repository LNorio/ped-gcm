import '@testing-library/jest-dom/vitest'
import { cleanup, configure } from '@testing-library/react'
import { afterEach } from 'vitest'

// A abertura completa do app (sessão → acesso → GET → render) passa de 1 s sob carga;
// o padrão de 1 s dos findBy/waitFor gerava falhas intermitentes nos testes de integração.
configure({ asyncUtilTimeout: 3000 })

afterEach(() => {
  cleanup()
})
