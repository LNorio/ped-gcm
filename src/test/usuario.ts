/**
 * Auxiliares de interação do usuário para os testes.
 *
 * `usuarioRapido()` cria uma instância do user-event sem o atraso entre teclas
 * (`delay: null`). O padrão (`delay: 0`) agenda um setTimeout a cada tecla, o que deixava os
 * testes de formulário com muita digitação em 3–7 s e, sob a carga da suíte completa, perto
 * do limite de 15 s. Não use em testes com fake timers: nesses, mantenha
 * `userEvent.setup({ advanceTimers: vi.advanceTimersByTime })`.
 */
import userEvent from '@testing-library/user-event'

export type Usuario = ReturnType<typeof userEvent.setup>

export function usuarioRapido(): Usuario {
  return userEvent.setup({ delay: null })
}

/**
 * Preenche um campo de texto livre vazio de uma vez (clique + colar), em vez de digitar tecla a
 * tecla. Use só onde a digitação em si não é o que se testa (ex.: textos longos de Nome,
 * Comentários, Campo ou cálculo). Não use onde o teste verifica a transformação ao digitar
 * (ex.: identificador em maiúsculas) nem o debounce de buscas.
 */
export async function colar(user: Usuario, campo: HTMLElement, texto: string): Promise<void> {
  await user.click(campo)
  await user.paste(texto)
}
