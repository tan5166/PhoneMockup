import { NextPage } from 'next';
import Head from 'next/head';
import { Footer } from '@/components/layout/Footer';
import { Header } from '@/components/layout/Header';
import { ExternalLink, Github } from 'lucide-react';

const LicensePage: NextPage = () => {
  return (
    <>
      <Head>
        <title>License - Phone Mockup</title>
        <meta
          name="description"
          content="MIT License — Phone Mockup is modified from iHou's PhoneMockup project."
        />
      </Head>

      <div className="min-h-screen bg-gray-50 flex flex-col">
        <Header />

        <main className="flex-1 max-w-3xl mx-auto px-4 sm:px-6 py-16 w-full">
          <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-8 md:p-12">
            {/* Attribution */}
            <div className="mb-10 p-6 bg-amber-50 border border-amber-200 rounded-xl">
              <h2 className="text-lg font-semibold text-amber-800 mb-3">
                Modified from iHou&apos;s PhoneMockup
              </h2>
              <p className="text-amber-700 text-sm leading-relaxed mb-4">
                This project is a modified version based on the original work by{' '}
                <strong>iHou</strong>. We are grateful for the open-source
                contribution that made this project possible.
              </p>
              <a
                href="https://github.com/ihou/PhoneMockup"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 bg-amber-100 hover:bg-amber-200 text-amber-800 rounded-lg text-sm font-medium transition-colors"
              >
                <Github className="w-4 h-4" />
                View Original Repository
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            {/* MIT License — from iHou/PhoneMockup */}
            <h1 className="text-2xl font-bold text-[#1c1f23] mb-6">MIT License</h1>

            <div className="prose prose-sm max-w-none text-gray-700 space-y-4">
              <p>
                <strong>Copyright (c) 2025 iHou</strong>
              </p>

              <p>
                Permission is hereby granted, free of charge, to any person obtaining a copy
                of this software and associated documentation files (the &ldquo;Software&rdquo;), to deal
                in the Software without restriction, including without limitation the rights
                to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
                copies of the Software, and to permit persons to whom the Software is
                furnished to do so, subject to the following conditions:
              </p>

              <p>
                The above copyright notice and this permission notice shall be included in all
                copies or substantial portions of the Software.
              </p>

              <p>
                THE SOFTWARE IS PROVIDED &ldquo;AS IS&rdquo;, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
                IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
                FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
                AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
                LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
                OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
                SOFTWARE.
              </p>
            </div>
          </div>
        </main>

        <Footer />
      </div>
    </>
  );
};

export default LicensePage;
