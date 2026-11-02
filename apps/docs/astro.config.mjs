// @ts-check
import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";

// Warden's documentation, built to static files (dist/) and served at docs.trywarden.xyz.
export default defineConfig({
  site: "https://docs.trywarden.xyz",
  integrations: [
    starlight({
      title: "Warden",
      description: "Documentation for Warden: push-to-deploy, health-checked releases and rollback on servers you own.",
      logo: { src: "./src/assets/warden-mark.svg", replacesTitle: false },
      favicon: "/favicon.svg",
      customCss: ["./src/styles/warden.css"],
      social: [{ icon: "github", label: "GitHub", href: "https://github.com/oluwatobicode/Warden-vps-managment-dashboard" }],
      editLink: { baseUrl: "https://github.com/oluwatobicode/Warden-vps-managment-dashboard/edit/main/apps/docs/" },
      lastUpdated: true,
      head: [
        { tag: "meta", attrs: { property: "og:image", content: "https://docs.trywarden.xyz/warden-og.jpg" } },
        { tag: "meta", attrs: { property: "og:image:width", content: "1200" } },
        { tag: "meta", attrs: { property: "og:image:height", content: "630" } },
        { tag: "meta", attrs: { name: "twitter:card", content: "summary_large_image" } },
        { tag: "meta", attrs: { name: "twitter:image", content: "https://docs.trywarden.xyz/warden-og.jpg" } },
        { tag: "link", attrs: { rel: "preconnect", href: "https://fonts.googleapis.com" } },
        { tag: "link", attrs: { rel: "preconnect", href: "https://fonts.gstatic.com", crossorigin: "" } },
        {
          tag: "link",
          attrs: {
            rel: "stylesheet",
            href: "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap",
          },
        },
      ],
      sidebar: [
        { label: "Getting started", items: ["introduction", "quick-start", "how-it-works"] },
        { label: "Servers", items: [{ autogenerate: { directory: "servers" } }] },
        { label: "Deploying apps", items: [{ autogenerate: { directory: "deploying" } }] },
        "variables",
        { label: "Databases", items: [{ autogenerate: { directory: "databases" } }] },
        "logs",
        { label: "Team", items: [{ autogenerate: { directory: "team" } }] },
        "api-tokens",
        "notifications",
        { label: "Self-hosting Warden", items: [{ autogenerate: { directory: "self-hosting" } }] },
        { label: "Reference", items: ["security", "troubleshooting"] },
      ],
    }),
  ],
});
