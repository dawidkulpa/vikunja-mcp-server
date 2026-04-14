import { readFile, writeFile, stat } from 'fs/promises';
import { basename } from 'path';

export async function readFileBuffer(filePath: string): Promise<Buffer> {
  return readFile(filePath);
}

export async function writeFileBuffer(filePath: string, buffer: Buffer): Promise<void> {
  return writeFile(filePath, buffer);
}

export async function getFileStats(filePath: string): Promise<{ size: number; name: string }> {
  const stats = await stat(filePath);
  return { size: stats.size, name: basename(filePath) };
}
