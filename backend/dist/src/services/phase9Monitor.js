"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.phase9Monitor = exports.Phase9Monitor = void 0;
const phase9InstagramScraper_1 = require("../lib/youtube/phase9InstagramScraper");
const phase9DualPlatformReposter_1 = require("../lib/youtube/phase9DualPlatformReposter");
const phase9DailyScheduler_1 = require("../lib/youtube/phase9DailyScheduler");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const cron = __importStar(require("node-cron"));
class Phase9Monitor {
    constructor() {
        this.isRunning = false;
        this.settingsPath = path.join(__dirname, '../../settings.json');
        this.dualPlatformReposter = new phase9DualPlatformReposter_1.Phase9DualPlatformReposter();
        this.dailyScheduler = new phase9DailyScheduler_1.Phase9DailyScheduler();
    }
    /**
     * Start Phase 9 monitoring based on settings
     */
    async start() {
        try {
            console.log('🚀 Phase 9 Monitor: Starting intelligent dual-platform automation...');
            const settings = this.loadSettings();
            const phase9AutopilotMode = settings.phase9AutopilotMode || 'off';
            if (phase9AutopilotMode === 'off') {
                console.log('📴 Phase 9 auto-posting is OFF');
                return;
            }
            // Start daily scheduling system
            await this.dailyScheduler.startDailyScheduling();
            if (phase9AutopilotMode === 'both' || phase9AutopilotMode === 'instagram') {
                console.log('🚀 Phase 9: Dual-platform mode activated - Instagram scraping + both platform repurposing');
                await this.startDualPlatformMode(settings);
            }
            else if (phase9AutopilotMode === 'dropbox') {
                console.log('📂 Phase 9: Dropbox mode activated - monitoring uploads only');
                await this.startDropboxMode(settings);
            }
            this.isRunning = true;
            console.log('✅ Phase 9 Monitor: Successfully started with dual-platform automation');
        }
        catch (error) {
            console.error('❌ Phase 9 Monitor: Failed to start:', error);
            throw error;
        }
    }
    /**
     * Stop Phase 9 monitoring
     */
    stop() {
        console.log('🛑 Phase 9 Monitor: Stopping...');
        if (this.scrapingJob) {
            this.scrapingJob.stop();
            this.scrapingJob = undefined;
        }
        if (this.processingJob) {
            this.processingJob.stop();
            this.processingJob = undefined;
        }
        this.dailyScheduler.stopDailyScheduling();
        this.isRunning = false;
        console.log('✅ Phase 9 Monitor: Stopped');
    }
    /**
     * Start dual-platform mode - scrape Instagram and repost to both platforms
     */
    async startDualPlatformMode(settings) {
        console.log('🚀 Initializing dual-platform intelligent repurposing mode...');
        // Validate credentials for both platforms
        if (!settings.instagramAccessToken || !settings.instagramBusinessId) {
            throw new Error('Instagram access token and business ID required for dual-platform mode');
        }
        if (!settings.youtubeRefreshToken || !settings.youtubeClientId) {
            throw new Error('YouTube credentials required for dual-platform mode');
        }
        // Create service instances
        const scraper = new phase9InstagramScraper_1.Phase9InstagramScraper(settings.instagramAccessToken, settings.instagramBusinessId);
        // Set up Instagram scraping schedule - every 2 hours
        this.scrapingJob = cron.schedule('0 */2 * * *', async () => {
            try {
                console.log('⏰ Phase 9 Scheduled: Starting Instagram content scraping...');
                const scrapingResult = await scraper.scrapeRecentPosts();
                if (scrapingResult.success) {
                    console.log(`✅ Scraping completed: ${scrapingResult.postsScraped} posts, ${scrapingResult.topPerformers} top performers`);
                    // Schedule new content for the week
                    await this.dailyScheduler.scheduleRestOfWeek();
                }
                else {
                    console.error(`❌ Scraping failed: ${scrapingResult.error}`);
                }
            }
            catch (error) {
                console.error('❌ Phase 9 Scraping Job Error:', error);
            }
        });
        // Set up dual-platform repost processing - every 15 minutes for real-time posting
        this.processingJob = cron.schedule('*/15 * * * *', async () => {
            try {
                console.log('⏰ Phase 9 Scheduled: Processing dual-platform reposts...');
                // Process both Instagram and YouTube reposts
                const dualResults = await this.dualPlatformReposter.processDualPlatformReposts();
                console.log(`🚀 Dual-platform processing: ${dualResults.successful}/${dualResults.processed} successful`);
                console.log(`   📱 Instagram: ${dualResults.instagram.successful} successful, ${dualResults.instagram.failed} failed`);
                console.log(`   📺 YouTube: ${dualResults.youtube.successful} successful, ${dualResults.youtube.failed} failed`);
                if (dualResults.errors.length > 0) {
                    console.warn('⚠️ Some reposts failed:', dualResults.errors);
                }
                // Clean up old scheduled posts
                await this.dailyScheduler.cleanupOldScheduledPosts();
            }
            catch (error) {
                console.error('❌ Phase 9 Dual-Platform Processing Job Error:', error);
            }
        });
        // Run initial scraping and scheduling
        console.log('🔄 Running initial Instagram content scraping and weekly scheduling...');
        const initialResult = await scraper.scrapeRecentPosts();
        if (initialResult.success) {
            console.log(`✅ Initial scraping: ${initialResult.postsScraped} posts processed, ${initialResult.topPerformers} top performers identified`);
            // Schedule posts for the rest of the week
            const weekScheduleResult = await this.dailyScheduler.scheduleRestOfWeek();
            if (weekScheduleResult.success) {
                console.log(`📅 Week scheduling: ${weekScheduleResult.scheduledPosts} posts scheduled across both platforms`);
            }
        }
        console.log('✅ Dual-platform mode fully initialized with automatic scheduling and processing');
    }
    /**
     * Start Dropbox mode - monitor uploads but no Instagram scraping
     */
    async startDropboxMode(settings) {
        console.log('📂 Initializing Dropbox monitoring mode...');
        // In Dropbox mode, we still process any existing reposts but don't scrape new content
        // Set up processing schedule - every hour (less frequent than dual-platform mode)
        this.processingJob = cron.schedule('0 * * * *', async () => {
            try {
                console.log('⏰ Phase 9 Dropbox Mode: Processing existing reposts...');
                // Process any pending reposts
                const dualResults = await this.dualPlatformReposter.processDualPlatformReposts();
                if (dualResults.processed > 0) {
                    console.log(`📊 Processed reposts - Total: ${dualResults.successful}/${dualResults.processed} successful`);
                    console.log(`   📱 Instagram: ${dualResults.instagram.successful}/${dualResults.instagram.successful + dualResults.instagram.failed}`);
                    console.log(`   📺 YouTube: ${dualResults.youtube.successful}/${dualResults.youtube.successful + dualResults.youtube.failed}`);
                }
            }
            catch (error) {
                console.error('❌ Phase 9 Dropbox Mode Processing Error:', error);
            }
        });
        console.log('✅ Dropbox mode initialized - monitoring existing reposts only');
    }
    /**
     * Load settings from environment variables or file fallback
     */
    loadSettings() {
        try {
            // Try to load from file first (development mode)
            const settingsData = fs.readFileSync(this.settingsPath, 'utf8');
            const fileSettings = JSON.parse(settingsData);
            // Use environment variables to override file settings (for production)
            const envOverrides = {
                autopostMode: process.env.AUTOPOST_MODE,
                phase9AutopilotMode: process.env.PHASE9_AUTOPILOT_MODE,
                instagramAccessToken: process.env.INSTAGRAM_ACCESS_TOKEN,
                instagramBusinessId: process.env.INSTAGRAM_BUSINESS_ID,
                youtubeRefreshToken: process.env.YOUTUBE_REFRESH_TOKEN,
                youtubeClientId: process.env.YOUTUBE_CLIENT_ID,
                youtubeClientSecret: process.env.YOUTUBE_CLIENT_SECRET,
                youtubeApiKey: process.env.YOUTUBE_API_KEY,
                youtubeChannelId: process.env.YOUTUBE_CHANNEL_ID,
                maxRepostsPerDay: process.env.MAX_REPOSTS_PER_DAY ? parseInt(process.env.MAX_REPOSTS_PER_DAY) : undefined,
                minDaysBetweenPosts: process.env.MIN_DAYS_BETWEEN_POSTS ? parseInt(process.env.MIN_DAYS_BETWEEN_POSTS) : undefined
            };
            // Remove undefined values from env overrides
            Object.keys(envOverrides).forEach(key => {
                if (envOverrides[key] === undefined) {
                    delete envOverrides[key];
                }
            });
            // Merge file settings with environment overrides (env takes precedence only when set)
            return { ...fileSettings, ...envOverrides };
        }
        catch (error) {
            console.error('❌ Failed to load settings:', error);
            return { autopostMode: 'off' };
        }
    }
    /**
     * Update auto-posting mode
     */
    async updatePhase9AutopilotMode(mode) {
        try {
            console.log(`🔄 Phase 9: Updating autopost mode to "${mode}"`);
            // Load current settings
            const settings = this.loadSettings();
            settings.phase9AutopilotMode = mode;
            // Save updated settings
            fs.writeFileSync(this.settingsPath, JSON.stringify(settings, null, 2));
            // Restart monitoring with new mode
            if (this.isRunning) {
                this.stop();
                await this.start();
            }
            console.log(`✅ Phase 9: Autopost mode updated to "${mode}"`);
        }
        catch (error) {
            console.error('❌ Failed to update autopost mode:', error);
            throw error;
        }
    }
    /**
     * Get current Phase 9 status and comprehensive statistics
     */
    async getStatus() {
        try {
            const settings = this.loadSettings();
            const phase9AutopilotMode = settings.phase9AutopilotMode || 'off';
            const status = {
                isRunning: this.isRunning,
                phase9AutopilotMode
            };
            // Add detailed stats if running
            if (this.isRunning) {
                try {
                    // Get scraper stats if in Instagram mode
                    if (phase9AutopilotMode === 'both' || phase9AutopilotMode === 'instagram') {
                        const scraper = new phase9InstagramScraper_1.Phase9InstagramScraper(settings.instagramAccessToken, settings.instagramBusinessId);
                        status.scraperStats = await scraper.getScrapingStats();
                        status.nextScraping = 'Every 2 hours';
                        status.nextProcessing = 'Every 15 minutes';
                    }
                    else {
                        status.nextProcessing = 'Every hour (Dropbox mode)';
                    }
                    // Get dual-platform stats
                    status.dualPlatformStats = await this.dualPlatformReposter.getDualPlatformStats();
                    // Get scheduling stats
                    status.schedulingStats = await this.dailyScheduler.getSchedulingStats();
                }
                catch (error) {
                    console.warn('⚠️ Could not fetch detailed stats:', error);
                }
            }
            return status;
        }
        catch (error) {
            console.error('❌ Error getting Phase 9 status:', error);
            return {
                isRunning: false,
                phase9AutopilotMode: 'off'
            };
        }
    }
    /**
     * Manually trigger Instagram content scraping
     */
    async triggerManualScraping() {
        try {
            console.log('🔄 Phase 9: Manual scraping triggered...');
            const settings = this.loadSettings();
            if (!settings.instagramAccessToken || !settings.instagramBusinessId) {
                throw new Error('Instagram credentials not configured');
            }
            const scraper = new phase9InstagramScraper_1.Phase9InstagramScraper(settings.instagramAccessToken, settings.instagramBusinessId);
            const result = await scraper.scrapeRecentPosts();
            console.log(`✅ Manual scraping completed: ${result.postsScraped} posts, ${result.topPerformers} top performers`);
            // Schedule new content for the week
            if (result.success && result.topPerformers > 0) {
                const weekScheduleResult = await this.dailyScheduler.scheduleRestOfWeek();
                // Add scheduling result to the response
                result.weekScheduleResult = weekScheduleResult;
            }
            return result;
        }
        catch (error) {
            console.error('❌ Manual scraping failed:', error);
            throw error;
        }
    }
    /**
     * Manually trigger dual-platform reposting
     */
    async triggerManualReposting() {
        try {
            console.log('🔄 Phase 9: Manual dual-platform reposting triggered...');
            const result = await this.dualPlatformReposter.processDualPlatformReposts();
            console.log(`✅ Manual reposting completed: ${result.successful}/${result.processed} successful`);
            console.log(`   📱 Instagram: ${result.instagram.successful} successful, ${result.instagram.failed} failed`);
            console.log(`   📺 YouTube: ${result.youtube.successful} successful, ${result.youtube.failed} failed`);
            return result;
        }
        catch (error) {
            console.error('❌ Manual reposting failed:', error);
            throw error;
        }
    }
    /**
     * Manually trigger weekly scheduling
     */
    async triggerWeeklyScheduling() {
        try {
            console.log('📅 Phase 9: Manual weekly scheduling triggered...');
            const result = await this.dailyScheduler.scheduleRestOfWeek();
            console.log(`✅ Weekly scheduling completed: ${result.scheduledPosts} posts scheduled`);
            return result;
        }
        catch (error) {
            console.error('❌ Weekly scheduling failed:', error);
            throw error;
        }
    }
    /**
     * Clean up placeholder and test data from database
     */
    async cleanupPlaceholderData() {
        try {
            console.log('🧹 Phase 9: Cleaning up placeholder and test data...');
            const { InstagramArchive } = require('../models/InstagramContent');
            const { RepostQueue } = require('../models/RepostQueue');
            const { VideoStatus } = require('../models/VideoStatus');
            const deletedCounts = {
                instagramArchive: 0,
                repostQueue: 0,
                videoStatus: 0
            };
            // Clean up test Instagram content
            const instagramCleanup = await InstagramArchive.deleteMany({
                $or: [
                    { caption: { $regex: /test|placeholder|mock|sample/i } },
                    { videoId: { $regex: /test|placeholder|mock|sample/i } },
                    { performanceScore: { $lt: 10 } }, // Very low scores are likely test data
                    { viewCount: 0, likeCount: 0, commentCount: 0 } // Zero engagement is likely test
                ]
            });
            deletedCounts.instagramArchive = instagramCleanup.deletedCount;
            // Clean up test repost queue entries
            const repostCleanup = await RepostQueue.deleteMany({
                $or: [
                    { sourceMediaId: { $regex: /test|placeholder|mock|sample/i } },
                    { status: 'failed', createdAt: { $lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } } // Old failed entries
                ]
            });
            deletedCounts.repostQueue = repostCleanup.deletedCount;
            // Clean up test video status entries
            const videoStatusCleanup = await VideoStatus.deleteMany({
                $or: [
                    { videoId: { $regex: /test|placeholder|mock|sample/i } },
                    { filename: { $regex: /test|placeholder|mock|sample/i } },
                    { status: 'failed', uploadDate: { $lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } }
                ]
            });
            deletedCounts.videoStatus = videoStatusCleanup.deletedCount;
            console.log('✅ Placeholder data cleanup complete:');
            console.log(`   📱 Instagram Archive: ${deletedCounts.instagramArchive} entries deleted`);
            console.log(`   🔄 Repost Queue: ${deletedCounts.repostQueue} entries deleted`);
            console.log(`   📹 Video Status: ${deletedCounts.videoStatus} entries deleted`);
            return {
                success: true,
                deletedCounts
            };
        }
        catch (error) {
            console.error('❌ Failed to cleanup placeholder data:', error);
            return {
                success: false,
                deletedCounts: {}
            };
        }
    }
    /**
     * Update Phase 9 settings
     */
    async updatePhase9Settings(newSettings) {
        try {
            console.log('🔄 Phase 9: Updating settings...');
            const settings = this.loadSettings();
            settings.phase9Settings = {
                ...settings.phase9Settings,
                ...newSettings
            };
            fs.writeFileSync(this.settingsPath, JSON.stringify(settings, null, 2));
            console.log('✅ Phase 9: Settings updated');
        }
        catch (error) {
            console.error('❌ Failed to update Phase 9 settings:', error);
            throw error;
        }
    }
}
exports.Phase9Monitor = Phase9Monitor;
// Create singleton instance
exports.phase9Monitor = new Phase9Monitor();
