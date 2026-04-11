/**
 * IPFS upload via Pinata API.
 * Receipt images are pinned to IPFS so the content hash can be stored
 * on-chain permanently (tamper-proof archive).
 *
 * TODO:
 * - Set PINATA_API_KEY and PINATA_SECRET_KEY in .env
 * - Handle large files (stream upload)
 */

const PINATA_BASE = "https://api.pinata.cloud";

export async function pinFile(fileBuffer: Buffer, filename: string): Promise<string> {
  const apiKey = process.env.PINATA_API_KEY;
  const secret = process.env.PINATA_SECRET_KEY;
  if (!apiKey || !secret) throw new Error("PINATA_API_KEY / PINATA_SECRET_KEY not set");

  const formData = new FormData();
  const blob = new Blob([fileBuffer]);
  formData.append("file", blob, filename);
  formData.append("pinataMetadata", JSON.stringify({ name: filename }));

  const res = await fetch(`${PINATA_BASE}/pinning/pinFileToIPFS`, {
    method: "POST",
    headers: { pinata_api_key: apiKey, pinata_secret_api_key: secret },
    body: formData,
  });
  if (!res.ok) throw new Error(`Pinata error: ${await res.text()}`);
  const data = await res.json() as { IpfsHash: string };
  return data.IpfsHash; // CID
}
