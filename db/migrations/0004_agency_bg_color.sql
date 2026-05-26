-- Agencies can now pick their dashboard background color. Card, border,
-- sidebar, and text contrast are derived from this in BrandTheme.tsx.

ALTER TABLE `agencies` ADD COLUMN `bg_color` text;
