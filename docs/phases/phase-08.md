# Phase 8 - Ultimate SEO, Performance, and Global Ranking

**Status:** Planned

## Overview
To rank locally (India) and globally on Google, we need a "Best of the Best" SEO strategy. This involves deep technical SEO (code-level optimization for Google's bots) and off-page manual SEO (authority building). 

## Part 1: Technical SEO (What I will code)

1. **Dynamic Meta Tags & OpenGraph**
   - Inject dynamic `<title>` and `<meta name="description">` on every single page.
   - Add **OpenGraph (OG)** and **Twitter Cards** so when users share `nor-vi.in` on Discord, WhatsApp, or Twitter, it generates a beautiful rich preview card with the logo and description.

2. **Sitemap & Robots.txt**
   - Install `@astrojs/sitemap` to auto-generate an XML sitemap of every page (Home, Agents, Legal, About).
   - Generate a strict `robots.txt` to tell Google exactly what to index (and what to hide, like `/account`).

3. **JSON-LD Structured Data (Rich Snippets)**
   - Add hidden `SoftwareApplication` and `Product` Schema.org JSON tags to the agent pages. This allows Google Search to show the Price (?999), Availability, and "Software" tags directly in the search results before the user even clicks the link!
   - Add `Organization` schema to the homepage to legitimize the business to Google.

4. **Performance & Core Web Vitals**
   - Ensure all images have explicit `width` and `height` to prevent Layout Shift.
   - Enable lazy-loading for off-screen images to ensure a 99+ Google Lighthouse score.

## Part 2: Manual Off-Page SEO (What YOU must do)

1. **Google Search Console (Crucial)**
   - Go to Google Search Console (GSC) and "Add Property" -> `https://nor-vi.in`.
   - Submit the `https://nor-vi.in/sitemap-index.xml` file we generate. This forces Google to crawl your site within 24-48 hours.

2. **Local SEO (Google Business Profile)**
   - Create a "Google My Business" profile using your registered address in Gwalior. This is the #1 way to rank locally in India for terms like "AI Agency in India".
   - Link it to your website. 

3. **High-Value Backlinks & Launch**
   - Google ranks websites based on "Authority" (how many other sites link to you).
   - Launch on **Product Hunt**, **Hacker News**, and **TheresAnAIForThat**.
   - Post case studies on Reddit (e.g., r/artificial, r/startups) linking back to the site.

4. **Content/Keyword Strategy (Future)**
   - The homepage alone isn't enough to rank for everything. Eventually, you will need to write specific landing pages or blog posts targeting exact searches, such as: "How to practice interviews with AI in 2026" (targeting Voro).
