import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Route su cui un utente già autenticato viene rimandato indietro
// (non ha senso restare su login/registrazione se si è già loggati).
const ROUTE_PUBBLICHE = ["/login", "/registrazione", "/recupera-password"];

// Route raggiungibili anche senza essere autenticati. "/" è la pagina di
// presentazione pubblica: un utente loggato che la visita non viene
// forzato altrove da qui, ci pensa la pagina stessa (redirect in base al ruolo).
// "/reimposta-password" NON va in ROUTE_PUBBLICHE: il link dall'email porta i
// token di recupero nel frammento dell'URL, invisibile al server, quindi la
// prima richiesta arriva qui senza sessione (va tollerata) ma una volta che
// il client stabilisce la sessione di recupero l'utente risulta "loggato" e
// non va rimandato altrove, altrimenti non potrebbe mai completare il form.
const ROUTE_ACCESSIBILI_SENZA_LOGIN = [
  "/",
  "/reimposta-password",
  "/privacy",
  "/cookie",
  "/termini",
  ...ROUTE_PUBBLICHE,
];

// Prefissi raggiungibili senza login perché indirizzati a persone che non
// hanno (e non devono avere) un account: "/firma-verbale/<token>" è il
// collegamento personale inviato per email a presidente e segretario per
// confermare il verbale. Il token nell'URL identifica il destinatario, ma da
// solo non conferma nulla: serve il codice usa-e-getta spedito a parte.
const PREFISSI_ACCESSIBILI_SENZA_LOGIN = ["/firma-verbale/"];

export default async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Necessario per rinfrescare il token di sessione scaduto: non rimuovere.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isRoutePubblica = ROUTE_PUBBLICHE.includes(pathname);
  const isAccessibileSenzaLogin =
    ROUTE_ACCESSIBILI_SENZA_LOGIN.includes(pathname) ||
    PREFISSI_ACCESSIBILI_SENZA_LOGIN.some((prefisso) => pathname.startsWith(prefisso));

  if (!user && !isAccessibileSenzaLogin) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && isRoutePubblica) {
    const url = request.nextUrl.clone();
    url.pathname = "/area-riservata";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
