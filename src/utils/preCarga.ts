/**
 * Pré-carga de páginas carregadas sob demanda (`React.lazy`).
 *
 * `preCarregar(importar)` inicia o `import()` na hora (ex.: na carga do app, em paralelo com
 * `GET /api/ped/acesso`) e devolve:
 * - `carregar()`, para usar no `lazy`: se o módulo já chegou, devolve uma promessa que entrega o módulo
 *   **de forma síncrona** a quem chama `then` (inclusive em `then` encadeados). O `lazy` sai resolvido
 *   já na primeira renderização, sem suspender: sem o "Carregando..." do `Suspense` e sem a espera mínima
 *   que o React aplica ao revelar o conteúdo depois do fallback. Se ainda está chegando, devolve a
 *   promessa da pré-carga (sem baixar duas vezes); se a pré-carga falhou (ex.: rede), tenta de novo, e a
 *   falha da nova tentativa segue para o `errorElement` da rota, como em qualquer `lazy`;
 * - `carregado()`: o módulo, se já chegou; senão `null` (para usar algo do módulo sem esperar).
 *
 * A página continua num chunk próprio: a pré-carga só antecipa o download.
 */

export interface ModuloPreCarregado<T> {
  carregar: () => Promise<T>
  carregado: () => T | null
}

function ehThenable(valor: unknown): valor is PromiseLike<unknown> {
  return (
    (typeof valor === 'object' || typeof valor === 'function') &&
    valor !== null &&
    typeof (valor as { then?: unknown }).then === 'function'
  )
}

/**
 * Promessa já cumprida cujo `then` chama o callback de sucesso na hora e devolve outra promessa assim
 * (o `lazy` lê o módulo sem esperar, mesmo depois de um `.then` que adapta o módulo ao `default`).
 */
function promessaCumprida<T>(valor: T): Promise<T> {
  // `valor` é um módulo (não uma promessa): `Awaited<T>` é o próprio `T`.
  const promessa = Promise.resolve(valor) as Promise<T>
  const thenOriginal = promessa.then.bind(promessa)
  const thenSincrono = (aoCumprir?: ((valor: T) => unknown) | null, aoRejeitar?: ((motivo: unknown) => unknown) | null) => {
    if (!aoCumprir) return thenOriginal(aoCumprir, aoRejeitar)
    let resultado: unknown
    try {
      resultado = aoCumprir(valor)
    } catch (erro) {
      return Promise.reject(erro)
    }
    return ehThenable(resultado) ? Promise.resolve(resultado) : promessaCumprida(resultado)
  }
  promessa.then = thenSincrono as Promise<T>['then']
  return promessa
}

export function preCarregar<T>(importar: () => Promise<T>): ModuloPreCarregado<T> {
  let modulo: { valor: T } | null = null
  let emAndamento: Promise<T> | null = importar().then((valor) => {
    modulo = { valor }
    return valor
  })
  // Falha da pré-carga não é erro da tela: a próxima chamada (renderização da rota) tenta de novo.
  emAndamento.catch(() => {
    emAndamento = null
  })

  return {
    carregar: () => {
      if (modulo) return promessaCumprida(modulo.valor)
      return emAndamento ?? importar()
    },
    carregado: () => modulo?.valor ?? null,
  }
}
