"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const autopilotService_1 = require("../../services/autopilotService");
const autopilot_1 = require("../../../jobs/autopilot");
const InstagramContent_1 = require("../../models/InstagramContent");
const RepostQueue_1 = require("../../models/RepostQueue");
const AutopilotLog_1 = require("../../models/AutopilotLog");
const router = express_1.default.Router();
/**
 * POST /api/phase9/run-autopilot - Manually trigger enhanced autopilot
 * Supports both scheduled mode and instant "Post Now" mode
 */
router.post('/run-autopilot', async (req, res) => {
    try {
        console.log('🚀 API: Enhanced autopilot trigger...');
        // Check for postNow flag in request body
        const { postNow = false } = req.body;
        console.log(`📋 Autopilot mode: ${postNow ? 'POST NOW (instant)' : 'SCHEDULED'}`);
        const result = await (0, autopilot_1.autopilotReposter)({ postNow });
        if (result.success) {
            res.json({
                success: true,
                message: result.message,
                data: {
                    processed: result.processed,
                    posted: result.posted,
                    errors: result.errors,
                    mode: postNow ? 'instant' : 'scheduled'
                }
            });
        }
        else {
            res.status(500).json({
                success: false,
                message: result.message,
                errors: result.errors
            });
        }
    }
    catch (error) {
        console.error('❌ API: Autopilot failed:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
/**
 * POST /api/phase9/post-now - Enhanced "Post Now" - instantly post highest-performing video
 * This is the new smart instant posting feature for the dashboard
 */
router.post('/post-now', async (req, res) => {
    try {
        console.log('🔥 API: POST NOW - Instant posting highest-performing video...');
        const result = await (0, autopilot_1.autopilotReposter)({ postNow: true });
        console.log('🔍 DEBUG: Post Now result:', {
            success: result.success,
            processed: result.processed,
            posted: result.posted,
            errors: result.errors.length
        });
        if (result.posted > 0) {
            res.json({
                success: true,
                message: `🎯 Posted ${result.posted} video(s) instantly!`,
                data: {
                    processed: result.processed,
                    posted: result.posted,
                    errors: result.errors,
                    mode: 'instant'
                }
            });
        }
        else if (result.processed > 0 && result.errors.length > 0) {
            res.status(400).json({
                success: false,
                message: `❌ Failed to post videos. ${result.errors.length} errors encountered`,
                data: result
            });
        }
        else if (result.processed === 0) {
            res.json({
                success: false,
                message: '📭 No eligible videos found for posting',
                data: result
            });
        }
        else {
            res.status(500).json({
                success: false,
                message: result.message,
                errors: result.errors
            });
        }
    }
    catch (error) {
        console.error('❌ API: POST NOW failed:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
/**
 * POST /api/phase9/force-post-all - Legacy: Force post all queued videos immediately
 */
router.post('/force-post-all', async (req, res) => {
    try {
        console.log('🚀 API: Force posting all queued videos (legacy)...');
        const result = await autopilotService_1.autopilotService.forcePostAll();
        res.json({
            success: true,
            message: 'Force posting completed',
            data: result
        });
    }
    catch (error) {
        console.error('❌ API: Force posting failed:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
/**
 * GET /api/phase9/status - Get autopilot status and stats
 */
router.get('/status', async (req, res) => {
    try {
        const status = await autopilotService_1.autopilotService.getStatus();
        res.json({
            success: true,
            data: status
        });
    }
    catch (error) {
        console.error('❌ API: Failed to get status:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
/**
 * DELETE /api/phase9/clear-history - Clear Instagram content history
 */
router.delete('/clear-history', async (req, res) => {
    try {
        console.log('🧹 API: Clearing Instagram content history...');
        // Clear all Instagram content records
        const deleteResult = await InstagramContent_1.InstagramArchive.deleteMany({});
        res.json({
            success: true,
            message: `Cleared ${deleteResult.deletedCount} Instagram content records`,
            data: {
                deletedCount: deleteResult.deletedCount
            }
        });
    }
    catch (error) {
        console.error('❌ API: Failed to clear history:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
/**
 * GET /api/phase9/queue - Get repost queue
 */
router.get('/queue', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 20;
        const status = req.query.status;
        const filter = {};
        if (status && ['queued', 'processing', 'completed', 'failed'].includes(status)) {
            filter.status = status;
        }
        const queue = await RepostQueue_1.RepostQueue.find(filter)
            .sort({ scheduledFor: 1 })
            .limit(limit)
            .lean();
        res.json({
            success: true,
            data: { queue }
        });
    }
    catch (error) {
        console.error('❌ API: Failed to get queue:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
/**
 * GET /api/phase9/content - Get Instagram archive content
 */
router.get('/content', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;
        const content = await InstagramContent_1.InstagramArchive.find({
            mediaType: 'VIDEO',
            viewCount: { $gte: 10000 }
        })
            .sort({ performanceScore: -1 })
            .limit(limit)
            .lean();
        res.json({
            success: true,
            data: { content }
        });
    }
    catch (error) {
        console.error('❌ API: Failed to get content:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
/**
 * GET /api/phase9/analytics - Get comprehensive autopilot analytics
 */
router.get('/analytics', async (req, res) => {
    try {
        // Content analytics
        const totalContent = await InstagramContent_1.InstagramArchive.countDocuments({ mediaType: 'VIDEO' });
        const eligibleContent = await InstagramContent_1.InstagramArchive.countDocuments({
            mediaType: 'VIDEO',
            viewCount: { $gte: 10000 },
            repostEligible: true
        });
        const highPerformingContent = await InstagramContent_1.InstagramArchive.countDocuments({
            mediaType: 'VIDEO',
            viewCount: { $gte: 50000 }
        });
        // Queue analytics
        const queueStats = await RepostQueue_1.RepostQueue.aggregate([
            { $group: { _id: '$status', count: { $sum: 1 } } }
        ]);
        const platformStats = await RepostQueue_1.RepostQueue.aggregate([
            { $group: { _id: '$targetPlatform', count: { $sum: 1 } } }
        ]);
        // Success rate analytics
        const totalProcessed = await RepostQueue_1.RepostQueue.countDocuments({
            status: { $in: ['completed', 'failed'] }
        });
        const successful = await RepostQueue_1.RepostQueue.countDocuments({ status: 'completed' });
        const successRate = totalProcessed > 0 ? (successful / totalProcessed * 100).toFixed(1) : '0';
        // Recent performance
        const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const recentPosts = await RepostQueue_1.RepostQueue.countDocuments({
            createdAt: { $gte: last24Hours }
        });
        // Activity logs
        const recentLogs = await AutopilotLog_1.AutopilotLog.find()
            .sort({ createdAt: -1 })
            .limit(10)
            .lean();
        // Top performing content
        const topContent = await InstagramContent_1.InstagramArchive.find({
            mediaType: 'VIDEO',
            viewCount: { $gte: 10000 }
        })
            .sort({ performanceScore: -1 })
            .limit(5)
            .lean();
        const analytics = {
            content: {
                total: totalContent,
                eligible: eligibleContent,
                highPerforming: highPerformingContent,
                avgViews: await InstagramContent_1.InstagramArchive.aggregate([
                    { $match: { mediaType: 'VIDEO' } },
                    { $group: { _id: null, avgViews: { $avg: '$viewCount' } } }
                ]).then(result => { var _a; return ((_a = result[0]) === null || _a === void 0 ? void 0 : _a.avgViews) || 0; })
            },
            queue: queueStats.reduce((acc, stat) => {
                acc[stat._id] = stat.count;
                return acc;
            }, {}),
            platforms: platformStats.reduce((acc, stat) => {
                acc[stat._id] = stat.count;
                return acc;
            }, {}),
            performance: {
                successRate: parseFloat(successRate),
                totalProcessed,
                successful,
                failed: totalProcessed - successful,
                recentPosts24h: recentPosts
            },
            topContent,
            recentActivity: recentLogs
        };
        res.json({
            success: true,
            data: analytics
        });
    }
    catch (error) {
        console.error('❌ API: Failed to get analytics:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
exports.default = router;
