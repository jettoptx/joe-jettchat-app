import { redirect } from "next/navigation";

/**
 * /chat — legacy alias, redirects to /spacecowboys (the canonical JettChat
 * app home). Kept so internal links / bookmarks pointing at /chat don't 404.
 * Individual threads still live at /chat/[id].
 */
export default function ChatIndexPage() {
  redirect("/spacecowboys");
}
