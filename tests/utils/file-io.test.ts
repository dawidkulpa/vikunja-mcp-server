import { jest, describe, it, expect, beforeEach } from '@jest/globals';

// Mock fs/promises BEFORE importing the module under test
jest.mock('fs/promises');
import { readFile, writeFile, stat } from 'fs/promises';

import { readFileBuffer, writeFileBuffer, getFileStats } from '../../src/utils/file-io';

const mockedReadFile = readFile as jest.MockedFunction<typeof readFile>;
const mockedWriteFile = writeFile as jest.MockedFunction<typeof writeFile>;
const mockedStat = stat as jest.MockedFunction<typeof stat>;

describe('file-io utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('readFileBuffer', () => {
    it('returns a Buffer from the file contents', async () => {
      const buffer = Buffer.from('hello file');
      mockedReadFile.mockResolvedValue(buffer);

      const result = await readFileBuffer('/tmp/test.txt');

      expect(result).toEqual(buffer);
      expect(mockedReadFile).toHaveBeenCalledWith('/tmp/test.txt');
    });

    it('throws a meaningful error when file does not exist', async () => {
      const enoentError = Object.assign(new Error('ENOENT: no such file'), { code: 'ENOENT' });
      mockedReadFile.mockRejectedValue(enoentError);

      await expect(readFileBuffer('/tmp/missing.txt')).rejects.toThrow('ENOENT');
    });
  });

  describe('writeFileBuffer', () => {
    it('writes a Buffer to the given path', async () => {
      mockedWriteFile.mockResolvedValue(undefined);
      const buffer = Buffer.from('output data');

      await writeFileBuffer('/tmp/out.bin', buffer);

      expect(mockedWriteFile).toHaveBeenCalledWith('/tmp/out.bin', buffer);
    });

    it('propagates write errors', async () => {
      mockedWriteFile.mockRejectedValue(new Error('EACCES: permission denied'));

      await expect(writeFileBuffer('/etc/nope', Buffer.from(''))).rejects.toThrow('EACCES');
    });
  });

  describe('getFileStats', () => {
    it('returns size and name from file stats', async () => {
      mockedStat.mockResolvedValue({ size: 1234 } as import('fs').Stats);

      const result = await getFileStats('/tmp/report.pdf');

      expect(result).toEqual({ size: 1234, name: 'report.pdf' });
      expect(mockedStat).toHaveBeenCalledWith('/tmp/report.pdf');
    });

    it('throws when stat fails', async () => {
      mockedStat.mockRejectedValue(new Error('ENOENT: no such file'));

      await expect(getFileStats('/tmp/missing.pdf')).rejects.toThrow('ENOENT');
    });
  });
});
