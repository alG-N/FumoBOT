// Mock dependencies
jest.mock('../Service/GachaService/NormalGachaService/BoostService', () => ({
  getUserBoosts: jest.fn().mockResolvedValue({}),
}));
jest.mock('../Service/GachaService/NormalGachaService/RarityService', () => ({
  calculateRarity: jest.fn().mockResolvedValue({ rarity: 'Common' }),
  updatePityCounters: jest.fn((p, r) => p),
  updateBoostCharge: jest.fn((c, a, r) => ({ boostCharge: c, boostActive: a, boostRollsRemaining: r })),
  meetsMinimumRarity: jest.fn(() => true),
}));
jest.mock('../Service/GachaService/NormalGachaService/InventoryService', () => ({
  selectAndAddFumo: jest.fn().mockResolvedValue({ name: 'TestFumo', rarity: 'Common' }),
  selectAndAddMultipleFumos: jest.fn().mockResolvedValue([{ name: 'TestFumo', rarity: 'Common' }]),
}));
jest.mock('../Core/database', () => ({
  get: jest.fn().mockResolvedValue({
    coins: 1000,
    boostCharge: 0,
    boostActive: false,
    boostRollsRemaining: 0,
    pityTranscendent: 0,
    pityEternal: 0,
    pityInfinite: 0,
    pityCelestial: 0,
    pityAstral: 0,
    rollsLeft: 100,
    totalRolls: 0,
    hasFantasyBook: false,
    luck: 0
  }),
  run: jest.fn().mockResolvedValue(),
}));
jest.mock('../Service/UserDataService/StorageService/StorageLimitService', () => ({
  canAddFumos: jest.fn().mockResolvedValue({ canAdd: true }),
  getStorageStatus: jest.fn().mockResolvedValue({ status: 'NORMAL' }),
}));
jest.mock('../Ultility/weekly', () => ({
  incrementWeeklyAstral: jest.fn(),
  getWeekIdentifier: jest.fn().mockReturnValue('2025-W01'),
}));

const CrateGachaRollService = require('../Service/GachaService/NormalGachaService/CrateGachaRollService');

const userId = 'test-user';
const fumos = [{ name: 'TestFumo', rarity: 'Common' }];

describe('CrateGachaRollService', () => {
  describe('performSingleRoll', () => {
    it('should return success and a fumo', async () => {
      const result = await CrateGachaRollService.performSingleRoll(userId, fumos);
      expect(result.success).toBe(true);
      expect(result.fumo).toBeDefined();
      expect(result.rarity).toBe('Common');
    });
  });

  describe('performMultiRoll', () => {
    it('should return success and an array of fumos', async () => {
      const result = await CrateGachaRollService.performMultiRoll(userId, fumos, 3);
      expect(result.success).toBe(true);
      expect(Array.isArray(result.fumosBought)).toBe(true);
      expect(result.fumosBought.length).toBeGreaterThan(0);
      expect(result.bestFumo).toBeDefined();
    });
  });

  describe('performBatch100Roll', () => {
    it('should return the best fumo or null', async () => {
      const result = await CrateGachaRollService.performBatch100Roll(userId, fumos);
      expect(result === null || result.name === 'TestFumo').toBe(true);
    });
  });
});