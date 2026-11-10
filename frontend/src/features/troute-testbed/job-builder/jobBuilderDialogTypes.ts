import { type TrouteOptimizeRequest } from '@trasolve/shared';

export interface JobBuilderDialogProps {
  isOpen: boolean;
  dark: boolean;
  existingJobIds: ReadonlySet<string>;
  onClose: () => void;
  onCreate: (request: TrouteOptimizeRequest) => void;
}
