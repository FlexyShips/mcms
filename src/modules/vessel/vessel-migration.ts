import * as XLSX from 'xlsx';
import { HttpError } from '../../utils/httpError.js';

export const vesselMigrationHeaders = [
  'name',
  'imo_number',
  'vessel_type',
  'flag_state',
  'gross_tonnage',
  'year_built',
  'status',
] as const;

export type VesselMigrationRow = {
  name: string;
  imoNumber?: string;
  vesselType: string;
  flagState: string;
  grossTonnage?: number;
  yearBuilt?: number;
  status: 'ACTIVE' | 'INACTIVE' | 'UNDER_REPAIR' | 'DECOMMISSIONED';
};

const statusValues = new Set<VesselMigrationRow['status']>([
  'ACTIVE',
  'INACTIVE',
  'UNDER_REPAIR',
  'DECOMMISSIONED',
]);

function cellString(value: unknown): string {
  return value === null || value === undefined ? '' : String(value).trim();
}

function cellNumber(value: unknown, field: string, rowNumber: number): number | undefined {
  const valueString = cellString(value);
  if (!valueString) return undefined;

  const parsed = Number(valueString);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new HttpError(400, `Invalid ${field} on row ${rowNumber}`, 'MIGRATION_VALIDATION_ERROR');
  }

  return parsed;
}

function normalizeHeader(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function valueForRow(row: Record<string, unknown>, expectedHeader: string): unknown {
  const expected = normalizeHeader(expectedHeader);
  const key = Object.keys(row).find((candidate) => normalizeHeader(candidate) === expected);
  return key ? row[key] : undefined;
}

export function parseVesselMigrationWorkbook(buffer: Buffer): VesselMigrationRow[] {
  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buffer, { type: 'buffer', cellDates: false });
  } catch {
    throw new HttpError(400, 'The uploaded file is not a valid Excel workbook', 'INVALID_FILE');
  }

  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new HttpError(400, 'The Excel workbook has no worksheets', 'INVALID_FILE');
  }

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[sheetName], {
    defval: null,
    raw: false,
  });
  const parsedRows: VesselMigrationRow[] = [];
  const errors: string[] = [];

  rows.forEach((rawRow, index) => {
    const rowNumber = index + 2;
    if (Object.values(rawRow).every((value) => !cellString(value))) return;

    try {
      const name = cellString(valueForRow(rawRow, 'name'));
      const vesselType = cellString(valueForRow(rawRow, 'vessel_type'));
      const flagState = cellString(valueForRow(rawRow, 'flag_state'));
      const statusValue = cellString(valueForRow(rawRow, 'status')).toUpperCase() || 'ACTIVE';

      if (!name) throw new Error('name is required');
      if (!vesselType) throw new Error('vessel_type is required');
      if (!flagState) throw new Error('flag_state is required');
      if (!statusValues.has(statusValue as VesselMigrationRow['status'])) {
        throw new Error(`status must be one of ${Array.from(statusValues).join(', ')}`);
      }

      parsedRows.push({
        name,
        imoNumber: cellString(valueForRow(rawRow, 'imo_number')) || undefined,
        vesselType,
        flagState,
        grossTonnage: cellNumber(valueForRow(rawRow, 'gross_tonnage'), 'gross_tonnage', rowNumber),
        yearBuilt: cellNumber(valueForRow(rawRow, 'year_built'), 'year_built', rowNumber),
        status: statusValue as VesselMigrationRow['status'],
      });
    } catch (error) {
      errors.push(`Row ${rowNumber}: ${error instanceof Error ? error.message : 'invalid data'}`);
    }
  });

  if (!parsedRows.length && !errors.length) {
    throw new HttpError(400, 'The Excel workbook contains no vessel rows', 'EMPTY_FILE');
  }
  if (errors.length) {
    throw new HttpError(
      400,
      'The Excel file contains invalid vessel rows',
      'MIGRATION_VALIDATION_ERROR',
      errors,
    );
  }
  if (parsedRows.length > 1000) {
    throw new HttpError(
      400,
      'A single migration cannot contain more than 1,000 vessels',
      'MIGRATION_LIMIT_EXCEEDED',
    );
  }

  const imoNumbers = parsedRows.map((row) => row.imoNumber).filter(Boolean) as string[];
  if (new Set(imoNumbers).size !== imoNumbers.length) {
    throw new HttpError(
      409,
      'The Excel file contains duplicate IMO numbers',
      'DUPLICATE_IMO_NUMBER',
    );
  }

  return parsedRows;
}

export function createVesselMigrationTemplate(): Buffer {
  const worksheet = XLSX.utils.aoa_to_sheet([
    [...vesselMigrationHeaders],
    ['', '', '', '', , , 'ACTIVE', ''],
  ]);
  worksheet['!cols'] = vesselMigrationHeaders.map(() => ({ wch: 28 }));

  const instructions = XLSX.utils.aoa_to_sheet([
    ['Vessel migration template'],
    ['Delete the example row before uploading your vessels.'],
    ['Required columns: name, vessel_type, flag_state.'],
    [
      'Optional columns: imo_number, gross_tonnage, year_built, status, assigned_superintendent_id.',
    ],
    ['status values: ACTIVE, INACTIVE, UNDER_REPAIR, DECOMMISSIONED.'],
    ['assigned_superintendent_id must be an active marine superintendent in this tenant.'],
  ]);
  instructions['!cols'] = [{ wch: 110 }];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Vessels');
  XLSX.utils.book_append_sheet(workbook, instructions, 'Instructions');
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}
