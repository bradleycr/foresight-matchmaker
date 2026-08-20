import { redirect } from "next/navigation"

export const dynamic = "force-dynamic"

/** Contacts tab retired — introductions are email / LinkedIn clicks on listings. */
export default function InboxPage() {
  redirect("/me/matches")
}
