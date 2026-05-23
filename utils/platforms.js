export const platforms = [
  { key: 'SGXMeta', label: 'SGXMeta', url: 'https://sgxmeta.ai/' },
  { key: 'SGGold', label: 'SGGold', url: 'https://sggold.sgxmeta.ai/' },
  { key: 'SGBN', label: 'SGBN', url: 'https://sgxmeta.ai/sgbn' },
  { key: 'SGSE', label: 'SGSE', url: 'https://sgxmeta.ai/sgse' },
  { key: 'SGChain', label: 'SGChain', url: 'https://sgchain.sgxmeta.ai/' },
  { key: 'SG5Trader', label: 'SG5Trader', url: 'https://sg5trader.sgxmeta.ai/' }
];

export function platformKeys() {
  return platforms.map((platform) => platform.key);
}
