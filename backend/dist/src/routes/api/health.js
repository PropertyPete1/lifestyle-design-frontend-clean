"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const environment_1 = require("../../config/environment");
const mongoose_1 = __importDefault(require("mongoose"));
const router = express_1.default.Router();
/**
 * Health check endpoint for Render deployment
 * GET /api/health
 */
router.get('/', async (req, res) => {
    try {
        const config = environment_1.appConfig.getConfig();
        const validation = environment_1.appConfig.validateConfig();
        // Check database connection
        const dbStatus = mongoose_1.default.connection.readyState === 1 ? 'connected' : 'disconnected';
        // Check required environment variables
        const envCheck = {
            nodeEnv: config.nodeEnv,
            hasInstagramToken: !!config.instagramAccessToken,
            hasYouTubeCredentials: !!(config.youtubeApiKey && config.youtubeClientId),
            hasOpenAIKey: !!config.openaiApiKey,
            hasDropboxKey: !!config.dropboxApiKey
        };
        // Overall health status
        const isHealthy = dbStatus === 'connected' && validation.valid;
        const healthData = {
            status: isHealthy ? 'healthy' : 'unhealthy',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            environment: config.nodeEnv,
            database: {
                status: dbStatus,
                uri: config.mongoUri ? 'configured' : 'missing'
            },
            services: envCheck,
            phase9: {
                autopilotMode: config.phase9AutopilotMode,
                enabled: config.phase9AutopilotMode !== 'off'
            },
            validation: {
                valid: validation.valid,
                missing: validation.missing
            }
        };
        // Return appropriate status code
        const statusCode = isHealthy ? 200 : 503;
        res.status(statusCode).json(healthData);
    }
    catch (error) {
        console.error('❌ Health check failed:', error);
        res.status(503).json({
            status: 'unhealthy',
            timestamp: new Date().toISOString(),
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
/**
 * Detailed system status endpoint
 * GET /api/health/detailed
 */
router.get('/detailed', async (req, res) => {
    try {
        const config = environment_1.appConfig.getConfig();
        // Check Phase 9 monitor status
        let phase9Status = null;
        try {
            const { phase9Monitor } = require('../../services/phase9Monitor');
            phase9Status = await phase9Monitor.getStatus();
        }
        catch (error) {
            phase9Status = { error: 'Phase 9 monitor not available' };
        }
        // Memory and process info
        const memoryUsage = process.memoryUsage();
        const processInfo = {
            pid: process.pid,
            uptime: process.uptime(),
            version: process.version,
            platform: process.platform,
            arch: process.arch,
            memory: {
                rss: Math.round(memoryUsage.rss / 1024 / 1024) + ' MB',
                heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024) + ' MB',
                heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024) + ' MB'
            }
        };
        const detailedStatus = {
            status: 'healthy',
            timestamp: new Date().toISOString(),
            process: processInfo,
            database: {
                status: mongoose_1.default.connection.readyState === 1 ? 'connected' : 'disconnected',
                host: mongoose_1.default.connection.host,
                name: mongoose_1.default.connection.name
            },
            phase9: phase9Status,
            config: {
                autopilotMode: config.phase9AutopilotMode,
                maxRepostsPerDay: config.maxRepostsPerDay,
                minDaysBetweenPosts: config.minDaysBetweenPosts
            }
        };
        res.json(detailedStatus);
    }
    catch (error) {
        console.error('❌ Detailed health check failed:', error);
        res.status(500).json({
            status: 'error',
            timestamp: new Date().toISOString(),
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
exports.default = router;
