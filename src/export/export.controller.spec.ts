import { TestBed } from '@suites/unit';
import { ExportController } from './export.controller';
import { ExportService } from './export.service';

describe('ExportController', () => {
  let controller: ExportController;
  let exportService: ExportService;

  beforeEach(async () => {
    const { unit, unitRef } =
      await TestBed.solitary(ExportController).compile();

    controller = unit;
    exportService = unitRef.get(ExportService) as unknown as ExportService;
  });

  describe('triggerExport', () => {
    it('should call exportAll and return a success message', async () => {
      (exportService.exportAll as jest.Mock).mockResolvedValueOnce(undefined);

      const result = await controller.triggerExport();

      expect(exportService.exportAll).toHaveBeenCalled();
      expect(result).toEqual({ message: 'Export completed successfully' });
    });

    it('should propagate errors from exportAll', async () => {
      (exportService.exportAll as jest.Mock).mockRejectedValueOnce(
        new Error('Fuseki is down'),
      );

      await expect(controller.triggerExport()).rejects.toThrow(
        'Fuseki is down',
      );
    });
  });
});
