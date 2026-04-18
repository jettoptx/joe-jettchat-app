import { redirect } from 'next/navigation'

// Default landing for authenticated users. Unauthenticated traffic is bounced
// to /login by middleware before reaching this server component, so we can
// safely send everyone to /spacecowboys (the JettChat app home).
//
// Previously redirected to /gensys (browser gaze sim — archived under
// /archive/gensys), then briefly to /chat (which had no index page).
export default function HomePage() {
  redirect('/spacecowboys')
}
