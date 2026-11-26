export class ProcessosError extends Error {
  constructor(
    message: string,
    public readonly status = 400,
    /** O motivo técnico (a mensagem do banco). Não vai na resposta da API; fica no registro da execução. */
    public readonly detalhe: string | null = null
  ) {
    super(message);
    this.name = "ProcessosError";
  }
}
