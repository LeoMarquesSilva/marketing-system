import { redirect } from "next/navigation";
import { FACILITIES_SUPPLIERS_PATH } from "@/lib/facilities/types";

export default function FacilitiesPage() {
  redirect(FACILITIES_SUPPLIERS_PATH);
}
