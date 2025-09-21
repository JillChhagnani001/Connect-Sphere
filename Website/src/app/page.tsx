import { redirect } from "next/navigation";

export default async function RootPage() {
  // Directly redirect to the feed for UI/UX review
  redirect('/feed');
}
