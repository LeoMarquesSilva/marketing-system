import { describe, expect, it } from "vitest";
import { lerRepasse } from "./autos-repasse";

describe("lerRepasse", () => {
  const doJusbr = { sistema: "jusbr", tribunal: "TJSP" };

  it("passa o pedido do Jus.br ao sistema da reserva", () => {
    expect(lerRepasse(doJusbr, "esaj:TJSP")).toEqual({ sistema: "esaj", tribunal: "TJSP" });
    expect(lerRepasse(doJusbr, "eproc:TJSP")).toEqual({ sistema: "eproc", tribunal: "TJSP" });
    expect(lerRepasse({ sistema: "jusbr", tribunal: "TJRJ" }, "dcp:TJRJ")).toEqual({ sistema: "dcp", tribunal: "TJRJ" });
  });

  it("recusa sistema desconhecido ou o próprio Jus.br", () => {
    expect(lerRepasse(doJusbr, "projudi:TJSP")).toHaveProperty("erro");
    expect(lerRepasse(doJusbr, "jusbr:BR")).toHaveProperty("erro");
    expect(lerRepasse(doJusbr, "outro:TJSP")).toHaveProperty("erro");
  });

  it("recusa reserva malformada", () => {
    expect(lerRepasse(doJusbr, "esaj")).toHaveProperty("erro");
    expect(lerRepasse(doJusbr, "esaj:")).toHaveProperty("erro");
    expect(lerRepasse(doJusbr, "esaj:TJSP:x")).toHaveProperty("erro");
  });

  it("recusa reserva de outro tribunal", () => {
    expect(lerRepasse(doJusbr, "eproc:TJRJ")).toHaveProperty("erro");
  });

  it("só repassa pedido ao Jus.br, ou o do PJe e do DCP ao eproc (processo migrado)", () => {
    expect(lerRepasse({ sistema: "esaj", tribunal: "TJSP" }, "eproc:TJSP")).toHaveProperty("erro");
    expect(lerRepasse({ sistema: "eproc", tribunal: "TJRJ" }, "pje:TJRJ")).toHaveProperty("erro");
    expect(lerRepasse({ sistema: "pje", tribunal: "TJRJ" }, "eproc:TJRJ")).toEqual({ sistema: "eproc", tribunal: "TJRJ" });
    expect(lerRepasse({ sistema: "dcp", tribunal: "TJRJ" }, "eproc:TJRJ")).toEqual({ sistema: "eproc", tribunal: "TJRJ" });
    expect(lerRepasse({ sistema: "pje", tribunal: "TJRJ" }, "dcp:TJRJ")).toHaveProperty("erro");
    expect(lerRepasse({ sistema: "pje", tribunal: "TJRJ" }, "eproc:TJSP")).toHaveProperty("erro");
  });
});
