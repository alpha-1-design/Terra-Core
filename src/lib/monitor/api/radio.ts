export interface RadioStation {
  id: string;
  name: string;
  url: string;
  countryCode: string;
  tags: string;
  favicon: string | null;
  votes: number;
  clickCount: number;
  codec: string;
  bitrate: number;
}

export const RADIO_COUNTRIES: { code: string; name: string }[] = [
  { code: "us", name: "United States" },
  { code: "gb", name: "United Kingdom" },
  { code: "de", name: "Germany" },
  { code: "fr", name: "France" },
  { code: "es", name: "Spain" },
  { code: "it", name: "Italy" },
  { code: "pt", name: "Portugal" },
  { code: "nl", name: "Netherlands" },
  { code: "se", name: "Sweden" },
  { code: "no", name: "Norway" },
  { code: "dk", name: "Denmark" },
  { code: "fi", name: "Finland" },
  { code: "ie", name: "Ireland" },
  { code: "pl", name: "Poland" },
  { code: "cz", name: "Czechia" },
  { code: "gr", name: "Greece" },
  { code: "tr", name: "Türkiye" },
  { code: "in", name: "India" },
  { code: "jp", name: "Japan" },
  { code: "kr", name: "South Korea" },
  { code: "cn", name: "China" },
  { code: "br", name: "Brazil" },
  { code: "ar", name: "Argentina" },
  { code: "mx", name: "Mexico" },
  { code: "ca", name: "Canada" },
  { code: "au", name: "Australia" },
  { code: "nz", name: "New Zealand" },
  { code: "za", name: "South Africa" },
  { code: "eg", name: "Egypt" },
  { code: "ng", name: "Nigeria" },
  { code: "ru", name: "Russia" },
];

interface RadioBrowserStation {
  stationuuid: string;
  name: string;
  url_resolved: string;
  countrycode: string;
  tags: string;
  favicon: string;
  votes: number;
  clickcount: number;
  codec: string;
  bitrate: number;
  lastcheckok: number;
}

const API = "https://de1.api.radio-browser.info/json";

/** Top-voted, recently-verified stations for a country. */
export async function fetchRadioStations(
  countryCode: string,
  limit = 40,
): Promise<RadioStation[]> {
  const params = new URLSearchParams({
    order: "votes",
    reverse: "true",
    limit: String(limit),
    hidebroken: "true",
  });
  const res = await fetch(
    `${API}/stations/bycountrycode/${countryCode}?${params}`,
    { cache: "no-store" },
  );
  if (!res.ok) throw new Error(`radio-browser ${res.status}`);
  const rows = (await res.json()) as RadioBrowserStation[];
  return rows
    .filter((s) => s.lastcheckok === 1)
    .map((s) => ({
      id: s.stationuuid,
      name: s.name,
      url: s.url_resolved,
      countryCode: s.countrycode,
      tags: s.tags,
      favicon: s.favicon || null,
      votes: s.votes,
      clickCount: s.clickcount,
      codec: s.codec,
      bitrate: s.bitrate,
    }));
}
