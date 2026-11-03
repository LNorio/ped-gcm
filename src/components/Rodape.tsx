import './Rodape.css'

export interface RodapeProps {
  /**
   * `escuro` (padrão): texto discreto sobre fundo claro (`--cor-fundo`), usado nas páginas internas.
   * `claro`: texto branco translúcido para telas com fundo azul (ex.: login).
   */
  tom?: 'escuro' | 'claro'
}

export function Rodape({ tom = 'escuro' }: RodapeProps) {
  return (
    <footer className={`rodape rodape--${tom}`}>
      Desenvolvido pelo Departamento de TI do Grupo Comercial Mariano
    </footer>
  )
}
