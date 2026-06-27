/** SEO metadata shared across pages. */
export interface PageSeo {
  title: string;
  description: string;
  keywords?: string;
}

/** SEO copy for the Phone Mockup generator pages (home + tool). */
export const mockupSeo: PageSeo = {
  title: 'Phone Mockup Generator | Free 3D Mobile Device Mockups',
  description:
    'Create stunning 3D Phone mockups for your app screenshots. Our free Phone Mockup tool is perfect for marketing materials, App Store listings, and presentations.',
  keywords:
    'phone mockup, mobile mockup, 3D mockup tool, app screenshot generator, ios mockup creator, android mockup, free mockup generator, phone frame, device mockup',
};

/** schema.org SoftwareApplication structured data for the mockup generator. */
export const mockupStructuredData = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Phone Mockup Generator',
  applicationCategory: 'UtilitiesApplication',
  operatingSystem: 'Any',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
    availability: 'http://schema.org/InStock',
  },
  description:
    'Create stunning 3D Phone mockups for your app screenshots. Perfect for App Store listings, marketing materials, and presentations.',
  featureList: [
    'Interactive 3D preview',
    'Multiple device frames',
    'High-quality rendering',
    'Easy screenshot upload',
    'Instant preview',
    'Free to use',
    'No watermarks',
  ],
  applicationSubCategory: 'Design Tools',
  softwareVersion: '1.0',
  inLanguage: 'en',
};
