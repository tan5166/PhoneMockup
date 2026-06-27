import Head from 'next/head';
import { JsonLd } from '@/components/JsonLd';
import type { PageSeo } from '@/lib/seo';

interface SeoProps extends PageSeo {
  /** Optional schema.org structured data injected as a JSON-LD script. */
  structuredData?: Record<string, unknown>;
}

/**
 * Renders the standard page <head> SEO tags (title, description, Open Graph,
 * Twitter card) plus an optional JSON-LD block, so pages don't repeat the
 * boilerplate. og/twitter values are derived from `title`/`description`.
 */
export function Seo({ title, description, keywords, structuredData }: SeoProps) {
  return (
    <>
      <Head>
        <title>{title}</title>
        <meta name="description" content={description} />
        {keywords && <meta name="keywords" content={keywords} />}
        <meta name="language" content="en" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={title} />
        <meta name="twitter:description" content={description} />
        <meta name="robots" content="index, follow" />
        <meta name="author" content="Phone Mockup" />
      </Head>
      {structuredData && <JsonLd data={structuredData} />}
    </>
  );
}
