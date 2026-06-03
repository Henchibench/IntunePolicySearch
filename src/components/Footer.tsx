/**
 * Footer for the unauthenticated landing. Neutral Fluent surface with a top
 * border, four short link columns, and a calm heading.
 */
export function Footer() {
  return (
    <footer className="mt-24 border-t border-border bg-lifted text-muted-foreground">
      <div className="mx-auto max-w-[1280px] px-8 py-16">
        <h2 className="max-w-[24ch] text-[28px] font-semibold leading-[1.25] text-foreground">
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
              <div className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
                {col.title}
              </div>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((l) => (
                  <li key={l}>
                    <a className="text-[14px] text-muted-foreground hover:text-foreground">
                      {l}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <p className="mt-16 text-[12px] text-muted-foreground">
          © Intune Policy Search · Workplace Ninja Summit 2025
        </p>
      </div>
    </footer>
  );
}
