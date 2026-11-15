import type {
  JobBuilderLocation,
  JobBuilderLocationErrors,
} from '@/features/troute-testbed/job-builder/jobBuilderModel';
import type { JobBuilderValidationStatus } from '@/features/troute-testbed/job-builder/useJobBuilderValidation';

export interface JobBuilderLocationListProps {
  locations: JobBuilderLocation[];
  placeIdRequired: boolean;
  selectedLocationId: string | null;
  errors: Record<string, JobBuilderLocationErrors>;
  validationStatus: JobBuilderValidationStatus;
  validationErrorCount: number;
  onSelect: (locationId: string) => void;
  onUpdate: (locationId: string, patch: JobBuilderLocationPatch) => void;
  onRemove: (locationId: string) => void;
  onReorder: (locationId: string, targetIndex: number) => void;
  onShuffle: () => void;
}

export type JobBuilderLocationPatch = Partial<
  Pick<
    JobBuilderLocation,
    'id' | 'name' | 'placeId' | 'openTime' | 'closeTime' | 'stayMinutes'
  >
>;
