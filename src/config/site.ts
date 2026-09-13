export const SITE_URL = 'https://disquiet.dev'; // Placeholder unless it's available

export const SITE_NAME = 'Disquiet';
export const SITE_DESCRIPTION =
  'Developer portfolio - case studies, and eventually music and visual art.';

export const CONTACT_EMAIL = 'hello@disquiet.dev'; // Placeholder

export const GOATCOUNTER_ENDPOINT = 'https://disquiet.goatcounter.com/count'; // Placeholder

export interface NavItem {
  label: string;
  href: string;
  enabled: boolean;
}

export const NAV: NavItem[] = [
  { label: 'Work', href: '/work', enabled: true },
  { label: 'Writing', href: '/writing', enabled: false },
  { label: 'Music', href: '/music', enabled: false },
  { label: 'Art', href: '/art', enabled: false },
  { label: 'About', href: '/about', enabled: true },
];
