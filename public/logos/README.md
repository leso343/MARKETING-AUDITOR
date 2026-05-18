# Logo Drop-In Guide

Place logo files here to brand the dashboard and report automatically.
No code changes needed — the system detects files on every request.

## Agency Logo (shown in sidebar top + report header)

Drop any of these files here:
  public/logos/agency.svg
  public/logos/agency.png
  public/logos/agency.jpg
  public/logos/agency.webp

If no file is found, the styled SNA FORENSIC text logo is used as fallback.

## Client Logo (shown in sidebar bottom + dashboard header)

Drop a logo file into the client's CSV folder:
  public/csvs/[client-slug]/logo.svg
  public/csvs/[client-slug]/logo.png
  public/csvs/[client-slug]/logo.jpg
  public/csvs/[client-slug]/logo.webp

If no file is found, the client name text is used as fallback.

## Client Config (name, subtitle, industry benchmark)

Create public/csvs/[client-slug]/client.json:

  {
    "displayName": "Your Client Name",
    "subtitle": "Industry · City",
    "industry": "roofing"
  }

Available industry values: roofing, hvac, plumbing, dental, legal, ecommerce

## Adding a New Client

1. Create folder:  public/csvs/[client-slug]/
2. Drop CSV exports in that folder
3. Add client.json with name + subtitle
4. Optionally drop logo.png for client branding
5. Visit: /audit/[client-slug]
