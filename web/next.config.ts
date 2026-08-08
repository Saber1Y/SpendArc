import type {NextConfig} from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    // Let webpack resolve the byte-identical vendored signer files, whose imports use `.js`
    // specifiers pointing at `.ts` sources (try .js first so node_modules is unaffected).
    config.resolve.extensionAlias = {
      ".js": [".js", ".ts"],
      ".jsx": [".jsx", ".tsx"],
      ".mjs": [".mjs", ".mts"],
    };
    // These optional peer deps of @privy-io/react-auth and @metamask/sdk are
    // statically resolved by webpack but unused here (Farcaster mini-app,
    // React Native). Alias to an empty shim so the bundle builds.
    config.resolve.alias = {
      ...(config.resolve.alias ?? {}),
      "@farcaster/mini-app-solana": require.resolve("./lib/empty-module.js"),
      "@react-native-async-storage/async-storage": require.resolve("./lib/empty-module.js"),
    };
    return config;
  },
};

export default nextConfig;
