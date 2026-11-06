import type {AppState,Bridge} from '../electron/contracts';
export type {AppState,ProgressState} from '../electron/contracts';

declare global {interface Window {warp?: Bridge}}

export const emptyState: AppState = {
  file: null, path: null, targets: [], busy: false, helperReady: false,
  anchor: {x: 260, y: 260}, presentation: 0, job: null
};
