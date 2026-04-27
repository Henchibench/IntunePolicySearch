/**
 * Editorial footer for the unauthenticated landing.
 * Dark warm-black surface (ink in light theme, deeper in dark), four short
 * link columns, large conversational headline. Per spec "Index".
 */
export function Footer() {
  return (
    <footer className="mt-24 bg-ink text-canvas">
      <div className="mx-auto max-w-[1240px] px-8 py-16">
        <h2 className="max-w-[14ch] text-[44px] font-medium leading-[1.05] tracking-tight2">
          Built for IT teams who don't have all day.
        </h2>

        <div className="mt-12 grid grid-cols-2 gap-8 md:grid-cols-4">
          {[
            { title: "PRODUCT", links: ["Policies", "Dashboard", "Compliance"] },
            { title: "RESOURCES", links: ["Workplace Ninja Summit", "Microsoft Graph", "Intune docs"] },
            { title: "ABOUT", links: ["Source", "Changelog"] },
            { title: "LEGAL", links: ["Privacy", "Terms"] },
          ].map((col) => (
            <div key={col.title}>
              <div className="text-[12px] font-bold tracking-eyebrow text-canvas/60">
                {col.title}
              </div>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((l) => (
                  <li key={l}>
                    <a className="text-[14px] font-[450] text-canvas/85 hover:text-canvas">
                      {l}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <p className="mt-16 text-[12px] text-canvas/50">
          © Intune Policy Search · Workplace Ninja Summit 2025
        </p>
      </div>
    </footer>
  );
}
