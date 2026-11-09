import { describe, expect, it } from "vitest";
import { SITUACOES_NO_ROBO, situacaoNoRobo } from "./situacao-robo";
import type { EnvioStatus } from "./types";

const tarefa = (envioStatus: EnvioStatus, extra: { envioErro?: string | null; envioSimulado?: boolean | null } = {}) => ({
  envioStatus,
  envioErro: extra.envioErro ?? null,
  envioSimulado: extra.envioSimulado ?? false,
});

describe("situacaoNoRobo", () => {
  it("vale a tarefa mais urgente da publicação", () => {
    expect(situacaoNoRobo([tarefa("concluido"), tarefa("erro")])).toBe("erro");
    expect(situacaoNoRobo([tarefa("concluido"), tarefa("processando")])).toBe("com_robo");
    expect(situacaoNoRobo([tarefa("concluido"), tarefa("pendente")])).toBe("na_fila");
  });

  it("pendente esperando o VIOS (ou indo para a pasta às 17h) é Aguardando o VIOS, não Na fila", () => {
    const esperando = tarefa("pendente", { envioErro: "Aguardando a disponibilidade da publicação no VIOS. Próxima tentativa às 16:00." });
    const pasta = tarefa("pendente", { envioErro: "Não chegou ao VIOS até 17h: vai agendar direto na pasta." });
    expect(situacaoNoRobo([esperando, tarefa("pendente")])).toBe("aguardando_vios");
    expect(situacaoNoRobo([pasta])).toBe("aguardando_vios");
    // Erro continua acima da espera.
    expect(situacaoNoRobo([esperando, tarefa("erro")])).toBe("erro");
  });

  it("todas gravadas: Agendada; se alguma só foi simulada, Só simulada", () => {
    expect(situacaoNoRobo([tarefa("concluido"), tarefa("concluido")])).toBe("agendada");
    expect(situacaoNoRobo([tarefa("concluido"), tarefa("concluido", { envioSimulado: true })])).toBe("simulada");
  });

  it("enviado ao robô conta como Com o robô; sem tarefas, Na fila", () => {
    expect(situacaoNoRobo([tarefa("enviado")])).toBe("com_robo");
    expect(situacaoNoRobo([])).toBe("na_fila");
  });

  it("o filtro tem uma opção para cada situação, sem repetir", () => {
    expect(new Set(SITUACOES_NO_ROBO.map((opcao) => opcao.valor)).size).toBe(6);
  });
});
