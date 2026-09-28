import "dotenv/config";
import {
  getProfessionalProfileAdmin,
  listMissingPublishRequirements,
  setProfessionalProfileStatus,
} from "../src/lib/profiles/admin";
import { createProfileCard } from "../src/lib/profiles/cards";

const actorId = "2f08c695-770e-47ce-b4e4-ce27fa414df8";
const profileId = "54dcbf9b-3147-487b-b8e0-088cdb6ddb8f";
const displayName = "Cristiana Pereira da Costa";

const before = await getProfessionalProfileAdmin(profileId);
const missing = listMissingPublishRequirements(before);
if (missing.length > 0) {
  throw new Error(`Perfil ainda incompleto: ${missing.join(", ")}`);
}

let publishedNow = false;
if (before.status !== "published") {
  await setProfessionalProfileStatus(profileId, "published", actorId);
  publishedNow = true;
}

const refreshed = await getProfessionalProfileAdmin(profileId);
let cardCreated = false;
if (!refreshed.cards.some((card) => card.label === displayName)) {
  await createProfileCard(profileId, { label: displayName }, actorId);
  cardCreated = true;
}

console.log(
  JSON.stringify(
    {
      profileId,
      publishedNow,
      cardCreated,
      missingRequirements: missing,
    },
    null,
    2,
  ),
);
