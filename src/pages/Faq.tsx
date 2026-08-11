import { motion } from "framer-motion";
import { HelpCircle, Home } from "lucide-react";
import { Link } from "react-router";

const FAQS: { q: string; a: string }[] = [
  {
    q: "Do I need an account or sign-in?",
    a: "No. Terra-Core is a client-side app — open the console instantly, no account, no email, no tracking. Your watchlist is saved in your own browser's local storage.",
  },
  {
    q: "Is the data actually live?",
    a: "Yes — every layer pulls from a real public feed in real time: OpenSky ADS-B aircraft, USGS earthquakes, Open-Meteo weather, NOAA space weather and aurora, RainViewer radar, iptv-org TV, and the world news wire. The status bar at the bottom shows each feed's health.",
  },
  {
    q: "Why does a feed sometimes show offline?",
    a: "Public APIs occasionally rate-limit or go down (OpenSky, for example, throttles anonymous clients). The app keeps the last good snapshot and retries on its poll cycle — most feeds recover on their own.",
  },
  {
    q: "Why won't some TV channels play?",
    a: "Broadcast streams are frequently geo-blocked or offline. The console auto-advances to the next working source, and the reference feeds at the bottom of the TV panel always play.",
  },
  {
    q: "Can I install Terra-Core like an app?",
    a: "Yes — it's a PWA. On desktop, use the install icon in the address bar; on mobile, 'Add to Home Screen'. It opens fullscreen with its own icon, and the app shell works offline.",
  },
  {
    q: "Do I need an API key for anything?",
    a: "No — everything works out of the box. Optionally, adding a NEWS_API_KEY (in Vercel → Settings → Environment Variables) upgrades the news feed to the keyed GNews API; without it, the public Google News fallback keeps working.",
  },
  {
    q: "Where is my watchlist stored?",
    a: "In your browser's local storage — it never leaves your device. It persists across reloads and visits, but is not synced between devices or browsers.",
  },
  {
    q: "Who built Terra-Core?",
    a: "Terra-Core is an extension of Core-X (Global Watch), the real-time 3D-globe world monitoring system by Samuel Mensah (github.com/alpha-1-design). Core-X aggregated USGS earthquakes, Reddit, Hacker News and GDELT events over a Python + WebSocket pipeline; Terra-Core evolves that mission to run 100% in the browser — no server to host — with an expanded feed suite and a free public-data backbone. Both are MIT-licensed, part of the Alpha-1 ecosystem.",
  },
];

function Qa({ q, a, index }: { q: string; a: string; index: number }) {
  return (
    <motion.details
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.04 }}
      className="group border-2 border-ink bg-chalk shadow-[4px_4px_0_0_#141414] open:bg-volt/10"
    >
      <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center border-2 border-ink bg-ink font-mono text-xs font-bold text-paper">
          {String(index + 1).padStart(2, "0")}
        </span>
        <span className="flex-1 font-sans text-sm font-bold uppercase tracking-tight">
          {q}
        </span>
        <span className="font-mono text-lg font-bold text-signal transition-transform duration-200 group-open:rotate-45">
          +
        </span>
      </summary>
      <p className="border-t-2 border-ink px-4 py-3 pl-15 text-sm leading-relaxed text-ink-soft">
        {a}
      </p>
    </motion.details>
  );
}

export default function Faq() {
  return (
    <div className="min-h-screen bg-paper">
      <header className="flex items-center justify-between border-b-2 border-ink bg-chalk px-4 py-3 lg:px-8">
        <Link to="/" className="flex items-center gap-2">
          <span className="flex h-10 w-10 items-center justify-center border-2 border-ink bg-volt font-mono text-sm font-bold shadow-[3px_3px_0_0_#141414]">
            TC
          </span>
          <div className="leading-tight">
            <span className="block font-sans text-base font-bold uppercase tracking-tight">
              Terra-Core
            </span>
            <span className="nb-label">Global Monitoring Command</span>
          </div>
        </Link>
        <nav className="flex items-center gap-2 sm:gap-3">
          <Link
            to="/"
            className="hidden border-2 border-ink bg-chalk px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-widest transition-colors hover:bg-volt/30 sm:block"
          >
            <span className="flex items-center gap-1.5">
              <Home className="size-3" /> Home
            </span>
          </Link>
          <Link
            to="/docs"
            className="hidden border-2 border-ink bg-chalk px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-widest transition-colors hover:bg-volt/30 sm:block"
          >
            Docs
          </Link>
          <Link
            to="/dashboard"
            className="border-2 border-ink bg-ink px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-widest text-paper shadow-[3px_3px_0_0_#ffd400] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none"
          >
            Launch Console
          </Link>
        </nav>
      </header>

      {/* Hero */}
      <section className="border-b-2 border-ink bg-grid">
        <div className="mx-auto max-w-3xl px-4 py-12 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <div className="inline-flex items-center gap-2 border-2 border-ink bg-chalk px-2 py-1 shadow-[3px_3px_0_0_#141414]">
              <HelpCircle className="size-3.5 text-signal" />
              <span className="nb-label-ink">// FAQ</span>
            </div>
            <h1 className="mt-5 font-sans text-4xl font-bold uppercase leading-[0.95] tracking-tight sm:text-5xl">
              Mission Briefing
            </h1>
            <p className="mt-4 max-w-xl font-sans text-base leading-relaxed text-ink-soft">
              The questions every operator asks — answered.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Q&A */}
      <section className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-10 lg:px-8">
        {FAQS.map((f, i) => (
          <Qa key={f.q} q={f.q} a={f.a} index={i} />
        ))}
      </section>

      {/* CTA */}
      <section className="border-t-2 border-ink bg-ink">
        <div className="mx-auto max-w-3xl px-4 py-12 text-center lg:px-8">
          <h2 className="font-sans text-3xl font-bold uppercase tracking-tight text-paper">
            Still curious? <span className="text-volt">Read the manual.</span>
          </h2>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/docs"
              className="inline-flex items-center gap-2 border-2 border-ink bg-chalk px-6 py-3 font-mono text-xs font-bold uppercase tracking-widest shadow-[4px_4px_0_0_#141414] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none"
            >
              Open Documentation
            </Link>
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-2 border-2 border-ink bg-volt px-6 py-3 font-mono text-xs font-bold uppercase tracking-widest shadow-[4px_4px_0_0_#141414] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none"
            >
              Launch Console
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t-2 border-ink bg-chalk">
        <div className="mx-auto max-w-3xl px-4 py-6 text-center lg:px-8">
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Terra-Core © 2026 · Built by Samuel Mensah · extension of Core-X
            Global · github.com/alpha-1-design
          </span>
        </div>
      </footer>
    </div>
  );
}
