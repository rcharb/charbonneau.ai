const cron = require('node-cron');
const { logger } = require('@librechat/data-schemas');
const { Balance } = require('~/db/models');
const { findUser } = require('~/models');

/**
 * Service to handle monthly token refills for yearly subscribers
 * Runs daily and checks if any yearly subscribers need their monthly token grant
 */
class SubscriptionRefillService {
  constructor() {
    this.cronJob = null;
    this.isRunning = false;
  }

  /**
   * Initialize the cron job to run daily at 2 AM
   */
  initialize() {
    if (this.cronJob) {
      logger.warn('[SubscriptionRefillService] Cron job already initialized');
      return;
    }

    // Run every day at 2:00 AM
    this.cronJob = cron.schedule('0 2 * * *', async () => {
      await this.processMonthlyRefills();
    });

    logger.info(
      '[SubscriptionRefillService] Monthly refill cron job initialized (runs daily at 2 AM)',
    );
  }

  /**
   * Stop the cron job
   */
  stop() {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
      logger.info('[SubscriptionRefillService] Cron job stopped');
    }
  }

  /**
   * Main process to check and refill tokens for yearly subscribers
   * Uses UTC for consistent timezone handling
   */
  async processMonthlyRefills() {
    if (this.isRunning) {
      logger.warn('[SubscriptionRefillService] Process already running, skipping this cycle');
      return;
    }

    this.isRunning = true;
    logger.info('[SubscriptionRefillService] Starting monthly refill process...');

    try {
      // Use UTC to avoid timezone issues
      const now = new Date();
      const currentYear = now.getUTCFullYear();
      const currentMonth = now.getUTCMonth() + 1; // 1-12
      const currentDay = now.getUTCDate(); // 1-31

      // Find all yearly subscribers who might need refilling
      // This includes:
      // 1. Users whose billing day is today
      // 2. Users whose billing day was earlier this month (missed due to downtime)
      const balancesToCheck = await Balance.find({
        isYearlySubscription: true,
        autoRefillEnabled: true,
        billingCycleDay: { $lte: currentDay, $gte: 1 }, // Any day up to today
        subscriptionPlan: { $in: ['standard', 'plus'] },
      }).lean();

      logger.info(
        `[SubscriptionRefillService] Found ${balancesToCheck.length} yearly subscriptions to check (current date: ${currentYear}-${currentMonth}-${currentDay} UTC)`,
      );

      let successCount = 0;
      let skipCount = 0;
      let errorCount = 0;

      for (const balance of balancesToCheck) {
        try {
          // Check if already refilled this month using month/year comparison
          const needsRefill = this.needsRefillThisMonth(
            balance.lastRefillMonth,
            balance.lastRefillYear,
            currentMonth,
            currentYear,
          );

          if (!needsRefill) {
            logger.debug(
              `[SubscriptionRefillService] User ${balance.user} already refilled for ${currentYear}-${currentMonth}, skipping`,
            );
            skipCount++;
            continue;
          }

          // Verify the user still has an active subscription
          const user = await findUser({ _id: balance.user });

          if (!user) {
            logger.warn(
              `[SubscriptionRefillService] User ${balance.user} not found, skipping refill`,
            );
            skipCount++;
            continue;
          }

          // Check if subscription is still active
          if (
            !user.subscriptionStatus ||
            !['active', 'trialing'].includes(user.subscriptionStatus)
          ) {
            logger.info(
              `[SubscriptionRefillService] User ${balance.user} subscription not active (${user.subscriptionStatus}), disabling auto-refill`,
            );
            await Balance.findOneAndUpdate(
              { _id: balance._id },
              {
                $set: {
                  autoRefillEnabled: false,
                },
              },
            );
            skipCount++;
            continue;
          }

          // Check if subscription period end is still in the future
          if (user.subscriptionPeriodEnd && new Date(user.subscriptionPeriodEnd) < now) {
            logger.info(
              `[SubscriptionRefillService] User ${balance.user} subscription expired, disabling auto-refill`,
            );
            await Balance.findOneAndUpdate(
              { _id: balance._id },
              {
                $set: {
                  autoRefillEnabled: false,
                },
              },
            );
            skipCount++;
            continue;
          }

          // Verify we haven't exceeded the subscription period
          // (in case subscription just started and we're catching up)
          if (balance.subscriptionStartDate) {
            const startDate = new Date(balance.subscriptionStartDate);
            const startYear = startDate.getUTCFullYear();
            const startMonth = startDate.getUTCMonth() + 1;

            // Don't refill if current month is before or same as start month/year
            if (
              currentYear < startYear ||
              (currentYear === startYear && currentMonth <= startMonth)
            ) {
              logger.debug(
                `[SubscriptionRefillService] User ${balance.user} subscription too new (started ${startYear}-${startMonth}), skipping`,
              );
              skipCount++;
              continue;
            }
          }

          // Perform the refill
          const refillAmount = balance.refillAmount || 0;

          if (refillAmount <= 0) {
            logger.warn(
              `[SubscriptionRefillService] User ${balance.user} has invalid refill amount (${refillAmount}), skipping`,
            );
            skipCount++;
            continue;
          }

          await Balance.findOneAndUpdate(
            { _id: balance._id },
            {
              $inc: {
                tokenCredits: refillAmount,
                subscriptionCredits: refillAmount,
              },
              $set: {
                lastRefill: now,
                lastRefillMonth: currentMonth,
                lastRefillYear: currentYear,
              },
            },
          );

          successCount++;
          logger.info(
            `[SubscriptionRefillService] Successfully refilled ${refillAmount} tokens for user ${balance.user} (${balance.subscriptionPlan} plan, billing day: ${balance.billingCycleDay})`,
          );
        } catch (error) {
          errorCount++;
          logger.error(
            `[SubscriptionRefillService] Error refilling tokens for user ${balance.user}:`,
            error,
          );
        }
      }

      logger.info(
        `[SubscriptionRefillService] Monthly refill process completed. Success: ${successCount}, Skipped: ${skipCount}, Errors: ${errorCount}`,
      );
    } catch (error) {
      logger.error('[SubscriptionRefillService] Error in monthly refill process:', error);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Check if a subscription needs refill for the current month
   * @param {number|null} lastMonth - Last refill month (1-12)
   * @param {number|null} lastYear - Last refill year
   * @param {number} currentMonth - Current month (1-12)
   * @param {number} currentYear - Current year
   * @returns {boolean} - True if refill is needed
   */
  needsRefillThisMonth(lastMonth, lastYear, currentMonth, currentYear) {
    // Never refilled before - needs refill
    if (!lastMonth || !lastYear) {
      return true;
    }

    // Different year - needs refill
    if (currentYear > lastYear) {
      return true;
    }

    // Same year, different month - needs refill
    if (currentYear === lastYear && currentMonth > lastMonth) {
      return true;
    }

    // Same year and month - already refilled
    return false;
  }

  /**
   * Manual trigger for testing purposes
   */
  async triggerManualRefill() {
    logger.info('[SubscriptionRefillService] Manual refill triggered');
    await this.processMonthlyRefills();
  }
}

// Create singleton instance
const subscriptionRefillService = new SubscriptionRefillService();

module.exports = subscriptionRefillService;
