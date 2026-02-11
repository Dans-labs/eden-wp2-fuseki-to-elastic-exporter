import { TestBed } from '@suites/unit';
import { ExportController } from './export.controller';
import { ReindexService } from '../reindex/reindex.service';

describe('ExportController', () => {
  let controller: ExportController;
  let reindexService: ReindexService;

  beforeEach(async () => {
    const { unit, unitRef } =
      await TestBed.solitary(ExportController).compile();

    controller = unit;
    reindexService = unitRef.get(ReindexService) as unknown as ReindexService;
  });

  describe('triggerExport', () => {
    it('should call reindexAll and return a success message', async () => {
      (reindexService.reindexAll as jest.Mock).mockResolvedValueOnce(undefined);

      const result = await controller.triggerExport();

      expect(reindexService.reindexAll).toHaveBeenCalled();
      expect(result).toEqual({ message: 'Reindex completed successfully' });
    });

    it('should propagate errors from reindexAll', async () => {
      (reindexService.reindexAll as jest.Mock).mockRejectedValueOnce(
        new Error('Fuseki is down'),
      );

      await expect(controller.triggerExport()).rejects.toThrow(
        'Fuseki is down',
      );
    });
  });
});
