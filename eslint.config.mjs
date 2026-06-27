import nextCoreWebVitals from 'eslint-config-next/core-web-vitals'

const eslintConfig = [
  ...nextCoreWebVitals,
  {
    ignores: ['out/**', '.next/**', 'node_modules/**', 'next-env.d.ts'],
  },
]

export default eslintConfig
