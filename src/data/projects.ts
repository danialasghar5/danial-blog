export interface Project {
  title: string;
  description: string;
  tech: string[];
  link?: string;
  featured: boolean;
}

export const projects: Project[] = [
  {
    title: "CovetPics",
    description: "Surfaces customer photos, Instagram feeds, and shoppable galleries on Shopify storefronts, serving millions of page views monthly.",
    tech: ["Ruby on Rails", "Shopify API", "React", "AWS"],
    link: "https://covet.pics",
    featured: true,
  },
  {
    title: "Jumpstart Pro Custom Extensions",
    description: "Production Ruby on Rails SaaS starter extensions including multi-tenant billing tweaks and robust OAuth hooks.",
    tech: ["Ruby on Rails", "Stripe API", "Tailwind CSS", "Hotwire"],
    link: "https://github.com/withastro/astro", // Fallback link
    featured: true,
  },
  {
    title: "Interstride Job Board Integration",
    description: "Scalable background integration system connecting university career services with student visa job opportunities.",
    tech: ["Ruby on Rails", "PostgreSQL", "Redis", "AWS SQS"],
    featured: true,
  },
  {
    title: "Astro Premium Developer Theme",
    description: "A fast, minimalist personal portfolio and developer blog template designed with accessibility and performance in mind.",
    tech: ["Astro", "TypeScript", "CSS Variables", "HTML5"],
    link: "https://github.com/withastro/astro",
    featured: false,
  },
  {
    title: "Shopify Custom Checkout Extension",
    description: "Custom UI widget for Shopify Plus checkouts enabling post-purchase upsells and analytics tracking.",
    tech: ["JavaScript", "Shopify Functions", "GraphQL"],
    featured: false,
  }
];
