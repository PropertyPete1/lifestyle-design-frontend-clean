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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Phase9DualPlatformReposter = void 0;
const RepostQueue_1 = require("../../models/RepostQueue");
const InstagramContent_1 = require("../../models/InstagramContent");
const matchAudioToVideo_1 = require("./matchAudioToVideo");
const realYouTubeUpload_1 = require("./realYouTubeUpload");
const analyzePeakHours_1 = require("./analyzePeakHours");
const analyzeTopHashtags_1 = require("./analyzeTopHashtags");
const fetchTrendingAudio_1 = require("./fetchTrendingAudio");
// Video enhancement removed - was ruining video quality
const axios_1 = __importDefault(require("axios"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const FormData = require('form-data');
class Phase9DualPlatformReposter {
    constructor() {
        this.uploadsDir = path.join(__dirname, '../../../uploads');
        this.settingsPath = path.join(__dirname, '../../../settings.json');
        // Ensure uploads directory exists
        if (!fs.existsSync(this.uploadsDir)) {
            fs.mkdirSync(this.uploadsDir, { recursive: true });
        }
        // Initialize Dropbox service if available
        try {
            const { dropbox } = require('../../services/dropbox');
            this.dropboxService = dropbox;
        }
        catch (error) {
            console.warn('⚠️ Dropbox service not available, sync disabled');
        }
    }
    /**
     * Create YouTube uploader instance with current settings
     */
    createYouTubeUploader() {
        const settings = this.loadSettings();
        return new realYouTubeUpload_1.RealYouTubeUploader(settings.youtubeApiKey, settings.youtubeClientId, settings.youtubeClientSecret, settings.youtubeRefreshToken);
    }
    /**
     * Process pending reposts for both platforms with intelligent scheduling
     */
    async processDualPlatformReposts() {
        var _a;
        const results = {
            processed: 0,
            successful: 0,
            failed: 0,
            instagram: { successful: 0, failed: 0 },
            youtube: { successful: 0, failed: 0 },
            errors: []
        };
        try {
            console.log('🚀 Phase 9: Processing dual-platform reposts...');
            // Get settings for platform configuration
            const settings = this.loadSettings();
            const phase9Settings = settings.phase9Settings || {};
            // Process Instagram reposts
            if (phase9Settings.enableInstagramReposts !== false) {
                const instagramResults = await this.processInstagramReposts();
                results.instagram = instagramResults;
                results.processed += instagramResults.successful + instagramResults.failed;
                results.successful += instagramResults.successful;
                results.failed += instagramResults.failed;
            }
            // Process YouTube reposts
            if (phase9Settings.enableYouTubeReposts !== false) {
                const youtubeResults = await this.processYouTubeReposts();
                results.youtube = youtubeResults;
                results.processed += youtubeResults.successful + youtubeResults.failed;
                results.successful += youtubeResults.successful;
                results.failed += youtubeResults.failed;
            }
            // Refresh content data after processing
            if ((_a = phase9Settings.contentRefresh) === null || _a === void 0 ? void 0 : _a.refreshAfterPost) {
                await this.refreshContentData();
            }
            console.log(`✅ Dual-platform processing complete: ${results.successful}/${results.processed} successful`);
            return results;
        }
        catch (error) {
            console.error('❌ Dual-platform repost processing failed:', error);
            results.errors.push(error instanceof Error ? error.message : 'Unknown error');
            return results;
        }
    }
    /**
     * Process Instagram reposts with enhanced caption rewriting
     */
    async processInstagramReposts() {
        const results = { successful: 0, failed: 0 };
        try {
            console.log('📱 Processing Instagram reposts...');
            // Get pending Instagram reposts
            const pendingReposts = await RepostQueue_1.RepostQueue.find({
                targetPlatform: 'instagram',
                status: 'queued',
                scheduledFor: { $lte: new Date() }
            })
                .sort({ priority: 1 })
                .limit(4); // Max 4 per platform per day
            console.log(`📱 Found ${pendingReposts.length} Instagram reposts ready for processing`);
            for (const repost of pendingReposts) {
                try {
                    // Mark as processing
                    repost.status = 'processing';
                    await repost.save();
                    // Get original Instagram content
                    const originalContent = await InstagramContent_1.InstagramArchive.findOne({ videoId: repost.sourceMediaId });
                    if (!originalContent) {
                        throw new Error('Original content not found');
                    }
                    // Download video from Instagram
                    const videoPath = await this.downloadInstagramVideo(originalContent.media_url, repost.sourceMediaId);
                    // Generate optimized Instagram caption (no dashes, new hook)
                    const optimizedCaption = await this.generateInstagramCaption(originalContent);
                    // Get fresh trending hashtags
                    const trendingHashtags = await this.getFreshInstagramHashtags();
                    // Match trending audio
                    const audioMatch = await this.matchInstagramAudio(videoPath);
                    // Post to Instagram
                    const postResult = await this.postToInstagram(videoPath, optimizedCaption, trendingHashtags, audioMatch);
                    if (postResult.success) {
                        // Sync to Dropbox
                        await this.syncToDropbox(videoPath, originalContent, optimizedCaption);
                        // Update repost queue
                        repost.status = 'completed';
                        repost.repostVideoId = postResult.mediaId;
                        repost.repostContent = {
                            newCaption: optimizedCaption.finalCaption,
                            newHashtags: trendingHashtags,
                            audioTrackId: audioMatch === null || audioMatch === void 0 ? void 0 : audioMatch.audioId,
                            optimizedForPlatform: 'instagram'
                        };
                        await repost.save();
                        // Update original content
                        originalContent.reposted = true;
                        originalContent.lastRepostDate = new Date();
                        originalContent.repostCount += 1;
                        await originalContent.save();
                        results.successful++;
                        console.log(`✅ Instagram repost successful: ${repost.sourceMediaId}`);
                    }
                    else {
                        throw new Error(postResult.error || 'Instagram post failed');
                    }
                }
                catch (error) {
                    console.error(`❌ Instagram repost failed for ${repost.sourceMediaId}:`, error);
                    repost.status = 'failed';
                    repost.errorMessage = error instanceof Error ? error.message : 'Unknown error';
                    await repost.save();
                    results.failed++;
                }
            }
        }
        catch (error) {
            console.error('❌ Instagram repost processing error:', error);
        }
        return results;
    }
    /**
     * Process YouTube reposts with enhanced optimization
     */
    async processYouTubeReposts() {
        const results = { successful: 0, failed: 0 };
        try {
            console.log('📺 Processing YouTube reposts...');
            // Get pending YouTube reposts
            const pendingReposts = await RepostQueue_1.RepostQueue.find({
                targetPlatform: 'youtube',
                status: 'queued',
                scheduledFor: { $lte: new Date() }
            })
                .sort({ priority: 1 })
                .limit(4); // Max 4 per platform per day
            console.log(`📺 Found ${pendingReposts.length} YouTube reposts ready for processing`);
            for (const repost of pendingReposts) {
                try {
                    // Mark as processing
                    repost.status = 'processing';
                    await repost.save();
                    // Get original Instagram content
                    const originalContent = await InstagramContent_1.InstagramArchive.findOne({ videoId: repost.sourceMediaId });
                    if (!originalContent) {
                        throw new Error('Original content not found');
                    }
                    // Download video from Instagram
                    const videoPath = await this.downloadInstagramVideo(originalContent.media_url, repost.sourceMediaId);
                    // Generate optimized YouTube caption with keywords and emojis
                    const optimizedCaption = await this.generateYouTubeCaption(originalContent);
                    // Get fresh trending YouTube hashtags (limit to 15)
                    const trendingHashtags = await this.getFreshYouTubeHashtags();
                    // Match trending YouTube audio
                    const audioMatch = await this.matchYouTubeAudio(videoPath);
                    // Upload to YouTube
                    const uploadResult = await this.uploadToYouTube(videoPath, optimizedCaption, trendingHashtags, audioMatch);
                    if (uploadResult.success) {
                        // Sync to Dropbox
                        await this.syncToDropbox(videoPath, originalContent, optimizedCaption);
                        // Update repost queue
                        repost.status = 'completed';
                        repost.repostVideoId = uploadResult.videoId;
                        repost.repostContent = {
                            newCaption: optimizedCaption.finalCaption,
                            newHashtags: trendingHashtags,
                            audioTrackId: audioMatch === null || audioMatch === void 0 ? void 0 : audioMatch.audioId,
                            optimizedForPlatform: 'youtube'
                        };
                        await repost.save();
                        // Update original content
                        originalContent.reposted = true;
                        originalContent.lastRepostDate = new Date();
                        originalContent.repostCount += 1;
                        await originalContent.save();
                        results.successful++;
                        console.log(`✅ YouTube repost successful: ${repost.sourceMediaId} -> ${uploadResult.videoId}`);
                    }
                    else {
                        throw new Error(uploadResult.error || 'YouTube upload failed');
                    }
                }
                catch (error) {
                    console.error(`❌ YouTube repost failed for ${repost.sourceMediaId}:`, error);
                    repost.status = 'failed';
                    repost.errorMessage = error instanceof Error ? error.message : 'Unknown error';
                    await repost.save();
                    results.failed++;
                }
            }
        }
        catch (error) {
            console.error('❌ YouTube repost processing error:', error);
        }
        return results;
    }
    /**
     * Download Instagram video to local storage
     */
    async downloadInstagramVideo(mediaUrl, mediaId) {
        try {
            console.log(`📥 Downloading Instagram video: ${mediaId}`);
            // Download original video
            const response = await axios_1.default.get(mediaUrl, { responseType: 'arraybuffer' });
            const originalBuffer = Buffer.from(response.data);
            console.log(`💾 Phase 9: Saving original video (no enhancement) for ${mediaId}...`);
            // Save original video without enhancement
            const fileName = `original_${mediaId}_${Date.now()}.mp4`;
            const filePath = path.join(this.uploadsDir, fileName);
            fs.writeFileSync(filePath, originalBuffer);
            console.log(`💾 Original video saved: ${fileName}`);
            return filePath;
        }
        catch (error) {
            console.error(`❌ Failed to download and enhance video ${mediaId}:`, error);
            // Fallback: try to download without enhancement
            try {
                console.log(`🔄 Attempting fallback download without enhancement...`);
                const response = await axios_1.default.get(mediaUrl, { responseType: 'stream' });
                const fileName = `fallback_${mediaId}_${Date.now()}.mp4`;
                const filePath = path.join(this.uploadsDir, fileName);
                const writer = fs.createWriteStream(filePath);
                response.data.pipe(writer);
                return new Promise((resolve, reject) => {
                    writer.on('finish', () => {
                        console.log(`⚠️ Using fallback video without enhancement: ${fileName}`);
                        resolve(filePath);
                    });
                    writer.on('error', reject);
                });
            }
            catch (fallbackError) {
                console.error(`❌ Fallback download also failed:`, fallbackError);
                throw fallbackError;
            }
        }
    }
    /**
     * Generate optimized Instagram caption using SMART FEATURES
     */
    async generateInstagramCaption(originalContent) {
        try {
            console.log('🧠 Phase 9: Using SMART caption generation with competitor analysis...');
            const settings = this.loadSettings();
            const openaiApiKey = settings.openaiApiKey;
            if (!openaiApiKey) {
                throw new Error('OpenAI API key not configured');
            }
            // 🧠 SMART FEATURE: Use advanced caption generation with competitor patterns
            const { prepareSmartCaption } = require('./prepareSmartCaption');
            const smartCaptionResult = await prepareSmartCaption({
                title: originalContent.caption.split(' ').slice(0, 10).join(' '), // First 10 words as title
                description: originalContent.caption,
                tags: originalContent.hashtags
            }, openaiApiKey, 'instagram');
            // Use the best performing version (versionA is optimized for engagement)
            const smartCaption = smartCaptionResult.versionA;
            // 🧠 SMART FEATURE: Get trending hashtags instead of reusing old ones
            const { analyzeTopHashtags } = require('./analyzeTopHashtags');
            const trendingHashtags = await this.getSmartHashtags();
            // Ensure no dashes in smart-generated content
            const finalCaption = smartCaption.description.replace(/-/g, ',').replace(/,,/g, ',');
            console.log('✅ Smart caption generated with competitor patterns and trending hashtags');
            return {
                finalCaption,
                hashtags: trendingHashtags.slice(0, 30) // Instagram allows up to 30 hashtags
            };
        }
        catch (error) {
            console.error('❌ Smart caption generation failed, using fallback:', error);
            console.log('🔄 Using fallback caption with dash removal...');
            // PHASE 9 FALLBACK: Remove dashes even when smart features fail
            const fallbackCaption = originalContent.caption.replace(/-/g, ',').replace(/,,/g, ',');
            return {
                finalCaption: fallbackCaption,
                hashtags: originalContent.hashtags
            };
        }
    }
    /**
     * Generate optimized YouTube caption using SMART FEATURES
     */
    async generateYouTubeCaption(originalContent) {
        try {
            console.log('🧠 Phase 9: Using SMART YouTube caption with SEO keywords and competitor analysis...');
            const settings = this.loadSettings();
            const openaiApiKey = settings.openaiApiKey;
            if (!openaiApiKey) {
                throw new Error('OpenAI API key not configured');
            }
            // 🧠 SMART FEATURE: Use advanced caption generation optimized for YouTube
            const { prepareSmartCaption } = require('./prepareSmartCaption');
            const smartCaptionResult = await prepareSmartCaption({
                title: originalContent.caption.split(' ').slice(0, 10).join(' '), // First 10 words as title
                description: originalContent.caption,
                tags: originalContent.hashtags
            }, openaiApiKey, 'youtube');
            // Use versionB for YouTube (informational/educational tone performs better)
            const smartCaption = smartCaptionResult.versionB;
            // 🧠 SMART FEATURE: Get YouTube-specific trending hashtags (limit to 15 for YouTube)
            const trendingHashtags = await this.getSmartHashtags('youtube');
            // Ensure no dashes in smart-generated content
            const finalCaption = smartCaption.description.replace(/-/g, ',').replace(/,,/g, ',');
            console.log('✅ Smart YouTube caption generated with SEO keywords and trending hashtags');
            return {
                finalCaption,
                hashtags: trendingHashtags.slice(0, 15) // YouTube performs better with fewer, targeted hashtags
            };
        }
        catch (error) {
            console.error('❌ Smart YouTube caption generation failed, using fallback:', error);
            console.log('🔄 Using fallback caption with dash removal...');
            // PHASE 9 FALLBACK: Remove dashes even when smart features fail
            const fallbackCaption = originalContent.caption.replace(/-/g, ',').replace(/,,/g, ',');
            return {
                finalCaption: fallbackCaption,
                hashtags: originalContent.hashtags
            };
        }
    }
    /**
     * Get SMART trending hashtags using advanced analytics
     */
    async getSmartHashtags(platform = 'instagram') {
        try {
            console.log(`🧠 Getting smart ${platform} hashtags using performance analytics...`);
            // Use different models based on platform
            if (platform === 'youtube') {
                // 🧠 SMART FEATURE: Use YouTube insights for hashtag analysis
                const { default: YouTubeInsight } = require('../../models/YouTubeInsight');
                const trendingHashtags = await YouTubeInsight.find({
                    metricType: 'hashtag',
                    totalViews: { $gt: 10000 } // Only hashtags with good performance
                })
                    .sort({ totalViews: -1, avgEngagement: -1 })
                    .limit(15) // YouTube works better with fewer, targeted hashtags
                    .select('hashtag totalViews');
                if (trendingHashtags.length > 0) {
                    const hashtags = trendingHashtags.map((item) => item.hashtag.startsWith('#') ? item.hashtag : `#${item.hashtag}`);
                    console.log(`📺 Using ${hashtags.length} smart YouTube hashtags (avg views: ${Math.round(trendingHashtags.reduce((sum, item) => sum + item.totalViews, 0) / trendingHashtags.length)})`);
                    return hashtags;
                }
            }
            else {
                // 🧠 SMART FEATURE: Use Instagram performance data
                const { default: TopHashtags } = require('../../models/TopHashtags');
                const trendingHashtags = await TopHashtags.find({
                    platform: 'instagram',
                    avgPerformanceScore: { $gt: 500 } // Only high-performing hashtags
                })
                    .sort({ avgPerformanceScore: -1, appearances: -1 })
                    .limit(30) // Instagram allows more hashtags
                    .select('hashtag avgPerformanceScore appearances');
                if (trendingHashtags.length > 0) {
                    const hashtags = trendingHashtags.map((item) => item.hashtag.startsWith('#') ? item.hashtag : `#${item.hashtag}`);
                    console.log(`📱 Using ${hashtags.length} smart Instagram hashtags (avg score: ${Math.round(trendingHashtags.reduce((sum, item) => sum + item.avgPerformanceScore, 0) / trendingHashtags.length)})`);
                    return hashtags;
                }
            }
            // Fallback to previous method if smart features fail
            return await this.getFreshInstagramHashtags();
        }
        catch (error) {
            console.error('❌ Smart hashtag analysis failed, using fallback:', error);
            return await this.getFreshInstagramHashtags();
        }
    }
    /**
     * Get fresh trending Instagram hashtags (fallback method)
     */
    async getFreshInstagramHashtags() {
        try {
            const { default: TopHashtags } = require('../../models/TopHashtags');
            // Get top 30 Instagram hashtags from database
            const trendingHashtags = await TopHashtags.find({ platform: 'instagram' })
                .sort({ avgPerformanceScore: -1 })
                .limit(30)
                .select('hashtag');
            if (trendingHashtags.length > 0) {
                const hashtags = trendingHashtags.map((item) => item.hashtag.startsWith('#') ? item.hashtag : `#${item.hashtag}`);
                console.log(`📱 Using ${hashtags.length} trending Instagram hashtags`);
                return hashtags;
            }
            // Fallback to default high-performance hashtags
            const defaultHashtags = [
                '#realestate', '#texas', '#lifestyledesignrealty', '#luxury', '#homes',
                '#property', '#investment', '#dreamhome', '#homebuying', '#realtor',
                '#househunting', '#newlisting', '#sold', '#justlisted', '#homesweethome',
                '#luxuryhomes', '#texasrealestate', '#realty', '#broker', '#agent',
                '#modernhomes', '#architecture', '#housegoals', '#propertyinvestment', '#forsale',
                '#openhouse', '#realestatelife', '#luxurylifestyle', '#lifestyle', '#design'
            ];
            console.log(`📱 Using ${defaultHashtags.length} default Instagram hashtags`);
            return defaultHashtags;
        }
        catch (error) {
            console.error('❌ Failed to get Instagram hashtags:', error);
            return ['#realestate', '#texas', '#lifestyledesignrealty', '#luxury', '#homes'];
        }
    }
    /**
     * Get fresh trending YouTube hashtags (limit to 15)
     */
    async getFreshYouTubeHashtags() {
        try {
            const { TopHashtags } = require('../../models/TopHashtags');
            // Get top 15 YouTube hashtags from database
            const trendingHashtags = await TopHashtags.find({ platform: 'youtube' })
                .sort({ avgPerformanceScore: -1 })
                .limit(15)
                .select('hashtag');
            if (trendingHashtags.length > 0) {
                const hashtags = trendingHashtags.map((item) => item.hashtag.startsWith('#') ? item.hashtag : `#${item.hashtag}`);
                console.log(`📺 Using ${hashtags.length} trending YouTube hashtags`);
                return hashtags;
            }
            // Fallback to default high-performance YouTube hashtags (max 15)
            const defaultHashtags = [
                '#realestate', '#texas', '#lifestyledesignrealty', '#shorts', '#luxury',
                '#property', '#homes', '#investment', '#realtor', '#househunting',
                '#luxuryhomes', '#texasrealestate', '#broker', '#dreamhome', '#lifestyle'
            ];
            console.log(`📺 Using ${defaultHashtags.length} default YouTube hashtags`);
            return defaultHashtags;
        }
        catch (error) {
            console.error('❌ Failed to get YouTube hashtags:', error);
            return ['#realestate', '#texas', '#lifestyledesignrealty', '#shorts', '#luxury'];
        }
    }
    /**
     * Match trending Instagram audio using SMART AUDIO MATCHING
     */
    async matchInstagramAudio(videoPath) {
        var _a, _b;
        try {
            console.log('🧠 Phase 9: Using SMART audio matching for Instagram...');
            // 🧠 SMART FEATURE: Use advanced audio matching service
            const videoId = path.basename(videoPath, '.mp4');
            // Use Phase 3 audio matching directly since VideoId won't be in database for reposts
            const audioMatch = await (0, matchAudioToVideo_1.matchAudioToVideo)(videoPath, 'instagram');
            if (audioMatch && audioMatch.audioTrackId) {
                console.log(`✅ Smart Instagram audio matched: "${((_a = audioMatch.audioTrack) === null || _a === void 0 ? void 0 : _a.title) || 'Default Track'}"`);
                return {
                    audioId: audioMatch.audioTrackId,
                    trackName: ((_b = audioMatch.audioTrack) === null || _b === void 0 ? void 0 : _b.title) || 'Default Track'
                };
            }
            // If no audio match found, return null
            console.log('🔄 No Instagram audio match found');
            return null;
        }
        catch (error) {
            console.error('❌ Smart Instagram audio matching failed:', error);
            return null;
        }
    }
    /**
     * Match trending YouTube audio using SMART AUDIO MATCHING
     */
    async matchYouTubeAudio(videoPath) {
        var _a, _b;
        try {
            console.log('🧠 Phase 9: Using SMART audio matching for YouTube...');
            // 🧠 SMART FEATURE: Use advanced audio matching service
            const videoId = path.basename(videoPath, '.mp4');
            // Use Phase 3 audio matching directly since VideoId won't be in database for reposts
            const audioMatch = await (0, matchAudioToVideo_1.matchAudioToVideo)(videoPath, 'youtube');
            if (audioMatch && audioMatch.audioTrackId) {
                console.log(`✅ Smart YouTube audio matched: "${((_a = audioMatch.audioTrack) === null || _a === void 0 ? void 0 : _a.title) || 'Default Track'}"`);
                return {
                    audioId: audioMatch.audioTrackId,
                    trackName: ((_b = audioMatch.audioTrack) === null || _b === void 0 ? void 0 : _b.title) || 'Default Track'
                };
            }
            // If no audio match found, return null
            console.log('🔄 No YouTube audio match found');
            return null;
        }
        catch (error) {
            console.error('❌ Smart YouTube audio matching failed:', error);
            return null;
        }
    }
    /**
     * Post to Instagram with optimized content
     */
    async postToInstagram(videoPath, caption, hashtags, audioMatch) {
        try {
            const settings = this.loadSettings();
            const accessToken = settings.instagramAccessToken;
            const businessId = settings.instagramBusinessId;
            if (!accessToken || !businessId) {
                throw new Error('Instagram credentials not configured');
            }
            console.log('📱 Phase 9: Posting VIDEO to Instagram (not image)');
            // PHASE 9 FIX: Upload video file to get a media container for video content
            const form = new FormData();
            form.append('video', fs.createReadStream(videoPath));
            form.append('caption', `${caption.finalCaption}\n\n${hashtags.join(' ')}`);
            form.append('media_type', 'REELS'); // Ensure it's treated as a video reel
            form.append('access_token', accessToken);
            // Upload video directly to Instagram API
            const uploadResponse = await axios_1.default.post(`https://graph.facebook.com/v18.0/${businessId}/media`, form, {
                headers: {
                    ...form.getHeaders(),
                    'Content-Type': 'multipart/form-data'
                },
                maxContentLength: Infinity,
                maxBodyLength: Infinity,
                timeout: 120000 // 2 minutes timeout for video upload
            });
            const containerId = uploadResponse.data.id;
            console.log(`📱 Video container created: ${containerId}`);
            // Wait for video processing
            console.log('⏳ Waiting for Instagram video processing...');
            await this.delay(5000); // 5 second delay for video processing
            // Publish the video
            const publishResponse = await axios_1.default.post(`https://graph.facebook.com/v18.0/${businessId}/media_publish`, {
                creation_id: containerId,
                access_token: accessToken
            });
            console.log('✅ VIDEO successfully posted to Instagram!');
            return {
                success: true,
                mediaId: publishResponse.data.id
            };
        }
        catch (error) {
            console.error('❌ Instagram VIDEO posting failed:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }
    /**
     * Upload to YouTube with optimized content
     */
    async uploadToYouTube(videoPath, caption, hashtags, audioMatch) {
        try {
            const title = `🏡 Lifestyle Design Realty | ${new Date().toLocaleDateString()} | Real Estate Excellence`;
            const description = `${caption.finalCaption}\n\n${hashtags.join(' ')}\n\nGenerated via Phase 9 Intelligent Content System`;
            const uploader = this.createYouTubeUploader();
            const uploadResult = await uploader.uploadVideo({
                videoPath,
                title,
                description,
                tags: hashtags,
                categoryId: '26', // Howto & Style
                privacy: 'public'
            });
            return {
                success: uploadResult.success,
                videoId: uploadResult.videoId,
                error: uploadResult.error
            };
        }
        catch (error) {
            console.error('❌ YouTube upload failed:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }
    /**
     * Sync video to Dropbox with proper naming
     */
    async syncToDropbox(videoPath, originalContent, caption) {
        var _a;
        try {
            const settings = this.loadSettings();
            const dropboxSettings = (_a = settings.phase9Settings) === null || _a === void 0 ? void 0 : _a.dropboxSync;
            if (!(dropboxSettings === null || dropboxSettings === void 0 ? void 0 : dropboxSettings.enabled) || !this.dropboxService) {
                return;
            }
            // Generate Phase 9 filename format: YYYY-MM-DD__IGRepost__{captionSnippetSanitized}.mp4
            const date = new Date().toISOString().split('T')[0];
            const captionSnippet = caption.finalCaption.substring(0, 30)
                .replace(/[^a-zA-Z0-9\s]/g, '') // Remove special chars but keep spaces
                .replace(/\s+/g, '_') // Replace spaces with underscores
                .toLowerCase();
            const fileName = `${date}__IGRepost__${captionSnippet}.mp4`;
            const syncPath = dropboxSettings.syncPath || '/SyncedInstagramPosts/';
            const dropboxPath = `${syncPath}${fileName}`;
            // Check for duplicates if enabled
            if (dropboxSettings.preventDuplicates && originalContent.dropboxSynced) {
                console.log(`⏭️ Skipping Dropbox sync for ${originalContent.videoId} (already synced)`);
                return;
            }
            const syncResult = await this.dropboxService.uploadFile(videoPath, dropboxPath);
            if (syncResult.success) {
                originalContent.dropboxSynced = true;
                originalContent.dropboxPath = dropboxPath;
                await originalContent.save();
                console.log(`✅ Synced to Dropbox: ${dropboxPath}`);
            }
            else {
                console.error(`❌ Dropbox sync failed: ${syncResult.error}`);
            }
        }
        catch (error) {
            console.error('❌ Dropbox sync error:', error);
        }
    }
    /**
     * Refresh content data after posting (audio, hashtags, descriptions)
     */
    async refreshContentData() {
        var _a;
        try {
            console.log('🔄 Refreshing content data...');
            const settings = this.loadSettings();
            const refreshSettings = (_a = settings.phase9Settings) === null || _a === void 0 ? void 0 : _a.contentRefresh;
            if (!(refreshSettings === null || refreshSettings === void 0 ? void 0 : refreshSettings.enabled)) {
                return;
            }
            // Refresh trending audio data
            if (refreshSettings.refreshAudio) {
                await (0, fetchTrendingAudio_1.fetchTrendingAudio)();
                console.log('✅ Audio data refreshed');
            }
            // Refresh hashtag data
            if (refreshSettings.refreshHashtags) {
                await (0, analyzeTopHashtags_1.analyzeTopHashtags)();
                console.log('✅ Hashtag data refreshed');
            }
            // Refresh peak hours data
            if (refreshSettings.refreshDescriptions) {
                await (0, analyzePeakHours_1.analyzePeakHours)();
                console.log('✅ Peak hours data refreshed');
            }
            console.log('✅ Content data refresh complete');
        }
        catch (error) {
            console.error('❌ Content refresh failed:', error);
        }
    }
    /**
     * Load settings from file
     */
    loadSettings() {
        try {
            const settingsData = fs.readFileSync(this.settingsPath, 'utf8');
            return JSON.parse(settingsData);
        }
        catch (error) {
            console.error('❌ Failed to load settings:', error);
            return {};
        }
    }
    /**
     * Utility delay function for rate limiting
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    /**
     * Get dual-platform repost statistics
     */
    async getDualPlatformStats() {
        try {
            const totalQueued = await RepostQueue_1.RepostQueue.countDocuments({ status: 'queued' });
            const instagramQueued = await RepostQueue_1.RepostQueue.countDocuments({ targetPlatform: 'instagram', status: 'queued' });
            const youtubeQueued = await RepostQueue_1.RepostQueue.countDocuments({ targetPlatform: 'youtube', status: 'queued' });
            const totalProcessed = await RepostQueue_1.RepostQueue.countDocuments({ status: { $in: ['completed', 'failed'] } });
            const totalSuccessful = await RepostQueue_1.RepostQueue.countDocuments({ status: 'completed' });
            const totalFailed = await RepostQueue_1.RepostQueue.countDocuments({ status: 'failed' });
            const nextScheduled = await RepostQueue_1.RepostQueue.findOne({ status: 'queued' })
                .sort({ scheduledFor: 1 })
                .select('scheduledFor');
            return {
                totalQueued,
                instagramQueued,
                youtubeQueued,
                totalProcessed,
                totalSuccessful,
                totalFailed,
                nextScheduled: nextScheduled === null || nextScheduled === void 0 ? void 0 : nextScheduled.scheduledFor
            };
        }
        catch (error) {
            console.error('❌ Error getting dual-platform stats:', error);
            return {
                totalQueued: 0,
                instagramQueued: 0,
                youtubeQueued: 0,
                totalProcessed: 0,
                totalSuccessful: 0,
                totalFailed: 0
            };
        }
    }
}
exports.Phase9DualPlatformReposter = Phase9DualPlatformReposter;
