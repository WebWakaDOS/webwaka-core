/**
 * CORE-10: Tenant Branding Schema
 * Blueprint Reference: WEBWAKA_UI_BUILDER_ARCHITECTURE.md — "Build Once Use Infinitely"
 *
 * Canonical branding schema for all WebWaka OS v4 tenants.
 * This interface is the single source of truth for tenant visual identity
 * across all verticals: Commerce, Professional, Civic, Transport, etc.
 *
 * Replaces the local StorefrontBranding in webwaka-commerce and the
 * theme object in webwaka-super-admin-v2.
 *
 * Stored in: UI_CONFIG_KV under key `branding:{tenantId}`
 * Consumed by: webwaka-ui-builder, webwaka-commerce, webwaka-super-admin-v2
 */

// ─── Color Palette ────────────────────────────────────────────────────────────

/**
 * Tenant colour palette. All values MUST be valid CSS colour strings
 * (hex, rgb, hsl, or named colours).
 */
export interface TenantColorPalette {
  /** Primary brand colour — used for CTAs, active states, links */
  primary: string;
  /** Secondary brand colour — used for secondary actions and highlights */
  secondary: string;
  /** Accent colour — used for badges, tags, and decorative elements */
  accent: string;
  /** Page/surface background colour */
  background: string;
  /** Primary text colour */
  text: string;
  /** Muted/secondary text colour */
  textMuted?: string;
  /** Border and divider colour */
  border?: string;
  /** Success state colour */
  success?: string;
  /** Warning state colour */
  warning?: string;
  /** Error/danger state colour */
  error?: string;
}

// ─── Typography ───────────────────────────────────────────────────────────────

/**
 * Tenant typography configuration.
 * Font names should be valid Google Fonts names or system font stack names.
 */
export interface TenantTypography {
  /** Font family for headings (h1–h6) */
  headingFont: string;
  /** Font family for body text and paragraphs */
  bodyFont: string;
  /** Base font size in px (default: 16) */
  baseFontSizePx?: number;
  /** Base line height (default: 1.5) */
  baseLineHeight?: number;
}

// ─── Assets ───────────────────────────────────────────────────────────────────

/**
 * Tenant asset URLs. All values MUST be absolute HTTPS URLs or
 * Cloudflare R2 public URLs.
 */
export interface TenantAssets {
  /** Primary logo URL (SVG or PNG, min 200×60px recommended) */
  logoUrl: string;
  /** Favicon URL (ICO, PNG, or SVG, 32×32px recommended) */
  faviconUrl: string;
  /** Hero/banner image URL for storefront/landing pages (optional) */
  heroImageUrl?: string;
  /** Open Graph / social share image URL (optional, 1200×630px recommended) */
  ogImageUrl?: string;
  /** App icon URL for PWA manifest (optional, 512×512px recommended) */
  appIconUrl?: string;
}

// ─── Layout ───────────────────────────────────────────────────────────────────

/**
 * Navigation bar style options.
 */
export type NavigationStyle = 'top-bar' | 'side-drawer' | 'bottom-tab' | 'hybrid';

/**
 * Footer style options.
 */
export type FooterStyle = 'minimal' | 'standard' | 'extended' | 'none';

/**
 * Layout configuration for the tenant's deployed sites and dashboards.
 */
export interface TenantLayout {
  /** Navigation bar style */
  navigationStyle: NavigationStyle;
  /** Footer style */
  footerStyle: FooterStyle;
  /** Whether to show the tenant's name in the navigation bar */
  showTenantNameInNav?: boolean;
  /** Maximum content width in px (default: 1280) */
  maxContentWidthPx?: number;
  /** Border radius scale: 'none' | 'sm' | 'md' | 'lg' | 'full' */
  borderRadius?: 'none' | 'sm' | 'md' | 'lg' | 'full';
}

// ─── SEO ─────────────────────────────────────────────────────────────────────

/**
 * SEO and metadata configuration for the tenant's deployed sites.
 */
export interface TenantSEO {
  /** Site title (used in <title> and OG tags) */
  siteTitle: string;
  /** Site description (used in meta description and OG tags) */
  siteDescription?: string;
  /** Primary locale (e.g., 'en-NG', 'en-GH', 'fr-SN') */
  locale?: string;
  /** Twitter/X handle (without @) */
  twitterHandle?: string;
}

// ─── Root Schema ─────────────────────────────────────────────────────────────

/**
 * TenantBrandingSchema — Canonical branding configuration for a WebWaka tenant.
 *
 * This is the governance-mandated interface for all tenant visual identity.
 * It MUST be used by all verticals instead of local branding interfaces.
 *
 * @example
 * const branding: TenantBrandingSchema = {
 *   tenantId: 'tenant_abc123',
 *   colors: { primary: '#E85D04', secondary: '#F48C06', accent: '#FAA307',
 *             background: '#FFFFFF', text: '#1A1A1A' },
 *   typography: { headingFont: 'Inter', bodyFont: 'Inter' },
 *   assets: { logoUrl: 'https://r2.webwaka.io/tenants/abc123/logo.svg',
 *             faviconUrl: 'https://r2.webwaka.io/tenants/abc123/favicon.ico' },
 *   layout: { navigationStyle: 'top-bar', footerStyle: 'standard' },
 *   seo: { siteTitle: 'Ade Electronics Store' },
 * };
 */
export interface TenantBrandingSchema {
  /** The tenant this branding configuration belongs to */
  tenantId: string;
  /** Colour palette */
  colors: TenantColorPalette;
  /** Typography configuration */
  typography: TenantTypography;
  /** Asset URLs (logo, favicon, hero image, etc.) */
  assets: TenantAssets;
  /** Layout and navigation configuration */
  layout: TenantLayout;
  /** SEO and metadata configuration */
  seo?: TenantSEO;
  /** ISO 8601 timestamp of when this branding config was last updated */
  updatedAt?: string;
  /** The version of this branding schema (for cache-busting) */
  version?: number;
}

// ─── KV Helpers ──────────────────────────────────────────────────────────────

/**
 * Returns the KV key for a tenant's branding configuration.
 * Used by webwaka-ui-builder (writer) and all verticals (readers).
 *
 * @param tenantId  The tenant identifier
 */
export function brandingKvKey(tenantId: string): string {
  return `branding:${tenantId}`;
}

/**
 * Default branding configuration used as a fallback when a tenant has not
 * yet configured their branding. Uses WebWaka platform brand colours.
 */
export const DEFAULT_BRANDING: Omit<TenantBrandingSchema, 'tenantId'> = {
  colors: {
    primary: '#2563EB',
    secondary: '#7C3AED',
    accent: '#F59E0B',
    background: '#FFFFFF',
    text: '#111827',
    textMuted: '#6B7280',
    border: '#E5E7EB',
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
  },
  typography: {
    headingFont: 'Inter',
    bodyFont: 'Inter',
    baseFontSizePx: 16,
    baseLineHeight: 1.5,
  },
  assets: {
    logoUrl: 'https://assets.webwaka.io/brand/logo.svg',
    faviconUrl: 'https://assets.webwaka.io/brand/favicon.ico',
  },
  layout: {
    navigationStyle: 'top-bar',
    footerStyle: 'standard',
    showTenantNameInNav: true,
    maxContentWidthPx: 1280,
    borderRadius: 'md',
  },
  seo: {
    siteTitle: 'WebWaka',
    locale: 'en-NG',
  },
  version: 1,
};
