/**
 * Copyright (c) 2026 BIDIGA Imrane - FasoFree. All rights reserved.
 * Proprietary and confidential. Unauthorized copying, modification or use is strictly prohibited.
 */

import { DisputeResolution } from '../entities/dispute.entity';

export const DISPUTE_OPENED = 'dispute.opened';
export const DISPUTE_RESOLVED = 'dispute.resolved';

export type DisputeOpenedEvent = {
  disputeId: string;
  orderId: string;
  clientId: string;
  businessId: string | null;
};

export type DisputeResolvedEvent = DisputeOpenedEvent & {
  resolution: DisputeResolution;
};
