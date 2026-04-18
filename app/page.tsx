import { redirect } from 'next/navigation'

// Default landing for authenticated users. Unauthenticated traffic is bounced
// to /login by middleware before reaching this server component, so we can
// safely send everyone to /chat.
//
// Previously redirected to /gensys, which was a browser sim of gaze auth.
// Archived under /archive/gensys until real gaze auth ships on the mobile app.
export default function HomePage() {
  redirect('/chat')
}
