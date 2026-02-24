// =============================================================================
// Depth Store Unit Tests
// =============================================================================

import { useDepthStore } from './depthStore';
import type { PriceLevel } from '@/types/chart';
import { MAX_DEPTH_LEVELS } from '@/utils/constants';

// Helper to reset store state between tests
function resetStore(): void {
  useDepthStore.getState().reset();
}

describe('depthStore', () => {
  beforeEach(() => {
    resetStore();
  });

  // ---------------------------------------------------------------------------
  // setSnapshot
  // ---------------------------------------------------------------------------

  describe('setSnapshot', () => {
    it('sets bids sorted in descending order by price', () => {
      const bids: PriceLevel[] = [
        { price: 100, quantity: 1 },
        { price: 300, quantity: 3 },
        { price: 200, quantity: 2 },
      ];
      const asks: PriceLevel[] = [];

      useDepthStore.getState().setSnapshot(bids, asks, 1);
      const state = useDepthStore.getState();

      expect(state.bids[0].price).toBe(300);
      expect(state.bids[1].price).toBe(200);
      expect(state.bids[2].price).toBe(100);
    });

    it('sets asks sorted in ascending order by price', () => {
      const bids: PriceLevel[] = [];
      const asks: PriceLevel[] = [
        { price: 500, quantity: 5 },
        { price: 300, quantity: 3 },
        { price: 400, quantity: 4 },
      ];

      useDepthStore.getState().setSnapshot(bids, asks, 1);
      const state = useDepthStore.getState();

      expect(state.asks[0].price).toBe(300);
      expect(state.asks[1].price).toBe(400);
      expect(state.asks[2].price).toBe(500);
    });

    it('sets lastUpdateId', () => {
      useDepthStore.getState().setSnapshot([], [], 42);
      expect(useDepthStore.getState().lastUpdateId).toBe(42);
    });

    it('marks store as dirty', () => {
      useDepthStore.getState().setSnapshot([], [], 1);
      expect(useDepthStore.getState().isDirty).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // applyDepthUpdate
  // ---------------------------------------------------------------------------

  describe('applyDepthUpdate', () => {
    it('upserts new bid levels', () => {
      // Start with a snapshot
      useDepthStore.getState().setSnapshot([{ price: 100, quantity: 1 }], [], 1);

      // Apply update with a new bid level
      useDepthStore.getState().applyDepthUpdate([{ price: 200, quantity: 2 }], [], 2);

      const state = useDepthStore.getState();
      expect(state.bids).toHaveLength(2);
      // Should be sorted descending
      expect(state.bids[0].price).toBe(200);
      expect(state.bids[1].price).toBe(100);
    });

    it('updates existing bid level quantity', () => {
      useDepthStore.getState().setSnapshot([{ price: 100, quantity: 1 }], [], 1);

      useDepthStore.getState().applyDepthUpdate([{ price: 100, quantity: 5 }], [], 2);

      const state = useDepthStore.getState();
      expect(state.bids).toHaveLength(1);
      expect(state.bids[0]).toEqual({ price: 100, quantity: 5 });
    });

    it('removes bid levels with quantity 0', () => {
      useDepthStore.getState().setSnapshot(
        [
          { price: 100, quantity: 1 },
          { price: 200, quantity: 2 },
        ],
        [],
        1,
      );

      useDepthStore.getState().applyDepthUpdate([{ price: 200, quantity: 0 }], [], 2);

      const state = useDepthStore.getState();
      expect(state.bids).toHaveLength(1);
      expect(state.bids[0].price).toBe(100);
    });

    it('upserts new ask levels', () => {
      useDepthStore.getState().setSnapshot([], [{ price: 500, quantity: 5 }], 1);

      useDepthStore.getState().applyDepthUpdate([], [{ price: 400, quantity: 4 }], 2);

      const state = useDepthStore.getState();
      expect(state.asks).toHaveLength(2);
      // Should be sorted ascending
      expect(state.asks[0].price).toBe(400);
      expect(state.asks[1].price).toBe(500);
    });

    it('removes ask levels with quantity 0', () => {
      useDepthStore.getState().setSnapshot(
        [],
        [
          { price: 400, quantity: 4 },
          { price: 500, quantity: 5 },
        ],
        1,
      );

      useDepthStore.getState().applyDepthUpdate([], [{ price: 400, quantity: 0 }], 2);

      const state = useDepthStore.getState();
      expect(state.asks).toHaveLength(1);
      expect(state.asks[0].price).toBe(500);
    });

    it('caps at MAX_DEPTH_LEVELS for bids', () => {
      const overflow = 5;
      const total = MAX_DEPTH_LEVELS + overflow;
      const initialBids: PriceLevel[] = Array.from({ length: total }, (_, i) => ({
        price: i + 1,
        quantity: 1,
      }));

      useDepthStore.getState().setSnapshot(initialBids, [], 1);
      const state = useDepthStore.getState();

      expect(state.bids).toHaveLength(MAX_DEPTH_LEVELS);
      // Descending: highest prices kept
      expect(state.bids[0].price).toBe(total);
      expect(state.bids[MAX_DEPTH_LEVELS - 1].price).toBe(overflow + 1);
    });

    it('caps at MAX_DEPTH_LEVELS for asks', () => {
      const overflow = 5;
      const total = MAX_DEPTH_LEVELS + overflow;
      const initialAsks: PriceLevel[] = Array.from({ length: total }, (_, i) => ({
        price: i + 1,
        quantity: 1,
      }));

      useDepthStore.getState().setSnapshot([], initialAsks, 1);
      const state = useDepthStore.getState();

      expect(state.asks).toHaveLength(MAX_DEPTH_LEVELS);
      // Ascending: lowest prices kept
      expect(state.asks[0].price).toBe(1);
      expect(state.asks[MAX_DEPTH_LEVELS - 1].price).toBe(MAX_DEPTH_LEVELS);
    });

    it('updates finalUpdateId', () => {
      useDepthStore.getState().setSnapshot([], [], 1);
      useDepthStore.getState().applyDepthUpdate([], [], 99);

      expect(useDepthStore.getState().lastUpdateId).toBe(99);
    });

    it('marks store as dirty after update', () => {
      useDepthStore.getState().setSnapshot([], [], 1);
      useDepthStore.getState().markClean();
      expect(useDepthStore.getState().isDirty).toBe(false);

      useDepthStore.getState().applyDepthUpdate([], [], 2);
      expect(useDepthStore.getState().isDirty).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // isDirty flag behavior
  // ---------------------------------------------------------------------------

  describe('isDirty flag', () => {
    it('starts as false', () => {
      expect(useDepthStore.getState().isDirty).toBe(false);
    });

    it('is set to true by setSnapshot', () => {
      useDepthStore.getState().setSnapshot([], [], 1);
      expect(useDepthStore.getState().isDirty).toBe(true);
    });

    it('is set to true by setBids', () => {
      useDepthStore.getState().setBids([{ price: 100, quantity: 1 }]);
      expect(useDepthStore.getState().isDirty).toBe(true);
    });

    it('is set to true by setAsks', () => {
      useDepthStore.getState().setAsks([{ price: 100, quantity: 1 }]);
      expect(useDepthStore.getState().isDirty).toBe(true);
    });

    it('is cleared by markClean', () => {
      useDepthStore.getState().setSnapshot([], [], 1);
      expect(useDepthStore.getState().isDirty).toBe(true);

      useDepthStore.getState().markClean();
      expect(useDepthStore.getState().isDirty).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // reset
  // ---------------------------------------------------------------------------

  describe('reset', () => {
    it('clears all state to initial values', () => {
      useDepthStore
        .getState()
        .setSnapshot([{ price: 100, quantity: 1 }], [{ price: 200, quantity: 2 }], 42);

      useDepthStore.getState().reset();
      const state = useDepthStore.getState();

      expect(state.bids).toEqual([]);
      expect(state.asks).toEqual([]);
      expect(state.lastUpdateId).toBe(0);
      expect(state.isDirty).toBe(false);
    });
  });
});
