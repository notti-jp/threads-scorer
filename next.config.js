/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      // /tutorial（末尾なし）でも、はじめてガイドを開けるようにする
      { source: "/tutorial", destination: "/tutorial/index.html" },
    ];
  },
};
module.exports = nextConfig;
