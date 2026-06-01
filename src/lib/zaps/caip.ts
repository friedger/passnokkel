// CAIP-2 / CAIP-10 / CAIP-19 parsing for the chain-agnostic zaps PoC.
//
//   CAIP-2  chain      namespace ":" reference                 e.g. stacks:1, eip155:1
//   CAIP-10 account    chain ":" address                       e.g. stacks:1:SP… , eip155:1:0x…
//   CAIP-19 asset      chain "/" asset_namespace ":" asset_ref  e.g. eip155:1/erc20:0x…
//
// The CAIP-358 zaps draft uses a Stacks-specific CAIP-19 form that drops the
// `asset_namespace:` segment and appends the fully-qualified SIP-010 asset:
//
//   stacks:1/<contract-address>.<contract-name>.<asset-name>
//
// so the parser accepts both the standard `ns:ref` body and this dotted body.

export interface ChainId {
  /** e.g. "stacks", "eip155" */
  namespace: string;
  /** e.g. "1" */
  reference: string;
  /** The canonical "namespace:reference" string. */
  toString(): string;
}

export interface AccountId {
  chainId: ChainId;
  /** On-chain address (the CAIP-10 account_address segment). */
  address: string;
}

export interface AssetId {
  chainId: ChainId;
  /** Standard CAIP-19 asset namespace (e.g. "erc20"); undefined for the Stacks dotted form. */
  assetNamespace?: string;
  /** Standard CAIP-19 asset reference (e.g. the token contract for erc20). */
  assetReference?: string;
  /** Raw asset body after the chain "/" — always present. */
  body: string;
}

function makeChainId(namespace: string, reference: string): ChainId {
  return {
    namespace,
    reference,
    toString: () => `${namespace}:${reference}`,
  };
}

/** Parse a CAIP-2 chain id, or null if malformed. */
export function parseChainId(input: string): ChainId | null {
  const parts = input.split(':');
  if (parts.length !== 2) return null;
  const [namespace, reference] = parts;
  if (!namespace || !reference) return null;
  return makeChainId(namespace, reference);
}

/** Parse a CAIP-10 account id (`namespace:reference:address`), or null if malformed. */
export function parseAccountId(input: string): AccountId | null {
  const idx = input.lastIndexOf(':');
  if (idx <= 0) return null;
  const chainId = parseChainId(input.slice(0, idx));
  const address = input.slice(idx + 1);
  if (!chainId || !address) return null;
  return { chainId, address };
}

/** Parse a CAIP-19 asset id (`chain/body`), handling the Stacks dotted form, or null. */
export function parseAssetId(input: string): AssetId | null {
  const slash = input.indexOf('/');
  if (slash <= 0) return null;
  const chainId = parseChainId(input.slice(0, slash));
  const body = input.slice(slash + 1);
  if (!chainId || !body) return null;

  // Standard form: asset_namespace ":" asset_reference (e.g. erc20:0x…).
  const colon = body.indexOf(':');
  if (colon > 0) {
    return {
      chainId,
      assetNamespace: body.slice(0, colon),
      assetReference: body.slice(colon + 1),
      body,
    };
  }
  // Stacks dotted form (no asset_namespace).
  return { chainId, body };
}

/**
 * The trust-critical check from the spec: an `accept` tag's CAIP-19 asset must
 * live on the same chain as its CAIP-10 account. Mismatches are dropped before
 * an address is ever shown to a sender.
 */
export function chainsMatch(asset: AssetId, account: AccountId): boolean {
  return asset.chainId.toString() === account.chainId.toString();
}
