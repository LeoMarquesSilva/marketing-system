/**
 * Preenche o mini-CV/dados de Ana Nunes Galvão e Daniela Lagoeiro dos Santos
 * (texto fornecido pelo usuário, foto já enviada em Fotos Colaboradores) e
 * publica + cria o cartão nomeado, no mesmo padrão do restante do time.
 *
 * Usa saveProfessionalProfile/setProfessionalProfileStatus/createProfileCard
 * reais (não SQL solto) para passar pela mesma validação/merge do editor.
 */
import "dotenv/config";
import {
  getProfessionalProfileAdmin,
  listMissingPublishRequirements,
  saveProfessionalProfile,
  setProfessionalProfileStatus,
} from "@/lib/profiles/admin";
import { createProfileCard } from "@/lib/profiles/cards";

const ACTOR_ID = "2f08c695-770e-47ce-b4e4-ce27fa414df8"; // Leonardo Marques (admin)

const PEOPLE = [
  {
    profileId: "9f06a506-17fb-4917-8d6e-14e6c57a46bb",
    displayName: "Ana Nunes Galvão",
    role: "Estagiária de Direito",
    practiceArea: "Recuperação de Crédito",
    photoUrl:
      "https://qwihfvagemzlyypeohpc.supabase.co/storage/v1/object/public/MARKETING-SYSTEM-FOTOS/colaboradores/3967e89a-3d9e-46d6-b0d4-f9bed260ff1e/1786326744492-ana-nunes-galvao-1.png",
    tagline:
      "Graduada em Direito pela Pontifícia Universidade Católica de Campinas (PUC-Campinas), atua no Contencioso Cível Empresarial, dedicando-se às áreas de Direito Contratual, Direito do Consumidor e Recuperação de Crédito.",
    bio:
      "Graduada em Direito pela Pontifícia Universidade Católica de Campinas (PUC-Campinas), atua no Contencioso Cível Empresarial, dedicando-se às áreas de Direito Contratual, Direito do Consumidor e Recuperação de Crédito. Possui experiência na condução de litígios empresariais, assessorando clientes na análise de demandas, elaboração de estratégias processuais e acompanhamento integral de processos judiciais, com enfoque na prevenção de riscos mediante análise criteriosa dos casos, implementação de procedimentos e desenvolvimento de soluções jurídicas voltadas à defesa dos interesses das empresas.",
  },
  {
    profileId: "76499bc5-a8d2-4987-bb9a-dfbdd7941014",
    displayName: "Daniela Lagoeiro dos Santos",
    role: "Estagiária de Direito",
    practiceArea: "Reestruturação e Insolvência",
    photoUrl:
      "https://qwihfvagemzlyypeohpc.supabase.co/storage/v1/object/public/MARKETING-SYSTEM-FOTOS/colaboradores/f483554e-d5e9-4edf-ac53-0615ab875504/1786326932489-daniela-lagoeiro.png",
    tagline:
      "Graduada em Direito pela Universidade São Francisco. Advogada inscrita na OAB/SP, com atuação voltada ao contencioso cível.",
    bio:
      "Graduada em Direito pela Universidade São Francisco. Advogada inscrita na OAB/SP, com atuação voltada ao contencioso cível. Possui experiência na condução de demandas judiciais, elaboração de peças processuais, acompanhamento estratégico de processos, gestão de prazos e negociação de acordos judiciais e extrajudiciais. Atuou em escritórios de advocacia de diferentes portes e na Defensoria Pública do Estado de São Paulo, desenvolvendo sólida experiência na resolução de conflitos e no atendimento a clientes. Possui conhecimento dos sistemas PJe, e-SAJ, eproc e Projudi, com atuação pautada pela organização, comprometimento e busca por soluções jurídicas eficientes.",
  },
];

async function main() {
  for (const person of PEOPLE) {
    console.log(`\n=== ${person.displayName} ===`);

    await saveProfessionalProfile(
      person.profileId,
      {
        photoUrl: person.photoUrl,
        localizations: [
          {
            locale: "pt-BR",
            isApproved: true,
            displayName: person.displayName,
            role: person.role,
            practiceArea: person.practiceArea,
            tagline: person.tagline,
            bio: person.bio,
          },
        ],
      },
      ACTOR_ID
    );
    console.log("  perfil salvo");

    const detail = await getProfessionalProfileAdmin(person.profileId);
    const missing = listMissingPublishRequirements(detail);
    if (missing.length > 0) {
      console.log("  AINDA FALTA:", missing.join(", "), "— não publicado");
      continue;
    }

    await setProfessionalProfileStatus(person.profileId, "published", ACTOR_ID);
    console.log("  publicado");

    const alreadyHasCard = detail.cards.some((c) => c.label === person.displayName);
    if (!alreadyHasCard) {
      await createProfileCard(person.profileId, { label: person.displayName }, ACTOR_ID);
      console.log(`  cartão "${person.displayName}" criado`);
    } else {
      console.log("  já tinha cartão nomeado");
    }
  }
}

main().catch((err) => {
  console.error("ERRO:", err instanceof Error ? err.message : err);
  process.exit(1);
});
